// End-to-end check of the Phase 3 backend API (rewards, requests, badges, missions, reports, sync).
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
const keyFile = join(tmpdir(), "starquest-e2e-rewards-key.json");
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
  const emma = (await owner.listChildren()).ok.find((c) => c.name === "Emma");
  const badges = await owner.listChildBadges(emma.id);
  const rewards = await owner.listRewards();
  check("badges and rewards survive upgrade", badges.ok.length >= 5 && rewards.ok.length >= 4, { badges, rewards });
  process.exit(failed ? 1 : 0);
}

const nowNs = () => BigInt(Date.now()) * 1_000_000n;
const dayNs = 86_400_000_000_000n;
const kid = (name, dailyGoal = []) => ({ name, age: 7n, avatar: { character: "fox", accessories: [] }, favoriteColor: "blue", dailyGoal });
const has = (arr, id) => arr.includes(id);

const anon = await actor(new AnonymousIdentity());
const ownerId = Ed25519KeyIdentity.generate();
const owner = await actor(ownerId);
const other = await actor(Ed25519KeyIdentity.generate());
writeFileSync(keyFile, JSON.stringify(ownerId.toJSON()));

await owner.createFamily("Rewards Family", 0n);
await other.createFamily("Other Family", 0n);
const behaviors = (await owner.listBehaviors()).ok;
const byKey = (k) => behaviors.find((b) => b.starterKey[0] === k);
const emma = (await owner.addChild(kid("Emma"))).ok.id;
const leo = (await owner.addChild(kid("Leo", [10n]))).ok.id;
const balance = async (id) => (await owner.getChild(id)).ok.balance;

// Rewards
let r = await anon.listRewards();
check("anonymous listRewards rejected", tag(r.err) === "notAuthorized", r);
let rewards = (await owner.listRewards()).ok;
const iceCream = rewards.find((x) => x.name === "Ice cream");
check("4 sample rewards seeded", rewards.length === 4 && iceCream.cost === 30n && rewards.every((x) => x.enabled), rewards);
r = await owner.addReward({ name: "Free", emoji: "🆓", cost: 0n, image: { keep: null } });
check("cost 0 rejected", tag(r.err) === "invalid", r);
r = await owner.addReward({ name: "Big", emoji: "🖼️", cost: 5n, image: { set: new Uint8Array(100_001) } });
check("image over 100 KB rejected", tag(r.err) === "invalid", r);
r = await owner.addReward({ name: " Sticker ", emoji: "🌟", cost: 5n, image: { set: Uint8Array.from([1, 2, 3]) } });
check("addReward with image", "ok" in r && r.ok.name === "Sticker" && r.ok.hasImage, r);
const sticker = r.ok.id;
r = await owner.getRewardImage(sticker);
check("getRewardImage returns bytes", "ok" in r && r.ok[0]?.length === 3, r);
r = await other.getRewardImage(sticker);
check("other family cannot read reward image", tag(r.err) === "notFound", r);
r = await owner.updateReward(sticker, { name: "Sticker", emoji: "🌟", cost: 5n, image: { remove: null } });
check("updateReward removes image", "ok" in r && !r.ok.hasImage, r);

