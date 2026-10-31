import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { MeetRoom } from "@/components/meet";
import { PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MeetRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await store.getMeetRoom(id);
  if (!room) notFound();
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/guardian/zoom", "Meet"], [`/guardian/zoom/rooms/${room.id}`, room.title.slice(0, 40)]]}
        title={room.title}
        sub="Native Charie room. Media flows peer to peer; the portal only exchanges connection setup."
      />
      <MeetRoom roomId={room.id} roomTitle={room.title} />
    </>
  );
}
