// Complaint to ticket: a hot signal cluster becomes a tracked ticket with its
// own evidence room and an automatic investigation of the affected product
// URL. The work order flow stays for planned multi step responses; this is
// the straight line from "customers are shouting" to ticket, evidence, fix,
// proof.
import { NextResponse } from "next/server";
import { fileTicketAndInvestigate } from "@/lib/tickets";
import { identity, scopeUid } from "@/lib/who";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { theme, samples, size, angryShare, targetUrl } = (await req.json().catch(() => ({}))) as {
    theme?: string; samples?: string[]; size?: number; angryShare?: number; targetUrl?: string;
  };
  const url = String(targetUrl ?? "").trim();
  if (!theme?.trim() || !url) {
    return NextResponse.json({ error: "theme and the product URL where it happens are required" }, { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "targetUrl must be a valid URL" }, { status: 400 });
  }
  const quotes = (samples ?? []).slice(0, 8).map((s) => `“${s}”`).join("\n");
  const body = [
    `Live signals cluster: ${size ?? "?"} messages, ${Math.round((angryShare ?? 0) * 100)}% negative.`,
    quotes ? `What customers said:\n${quotes}` : "",
    "Filed from Live signals so the theme is investigated like any other ticket: evidence first, then a fix, then proof.",
  ].filter(Boolean).join("\n\n");
  const ownerUid = scopeUid(await identity(req));
  const { ticket, runId } = await fileTicketAndInvestigate({
    subject: `Customer theme: ${theme.trim()}`.slice(0, 140),
    body: body.slice(0, 2000),
    targetUrl: url,
    ownerUid,
  });
  return NextResponse.json({ id: ticket.id, runId }, { status: 201 });
}
