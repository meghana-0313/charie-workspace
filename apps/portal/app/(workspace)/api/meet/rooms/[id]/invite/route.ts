import { NextResponse } from "next/server";
import { mintInvite } from "@/lib/auth";
import { store } from "@/lib/store";
import { seatName } from "@/lib/who";

// Mint a guest invite link for a room. Logged-in members only; the link
// itself is public for 24h and opens just the guest lobby for this room.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await seatName(req)) === null && process.env.PORTAL_PASSPHRASE) {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }
  const { id: roomId } = await params;
  if (!(await store.getMeetRoom(roomId))) return NextResponse.json({ error: "no such room" }, { status: 404 });
  const base = (process.env.PORTAL_PUBLIC_URL ?? "").replace(/\/$/, "");
  const token = mintInvite(roomId);
  const path = `/meet/guest/${roomId}?token=${encodeURIComponent(token)}`;
  return NextResponse.json({ url: base ? `${base}${path}` : path, expiresInHours: 24 });
}
