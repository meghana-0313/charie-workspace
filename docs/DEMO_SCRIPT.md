# Demo script (3 minutes, hosted portal)

**Format:** screen recording of the live portal (charie-portal on Cloud Run).
Pre-stage everything below before hitting record; each beat should already be
loaded in a tab. If a beat misbehaves live, cut to the pre-recorded tab and keep
narrating; never fake a result.

| Time | Screen | Say |
|---|---|---|
| 0:00 | Home, Night shift digest card | "Your software broke at 3am. Nobody paged you. Charie investigated anyway. This is the morning digest." |
| 0:20 | Ticket room: findings with screenshots | "A customer complaint became a ticket. Charie drove the real app, hit the same wall the customer did, and filed evidence: screenshots, repro steps, the failing request. Not vibes. Proof." |
| 0:50 | Finding detail, SAM grounding boxes | "Every claim is grounded in the screenshot it came from. Muse models read the evidence; the trace is the receipt." |
| 1:10 | Approve instruction, MCP packet | "I approve one instruction. The fix packet goes to my coding agent over MCP, cloud or local, scoped to my account. I never paste logs into a chat window again." |
| 1:35 | Verify run, before/after proof | "Then Charie re-runs the exact journey and diffs it. Fixed, regressed, or inconclusive. The ticket only closes with proof. Proof, or it did not happen." |
| 2:00 | Live signals, hot cluster | "Meanwhile your customers are shouting in support. Charie clusters the themes, grades the heat, and one click files it as a ticket with the product URL. Complaint to investigation in one click." |
| 2:25 | Security page, grade A | "And it attacks itself like a bug bounty hunter: 35 checks, recon, OWASP. That is our own dashboard earning its grade A." |
| 2:45 | Meet room, guest joining | "A customer joins from a link. No account, consent first, nothing recorded. Charie takes live notes, knows the customer from the teammate, and saves the summary to the ticket." |
| 2:55 | Chat with Charie | "Or I just ask Charie. It answers from my tickets, my runs, my context, on Muse Spark." |
| 3:00 | Logo | "Ticket to evidence to fix to proof. Meet Charie." |

## Pre-stage checklist

- One ticket investigated end to end, verification green (the ShopFast demo).
- Night shift digest present (run one manually the hour before if needed).
- A seeded signals cluster with hot angry share for the one-click beat.
- Security page showing the latest grade A pentest of the demo target.
- A second browser (or phone) ready off camera to join the Meet room as guest.
- Demo target running (`npm run demo:target` or the hosted charie-demo).

## Fallback

If the live portal stalls, the local stack tells the same story: demo target on
`localhost:3101`, engine on `localhost:3103`, portal on `localhost:3102`, and
`services/agent-engine/sample-report/` holds a real past run. Narrate honestly:
a recording is a recording.
