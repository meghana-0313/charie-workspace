import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { identity, scopeUid } from "@/lib/who";
import { MeetRoom } from "@/components/meet";
import { PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await store.getMeetRoom(id);
  if (!room) notFound();
  // Ownership: rooms belong to the account that created them; legacy rooms
  // without an owner stay open to any signed in member.
  const myUid = scopeUid(await identity());
  if (room.uid && myUid && room.uid !== myUid) notFound();
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/zoom", "Meet"], [`/guardian/zoom/rooms/${room.id}`, room.title.slice(0, 40)]]}
        title={room.title}
        sub="Media flows peer to peer; the portal only exchanges connection setup."
      />
      <MeetRoom
        roomId={room.id}
        roomTitle={room.title}
        initialEnded={Boolean(room.endedAt)}
        savedTranscript={room.transcript ?? []}
        savedNotes={room.notes ?? []}
        savedSummary={room.summary ?? ""} savedScreenLog={room.screenLog ?? []}
      />
    </>
  );
}
