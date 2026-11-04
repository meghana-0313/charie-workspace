# Demo script (3 minutes, hosted portal)

**One story, then breadth.** The whole demo follows one ShopFlow checkout
failure from customer complaint to verified fix. Signals, security, and Meet
appear only as a fast montage near the end. Judges should remember one
complete autonomous loop: ticket to evidence, evidence to fix, fix to proof.

**Format:** screen recording of the live portal (charie-portal on Cloud Run),
narrated to the timings below (about 130-150 words per minute). Pre-stage
every screen in its own tab before recording. If a live beat misbehaves, cut
to the pre-staged tab and keep narrating. Never fake a result, a model
response, or a reasoning trace.

## The script

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00-0:20 | Cold open: the demo incident card with its 03:07 AM timestamp, then the camera settles on Home and the Night Shift Digest | Start on the red incident and the time, not a static dashboard. Slow zoom into the digest card as the second sentence lands. | "Your software broke at 3 AM. Nobody noticed. Nobody investigated. Nobody fixed it. Except Charie. By the time your team starts its morning, Charie has already investigated what went wrong." |
| 0:20-0:50 | The ShopFlow checkout ticket (`demo-tkt-checkout`), then the failing journey: screenshot, repro steps, trace or log for the failing step | Show the real app failure first, then the evidence Charie filed. Zoom into the screenshot, then the exact repro step that breaks. | "A customer reported that checkout was not working. Instead of just summarising the complaint, Charie opened the application, reproduced the customer's journey, and found where it broke. Here is the screenshot. Here is the exact reproduction path. This is not an AI guessing what went wrong. It is an investigation backed by evidence." |
| 0:50-1:15 | Finding detail: SAM grounding boxes on the screenshot, the findings list, and the execution report showing the model that actually ran | Pause on the grounded element (the checkout total or button the finding is about). Then show the report header with its model and provider label. | "Charie uses Meta's models to understand what it sees, connect the evidence, and explain the failure. Every important finding is linked to its source, and the report names the model that did the work. You can inspect the evidence behind the conclusion instead of blindly trusting an AI-generated answer." |
| 1:15-1:45 | The proposed fix instruction on the ticket, your approval click, then the MCP fix packet / handoff view | Click Approve fix instruction on camera. Show the scoped packet the coding agent receives. Keep this beat about control, not tools. | "Now Charie proposes what needs to change. I review it, and I approve it. Through MCP, Charie sends a scoped fix packet directly to my coding agent, running locally or in the cloud. The developer stays in control. The repetitive investigation is automated." |
| 1:45-2:15 | Verification run: the same checkout journey re-run, ending on the before/after comparison, failed before and passed after | This is the emotional payoff. Hold on the green verified result a beat longer than feels natural. Do not rush past it. | "But here is the important part. Charie does not stop after suggesting a fix. It runs the same journey again and checks the result. Did it actually work? Did something else break? Fixed, regressed, or inconclusive, every outcome has evidence. Because a proposed fix is not proof. Verification is." |
| 2:15-2:40 | Fast montage, one clean cut each: Support Signals hot cluster, the Security page with its latest report, a Meet room with a guest tile | About eight seconds per surface. No narration pauses between cuts; the point is breadth, not depth. If any surface is not pre-staged and healthy, drop it and give the time to the others. | "And this goes beyond QA. Charie turns customer complaints into actionable investigations, identifies security weaknesses through controlled testing, and brings customers and engineering teams into the same conversation. One platform. Connected workflows." |
| 2:40-3:00 | Chat with Charie. Ask: "What was the checkout issue, and how do we know it is fixed?" Let the answer cite the ticket, the finding, and the verified status. Final frame: cut back to the green before/after verification card under the closing line and logo. | Pre-stage this conversation so the answer is grounded in the real ticket. End on the result, not on the chat box. | "Or I can simply ask Charie. It understands the investigation, the evidence, and the outcome. From the first customer complaint to a verified fix. That is autonomous quality engineering. Ticket to evidence. Evidence to fix. Fix to proof. Meet Charie." |

## Pre-stage checklist (before recording)

- [ ] Demo workspace entered once through Explore Charie Demo, so the seed has topped up: ShopFlow checkout ticket investigated end to end, verification green, linked report and findings open in tabs.
- [ ] The checkout finding has a screenshot with SAM grounding boxes; if the prepared run has none, use a run that does and make it the story ticket.
- [ ] Night Shift Digest present on Home (run a night shift or use the seeded digest the hour before).
- [ ] One signals cluster with a hot, angry share on the Signals page.
- [ ] Latest security report on the Security page (the seeded sample report is fine; do not claim a grade the report does not show).
- [ ] Meet room open with a guest joined from a second browser or phone, off camera until the montage.
- [ ] Chat thread ready with the closing question, answered from the actual ticket and verification state.
- [ ] Every screen for the table above open in a tab, in order, so recording is tab-switching, not navigating and waiting.
- [ ] Demo target reachable (hosted charie-demo, or `npm run demo:target` on localhost:3101 locally).

## Honesty guardrails

- Model labels say only what actually ran. `analysisSource` is `heuristic` until a real model call succeeds; never narrate a heuristic answer as Muse Spark.
- The grounding boxes, reasoning, and report shown must come from the execution they claim to come from. An illustrative layout is never recorded as a result.
- Seeded and simulated records (Guardian incidents, demo builds, sample reports) are labelled as such in the product. Keep those labels on screen; do not crop them out.
- If the prepared verification is not green, record the story with its real status. A fixed claim needs a passed verification behind it.

## Rehearsal checklist

- [ ] One full run at speaking pace fits 3:00 with pauses. If it overruns, cut montage surfaces first, never the verification beat.
- [ ] Narration runs a fraction of a second ahead of the screen action, so each sentence lands as its evidence appears.
- [ ] No unnecessary cursor movement, no loading screens: zoom into evidence, use short transitions, highlight the element each sentence names.
- [ ] Subtle sound only where it earns it: the incident alert at 0:00 and the verified pass at about 2:10.
- [ ] Record one complete fallback take of the core loop (0:00-2:15) in the same session, so an unstable live beat can be replaced without re-recording the day.

## Fallback

If the live portal stalls, the local stack tells the same story: demo target on
`localhost:3101`, engine on `localhost:3103`, portal on `localhost:3102`, and
`services/agent-engine/sample-report/` holds a real past run. Narrate honestly:
a recording is a recording.
