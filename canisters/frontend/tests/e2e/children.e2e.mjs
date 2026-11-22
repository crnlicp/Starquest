// End-to-end check of the Phase 2 backend API (children, behaviors, logging, points/levels/streaks).
// Usage: see families.e2e.mjs (`npm run test:e2e` runs every *.e2e.mjs; `-- --after-upgrade` checks survival).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { HttpAgent, Actor, AnonymousIdentity } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, "../..");
const repoRoot = resolve(frontendDir, "../..");
const didJs = join(frontendDir, "app/bindings/declarations/backend.did.js");
const keyFile = join(tmpdir(), "starquest-e2e-children-key.json");
const mode = process.argv.includes("--after-upgrade") ? "after-upgrade" : "full";

if (!existsSync(didJs)) {
  console.error(`Missing ${didJs}: build the frontend first (npm run build) to generate bindings.`);
  process.exit(1);
}
const icp = (args) => execFileSync("icp", args, { encoding: "utf8", cwd: repoRoot }).trim();
const { api_url, root_key } = JSON.parse(icp(["network", "status", "--json"]));
const canisterId = icp(["canister", "status", "backend", "--id-only"]);
const { idlFactory } = await import(pathToFileURL(didJs).href);
const rootKey = Uint8Array.from(Buffer.from(root_key, "hex"));
const actor = async (identity) =>
  Actor.createActor(idlFactory, { agent: await HttpAgent.create({ host: api_url, rootKey, identity }), canisterId });

let failed = 0;
const tag = (v) => (v && typeof v === "object" ? Object.keys(v)[0] : String(v));
function check(label, cond, got) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  got: " + JSON.stringify(got, (_, x) => (typeof x === "bigint" ? x.toString() : x))}`);
  if (!cond) failed++;
}

if (mode === "after-upgrade") {
  if (!existsSync(keyFile)) {
    console.error("No saved key: run the full check before upgrading.");
    process.exit(1);
  }
  const owner = await actor(Ed25519KeyIdentity.fromJSON(readFileSync(keyFile, "utf8")));
  const kids = await owner.listChildren();
  check("children survive upgrade", "ok" in kids && kids.ok.length === 1 && kids.ok[0].name === "Emma" && kids.ok[0].xp === 50n, kids);
  process.exit(failed ? 1 : 0);
}

const nowNs = () => BigInt(Date.now()) * 1_000_000n;
const dayNs = 86_400_000_000_000n;
const kid = (name, dailyGoal = []) => ({ name, age: 7n, avatar: { character: "fox", accessories: [] }, favoriteColor: "blue", dailyGoal });

const anon = await actor(new AnonymousIdentity());
const ownerId = Ed25519KeyIdentity.generate();
const owner = await actor(ownerId);
const other = await actor(Ed25519KeyIdentity.generate());
writeFileSync(keyFile, JSON.stringify(ownerId.toJSON()));

let r = await anon.addChild(kid("Anon"));
check("anonymous addChild rejected", tag(r.err) === "notAuthorized", r);
r = await anon.listChildren();
check("anonymous listChildren rejected", tag(r.err) === "notAuthorized", r);

await owner.createFamily("Kids Family", 60n);
await other.createFamily("Other Family", 0n);
let behaviors = (await owner.listBehaviors()).ok;
check("new family gets 13 enabled starters", behaviors.length === 13 && behaviors.every((b) => b.enabled), behaviors.length);
const byKey = (k) => behaviors.find((b) => b.starterKey[0] === k);

r = await owner.addChild(kid("  "));
check("empty child name rejected", tag(r.err) === "invalid", r);
r = await owner.addChild({ ...kid("Old"), age: 40n });
check("age out of range rejected", tag(r.err) === "invalid", r);
r = await owner.addChild(kid(" Emma "));
check("addChild (default goal 20, level 1)", "ok" in r && r.ok.name === "Emma" && r.ok.dailyGoal === 20n && r.ok.level.number === 1n, r);
const emma = r.ok.id;
const leo = (await owner.addChild(kid("Leo", [10n]))).ok.id;
r = await other.getChild(emma);
check("other family cannot read child", tag(r.err) === "notFound", r);
r = await other.logCustom(emma, 5n, "hack", []);
check("other family cannot log for child", tag(r.err) === "notFound", r);

