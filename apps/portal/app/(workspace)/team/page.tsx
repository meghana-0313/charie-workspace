import { store } from "@/lib/store";
import { identity, isAdmin, scopeUid } from "@/lib/who";
import { ApiKeyForm, ApiKeyRow, SeatForm, SeatRow } from "@/components/team";
import { EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const admin = await isAdmin(store);
  const myUid = scopeUid(await identity());
  const seats = admin ? await store.listSeats() : [];
  const keys = admin ? await store.listApiKeys(myUid) : [];
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/team", "Team"]]}
        title="Team"
        sub="Google seats for teammates. Invite by email; invited people sign in with Google and land in their own account."
      />
      {!admin ? (
        <div className="card">
          <EmptyState title="Admins only" body="Ask a workspace admin to manage seats." />
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Invite a teammate</div>
            <SeatForm />
          </div>
          <div className="card">
            <div className="card-title">Seats ({seats.length})</div>
            {seats.length === 0 ? (
              <EmptyState title="No seats yet" body="Invite above. Teammates sign in with Google and link automatically." />
            ) : (
              <table>
                <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
                <tbody>
                  {seats.map((s) => (
                    <SeatRow key={s.id} id={s.id} email={s.email} name={s.name} role={s.role} owner={s.owner} linked={Boolean(s.uid)} lastLoginAt={s.lastLoginAt} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-title">App ingest keys</div>
            <p className="muted small">
              Keys let your production apps and SDKs report errors to Charie. Web apps use the
              drop-in snippet (<code>/charie.js</code>); mobile apps follow <code>docs/MOBILE_SDK.md</code>.
            </p>
            <ApiKeyForm />
            <div className="section-label">Keys ({keys.length})</div>
            {keys.length === 0 ? (
              <EmptyState title="No keys yet" body="Create one above per app." />
            ) : (
              <table>
                <thead><tr><th>Key</th><th>App</th><th>Activity</th><th></th></tr></thead>
                <tbody>
                  {keys.map((k) => (
                    <ApiKeyRow key={k.id} id={k.id} prefix={k.prefix} name={k.name} createdAt={k.createdAt} lastUsedAt={k.lastUsedAt} revoked={k.revoked} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
