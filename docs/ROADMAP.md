# Roadmap: what we're deliberately NOT building this week

The full vision (support agent joining calls, pentest, crypto review, mobile, custom
video) is real - but a hackathon is won by one complete loop, not five half-loops.
Each item below states what we demo *instead* and what unlocks it later.

## In the hackathon build (Nov 4)

- [x] One web demo-target, one goal, one verified improvement
- [x] Machine tester + usability sim + evidence analyst + verifier
- [x] Static evidence report + MCP fix packet
- [ ] Muse Image redesigns (needs API key; graceful fallback ready)
- [x] Portal rooms UI (read + discuss + approve)
- [x] MCP server serving findings to Muse Code

## Explicitly deferred (with honest demo substitutes)

| Vision item | Why deferred | Demo substitute | Unlocks when |
|---|---|---|---|
| AI joins Zoom calls + remote control | Permissions, safety review, meeting SDKs; can't be done responsibly in 6 days | Simulated ticket ingestion: same pipeline, honest label | Post-hackathon, scoped + revocable + audited |
| Full pentest | Requires authorized scope, safe targets, expertise to avoid false "secure" claims | DONE: passive surface checks live (headers, cookie flags), honestly labeled - full pentest stays deferred | Security module milestone |
| Crypto review | Cannot certify encryption from source alone; needs runtime + config access | Dependency/algorithm inventory from lockfiles (informational only) | With test-env + expert review loop |
| Native mobile (Android/iOS) | Device farm + Appium setup dwarfs the week | Mobile-viewport web journeys (responsive + touch) | Device-cloud milestone |
| Custom meeting/video service | Video infra is a company, not a feature | Issue rooms: async-first collaboration around evidence; link-out to existing meeting tools | Never - integrate, don't rebuild |
| Human usability validation | Needs participant recruiting + consent flow | Report section specifying the validation protocol + simulated numbers clearly labeled as simulated | Beta with design partners |

## The rule

If a feature can't go from trigger to verified evidence in the demo, it ships as a
labeled protocol/placeholder - never as a faked capability.