r = await owner.logBehavior(emma, byKey("brush-teeth").id, ["  at night "], []);
check("good behavior +5 balance and xp", "ok" in r && r.ok.newBalance === 5n && r.ok.newXp === 5n && r.ok.entry.note[0] === "at night", r);
r = await owner.logBehavior(emma, byKey("hitting").id, [], []);
check("oops floors balance at 0, xp unchanged", "ok" in r && r.ok.newBalance === 0n && r.ok.newXp === 5n && r.ok.entry.balanceDelta === -5n, r);
const oopsId = r.ok.entry.id;
r = await owner.deleteLogEntry(oopsId);
check("undo oops restores only what was taken", "ok" in r && r.ok.balance === 5n && r.ok.xp === 5n, r);
r = await owner.deleteLogEntry(oopsId);
check("undo twice is notFound", tag(r.err) === "notFound", r);

r = await owner.logCustom(emma, 0n, "zero", []);
check("custom 0 rejected", tag(r.err) === "invalid", r);
r = await owner.logCustom(emma, 101n, "too much", []);
check("custom 101 rejected", tag(r.err) === "invalid", r);
r = await owner.logCustom(emma, 45n, "Great week", []);
check("level-up and goal reached at 50 xp", "ok" in r && r.ok.leveledUp[0]?.number === 2n && r.ok.goalReached && r.ok.dayPoints === 50n && r.ok.streak === 1n, r);

r = await owner.logCustom(emma, 5n, "future", [nowNs() + 3_600_000_000_000n]);
check("future time rejected", tag(r.err) === "invalid", r);
r = await owner.logCustom(emma, 20n, "Yesterday", [nowNs() - dayNs]);
check("backdated entry extends streak to 2", "ok" in r && r.ok.streak === 2n && r.ok.goalReached, r);
const yesterdayId = r.ok.entry.id;
await owner.deleteLogEntry(yesterdayId);
r = await owner.getChild(emma);
check("deleting backdated entry recomputes streak", "ok" in r && r.ok.streak === 1n && r.ok.xp === 50n && r.ok.todayPoints === 50n, r);

r = await owner.setBehaviorEnabled(byKey("make-bed").id, false);
r = await owner.logBehavior(emma, byKey("make-bed").id, [], []);
check("disabled behavior cannot be logged", tag(r.err) === "invalid", r);

r = await owner.addBehavior({ name: "Fed the cat", emoji: "🐱", points: 0n, kind: { good: null }, assignedTo: [], mission: [] });
check("behavior with 0 points rejected", tag(r.err) === "invalid", r);
r = await owner.addBehavior({ name: "Shouting", emoji: "📢", points: 5n, kind: { good: null }, assignedTo: [], mission: [{ suggestion: "x", refund: 1n }] });
check("mission on good behavior rejected", tag(r.err) === "invalid", r);
r = await owner.addBehavior({ name: "Fed the cat", emoji: "🐱", points: 3n, kind: { good: null }, assignedTo: [[leo]], mission: [] });
check("custom behavior assigned to Leo", "ok" in r && r.ok.assignedTo[0][0] === leo, r);
const cat = r.ok.id;
r = await owner.logBehavior(emma, cat, [], []);
check("unassigned child cannot get it", tag(r.err) === "invalid", r);
r = await owner.logBehavior(leo, cat, [], []);
check("assigned child gets it", "ok" in r && r.ok.newBalance === 3n, r);
const leoEntry = r.ok.entry.id;

await owner.deleteBehavior(byKey("kind").id);
r = await owner.enableStarterBehaviors(["nope"]);
check("unknown starter key rejected", tag(r.err) === "invalid", r);
r = await owner.enableStarterBehaviors(["kind", "make-bed"]);
check("starters restored and re-enabled", "ok" in r && r.ok.length === 14 && r.ok.every((b) => b.enabled), r.ok?.length);

r = await owner.deleteChild(leo);
check("deleteChild", "ok" in r, r);
r = await owner.getChild(leo);
check("deleted child is gone", tag(r.err) === "notFound", r);
r = await owner.deleteLogEntry(leoEntry);
check("deleted child's entries are gone", tag(r.err) === "notFound", r);
behaviors = (await owner.listBehaviors()).ok;
check("deleted child dropped from assignments", behaviors.find((b) => b.id === cat).assignedTo.length === 0, behaviors);

const levels = await owner.getLevels();
check("10 levels", levels.length === 10 && levels[9].title === "Superstar Legend", levels.length);

console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
