// Jira sync: pull issues into Charie tickets (auto-investigated), push
// verification proof back as comments + transitions. Approval gates stay
// human: dispatch and verify happen on the ticket page.

import { store } from "./store";
import { fileTicketAndInvestigate } from "./tickets";
import { jiraComment, jiraSearch, jiraTransition, type JiraCreds } from "./jira";
import type { Connector, SyncRule, Ticket } from "./types";

function creds(c: Connector): JiraCreds | null {
  if (!c.config.domain || !c.config.email || !c.config.token) return null;
  return { domain: c.config.domain, email: c.config.email, token: c.config.token };
}

function jqlFor(rule: SyncRule): string {
  if (rule.jql?.trim()) return rule.jql.trim();
  if (rule.project?.trim()) return `project = ${rule.project.trim()} ORDER BY created DESC`;
  return "ORDER BY created DESC";
}

/** Pull new issues for one rule. Returns a short human status. Never throws. */
export async function pullRule(ruleId: string): Promise<string> {
  try {
    const rule = await store.getSyncRule(ruleId);
    if (!rule) return "rule gone";
    const conn = await store.getConnector(rule.connectorId);
    if (!conn || conn.kind !== "jira") return "connector gone";
    const c = creds(conn);
    if (!c) return "connector has no credentials";
    const issues = await jiraSearch(c, jqlFor(rule));
    if (!issues) {
      await store.saveConnector({ ...conn, status: "error", detail: "jira search failed", updatedAt: new Date().toISOString() });
      return "jira search failed";
    }
    const seen = new Set(rule.importedKeys ?? []);
    const fresh = issues.filter((i) => !seen.has(i.key)).slice(0, 10);
    for (const issue of fresh) {
      const subject = `[${issue.key}] ${issue.summary}`.slice(0, 140);
      const body = [
        `Jira ${issue.key} (${issue.issuetype}, ${issue.priority}, status ${issue.status}).`,
        issue.description.slice(0, 800),
      ].join("\n");
      await fileTicketAndInvestigate({
        subject, body, targetUrl: rule.targetUrl,
        sourceRepo: `jira:${issue.key}`, ownerUid: rule.uid,
      }).catch(() => null);
      seen.add(issue.key);
    }
    const at = new Date().toISOString();
    await store.saveSyncRule({ ...rule, importedKeys: [...seen].slice(-200), lastRunAt: at, lastStatus: `${fresh.length} new of ${issues.length}`, updatedAt: at });
    await store.saveConnector({ ...conn, status: "connected", detail: undefined, lastSyncAt: at, lastSyncStatus: `${fresh.length} new`, updatedAt: at });
    return `${fresh.length} new of ${issues.length}`;
  } catch (e) {
    return `error: ${(e as Error).message.slice(0, 120)}`;
  }
}

/** Push verification proof back to Jira. Fire-and-forget from verify flows. */
export async function syncVerifyToJira(ticket: Ticket): Promise<void> {
  try {
    if (!ticket.sourceRepo?.startsWith("jira:")) return;
    const key = ticket.sourceRepo.slice("jira:".length);
    if (!key) return;
    const conns = await store.listConnectors(ticket.uid);
    const conn = conns.find((c) => c.kind === "jira" && c.status === "connected");
    if (!conn) return;
    const c = creds(conn);
    if (!c) return;
    const base = (process.env.PORTAL_PUBLIC_URL ?? "").replace(/\/$/, "");
    const room = ticket.roomId ? await store.getRoom(ticket.roomId) : null;
    const runs = room?.runIds.length ?? 0;
    const ok = await jiraComment(
      c, key,
      `Charie verified the fix for "${ticket.subject}" (${runs} runs, before/after diff on the ticket).${base ? ` Evidence: ${base}/tickets/${ticket.id}` : ""}`,
    );
    if (!ok) return;
    const rules = await store.listSyncRules(ticket.uid);
    const rule = rules.find((r) => r.connectorId === conn.id && r.doneTransitionId);
    if (rule?.doneTransitionId) {
      await jiraTransition(c, key, rule.doneTransitionId).catch(() => false);
    }
    await store.saveConnector({ ...conn, lastSyncAt: new Date().toISOString(), lastSyncStatus: `verified ${key}`, updatedAt: new Date().toISOString() });
  } catch {
    /* sync-back is best effort */
  }
}
