// End-to-end check of the Phase 4 backend API (device pairing, device access, picture passwords).
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
const keyFile = join(tmpdir(), "starquest-e2e-devices-key.json");
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
  const device = await actor(Ed25519KeyIdentity.fromJSON(readFileSync(keyFile, "utf8")));
  check("paired device survives upgrade", tag(await device.getMyRole()) === "device");
  process.exit(failed ? 1 : 0);
}

const kid = (name) => ({ name, age: 7n, avatar: { character: "fox", accessories: [] }, favoriteColor: "blue", dailyGoal: [] });
const newDevice = () => { const id = Ed25519KeyIdentity.generate(); return actor(id).then((a) => ({ id, a })); };
const wrongCode = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

const owner = await actor(Ed25519KeyIdentity.generate());
const other = await actor(Ed25519KeyIdentity.generate());
const anon = await actor(new AnonymousIdentity());
await owner.createFamily("Device Family", 0n);
await other.createFamily("Other Family", 0n);
const emma = (await owner.addChild(kid("Emma"))).ok.id;
const liam = (await owner.addChild(kid("Liam"))).ok.id;
await owner.logCustom(emma, 50n, "head start", []);
await owner.logCustom(liam, 20n, "head start", []);
const reward = (await owner.listRewards()).ok.find((x) => x.name === "Ice cream");

// Pairing codes
let r = await anon.createPairingCode(emma);
check("anonymous createPairingCode rejected", tag(r.err) === "notAuthorized", r);
r = await other.createPairingCode(emma);
check("other family cannot pair our child", tag(r.err) === "notFound", r);
r = await owner.createPairingCode(emma);
check("createPairingCode", "ok" in r && /^\d{6}$/.test(r.ok.code) && r.ok.url === `starquest://pair?code=${r.ok.code}`, r);
const first = r.ok.code;
r = await owner.createPairingCode(emma);
const code = r.ok.code;
check("new code replaces the child's earlier one", code !== first, r);

// Redeem
const tab = await newDevice();
r = await anon.redeemPairingCode(code, "Tablet");
check("anonymous redeem rejected", tag(r.err) === "notAuthorized", r);
r = await owner.redeemPairingCode(code, "Tablet");
check("parent cannot redeem", tag(r.err) === "alreadyExists", r);
r = await tab.a.redeemPairingCode(first, "Tablet");
check("replaced code no longer works", tag(r.err) === "notFound", r);
r = await tab.a.redeemPairingCode(code, " ");
check("blank device name rejected", tag(r.err) === "invalid", r);
r = await tab.a.redeemPairingCode(code, "Emma's tablet");
check("redeem pairs the device", "ok" in r && r.ok.childId === emma && r.ok.name === "Emma's tablet", r);
writeFileSync(keyFile, JSON.stringify(tab.id.toJSON()));
const dev = tab.a;
const role = await dev.getMyRole();
check("device role", tag(role) === "device" && role.device.childId === emma, role);
const late = await newDevice();
r = await late.a.redeemPairingCode(code, "Phone");
check("code is single use", tag(r.err) === "notFound", r);
r = await dev.redeemPairingCode(code, "Again");
check("paired device cannot redeem again", tag(r.err) === "alreadyExists", r);

// Per-caller throttle
const guesser = await newDevice();
for (let i = 0; i < 4; i++) await guesser.a.redeemPairingCode(wrongCode(code), "Guess");
r = await guesser.a.redeemPairingCode(wrongCode(code), "Guess");
check("5th wrong code still notFound", tag(r.err) === "notFound", r);
r = await guesser.a.redeemPairingCode(wrongCode(code), "Guess");
check("then the caller is rate limited", tag(r.err) === "rateLimited" && r.err.rateLimited.retryAfterNs > 0n, r);

// What a device can do
r = await dev.getChild(emma);
check("device reads its child", "ok" in r && r.ok.name === "Emma", r);
r = await dev.getChild(liam);
check("device cannot read sibling", tag(r.err) === "notAuthorized", r);
r = await dev.listChildren();
check("listChildren shows only own child", r.ok.length === 1 && r.ok[0].id === emma, r);
r = await dev.getChildStats(liam, { week: null });
check("sibling stats rejected", tag(r.err) === "notAuthorized", r);
r = await dev.getChildStats(emma, { week: null });
check("own stats", "ok" in r, r);
r = await dev.getHistory({ childId: [], kind: [], fromDay: [], toDay: [] }, [], 50n);
check("history scoped to own child", r.ok.entries.length > 0 && r.ok.entries.every((e) => e.childId === emma), r);
r = await dev.getHistory({ childId: [liam], kind: [], fromDay: [], toDay: [] }, [], 50n);
check("sibling history rejected", tag(r.err) === "notAuthorized", r);
r = await dev.listChildBadges(liam);
check("sibling badges rejected", tag(r.err) === "notAuthorized", r);
r = await dev.getChangesSince(0n);
check("sync scoped to own child",
  r.ok.children.length === 1 && r.ok.children[0].id === emma && r.ok.entries.every((e) => e.childId === emma) && r.ok.rewards.length >= 4, r);
