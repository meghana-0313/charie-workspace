// Screen vision reply parsing: reasoning models must not answer empty.
// Offline: scripted provider replies. Run: npm run test.
import { strict as assert } from "node:assert";
import { describeScreenDetailed } from "../src/vision.js";
import { _clearSecretCache } from "../src/secrets.js";

let n = 0;
const ok = (cond: unknown, msg: string) => { n++; assert.ok(cond, msg); };

const IMG = "data:image/jpeg;base64,AAAA";
const saved = { meta: process.env.META_API_KEY, baseten: process.env.BASETEN_API_KEY };
delete process.env.BASETEN_API_KEY;
process.env.META_API_KEY = "fake-test-key";
_clearSecretCache();

const reply = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

// Plain string content (the shape that always worked).
const plain = await describeScreenDetailed(IMG, "what do you see?", reply({ choices: [{ finish_reason: "stop", message: { content: "A checkout page." } }] }) as typeof fetch);
ok(plain.ok && plain.text.includes("checkout"), "string content parses");

// Reasoning-only reply: content empty, scratch work in reasoning_content.
// Vision must NEVER speak that (it leaks the prompt); it reports empty.
const reasoning = await describeScreenDetailed(IMG, "what do you see?", reply({ choices: [{ finish_reason: "length", message: { content: "", reasoning_content: "We need to answer in one short sentence. The screen shows a checkout error." } }] }) as typeof fetch);
ok(!reasoning.ok && reasoning.reason.includes("finish_reason=length"), "reasoning scratch work is never spoken as a vision answer");

// Leaked reasoning in content is rejected by name too.
const leaked = await describeScreenDetailed(IMG, "what do you see?", reply({ choices: [{ finish_reason: "stop", message: { content: "We need to answer in ONE short sentence. We are Charie watching shared screen live." } }] }) as typeof fetch);
ok(!leaked.ok && leaked.reason.includes("leaked"), "leaked reasoning in content is rejected");

// Content as an array of text parts.
const parts = await describeScreenDetailed(IMG, "what do you see?", reply({ choices: [{ finish_reason: "stop", message: { content: [{ type: "text", text: "A red error banner." }] } }] }) as typeof fetch);
ok(parts.ok && parts.text.includes("error banner"), "array content parts parse");

// Truly empty: named with its finish_reason, never a bare "answered empty".
const empty = await describeScreenDetailed(IMG, "what do you see?", reply({ choices: [{ finish_reason: "length", message: { content: "" } }] }) as typeof fetch);
ok(!empty.ok && empty.reason.includes("finish_reason=length"), "empty reply names its finish_reason");

// No frame at all: honest, no provider call.
const noFrame = await describeScreenDetailed("not-an-image", "hi", reply({}) as typeof fetch);
ok(!noFrame.ok && noFrame.reason.includes("no image frame"), "missing frame is honest");

if (saved.meta === undefined) delete process.env.META_API_KEY; else process.env.META_API_KEY = saved.meta;
if (saved.baseten === undefined) delete process.env.BASETEN_API_KEY; else process.env.BASETEN_API_KEY = saved.baseten;
_clearSecretCache();
console.log(`vision tests passed (${n})`);
