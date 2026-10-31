// Shared sub-navigation for the Guardian suite pages.

const LINKS: Array<[string, string]> = [
  ["/guardian", "Incidents"],
  ["/guardian/work", "Work Orders"],
  ["/guardian/signals", "Signals"],
  ["/guardian/night", "Night Shift"],
  ["/guardian/security", "Security"],
  ["/guardian/zoom", "Zoom"],
];

export function SuiteNav({ current }: { current: string }) {
  return (
    <nav className="suite-nav">
      {LINKS.map(([href, label]) => (
        <a key={href} href={href} className={href === current ? "on" : ""}>{label}</a>
      ))}
    </nav>
  );
}