// Requests and approvals
r = await owner.requestReward(emma, iceCream.id);
check("request rejected without enough points", tag(r.err) === "invalid", r);
r = await owner.logCustom(emma, 40n, "great day", []);
check("first log unlocks First Star", "ok" in r && has(r.ok.newBadges, "first-star"), r);
r = await owner.setSavingGoal(emma, [iceCream.id]);
check("setSavingGoal", "ok" in r && r.ok.savingForRewardId[0] === iceCream.id, r);
r = await owner.requestReward(emma, iceCream.id);
check("requestReward pending with price snapshot", "ok" in r && tag(r.ok.status) === "pending" && r.ok.cost === 30n, r);
const req1 = r.ok.id;
r = await owner.requestReward(emma, iceCream.id);
check("duplicate pending request rejected", tag(r.err) === "alreadyExists", r);
r = await owner.listPendingRequests();
check("listPendingRequests", r.ok.length === 1 && r.ok[0].id === req1, r);
r = await other.decideRequest(req1, true);
check("other family cannot decide", tag(r.err) === "notFound", r);
r = await owner.decideRequest(req1, true);
check("approve deducts cost", "ok" in r && tag(r.ok.request.status) === "approved" && r.ok.log[0].newBalance === 10n && tag(r.ok.log[0].entry.kind) === "reward", r);
check("first reward unlocks Treasure Hunter", has(r.ok.log[0].newBadges, "first-reward"), r.ok.log);
const rewardEntry = r.ok.log[0].entry.id;
r = await owner.decideRequest(req1, true);
check("second approval rejected", tag(r.err) === "invalid" && (await balance(emma)) === 10n, r);
check("approval clears saving goal", (await owner.getChild(emma)).ok.savingForRewardId.length === 0, null);
r = await owner.deleteLogEntry(rewardEntry);
check("reward entry cannot be undone", tag(r.err) === "invalid", r);

await owner.logCustom(emma, 25n, "chores", []);
const req2 = (await owner.requestReward(emma, iceCream.id)).ok.id;
await owner.logCustom(emma, -10n, "mess", []);
r = await owner.decideRequest(req2, true);
check("approve rejected when balance dropped", tag(r.err) === "invalid" && (await balance(emma)) === 25n, r);
r = await owner.decideRequest(req2, false);
check("decline keeps balance", "ok" in r && tag(r.ok.request.status) === "declined" && r.ok.log.length === 0 && (await balance(emma)) === 25n, r);

// Missions
const hitting = byKey("hitting");
const before = (await owner.getChild(emma)).ok;
r = await owner.logBehavior(emma, hitting.id, [], []);
const oops = r.ok.entry;
r = await owner.startMission(oops.id);
const refund = hitting.mission[0].refund;
check("startMission refund from behavior", "ok" in r && tag(r.ok.status) === "active" && r.ok.refund === refund, r);
const mission = r.ok.id;
r = await owner.startMission(oops.id);
check("second mission for same oops rejected", tag(r.err) === "alreadyExists", r);
r = await owner.startMission(rewardEntry);
check("mission for non-oops rejected", tag(r.err) === "invalid", r);
r = await owner.confirmMission(mission);
check("confirmMission refunds balance, no XP", "ok" in r && r.ok.newBalance === before.balance - hitting.points + refund && r.ok.newXp === before.xp, r);
check("mission unlocks Make It Right", has(r.ok.newBadges, "make-it-right"), r.ok.newBadges);
const missionEntry = r.ok.entry.id;
r = await owner.confirmMission(mission);
check("second confirm rejected", tag(r.err) === "invalid", r);
r = await owner.deleteLogEntry(oops.id);
check("oops with done mission cannot be undone", tag(r.err) === "invalid", r);
await owner.deleteLogEntry(missionEntry);
r = await owner.listActiveMissions();
check("undoing refund reopens mission", r.ok.some((m) => m.id === mission), r);
r = await owner.cancelMission(mission);
check("cancelMission", "ok" in r && (await owner.listActiveMissions()).ok.length === 0, r);

// Badges
r = await owner.logCustom(emma, 40n, "big help", []);
check("100 XP unlocks 100 Points Club", "ok" in r && r.ok.newXp >= 100n && has(r.ok.newBadges, "points-100"), r);
const kind = byKey("kind");
let kindResults = [];
for (let i = 0; i < 10; i++) kindResults.push((await owner.logBehavior(emma, kind.id, [], [])).ok.newBadges);
check("Kindness Hero unlocks on the 10th, not before", has(kindResults[9], "kindness-hero") && !kindResults.slice(0, 9).some((b) => has(b, "kindness-hero")), kindResults);
r = await owner.listChildBadges(emma);
const ids = r.ok.map((b) => b.badgeId);
check("badges unlock once", ids.length === new Set(ids).size && ["first-star", "first-reward", "make-it-right", "points-100", "kindness-hero"].every((b) => has(ids, b)), ids);
check("8 badge definitions", (await owner.getBadgeDefinitions()).length === 8, null);

