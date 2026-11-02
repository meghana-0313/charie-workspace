// Stroke-consistent 16px icons. No emoji in the interface.

const P: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  repo: '<path d="M4 4h7l2 2h7v14H4z"/><circle cx="12" cy="13" r="2.5"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  order: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  signal: '<path d="M3 17l4-6 4 3 4-8 4 5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  video: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10l6-3v10l-6-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  ticket: '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/><path d="M14 6v2M14 11v2M14 16v2"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  access: '<circle cx="12" cy="5" r="2"/><path d="M4 9.5h16M12 9.5V14m0 0l-3.5 7M12 14l3.5 7"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  agent: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M9 9.5h.01M15 9.5h.01M9 13h6"/><path d="M12 16v2.5M8.5 21h7"/>',
  chat: '<path d="M4 6h16v10H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
  plug: '<path d="M9 3v6M15 3v6M6 9h12v5a6 6 0 0 1-12 0zM12 20v1"/>',
  users: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/><path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.9c1.7.6 2.7 1.9 3 4.1"/>',
  home: '<path d="M3 11.5L12 4l9 7.5"/><path d="M6 10v10h12V10"/>',
  alert: '<path d="M12 3L2.5 20h19z"/><path d="M12 10v4M12 17.2h.01"/>',
  bolt: '<path d="M13 2L4.5 13.5H11L9.8 22 18.5 10H12z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 3h-15z"/><path d="M10 22a2.2 2.2 0 0 0 4 0"/>',
  code: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  flask: '<path d="M10 3h4M11 3v5.5L5.5 18a2.4 2.4 0 0 0 2.1 3.5h8.8a2.4 2.4 0 0 0 2.1-3.5L13 8.5V3"/><path d="M8 15h8"/>',
  branch: '<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 7.2V16.8M18 9.2c0 4-5 3.6-8 5.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  spark: '<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  send: '<path d="M21 3L10.2 13.8M21 3l-6.8 18-3.4-7.2L3.5 10.4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  phone: '<path d="M5 4h4l1.5 4.5L8 10a12 12 0 0 0 6 6l1.5-2.5L20 15v4a2 2 0 0 1-2.2 2A17 17 0 0 1 3 6.2 2 2 0 0 1 5 4z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
  brain: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10.2h.01M15 10.2h.01M9.5 15.2c1.6 1.1 3.4 1.1 5 0"/>',
  bug: '<ellipse cx="12" cy="13" rx="5" ry="6"/><path d="M12 7V5a3 3 0 0 1 6 0M12 7V5a3 3 0 0 0-6 0"/><path d="M7 11L3.5 9M7.5 15H3M7 17l-3 2.5M17 11l3.5-2M16.5 15H21M17 17l3 2.5M9 10.5h.01M15 10.5h.01"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.5 11.5L20 3M16.5 6.5l3 3M14 9l2.5 2.5"/>',
  arrow: '<path d="M4 12h15M13.5 6L19.5 12l-6 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
};

export function Icon({ name, size = 16 }: { name: keyof typeof P & string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: P[name] ?? '<circle cx="12" cy="12" r="8"/>' }}
    />
  );
}
