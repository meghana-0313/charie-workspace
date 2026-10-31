import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { store } from "@/lib/store";
import { settleBuild, startBuild } from "@/lib/repos";

export const maxDuration = 300;

function sigOk(raw: string, secret: string, sig: string | null): boolean {
  if (!sig || !sig.startsWith("sha256=")) return false;
  const want = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GitHub push webhook (public URL, HMAC-signed per repo). Pushes to the
// tracked branch rebuild, redeploy, and retest without any clicks.
export async function POST(req: Request) {
  const raw = await req.text();
  const event = req.headers.get("x-github-event") ?? "";
  if (event === "ping") return NextResponse.json({ ok: true });
  if (event !== "push") return NextResponse.json({ ignored: event || "no event" });
  let payload: { ref?: string; repository?: { full_name?: string } };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const full = String(payload.repository?.full_name ?? "").toLowerCase();
  const repo = (await store.listRepos()).find((r) => `${r.owner}/${r.repo}`.toLowerCase() === full);
  if (!repo || !repo.webhookSecret) return NextResponse.json({ ignored: "unknown repo" });
  if (!sigOk(raw, repo.webhookSecret, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 403 });
  }
  if (repo.autoTestOnPush === false) return NextResponse.json({ ignored: "autopilot off for repo" });
  if (String(payload.ref ?? "") !== `refs/heads/${repo.branch}`) return NextResponse.json({ ignored: "other branch" });
  if (repo.status === "building") return NextResponse.json({ ignored: "build in flight" });
  let build;
  try {
    build = await startBuild(repo.id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const settled = await settleBuild(build.id).catch(() => null);
  return NextResponse.json({ build: build.id, status: settled?.status ?? "working" });
}
