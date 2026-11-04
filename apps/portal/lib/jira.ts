// Jira Cloud REST client (basic auth: email + API token).
// Pull issues in, comment and transition back out. Null/false on any failure.

export interface JiraIssue {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  issuetype: string;
}

function base(domain: string): string {
  return `https://${domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
}

function headers(email: string, token: string): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
    "user-agent": "charie-portal",
  };
}

function textFromAdf(node: unknown): string {
  // Description/comment bodies arrive as Atlassian Document Format. Flatten text.
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.text === "string") out.push(o.text);
    if (Array.isArray(o.content)) for (const c of o.content) walk(c);
  };
  walk(node);
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function adf(text: string): unknown {
  return {
    version: 1,
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export interface JiraCreds {
  domain: string;
  email: string;
  token: string;
}

export async function jiraTest(c: JiraCreds): Promise<string | null> {
  try {
    const res = await fetch(`${base(c.domain)}/rest/api/3/myself`, {
      headers: headers(c.email, c.token),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { displayName?: string }).displayName ?? "ok";
  } catch {
    return null;
  }
}

export async function jiraSearch(c: JiraCreds, jql: string, max = 25): Promise<JiraIssue[] | null> {
  try {
    const res = await fetch(`${base(c.domain)}/rest/api/3/search/jql`, {
      method: "POST",
      headers: headers(c.email, c.token),
      body: JSON.stringify({ jql, maxResults: Math.min(Math.max(max, 1), 50), fields: ["summary", "description", "status", "priority", "issuetype"] }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { issues?: Array<{ key?: string; fields?: Record<string, unknown> }> };
    return (j.issues ?? []).map((i) => {
      const f = i.fields ?? {};
      const flat = (v: unknown) => (v && typeof v === "object" ? String((v as Record<string, unknown>).name ?? "") : "");
      return {
        key: String(i.key ?? ""),
        summary: String(f.summary ?? ""),
        description: typeof f.description === "string" ? f.description : textFromAdf(f.description),
        status: flat(f.status),
        priority: flat(f.priority),
        issuetype: flat(f.issuetype),
      };
    }).filter((i) => i.key && i.summary);
  } catch {
    return null;
  }
}

export async function jiraComment(c: JiraCreds, key: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${base(c.domain)}/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
      method: "POST",
      headers: headers(c.email, c.token),
      body: JSON.stringify({ body: adf(text.slice(0, 3000)) }),
      signal: AbortSignal.timeout(20000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function jiraTransitions(c: JiraCreds, key: string): Promise<Array<{ id: string; name: string }> | null> {
  try {
    const res = await fetch(`${base(c.domain)}/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
      headers: headers(c.email, c.token),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { transitions?: Array<{ id?: string; name?: string }> };
    return (j.transitions ?? []).map((t) => ({ id: String(t.id ?? ""), name: String(t.name ?? "") })).filter((t) => t.id);
  } catch {
    return null;
  }
}

export async function jiraTransition(c: JiraCreds, key: string, transitionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${base(c.domain)}/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
      method: "POST",
      headers: headers(c.email, c.token),
      body: JSON.stringify({ transition: { id: transitionId } }),
      signal: AbortSignal.timeout(20000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
