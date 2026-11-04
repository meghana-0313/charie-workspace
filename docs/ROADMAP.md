# Roadmap: what we're deliberately NOT building this week

The full vision (support agent joining calls, pentest, crypto review, mobile, custom
video) is real - but a hackathon is won by one complete loop, not five half-loops.
Each item below states what we demo *instead* and what unlocks it later.

## In the hackathon build (Nov 4)

- [x] One web demo-target, one goal, one verified improvement
- [x] Machine tester + usability sim + evidence analyst + verifier
- [x] Static evidence report + MCP fix packet
- [x] Muse Image redesigns (live with `META_API_KEY`; graceful fallback without)
- [x] Portal rooms UI (read + discuss + approve)
- [x] MCP server serving findings to Muse Code

## Explicitly deferred (with honest demo substitutes)

| Vision item | Why deferred | Demo substitute | Unlocks when |
|---|---|---|---|
| AI joins Zoom calls + remote control | Permissions, safety review, meeting SDKs; can't be done responsibly in 6 days | SHIPPED differently: native Meet rooms in the portal where Charie joins, sees the shared screen, and files on-call tickets; Zoom bot via Recall stays an optional fallback. Remote control stays deferred by design - never in scope | Zoom: when a customer demands it; remote control: not planned |
| Full pentest | Requires authorized scope, safe targets, expertise to avoid false "secure" claims | DONE: passive surface checks live (headers, cookie flags), honestly labeled - full pentest stays deferred | Security module milestone |
| Crypto review | Cannot certify encryption from source alone; needs runtime + config access | Dependency/algorithm inventory from lockfiles (informational only) | With test-env + expert review loop |
| Native mobile (Android/iOS) | Device farm + Appium setup dwarfs the week | Mobile-viewport web journeys (responsive + touch) | Device-cloud milestone |
| Custom meeting/video service | Video infra is a company, not a feature | SHIPPED as native Meet on mesh WebRTC (portal-hosted signaling, STUN) - deliberately not a video company: no TURN relay yet, so strict NATs can fail; that is the honest remaining gap | TURN relay post-hackathon for strict-NAT customers |
| Human usability validation | Needs participant recruiting + consent flow | Report section specifying the validation protocol + simulated numbers clearly labeled as simulated | Beta with design partners |

## The rule

If a feature can't go from trigger to verified evidence in the demo, it ships as a
labeled protocol/placeholder - never as a faked capability.
