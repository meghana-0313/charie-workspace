import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { checkInvite } from "@/lib/auth";
import { GuestLobby } from "@/components/guest";

export const dynamic = "force-dynamic";

export default async function GuestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const { token } = await searchParams;
  const room = await store.getMeetRoom(id);
  if (!room || !checkInvite(id, token)) notFound();
  if (room.endedAt) {
    return (
      <div className="login-wrap">
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-title">Meeting ended</div>
          <p className="muted small">The host ended &ldquo;{room.title}&rdquo; for everyone. Thanks for joining; you can close this tab.</p>
        </div>
      </div>
    );
  }
  return <GuestLobby roomId={room.id} roomTitle={room.title} token={token ?? ""} />;
}
