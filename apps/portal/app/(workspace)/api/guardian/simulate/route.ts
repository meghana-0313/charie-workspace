import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { seedStuffingAttack } from "@/lib/guardian-seed";

// POST /api/guardian/simulate - seed the demo credential-stuffing attack.
export async function POST() {
  const events = seedStuffingAttack();
  await store.saveEvents(events);
  return NextResponse.json({ saved: events.length, note: "simulated attack window ready - run Analyze now" }, { status: 201 });
}