r = await dev.listRewards();
check("device lists rewards", r.ok.length >= 4, r);
r = await dev.getMyFamily();
check("device reads family settings", "ok" in r && r.ok.name === "Device Family", r);
r = await dev.setSavingGoal(emma, [reward.id]);
check("device sets own saving goal", r.ok?.savingForRewardId[0] === reward.id, r);
r = await dev.setSavingGoal(liam, [reward.id]);
check("device cannot set sibling goal", tag(r.err) === "notAuthorized", r);
r = await dev.requestReward(emma, reward.id);
check("device requests a reward", "ok" in r && r.ok.childId === emma && tag(r.ok.status) === "pending", r);
r = await dev.requestReward(liam, reward.id);
check("device cannot request for sibling", tag(r.err) === "notAuthorized", r);
await owner.requestReward(liam, reward.id);
r = await dev.listPendingRequests();
check("device sees only own requests", r.ok.length === 1 && r.ok[0].childId === emma, r);
r = await dev.heartbeat();
check("heartbeat", "ok" in r, r);

// What a device cannot do
const behavior = (await owner.listBehaviors()).ok[0];
const denied = {
  logBehavior: () => dev.logBehavior(emma, behavior.id, [], []),
  logCustom: () => dev.logCustom(emma, 100n, "cheat", []),
  resetPoints: () => dev.resetPoints(emma),
  decideRequest: async () => dev.decideRequest((await owner.listPendingRequests()).ok[0].id, true),
  addReward: () => dev.addReward({ name: "Pony", emoji: "🐴", cost: 1n, image: { keep: null } }),
  updateChild: () => dev.updateChild(emma, kid("Emma")),
  listDevices: () => dev.listDevices(),
  createPairingCode: () => dev.createPairingCode(emma),
  setPicturePassword: () => dev.setPicturePassword(emma, [{ cat: null }, { dog: null }, { owl: null }]),
  createInvite: () => dev.createInvite(),
};
for (const [name, call] of Object.entries(denied)) {
  r = await call();
  check(`device cannot ${name}`, tag(r.err) === "notAuthorized", r);
}
r = await dev.createFamily("Kid Family", 0n);
check("device cannot create a family", tag(r.err) === "alreadyExists", r);

// Picture password
const pw = [{ cat: null }, { dog: null }, { lion: null }];
r = await dev.verifyPicturePassword(emma, pw);
check("no picture password: verify passes", r.ok === true, r);
r = await owner.setPicturePassword(emma, [{ cat: null }]);
check("picture password needs 3 animals", tag(r.err) === "invalid", r);
r = await owner.setPicturePassword(emma, pw);
check("setPicturePassword", "ok" in r, r);
check("hasPicture shown", (await owner.getChild(emma)).ok.hasPicture === true);
r = await dev.verifyPicturePassword(emma, pw);
check("right picture password", r.ok === true, r);
r = await dev.verifyPicturePassword(emma, [{ dog: null }, { cat: null }, { lion: null }]);
check("order matters", r.ok === false, r);
r = await dev.verifyPicturePassword(liam, pw);
check("device cannot verify sibling", tag(r.err) === "notAuthorized", r);
for (let i = 0; i < 4; i++) await dev.verifyPicturePassword(emma, [{ fox: null }, { fox: null }, { fox: null }]);
r = await dev.verifyPicturePassword(emma, pw);
check("soft lockout after 5 misses", tag(r.err) === "rateLimited", r);
r = await owner.clearPicturePassword(emma);
check("clearPicturePassword", "ok" in r && (await owner.getChild(emma)).ok.hasPicture === false, r);

// Devices list and revoke
r = await owner.listDevices();
check("listDevices", r.ok.length === 1 && r.ok[0].childId === emma && r.ok[0].lastActive > 0n, r);
r = await other.revokeDevice(tab.id.getPrincipal());
check("other family cannot revoke", tag(r.err) === "notFound", r);
const kept = await newDevice();
await kept.a.redeemPairingCode((await owner.createPairingCode(emma)).ok.code, "Kept");
r = await owner.revokeDevice(kept.id.getPrincipal());
check("revokeDevice", "ok" in r, r);
check("revoked device is none at once", tag(await kept.a.getMyRole()) === "none");
r = await kept.a.getChild(emma);
check("revoked device gets notAuthorized", tag(r.err) === "notAuthorized", r);

// Deleting a child unpairs its devices
const liamTab = await newDevice();
r = await liamTab.a.redeemPairingCode((await owner.createPairingCode(liam)).ok.code, "Liam tab");
check("pair second device", "ok" in r, r);
await owner.deleteChild(liam);
check("deleting the child unpairs its device", tag(await liamTab.a.getMyRole()) === "none");
check("deleted child's device gone from list", (await owner.listDevices()).ok.every((d) => d.childId !== liam));

// Global throttle: wrong codes from many fresh keys (last, as it blocks redeeming for up to 60 s)
let limited = false;
for (let i = 0; i < 40 && !limited; i++) {
  r = await (await newDevice()).a.redeemPairingCode("000000", "Bot");
  limited = tag(r.err) === "rateLimited";
}
check("wrong codes across many callers hit the global limit", limited, r);
// Wait the lock out so the next run (or suite) starts clean.
if (limited) await new Promise((ok) => setTimeout(ok, Number(r.err.rateLimited.retryAfterNs / 1_000_000n) + 1000));

console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