await owner.logBehavior(leo, hitting.id, [], [nowNs() - dayNs]);
r = await owner.logCustom(leo, 10n, "good day", []);
check("goal day after an oops day unlocks Comeback Kid", "ok" in r && r.ok.goalReached && has(r.ok.newBadges, "comeback-kid"), r);
for (let d = 6n; d >= 1n; d--) r = await owner.logCustom(leo, 10n, "goal", [nowNs() - d * dayNs]);
check("7 goal days unlock 7-Day Streak", "ok" in r && r.ok.streak === 7n && has(r.ok.newBadges, "streak-7"), r);

// Reset
const emmaBefore = (await owner.getChild(emma)).ok;
r = await owner.resetPoints(emma);
check("resetPoints zeroes balance, keeps XP", "ok" in r && r.ok.balance === 0n && r.ok.xp === emmaBefore.xp, r);

// Reports
r = await owner.getChildStats(emma, { today: null });
check("today stats", "ok" in r && r.ok.buckets.length === 1 && r.ok.earned === emmaBefore.xp && r.ok.spent === 30n && r.ok.topBehaviors[0].behaviorId === kind.id && r.ok.topBehaviors[0].count === 10n, r);
const lens = [];
for (const range of ["week", "month", "year"]) lens.push((await owner.getChildStats(emma, { [range]: null })).ok.buckets.length);
check("bucket counts week/month/year", lens.join() === "7,30,52", lens);
r = await owner.getChildStats(leo, { week: null });
check("week stats across backdated days", "ok" in r && r.ok.earned === 70n && r.ok.oopsCount === 1n && r.ok.goodCount === 7n, r);
r = await owner.getWeeklySummary(emma);
check("weekly summary top good behavior", "ok" in r && r.ok.name === "Emma" && r.ok.topBehavior[0]?.title === kind.name, r);
r = await other.getChildStats(emma, { week: null });
check("other family cannot read stats", tag(r.err) === "notFound", r);

const filter = (o = {}) => ({ childId: [], kind: [], fromDay: [], toDay: [], ...o });
r = await owner.getHistory(filter({ childId: [emma] }), [], 5n);
const p1 = r.ok;
r = await owner.getHistory(filter({ childId: [emma] }), p1.nextCursor, 5n);
check("history paginates newest first", p1.entries.length === 5 && p1.nextCursor.length === 1 && r.ok.entries.every((e) => e.id < p1.nextCursor[0]) && p1.entries[0].id > p1.entries[4].id, { p1, p2: r });
r = await owner.getHistory(filter({ kind: [{ reset: null }] }), [], 50n);
check("history filters by kind", r.ok.entries.length === 1 && r.ok.nextCursor.length === 0, r);
r = await owner.getHistory(filter(), [], 0n);
check("history limit 0 rejected", tag(r.err) === "invalid", r);
r = await other.getHistory(filter({ childId: [emma] }), [], 10n);
check("other family cannot read history", tag(r.err) === "notFound", r);

// Sync
const since = (await owner.getChangesSince(0n)).ok.serverTime;
await owner.logCustom(leo, 3n, "after sync", []);
const pending = (await owner.requestReward(leo, iceCream.id)).ok.id;
await owner.deleteReward(iceCream.id);
r = await owner.getChangesSince(since);
const c = r.ok;
check("changes: only what changed since", "ok" in r && c.complete && c.entries.length === 1 && c.children.length === 1 && c.children[0].id === leo, c);
check("changes: deleted reward and declined request", c.deleted.some((d) => tag(d.kind) === "reward" && d.id === iceCream.id) && c.requests.some((q) => q.id === pending && tag(q.status) === "declined"), c);
r = await other.getChangesSince(0n);
check("changes scoped to caller's family", "ok" in r && r.ok.children.length === 0 && r.ok.entries.length === 0 && r.ok.rewards.length === 4, r);
r = await anon.getChangesSince(0n);
check("anonymous getChangesSince rejected", tag(r.err) === "notAuthorized", r);

console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
