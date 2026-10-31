// Design-system primitives. Server components; styling lives in globals.css.

import Link from "next/link";

export function PageHead({ crumbs, title, sub, actions }: {
  crumbs?: Array<[string, string]>;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      {crumbs && crumbs.length > 0 && (
        <div className="page-crumbs">
          {crumbs.map(([href, label], i) => (
            <span key={href}>
              {i > 0 && " / "}
              <Link href={href}>{label}</Link>
            </span>
          ))}
        </div>
      )}
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`badge${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {body && <div className="small">{body}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

export function Stat({ num, label }: { num: React.ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat-num">{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Timeline({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="muted small">No timeline entries.</p>;
  return (
    <ul className="timeline">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
