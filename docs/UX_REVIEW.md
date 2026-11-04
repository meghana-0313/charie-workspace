# Charie UX review - before and after

Open [ux-review.html](ux-review.html) in a browser. Every fix is shown as a
side-by-side before/after pair at the same width, with the root cause and the
files that changed under it. The panels are rendered mock panels built from
the actual before/after design tokens and component structure, labeled as
such - the sandbox used for this work has no browser capture, so no panel is
presented as a screenshot.

## Brand kit (fixed, used everywhere)

- Name: Teal Signal on Ink Navy.
- Accent `#0fbfae` (light theme `#0f766e`), accent ink `#6ee7d8`, danger
  `#ef4444` true red, ok `#22c55e`, warn `#f59e0b`, info `#38bdf8`.
- Surfaces: bg `#0a0f14`, surface `#11181f`, line `#22303d`.
- Type: Fraunces (self-hosted, no network fetch) for display headings and
  the login wordmark; Inter/system for UI; tabular sans for stat numbers.
- Scale: page titles 24px, greeting 26px, stat numbers 20px.
- Shape: flat border-only cards at 12px radius; shadows only on menus,
  palette, modal, and the login shell.

## What changed

1. Header dropdowns no longer paint the screen purple or swallow clicks
   (backdrop is a div, topbar stacks above it).
2. Sidebar: Threats duplicate removed (one Incidents screen), ACCOUNT
   section, collapsible with persisted state.
3. Camera and screen-share tracks stop on Leave, End, and page exit.
4. Charie answers spoken questions in calls (engine reply, honest heuristic
   fallback), for teammates and customers, not only bug keywords.
5. Rooms: status column, transcript/notes/summary persisted at End,
   ended-room page shows them, Re-open restores full context.
6. New Chat actually starts fresh (panel remounts per thread).
7. New investigation opens as a modal on the investigations page.
8. Checklist shows a checkmark, not the word "done".
9. Integrations: Azure, Cloudflare, Supabase connect and verify for real.
10. Login: split brand panel instead of a lone dull card.

Gates: `npm test`, engine typecheck, portal typecheck, `portal:build`.
Not browser-verified: no listening sockets or browser in this sandbox, so
visual sign-off is the review page above plus the production deploy.
