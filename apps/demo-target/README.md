# ShopFast demo-target — seeded defect catalog (GROUND TRUTH)

This app is intentionally broken. The agent-engine's self-test passes only if a run
against the **buggy** build reports all four seeds, and a run against the **fixed**
build (`npm run dev:fixed`) reports none of them.

## Seeds

| ID | Category | Severity | Description | Location |
|---|---|---|---|---|
| BUG-1 | functional | blocker | Checkout `POST /api/checkout` returns 500 with 3+ items; client swallows the error (spinner stops, no message, no redirect) | `server.js` + `public/checkout.html` |
| UX-1 | usability | major | Three controls labeled "Continue" with three different behaviors (forward / back-to-step-1 / scroll-to-top). First-time users backtrack. | `public/checkout.html` |
| UX-2 | usability | minor | Invalid email on step 1 silently does nothing in buggy build (no error message) | `public/checkout.html` |
| A11Y-1 | accessibility | major | "Place order" is a `<div>` with a click handler: not keyboard-focusable, no role; inputs lack real `<label>`s | `public/checkout.html` |

## Fixed build behavior

`npm run dev:fixed` simulates the post-fix build: checkout accepts any cart size,
failures show an error toast, and invalid email shows a message. (UX-1/A11Y-1 fixes
are represented by the verifier passing the *goal*; full UI fixes land via the
coding-agent flow in the portal milestone.)
