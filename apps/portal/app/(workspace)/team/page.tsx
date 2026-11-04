import { store } from "@/lib/store";
import { identity, isAdmin, scopeUid } from "@/lib/who";
import { ApiKeyForm, ApiKeyRow, SeatForm, SeatRow } from "@/components/team";
import { Icon } from "@/components/icons";
import { EmptyState, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const admin = await isAdmin(store);
  const myUid = scopeUid(await identity());
  const allSeats = admin ? await store.listSeats() : [];
  // Demo visitors get the full Team surface over sample seats only -
  // the real workspace seat list (emails) is never shown in the sandbox.
  const seats = myUid === "demo-workspace" ? allSeats.filter((s) => s.id.startsWith("demo-")) : allSeats;
  const keys = admin ? await store.listApiKeys(myUid) : [];
  return (
    <>
      <PageHead
        crumbs={[["/", "Home"], ["/team", "Team"]]}
        title={<><span className="icon-orb violet" style={{ width: 38, height: 38 }}><Icon name="users" size={19} /></span> Team</>}
        sub="Seats for teammates. Invite by email; invited people create an account with that email and land in their own data."
      />
      {admin && (
        <div className="stats">
          <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="users" size={20} /></span><div><div className="stat-num">{seats.length}</div><div className="stat-label">Seats</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb green"><Icon name="check" size={20} /></span><div><div className="stat-num">{seats.filter((s) => s.uid).length}</div><div className="stat-label">Linked accounts</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb amber"><Icon name="key" size={20} /></span><div><div className="stat-num">{keys.filter((k) => !k.revoked).length}</div><div className="stat-label">Active app keys</div></div></div></div>
          <div className="stat"><div className="icon-stat"><span className="icon-orb violet"><Icon name="shield" size={20} /></span><div><div className="stat-num">{seats.filter((s) => s.owner).length}</div><div className="stat-label">Owners and admins</div></div></div></div>
        </div>
      )}
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
              <EmptyState title="No seats yet" body="Invite above. Teammates create an account with the invited email and link automatically." />
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
