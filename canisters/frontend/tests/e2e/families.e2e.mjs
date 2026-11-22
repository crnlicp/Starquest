// End-to-end check of the Phase 1 backend API (families, parent PIN, caregivers) against the local network.
// Usage (from repo root, after `npm run deploy:local`):
//   npm run test:e2e                      # full run; saves the owner key for the upgrade check
//   npm run test:e2e -- --after-upgrade   # after redeploying: checks the data from the last run survived
// Keys are throwaway Ed25519 identities; nothing is added to the icp keystore.
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
const keyFile = join(tmpdir(), "starquest-e2e-owner-key.json");
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
    console.error("No saved owner key: run the full check before upgrading.");
    process.exit(1);
  }
  const owner = await actor(Ed25519KeyIdentity.fromJSON(readFileSync(keyFile, "utf8")));
  const fam = await owner.getMyFamily();
  check("family survives upgrade", "ok" in fam && fam.ok.name === "Test Family" && fam.ok.hasPin, fam);
  const parents = await owner.listParents();
  check("parents survive upgrade (owner only)", "ok" in parents && parents.ok.length === 1, parents);
  process.exit(failed ? 1 : 0);
}

const anon = await actor(new AnonymousIdentity());
const ownerId = Ed25519KeyIdentity.generate();
const owner = await actor(ownerId);
const care = await actor(Ed25519KeyIdentity.generate());
const other = await actor(Ed25519KeyIdentity.generate());
writeFileSync(keyFile, JSON.stringify(ownerId.toJSON()));

let r = await anon.createFamily("Anon", 0n);
check("anonymous createFamily rejected", tag(r.err) === "notAuthorized", r);
check("anonymous role is none", tag(await anon.getMyRole()) === "none");
r = await anon.verifyParentPin("1234");
check("anonymous verifyParentPin rejected", tag(r.err) === "notAuthorized", r);

r = await owner.createFamily("   ", 60n);
check("empty family name rejected", tag(r.err) === "invalid", r);
r = await owner.createFamily("  Test Family  ", 60n);
check("owner creates family (name trimmed)", "ok" in r && r.ok.name === "Test Family" && !r.ok.hasPin && r.ok.settings.tzOffsetMinutes === 60n, r);
r = await owner.createFamily("Second", 0n);
check("second family for same parent rejected", tag(r.err) === "alreadyExists", r);
const role = await owner.getMyRole();
check("owner role", "parent" in role && "owner" in role.parent.kind, role);

r = await owner.setParentPin("12a4", []);
check("non-digit PIN rejected", tag(r.err) === "invalid", r);
r = await owner.setParentPin("1234", []);
check("first PIN set", "ok" in r, r);
r = await owner.setParentPin("5678", []);
check("changing PIN without current rejected", tag(r.err) === "notAuthorized", r);
r = await owner.verifyParentPin("1234");
check("correct PIN verifies", r.ok === true, r);
for (let i = 1; i <= 4; i++) {
  r = await owner.verifyParentPin("0000");
  check(`wrong PIN #${i} -> false`, r.ok === false, r);
}
r = await owner.verifyParentPin("0000");
check("wrong PIN #5 -> false (locks)", r.ok === false, r);
r = await owner.verifyParentPin("1234");
check("locked: even correct PIN rate-limited", tag(r.err) === "rateLimited" && r.err.rateLimited.retryAfterNs > 0n, r);

r = await owner.updateSettings({ ...(await owner.getMyFamily()).ok.settings, tzOffsetMinutes: 5000n });
check("invalid settings rejected", tag(r.err) === "invalid", r);

r = await care.createInvite();
check("non-parent cannot create invite", tag(r.err) === "notAuthorized", r);
const inv = await owner.createInvite();
check("owner creates invite (64-hex token)", "ok" in inv && /^[0-9a-f]{64}$/.test(inv.ok.token), inv);
r = await anon.acceptInvite(inv.ok.token);
check("anonymous cannot accept invite", tag(r.err) === "notAuthorized", r);
r = await care.acceptInvite(inv.ok.token);
check("caregiver accepts invite", "ok" in r && r.ok.name === "Test Family", r);
r = await other.acceptInvite(inv.ok.token);
check("invite is single use", tag(r.err) === "notFound", r);
const careRole = await care.getMyRole();
check("caregiver role", "parent" in careRole && "caregiver" in careRole.parent.kind, careRole);
r = await care.getMyFamily();
check("caregiver reads own family", "ok" in r && r.ok.name === "Test Family", r);
r = await other.getMyFamily();
check("outsider cannot read family", tag(r.err) === "notAuthorized", r);
r = await care.renameFamily("Test Family");
check("caregiver can update family", "ok" in r, r);

r = await owner.listParents();
check("two parents listed", "ok" in r && r.ok.length === 2, r);
r = await care.removeParent(ownerId.getPrincipal());
check("caregiver cannot remove owner", tag(r.err) === "notAuthorized", r);
r = await owner.removeParent(ownerId.getPrincipal());
check("owner cannot remove self", tag(r.err) === "invalid", r);
r = await owner.removeParent(await care.whoami());
check("owner removes caregiver", "ok" in r, r);
r = await care.getMyFamily();
check("removed caregiver loses access", tag(r.err) === "notAuthorized", r);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
