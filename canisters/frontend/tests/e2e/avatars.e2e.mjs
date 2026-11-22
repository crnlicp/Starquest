// End-to-end check of the Phase 11 avatar API (item unlocks, dress-up access, one item per slot).
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
const keyFile = join(tmpdir(), "starquest-e2e-avatars-key.json");
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

const kid = (name, accessories = []) => ({ name, age: 7n, avatar: { character: "fox", accessories }, favoriteColor: "blue", dailyGoal: [] });
const look = (accessories, character = "dragon") => ({ character, accessories });

if (mode === "after-upgrade") {
  if (!existsSync(keyFile)) {
    console.error("No saved key: run the full e2e first.");
    process.exit(1);
  }
  const owner = await actor(Ed25519KeyIdentity.fromJSON(readFileSync(keyFile, "utf8")));
  const kids = (await owner.listChildren()).ok ?? [];
  const mia = kids.find((c) => c.name === "Mia");
  check("worn avatar survives upgrade", mia?.avatar.character === "dragon" && mia.avatar.accessories.includes("hat-crown"), mia?.avatar);
  process.exit(failed ? 1 : 0);
}

const anon = await actor(new AnonymousIdentity());
const ownerId = Ed25519KeyIdentity.generate();
const owner = await actor(ownerId);
const other = await actor(Ed25519KeyIdentity.generate());
writeFileSync(keyFile, JSON.stringify(ownerId.toJSON()));
await owner.createFamily("Avatar Family", 0n);
await other.createFamily("Other Family", 0n);

let r = await owner.addChild(kid("Bad", ["hat-crown"]));
check("addChild with a locked item rejected", tag(r.err) === "invalid", r);
const mia = (await owner.addChild(kid("Mia", ["hat-party"]))).ok.id;

r = await anon.listAvatarItems(mia);
check("anonymous listAvatarItems rejected", tag(r.err) === "notAuthorized", r);
r = await other.listAvatarItems(mia);
check("other family cannot list items", tag(r.err) === "notFound", r);
r = await owner.listAvatarItems(mia);
const items = r.ok ?? [];
const open = (id) => items.find((i) => i.id === id)?.unlocked;
check("21 items, free ones open, crown locked", items.length === 21 && open("hat-party") && open("bg-sky") && !open("hat-crown"), items.length);

r = await owner.setAvatar(mia, look(["hat-crown"]));
check("locked item refused", tag(r.err) === "invalid", r);
r = await owner.setAvatar(mia, look(["hat-party", "hat-cap"]));
check("two hats refused", tag(r.err) === "invalid", r);
r = await owner.setAvatar(mia, look(["nope"]));
check("unknown item refused", tag(r.err) === "invalid", r);
r = await other.setAvatar(mia, look(["hat-party"]));
check("other family cannot dress child", tag(r.err) === "notFound", r);
r = await anon.setAvatar(mia, look([]));
check("anonymous setAvatar rejected", tag(r.err) === "notAuthorized", r);

r = await owner.logCustom(mia, 70n, "big day", []);
check("points logged", "ok" in r, r);
await owner.logCustom(mia, 60n, "bigger day", []);
r = await owner.listAvatarItems(mia);
check("level 3 opens crown, wizard stays locked", r.ok?.find((i) => i.id === "hat-crown")?.unlocked && !r.ok?.find((i) => i.id === "hat-wizard")?.unlocked, null);
r = await owner.setAvatar(mia, look(["hat-crown", "bg-rainbow", "glasses-round"]));
check("crown, rainbow and glasses saved", "ok" in r && r.ok.avatar.character === "dragon" && r.ok.avatar.accessories.length === 3, r);

console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
