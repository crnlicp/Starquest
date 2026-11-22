# Star Quest — Build Plan (ICP)

Source spec: [specs.md](specs.md). This plan splits the build into phases that can each be done in **one separate session**. Each phase ends in a working, committed state.

## How to use this plan (per session)

1. Open a new session and say: *"Do Phase N from docs/plan.md."*
2. Read `~/.claude/icp/RULES.md` (shared ICP rules — they win over this plan if they ever disagree), this file, and only the files listed under the phase's "Touches". Load the listed skills; skills win over memory.
3. Set the phase status to `🟡 In progress` at the start, `✅ Done` at the end (or `⛔ Blocked` + a note).
4. Tick the task checkboxes, fill in "Session notes" (decisions, deviations, follow-ups) — keep it short.
5. Verify the acceptance criteria, then commit (`phase N: <summary>`).

Status legend: `⬜ Not started` · `🟡 In progress` · `✅ Done` · `⛔ Blocked`

## Status overview

| # | Phase | Status | Depends on |
|---|-------|--------|-----------|
| 0 | Project scaffold & toolchain | ✅ Done | — |
| 1 | Backend: families, parents, PIN, caregivers | ✅ Done | 0 |
| 2 | Backend: children, behaviors, logging, points/levels/streaks | ✅ Done | 1 |
| 3 | Backend: rewards, approvals, badges, missions, reports, sync | ✅ Done | 2 |
| 4 | Backend: device pairing, picture passwords, security pass | ✅ Done | 3 |
| 5 | Frontend foundation: auth, bindings, i18n, design system, PWA shell | ✅ Done | 1 |
| 6 | Parent app: onboarding, family home, quick log, behaviors | ✅ Done | 2, 5 |
| 7 | Parent app: rewards mgmt, approvals inbox, missions | ✅ Done | 3, 6 |
| 8 | Kid Mode: avatar picker, child profile, shop, celebrations | ✅ Done | 7 |
| 9 | Kid device pairing & live sync | ✅ Done | 4, 8 |
| 10 | Reports, history, certificates, settings | ✅ Done | 7 |
| 11 | Avatars, customization, Lottie & sound assets | ✅ Done | 8 |
| 12 | Polish: optimistic UI, a11y, reduced motion, perf, tests | ✅ Done | 9, 10, 11 |
| 13 | Mainnet deployment | 🟡 In progress | 12 |

---

## Architecture decisions (apply to all phases)

Stack (matches [specs.md](specs.md), `~/.claude/icp/RULES.md` and the ICP skills in `~/.claude/skills`):

Repo layout (flat, path-based canisters — RULES.md "Folder structure"):

```text
Starquest/
├── icp.yaml            # networks, environments, canisters: [canisters/*]
├── package.json        # scripts only; delegates via npm --prefix / cd … && mops …
├── scripts/            # cross-canister scripts (deploy-local, seed)
├── docs/
└── canisters/
    ├── backend/        # canister.yaml (@dfinity/motoko), mops.toml, mops.lock, test/, scripts/
    │   └── src/        # main.mo, backend.did, types.mo, types/, lib/, mixins/, migrations/
    └── frontend/       # canister.yaml (@dfinity/static-site, dir: build/client), package.json,
                        # vite.config.ts, react-router.config.ts, app/, public/, scripts/, tests/
```

- **Tooling:** `icp` CLI (recipes pinned: `@dfinity/motoko@v5.0.0`, `@dfinity/static-site@v1.0.0`), `mops` (pinned `moc`, `core`). Verify unfamiliar flags with `icp <cmd> --help`. Run `mops check` before building. Behind the TLS proxy set `NODE_EXTRA_CA_CERTS=~/.local/share/certs/volvo-got-fw-rootca-2026-10.pem` and leave `NODE_OPTIONS` empty (see Phase 0 notes).
- **Canisters:** folder name = canister name: `backend` (Motoko actor — persistent by default on moc 2, so no `persistent` keyword; `mo:core` only), `frontend` (static-site). One backend canister as per spec.
- **Frontend:** React Router (framework mode, SPA, `ssr: false`) + Vite, source in `canisters/frontend/app/` (`root.tsx`, `routes.ts`, `routes/`, `components/`, `lib/`, `i18n/`), static files and `_headers` / `_redirects` / `.well-known/` in `public/`.
- **Frontend libs:** `@icp-sdk/core@^6`, `@icp-sdk/auth@^11` (`AuthClient`, mainnet II by default), `@icp-sdk/bindgen` Vite plugin generating `app/bindings/` (generated, not committed) from the committed `canisters/backend/src/backend.did`.
- **Canister IDs / root key:** from the `ic_env` cookie via `safeGetCanisterEnv()` (`PUBLIC_CANISTER_ID:backend`, `IC_ROOT_KEY`); Vite dev server simulates the cookie. No `.env` canister IDs, no `fetchRootKey()`, no `host` in browser code.
- **Backend layout:** `src/types.mo` + `src/types/`, `src/lib/` (stateless domain logic), `src/mixins/` (public API; state injected as parameters, never declared inside a mixin), `src/main.mo` (composition root, owns state, no public methods), `src/migrations/` (`YYYYMMDD_HHMMSS.mo`), `test/` (mops tests).
- **State & migrations:** enhanced orthogonal persistence. No `stable` keyword, no upgrade hooks, no `mo:base`, no `.vals()`. Stable fields are declared without initializers; the first migration (`OldActor = {}`) supplies initial values from Phase 0 on. Non-stable-compatible changes go in the **single pending migration** (create one only if none is pending, else edit it; `check-limit = 1`, never raised). Stable-compatible changes need no migration. Never edit an applied migration.
- **Candid:** after any interface change, `mops generate candid backend` and commit the `.did`.
- **Git:** commit `.icp/data/`; ignore `.icp/cache/`, `.mops/`, `build/`, `.react-router/`, `app/bindings/`, `node_modules/`, `deployed/`. Never delete `.icp/`.
- **Identities:** local work always uses `--identity anonymous` (unless `ICP_IDENTITY` is set); never `prod-identity` locally. Anything touching mainnet (`-e ic`, `prod-identity`, cycles, controllers) needs explicit approval every time.
- **Local dev:** `icp network start -d` → `icp deploy --identity anonymous`; sign-in against mainnet II (no local II unless offline).
- **After local verification:** Motoko needs no cleanup; delete leftover PocketIC `/tmp/.tmp*` folders only if no running process uses them (see RULES.md).
- **Time:** all timestamps `Int` nanoseconds (`Time.now()`); "day" boundaries computed using the family's timezone offset (stored in family settings, sent by the frontend).
- **Roles:** caller resolution → `#parent(familyId)` | `#device(familyId, childId)` | `#none`. Every public method starts with a guard. Anonymous rejected everywhere.
- **PIN / picture password:** salted SHA-256 hash stored in backend; verification is an **update** call with attempt limiting (a 4-digit space is tiny, so rate limiting is the real protection). `mo:core` has no SHA-256, so this needs a mops package (e.g. `sha2`) — **ask the user before adding it** (Phase 1).
- **Randomness:** cryptographic randomness from the management canister (`raw_rand`, or `mo:core/Random` if present — check `api-reference.md`) for pairing codes, invite tokens, salts.
- **Sync:** every mutation bumps a per-family `version` and records `updatedAt`; `getChangesSince(ts)` returns changed entities + server time.
- **i18n:** `i18next` + `react-i18next`, `en` and `sv` JSON files; no hard-coded UI strings.
- **No external calls:** all fonts, sounds, Lottie JSON, avatars bundled in the frontend.

---

## Phase 0 — Project scaffold & toolchain
**Status:** ✅ Done
**Skills:** `icp-cli` (+ `references/binding-generation.md`, `references/dev-server.md`), `mops-cli`, `writing-motoko` (+ `references/project-setup.md`), `migrating-motoko-actors`, `static-site`
**Touches:** new files at root, `canisters/backend/`, `canisters/frontend/`

Tasks
- [x] Check toolchain: `icp --version`, `mops --version`, Node ≥ 22 (install `@icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops` if missing); TLS proxy: see notes below.
- [x] Root `icp.yaml`: `canisters: [canisters/*]`, local network (optional `gateway.port: 0` for parallel worktrees).
- [x] `canisters/backend/canister.yaml` (`name: backend`, recipe `@dfinity/motoko@v5.0.0`) + `mops.toml` via `mops` CLI (pin `moc`, add `core`, `[canisters.backend] main = "src/main.mo"`, `candid = "src/backend.did"`, migrations dir `src/migrations`, `check-limit = 1` — re-added in Phase 1).
- [x] Minimal backend in the target layout (`types.mo`, `lib/`, `mixins/`, `main.mo`) with a `whoami()` query; `mops check` clean. (Migration chain deferred to Phase 1 — see notes.)
- [x] `mops generate candid backend` → commit `src/backend.did`.
- [x] `canisters/frontend/`: React Router (SPA mode) + Vite + TS; `canister.yaml` (`name: frontend`, recipe `@dfinity/static-site@v1.0.0`, `dir: build/client`, build steps `npm install`, `npm run build`); deps `@icp-sdk/core@^6`, `@icp-sdk/auth@^11`, `@icp-sdk/bindgen` (Vite plugin → `app/bindings`), framer-motion, canvas-confetti, lottie-react, recharts, i18next, react-i18next.
- [x] Vite dev server `ic_env` cookie simulation (guarded by `command === "serve"`).
- [x] `public/_redirects` (`/*  /index.html  200`) and `public/_headers` baseline (CSP, cache headers).
- [x] `.gitignore` per the Git rule above.
- [x] Root `package.json` (scripts only): `dev` (`npm --prefix canisters/frontend run dev`), `build`, `check` (`cd canisters/backend && mops check`), `gen:candid` (`cd canisters/backend && mops generate candid backend`), `deploy:local` (`scripts/deploy-local.sh`, uses `--identity anonymous`).
- [x] Short `README.md` with local run steps.

Acceptance
- `icp network start -d && icp deploy --identity anonymous` succeeds locally; the frontend URL loads and displays the principal returned by `whoami()` via generated bindings.

Session notes:
- Verified: `mops check` + lint pass; `icp deploy` (anonymous) creates both canisters; `icp canister call backend whoami --query` → `2vxsx-fae`; frontend serves the SPA shell on deep links with the CSP and an `ic_env` cookie carrying `PUBLIC_CANISTER_ID:backend`; the generated IDL called from Node returns `2vxsx-fae`. **Not checked in a real browser** (Chrome extension not connected) — open `http://frontend.local.localhost:8000/` once.
- TLS proxy fix: the system store has stale `got-fw-rootca`/`got-fw-subca` certs (expire 2026-11-28); the proxy signs with renewed ones with the same names. Node works with `NODE_EXTRA_CA_CERTS=~/.local/share/certs/volvo-got-fw-rootca-2026-10.pem` and **without** `--use-system-ca` (that flag makes Node pick the stale root again). `deploy-local.sh` no longer sets `NODE_OPTIONS`.
- Toolchain: moc 2.2.4, lintoko 0.12.0, `core` 2.7.0. moc 2 → plain `actor` (persistent by default), no `--default-persistent-actors`.
- Migration chain: a configured `[canisters.backend.migrations]` with no files fails with M0251, and an identity migration must not exist, so the chain config is **not** in `mops.toml` yet. Phase 1 adds it (`chain = "src/migrations"`, `check-limit = 1`) together with the first migration (`OldActor = {}`).
- Vite: `react-router build` loads the config with `command: "serve"`, so the dev-server `ic_env` guard also checks `mode === "development"`. TS 7 removed `baseUrl`.
- `icp canister call` asks for confirmation interactively; pipe `echo y |` in scripts.
- Deferred deps (framer-motion, canvas-confetti, lottie-react, recharts, i18next): added in the phases that use them.

---

## Phase 1 — Backend: families, parents, PIN, caregivers
**Status:** ✅ Done
**Skills:** `writing-motoko`, `migrating-motoko-actors`, `canister-security`
**Touches:** `canisters/backend/*`

Tasks
- [x] Ask the user to approve a SHA-256 mops package (`sha2` is cached locally); add it with `mops add`.
- [x] Add `[canisters.backend.migrations]` (`chain = "src/migrations"`, `check-limit = 1`) to `mops.toml` together with the first migration file.
- [x] Declare stable state (families, parents, invites, attempt counters) in `main.mo` and give it initial values in the pending migration.
- [x] `types.mo`: `Family`, `Parent`, `Settings`, `Invite`, IDs, `Role`, error variant `Error` (`#notAuthorized`, `#notFound`, `#invalid : Text`, `#rateLimited`, …); all mutations return `Result`.
- [x] Access-control helpers: `requireAuthenticated`, `resolveRole(caller)`, `requireParent(familyId)`.
- [x] `createFamily(name, tzOffset)` — caller becomes owner parent; one family per parent principal.
- [x] `getMyFamily()` / `getMyRole()` queries.
- [x] PIN: `setParentPin(pin)` (first time, or with old PIN), `verifyParentPin(pin)` (update, 5 tries → 1 min lock), salted hash.
- [x] Caregivers: `createInvite()` → random token (expiry 7 days, single use); `acceptInvite(token)`; `listParents()`; `removeParent(principal)` (owner only, cannot remove self/owner).
- [x] Family `Settings` record (language, sound, animation level, leaderboard, reminder time, daily goal default, tz offset) + `updateSettings`.
- [x] Input validation helpers (text length, ranges).

Acceptance
- Using `icp canister call` with two identities: create family, set/verify PIN (incl. lockout), invite + accept, remove caregiver; anonymous calls rejected.
- `icp deploy --identity anonymous` (upgrade) keeps data.

Session notes:
- API (see `src/backend.did`): `createFamily(name, tzOffsetMinutes)`, `getMyRole`, `getMyFamily`, `renameFamily`, `updateSettings`, `listParents`, `removeParent`, `setParentPin(newPin, ?currentPin)`, `verifyParentPin`, `createInvite`, `acceptInvite`, `revokeInvite`, `whoami`. Errors: `#notAuthorized | #notFound | #alreadyExists | #invalid Text | #rateLimited {retryAfterNs}`.
- Layout: `types.mo` (one `State` record with `var nextFamilyId`, passed to every mixin), `lib/{Validation,Pin,Families,Invites}.mo`, `mixins/{Health,Families,ParentPin,Caregivers}.mo`. First migration `src/migrations/20261121_*.mo` (`OldActor = {}`) is **pending until the first mainnet deploy** — extend it (not a new file) for Phase 2–4 state; locally it was applied, so a local state reset (`icp deploy --mode reinstall` locally) may be needed when the pending file changes.
- PIN: salted SHA-256 (`sha2` 0.3.2, salt = 32 bytes from `Random.blob()`), lockout per family: 5 failures → 60 s, success resets. Invites: 64-hex token, 7-day TTL, single use (consumed even if expired), max 10 open per family, expired ones pruned on create.
- After every `await Random.blob()` the mixin re-checks membership and (for PIN) that the stored PIN didn't change.
- Verified locally: `npm run test:e2e` (`canisters/frontend/tests/e2e/families.e2e.mjs`, 32 checks with throwaway Ed25519 keys: anonymous rejection, validation, PIN set/change/lockout, invite create/accept/single-use, caregiver access, owner-only removal), then redeploy + `npm run test:e2e -- --after-upgrade` (data intact). Later phases should extend this suite (or add sibling `*.e2e.mjs` files); Phase 12 folds it into CI-style tests.
- moc 2 gotchas: module-level `let` must be static (no arithmetic, no method calls — use literals); `case (#ok)` doesn't match `#ok x` — use `#ok _`; `Text.fromChar` is deprecated → `c.toText()`.

---

## Phase 2 — Backend: children, behaviors, logging, points/levels/streaks
**Status:** ✅ Done
**Skills:** `writing-motoko`
**Touches:** `canisters/backend/*`

Tasks
- [x] `Child` (name, age, avatar config, favorite color, balance, xp, dailyGoal, streak, lastGoalDay, savingForRewardId, pictureHash?, createdAt). CRUD: `addChild`, `updateChild`, `deleteChild` (parents only).
- [x] `Behavior` (name, emoji, points, `#good | #oops`, `assignedTo : ?[ChildId]`, enabled, missionSuggestion?). CRUD.
- [x] Starter library constant (8 good + 5 oops from spec) and `enableStarterBehaviors(ids)`; new families get them auto-enabled.
- [x] `LogEntry` (childId, behaviorId?, points, note?, timestamp (backdatable), createdBy, kind `#behavior | #custom | #mission | #reward | #reset`).
- [x] `logBehavior(childId, behaviorId, note?, at?)`, `logCustom(childId, points, reason, at?)`, `deleteLogEntry(id)` (reverts balance; XP rules below).
- [x] Points rules: good → +balance +xp; oops → −balance (floor 0), xp unchanged; deleting an entry reverses its effect (xp may decrease only via undo).
- [x] Levels table (10 levels, "Little Star" → "Superstar Legend", XP thresholds) in a shared module; return `LogResult { entry, newBalance, newXp, leveledUp : ?Level, newBadges : [BadgeId], goalReached : Bool, streak }` so the UI can animate.
- [x] Daily goal + streak computation (using tz offset), recomputed on backdate/delete for the affected day.

Acceptance
- Call sequence via CLI shows balance floors at 0, XP never drops on oops, level-up flagged at threshold, streak increments across simulated days (unit-test pure `lib/` functions with `mops test` in `canisters/backend/test/`).

Session notes:
- API: `addChild(ChildInput)`, `updateChild(id, ChildInput)`, `deleteChild`, `listChildren`, `getChild` (→ `ChildView` with `level`, `nextLevelXp`, `todayPoints`, `streak`); `addBehavior(BehaviorInput)`, `updateBehavior`, `setBehaviorEnabled`, `deleteBehavior`, `listBehaviors`, `listStarterBehaviors`, `enableStarterBehaviors(keys)`; `logBehavior(childId, behaviorId, ?note, ?at)`, `logCustom(childId, points, reason, ?at)`, `deleteLogEntry(id)` (→ updated `ChildView`), `getLevels`.
- State (in `Types.State`, all added to the still-pending first migration; local reinstall was needed): `children`, `behaviors`, `logs : Map<ChildId, Map<LogId, LogEntry>>`, `logOwner : Map<LogId, ChildId>` (find entry by id), `dayXp : Map<ChildId, Map<day, Nat>>`, counters. `Child` already carries `savingForRewardId` and `picture : ?PinHash`; `Behavior` carries `mission : ?{suggestion; refund}` and `starterKey` (Phase 3 badges such as Kindness Hero can key on `starterKey = "kind"`).
- Rules: daily goal progress = XP earned that day (oops don't drain the ring). Streak = consecutive days with dayXp ≥ child's current `dailyGoal`, ending today, or yesterday while today isn't met. Each entry stores `day` (family-local day at log time) plus the applied `balanceDelta`/`xpDelta`, so undo reverses exactly what was applied (balance floors at 0 if already spent). `#reward`/`#reset` entries can't be undone. `newBadges` is always `[]` until Phase 3.
- Limits: 20 children, 100 behaviors per family; behavior points 1–100, custom −100..100 (≠0), mission refund ≤ points, note/reason ≤ 200, backdate ≤ 365 days, ≤ 5 min in the future. Starter keys: brush-teeth, make-bed, help-sibling, homework, vegetables, kind, bedtime, tidy-toys, hitting, shouting, not-listening, lying, screen-time (all seeded on `createFamily`; oops ones have missions).
- Libs: `lib/{Levels,Points,Days,Children,Behaviors,Logs}.mo`; mixins `mixins/{Children,Behaviors,Logging}.mo`. Unit tests: `canisters/backend/test/lib.test.mo` (`npm run test:backend`). E2E: `canisters/frontend/tests/e2e/children.e2e.mjs` (32 checks); `npm run test:e2e` now runs every `*.e2e.mjs`, also with `-- --after-upgrade`.

---

## Phase 3 — Backend: rewards, approvals, badges, missions, reports, sync
**Status:** ✅ Done
**Skills:** `writing-motoko`
**Touches:** `canisters/backend/*`

Tasks
- [x] `Reward` (name, emoji, optional small image blob ≤ 100 KB, cost, enabled) CRUD; sample rewards seeded on family creation (Ice cream 30, Extra screen time 50, Playground 100, Movie night 150).
- [x] `RewardRequest` (childId, rewardId, status `#pending|#approved|#declined`, createdAt, decidedAt, decidedBy). `requestReward` (parent or device of that child), `decideRequest(id, approve)` — approve checks balance and deducts; `listPendingRequests`.
- [x] `setSavingGoal(childId, rewardId?)` (child device or parent).
- [x] Badges: definitions (First Star, 7-Day Streak, 100 Points Club, Kindness Hero, Clean Room Champion, Comeback Kid, …) evaluated after each log; store `ChildBadge (badgeId, unlockedAt)`.
- [x] Recovery missions: behavior-level suggestion text + refund amount; `startMission(oopsEntryId)`, `confirmMission(id)` (parent) → `#mission` log entry.
- [x] Reports: `getChildStats(childId, range #today|#week|#month|#year)` → totals, good/oops counts, points-over-time buckets, top behaviors; `getHistory(filter, cursor, limit)` paginated; `getWeeklySummary(childId)`.
- [x] `resetPoints(childId)` (sets balance 0 via `#reset` entry; history and XP kept).
- [x] `getChangesSince(ts)` — scoped by role; returns changed children, entries, requests, badges, rewards, behaviors + `serverTime`.

Acceptance
- Request → approve flow deducts points exactly once and rejects if balance insufficient; badges unlock once; `getChangesSince` returns only data visible to the caller.

Session notes:
- API: `addReward(RewardInput)`, `updateReward`, `setRewardEnabled`, `deleteReward`, `listRewards`, `getRewardImage(id)` (images stored apart from `Reward`, which has `hasImage`; `RewardInput.image : #keep | #remove | #set blob`); `setSavingGoal(childId, ?rewardId)`; `requestReward(childId, rewardId)`, `decideRequest(id, approve)` (→ `Decision { request; log : ?LogResult }`), `listPendingRequests`; `startMission(oopsEntryId)`, `confirmMission(id)` (→ `LogResult`), `cancelMission`, `listActiveMissions`; `resetPoints(childId)`; `getChildStats(childId, #today|#week|#month|#year)`, `getWeeklySummary`, `getHistory(filter, ?cursor, limit)`; `getBadgeDefinitions`, `listChildBadges`; `getChangesSince(since)`.
- Requests: price copied at request time; requesting and approving both need balance ≥ cost; one pending request per child+reward, ≤ 20 pending per child. Approval writes a `#reward` entry (no XP), clears the saving goal if it pointed at that reward, and can't be repeated. Deleting a reward declines its pending requests and clears saving goals.
- Missions: only for `#behavior` oops entries whose behavior has a mission; refund = min(mission refund, points actually taken); one live mission per entry. Refund is a `#mission` entry, balance only (no XP, no goal progress). Undoing the refund reopens the mission; an oops with a completed mission can't be undone; undoing an oops cancels its active mission.
- Badges (`lib/Badges.mo`, 8): first-star, streak-7, points-100, kindness-hero (10× starter `kind`), clean-room (10× `tidy-toys`/`make-bed`), comeback-kid (goal reached the day after an oops), make-it-right, first-reward. Checked in `Logs.record`, unlocked once, kept if the entry is undone.
- Reports: rolling ranges ending today (1 / 7 / 30 days with daily buckets, year = 364 days in 52 weekly buckets), day indices as in `lib/Days.mo`. `earned` = XP, `lost` = oops taken, plus `refunded`, `spent`; top 5 behaviors by count. History is newest-logged first (by entry id), cursor = last id, limit 1–100.
- Sync: `getChangesSince` returns everything in the caller's family with `updatedAt`/`createdAt`/`unlockedAt` ≥ `since` (inclusive; upsert by id) plus deletion tombstones (child, behavior, reward, entry) kept 30 days; `complete = false` means reload everything. A child tombstone implies its entries, requests, missions and badges are gone. Timestamps replace the per-family `version` counter. Device access was added in Phase 4.
- State: `rewards`, `rewardImages`, `requests`, `missions`, `badges`, `deletions` + counters, added to the still-pending first migration (local reinstall again). `List.retain` trapped on a fresh list, so `Sync.recordDeletion` rebuilds with `filter`.
- Tests: `canisters/frontend/tests/e2e/rewards.e2e.mjs` (52 checks, also `--after-upgrade`).

---

## Phase 4 — Backend: device pairing, picture passwords, security pass
**Status:** ✅ Done
**Skills:** `writing-motoko`, `canister-security`, `reviewing-motoko`
**Touches:** `canisters/backend/*`

Tasks
- [x] `PairingCode` (6-digit random, childId, expiresAt = now+10 min, used). `createPairingCode(childId)` (parent); returns code + QR payload (`starquest://pair?code=…` / URL with `#code=`).
- [x] `redeemPairingCode(code, deviceName)` from the device's Ed25519 principal → creates `PairedDevice (principal, familyId, childId, name, pairedAt, lastActive)`. Rate limit per caller **and** globally per code: 5 wrong tries → 60 s wait. Single use.
- [x] `listDevices()`, `revokeDevice(principal)` — revoke takes effect immediately (role resolution reads live map).
- [x] Update `lastActive` cheaply (on `requestReward` / a light `heartbeat()` update, throttled).
- [x] Picture password per child: `setPicturePassword(childId, [animalId x3])`, `clearPicturePassword`, `verifyPicturePassword` (gentle: returns Bool, with soft rate limit).
- [x] Security pass: every public method guarded; device principals only read own child + request rewards/set saving goal; input bounds; no unbounded loops over user-controlled sizes (cap counts: children ≤ 10, behaviors ≤ 100, rewards ≤ 50, etc.); periodic cleanup of expired codes/invites (timer).
- [x] Run `reviewing-motoko` checklist; fix Blockers.

Acceptance
- Device identity can read its child, request a reward, cannot log points or read sibling data; revoked device immediately gets `#notAuthorized`; brute-force of codes is throttled.

Session notes:
- API (`mixins/Devices.mo`, logic in `lib/Devices.mo`, `lib/Picture.mo`): `createPairingCode(childId)` → `{code; childId; expiresAt; url = "starquest://pair?code=…"}` (parent; a new code replaces the child's earlier one; ≤ 10 open codes per family). `redeemPairingCode(code, deviceName)` → `PairedDevice` (authenticated key that is neither a parent nor a paired device; single use; ≤ 20 devices per family). `listDevices`, `revokeDevice(principal)` (parent). `heartbeat()`. `setPicturePassword(childId, vec Animal)`, `clearPicturePassword(childId)` (parent), `verifyPicturePassword(childId, vec Animal)` → `Bool` (parent or that child's device).
- Roles: `Role` gains `#device {familyId; childId}`. `Families.requireMember` returns `Access {familyId; childId : ?ChildId}` (null = parent) and `Families.allows(access, childId)` gates child-specific calls. Device lookup reads the live `devices` map and checks the child still exists, so revoke/delete take effect at once. `createFamily`/`acceptInvite` refuse device principals.
- Device-readable (own child only, sibling → `#notAuthorized`): `getMyRole`, `getMyFamily`, `listChildren` (filtered), `getChild`, `listBehaviors`, `listRewards`, `getRewardImage`, `listPendingRequests` (filtered), `getChildStats`, `getWeeklySummary`, `getHistory` (forced to own child), `listChildBadges`, `getChangesSince` (children/entries/badges/requests/missions filtered; behaviors and rewards are family-wide). Device writes: `requestReward`, `setSavingGoal`, `heartbeat`, `verifyPicturePassword`. Everything else stays parent-only.
- Throttling: per caller 5 wrong codes → 60 s lock; globally ≤ 30 wrong codes per 60 s window across all callers (device keys are free, so this is the real cap, ~300 guesses per code lifetime; a flood blocks honest pairing for ≤ 60 s). "Per code" in the task can't be literal: a wrong guess names no code. Picture password: 3 of 12 animals, ordered, repeats allowed; 5 misses → 60 s lock per child; no password set → `true`. Hashes reuse `Pin` (salted SHA-256).
- `lastActive` updates at most every 5 min (`heartbeat`, `requestReward`).
- Cleanup: hourly `Timer.recurringTimer` in `main.mo` (re-armed by the actor body on every install/upgrade) prunes expired invites, codes and finished attempt counters (`lib/Cleanup.mo`). Deleting a child also removes its devices, codes and picture attempts.
- State added to the still-pending first migration (local reinstall needed): `pairingCodes`, `devices`, `pairAttempts`, `var pairWindow`, `pictureAttempts`. Rate-limit counters are persisted on purpose so an upgrade doesn't reset lockouts.
- Review fixes: `Children.remove` no longer mutates `behaviors` while iterating; picture animals are an `Animal` variant, not `Text`; redeem logic moved to `lib/`. Caps already in place: children 20, behaviors 100, rewards 50, pending requests 20/child, invites 10.
- Known/left: deletion tombstones in a device's sync may include sibling entry IDs (IDs only). No `system func inspect` ingress filter (guards already reject anonymous; adding it would turn the anonymous e2e checks into rejects).
- Tests: `tests/e2e/devices.e2e.mjs` (pairing, throttles, device scope, denied parent actions, picture password, revoke, child delete; `--after-upgrade` checks the device survives). It waits out the global lock at the end so reruns start clean.

---

## Phase 5 — Frontend foundation
**Status:** ✅ Done
**Skills:** `user-sign-in`, `icp-cli` (binding-generation, dev-server refs), `static-site`
**Touches:** `canisters/frontend/*`

Tasks
- [x] Actor factory: II identity (parent) or stored Ed25519 identity (device) → `createActor(canisterId, { agentOptions: { identity, rootKey } })` from bindings; `canisterId` and `rootKey` from `safeGetCanisterEnv()`; no `host`, no `fetchRootKey()`.
- [x] Auth context with `@icp-sdk/auth` `AuthClient` (mainnet II default, no `identityProvider`): `await signIn()` in try/catch, `signOut()`, restore via `isAuthenticated()`/`getIdentity()`, react to `subscribe()`/`getStatus()`; no top-level await. Treat principal `2vxsx-fae` as a failed sign-in. Role detection via `getMyRole`.
- [x] Router + screens skeleton (Welcome, Parent area, Kid area) with page transitions (Framer Motion `AnimatePresence`).
- [x] i18n setup (`en`, `sv`), language switch persisted to settings.
- [x] Design system: color tokens (child favorite color as theme var), rounded playful font (bundled), `BigButton` (squish on tap), `Card` (slide/bounce in), `Modal`, `EmojiIcon`, `NumberRoller`.
- [x] Motion settings: `useMotionLevel()` combining `prefers-reduced-motion` + in-app setting; all animations read it.
- [x] Sound manager (bundled small audio files, on/off).
- [x] PWA: manifest, icons, service worker (cache shell assets only), iOS meta tags; extend `_headers` (CSP must allow `https://id.ai` popup and IC API `connect-src`; long cache for hashed assets, no-cache for `index.html`/`sw.js`). No `.ic-assets.json5` (not read by static-site).
- [x] Welcome screen: "I'm a parent" / "I'm a kid!".

Acceptance
- Locally: parent can log in with II, sees their principal/role; app installable (Lighthouse PWA check passes); `sv` switch works.

Session notes:
- **New deps (approved):** `framer-motion`, `i18next`, `react-i18next`, `@fontsource/nunito`. Service worker and sound manager are hand-written.
- **Layout:** `app/lib/` holds `actor.ts`, `auth.tsx` (`AuthProvider`/`useAuth`: one `AuthClient` per page, not disposed, because StrictMode remounts effects), `device.ts` (Ed25519 key in localStorage `starquest.device-key`), `prefs.tsx` (language/sound/animation; local copy in `starquest.prefs`, and a parent's change also calls `updateSettings`), `motion.ts` (`useMotionLevel`), `sound.ts` (`useSound`), `theme.ts` (`kidTheme(color)` sets `--kid`), `pwa.ts`, `storage.ts`. `app/components/` holds `BigButton`, `Card`, `Modal`, `EmojiIcon`, `NumberRoller`, `PrefsPanel`. Routes: `/` Welcome, `/parent`, `/kid`.
- **Motion:** `root.tsx` wraps pages in `MotionConfig reducedMotion` driven by `useMotionLevel()`, so every Framer animation follows it. Page transitions use `AnimatePresence mode="wait"` keyed by pathname with a frozen `useOutlet()`.
- **CSP:** React Router's SPA `index.html` has inline bootstrap scripts that change per build. `scripts/csp-hashes.mjs` runs after `react-router build`, hashes them into `build/client/_headers` (placeholder `__INLINE_SCRIPT_HASHES__`), and fills `__LOCAL_CONNECT__` with `http://localhost:8000 http://*.localhost:8000` only when `ICP_ENVIRONMENT` is unset or `local`. **Phase 13:** check that the served mainnet CSP does not list localhost.
- **Assets:** icons (192, 512, maskable 512, apple-touch 180) and three sounds (`pop`, `ding`, `whoosh`) were generated by a throwaway script as placeholders; Phase 11 replaces them. The SW caches the shell plus `/assets`, `/icons`, `/sounds` (cache-first) and never touches `/api` or other origins; bump `CACHE` in `public/sw.js` when icons or sounds change.
- **Verified locally:** typecheck and build pass; `_headers` served with hashes; a headless Chromium smoke run (playwright-core from another local project, not added here) showed no console or CSP errors, the kid page gets a stable device principal and `#none` role, the `sv` switch works and survives reload, the SW registers, and the manifest has 192/512/maskable icons. Lighthouse 12 dropped its PWA category, so installability was checked by those criteria instead.
- **Not verified:** a real II sign-in (needs an interactive browser; the Chrome extension was not connected). The user accepted the phase without it; check it at the start of Phase 6 work in a real browser.

---

## Phase 6 — Parent app: onboarding, family home, quick log, behaviors
**Status:** ✅ Done
**Skills:** —
**Touches:** `canisters/frontend/*`

Tasks
- [x] Onboarding wizard (< 1 minute): family name → set 4-digit PIN → add first child (name, age, avatar, color) → done (starter behaviors + sample rewards already enabled).
- [x] Family home: children cards with avatar (gentle bounce), points, level, streak flame; "Kid Mode" button; badge count for pending approvals.
- [x] Child CRUD screens.
- [x] Quick log: pick child → tap behavior (2 taps), optional note, backdate picker, custom ± points with reason; undo toast; points fly/oops float animation.
- [x] Behavior management: list, create/edit (emoji picker, points, type, assigned children), enable from starter library, delete.

Acceptance
- New user can go from login to first logged behavior in under a minute; undo works; logging animates instantly.

Session notes:
- **Routes:** a pathless layout `routes/parent.tsx` gates every `/parent/*` page: sign-in, then `#none` → `/parent/onboarding`, `#device` → `/kid`, otherwise the page. Pages: `parent` (home), `parent/onboarding`, `parent/settings` (prefs, principal and role, sign-out), `parent/log?child=`, `parent/children/new`, `parent/children/:id`, `parent/behaviors`, `parent/behaviors/new`, `parent/behaviors/:id`.
- **Data:** `lib/family.tsx` `FamilyProvider` (in `root.tsx`, above the page transitions so navigation doesn't refetch) loads the family, children, behaviors and pending-request count once. `setChild`/`setBehaviors` patch it in place. `lib/result.ts` has `unwrap` (throws `ApiError`) and `errorText` (translated error kinds; backend `invalid` text is shown as-is, English only). `lib/avatars.ts` maps character keys to placeholder emoji until Phase 11.
- **Quick log:** the balance changes optimistically, mirroring the backend's never-below-zero rule. A star float flies to the counter, the avatar jumps (an oops gets a soft float down and a wobble), then the child is refetched. Undo calls `deleteLogEntry` from a toast within 8 s. Note and backdate (`datetime-local` → ns) sit under a collapsed "options" row. Custom ± points use a modal. A level-up shows in the toast only; the full celebration is Phase 8. The child header is sticky so the counter stays in view.
- **Home:** the Approvals button shows the pending count but stays disabled until Phase 7 adds the inbox. "Kid Mode" links to `/kid` (Phase 8).
- **Behaviors:** an enable/disable switch per behavior, create/edit/delete, and a starter library listing starters missing from the family (`enableStarterBehaviors` returns the full list). An existing mission is kept on edit but dropped if it no longer fits (Phase 7 adds the mission UI). Starter names come from the backend in English, so Swedish starter names would need a backend or client mapping later.
- **Dev fixes:** `vite.config.ts` now sets `resolve.tsconfigPaths` (the dev SSR runner couldn't resolve `~/`), and sets the `ic_env` cookie from a middleware plugin (`server.headers` never reached React Router's HTML, so `vite dev` had no canister ID).
- **Dev-only test sign-in:** under `vite dev` only (`import.meta.env.DEV`, absent from the build), `AuthProvider` uses an Ed25519 key from localStorage `starquest.dev-parent-key` as the parent identity, so headless runs can test parent pages without II.
- **Verified:** typecheck and build pass. A headless Chromium run against `vite dev` + the local backend passed:
  - onboarding (family → PIN → child → home);
  - the quick log (counter updates within 300 ms of the tap; undo; an oops at 0 stays 0; custom +12; a backdated log with a note);
  - behaviors (disable, which also hides it from the quick log; create, edit, delete; re-add a deleted starter from the library);
  - child add, edit, delete;
  - Swedish on home.
  The scripted login-to-first-log took 10.8 s. The deployed frontend's smoke run is clean. A real II sign-in was checked by hand on 2026-11-21. It needed `agentOptions.host = "https://icp-api.io"` on the AuthClient, because II calls otherwise go to the local replica, which has no II canister.

---

## Phase 7 — Parent app: rewards management, approvals inbox, missions
**Status:** ✅ Done
**Skills:** —
**Touches:** `canisters/frontend/*`

Tasks
- [x] Reward management: list/create/edit/delete, emoji or image upload (client-side resize/compress to ≤ 100 KB WebP).
- [x] Approvals inbox: pending requests with child avatar, reward, balance check; approve/decline; inbox badge count.
- [x] "Make It Right" mission prompt after an Oops log; mission list per child; parent confirm → refund animation.
- [x] Gentle copy throughout ("Oops!", "You can do it next time!") in both languages.

Acceptance
- Request created from backend/CLI appears in inbox; approve deducts; mission confirm restores points.

Session notes:
- **Shared data:** the family context now also holds rewards, pending requests and active missions. `reloadInbox()` refetches children, requests and missions; the inbox calls it on open, because kids make requests from their own devices. The home Approvals badge counts requests plus active missions.
- **Rewards** (`/parent/rewards`, `/new`, `/:id`): list sorted by cost with an enable switch, create/edit/delete with an emoji palette and an optional photo. `lib/image.ts` resizes the photo in the browser to WebP (512px down to 192px, quality 0.85 down to 0.4) until it is ≤ 100 KB, and caches each reward's picture as an object URL per `updatedAt`. Deleting a reward drops its pending requests locally (the backend declines them).
- **Approvals inbox** (`/parent/approvals`): each request shows the child's avatar and colors, the reward picture or emoji, the cost and the child's balance. Approve is disabled with "Needs N more stars" when the balance has dropped below the cost since the request (the backend refuses a request the child can't afford, so this only happens after a later oops). Active missions are listed per child with Done and cancel.
- **Make It Right:** after an oops whose behavior has a mission, the quick log shows an offer ("Oops! You can do it next time!") with Start mission / Not now. The refund shown is capped by what the oops actually took. The child's active missions are listed on the quick log; Done confirms with the same float-to-counter animation and an undo toast. Undo reloads missions, since undoing an oops cancels its mission and undoing a refund reopens it.
- **Behavior form:** oops behaviors get an optional Make It Right idea and refund; lowering the points clamps the refund instead of dropping the mission.
- **Verified** headlessly against `vite dev` with a fresh dev parent key: reward create with photo, edit keeps photo, toggle, delete; oops → offer → start → Done refunds +5; undo reopens the mission; a request made from Node with the same key appears in the inbox with the badge; short balance blocks approve; confirming the mission then approving deducts; decline leaves the balance; mission edit in the behavior form; Swedish inbox copy. No console errors. The deployed local build passes the smoke test.
- **Not done:** no polling, so a request made while the inbox is open appears on the next visit (live sync is Phase 9). Starter mission suggestions come from the backend in English.

---

## Phase 8 — Kid Mode: avatar picker, child profile, shop, celebrations
**Status:** ✅ Done
**Skills:** —
**Touches:** `canisters/frontend/*`

Tasks
- [x] Enter Kid Mode from parent device; exit / open parent settings requires PIN pad (`verifyParentPin`).
- [x] Avatar picker (big bouncing avatars, idle blink/wave) + picture password (tap 3 animals, shake on wrong, no error text).
- [x] Child profile: avatar, points counter, level bar, daily goal ring (fills, bursts with stars), streak flame (grows with length), trophy shelf, saving-for progress bar.
- [x] Treasure shop: browse rewards, "I want this!" → request; pending state shown; pin "saving for".
- [x] Celebrations: level-up full-screen (confetti, fireworks, badge spin-in, avatar dance), badge unlock (treasure chest), reward approved (gift box shake + pop), oops (wobble, soft float down).
- [x] Read-aloud button (Web Speech API, language-aware).
- [x] Child favorite color theming; icons-first, huge touch targets; no external links.

Acceptance
- A 5-year-old flow works with zero text reading: pick avatar → see points → request reward. All celebrations respect reduced motion.

Session notes:
- Routes: `/kid` (picker), `/kid/:childId` (profile), `/kid/:childId/shop`. `KidProvider` sits at the root next to `FamilyProvider`, because the page transition remounts every route on navigation; it uses member-level calls only, so Phase 9 can feed it a device backend.
- Lock: opening `/kid` as a parent sets `starquest.kidMode` in localStorage; `/parent` redirects to `/kid` until the PIN pad (`verifyParentPin`) clears it. Picture-password unlocks last for one Kid Mode visit (cleared on entry, not exit, so the page fading out doesn't bounce back).
- Parents set or clear the picture password on the child's edit page.
- Celebrations come from `getChangesSince` against a per-child "last seen" time in localStorage: oops, points, badges, approved rewards, then level-up. The first visit only records the time. Phase 9 polling can reuse this.
- No new dependencies: confetti/fireworks are a small canvas component and avatars are still emoji (Lottie art is Phase 11). Calm mode drops confetti, shakes and dances.
- Read-aloud uses `speechSynthesis` (en-US / sv-SE) and hides where unsupported. Badge and level names come from the backend in English.
- Tested headless (`p8.cjs` in the session scratchpad): wrong/right picture password, `/parent` locked, request + pending + pin, wrong/right PIN, catch-up celebrations (oops, points, badge, reward, level), no confetti in reduced motion, no console errors.

---

## Phase 9 — Kid device pairing & live sync
**Status:** ✅ Done
**Skills:** `user-sign-in` (for identity storage notes)
**Touches:** `canisters/frontend/*`

Tasks
- [x] Parent: "Connect a device" on child profile → QR (bundled QR lib, e.g. `qrcode`) + 6-digit code with 10-minute countdown.
- [x] Kid: "I'm a kid!" → camera QR scan (bundled scanner, e.g. `jsqr` / BarcodeDetector) or code keypad; generate an `Ed25519KeyIdentity` (`@icp-sdk/core/identity`), persist in IndexedDB; redeem; "teleport" sparkle animation.
- [x] Device boots straight into that child's Kid Mode when a stored identity resolves to `#device`; on `#notAuthorized` → clear identity, back to Welcome.
- [x] Polling `getChangesSince` every ~5 s while visible, immediate refresh on `visibilitychange`/focus; stop when hidden.
- [x] Incoming parent-logged points/approvals on the device play the full animation (queue events, play once).
- [x] Connected devices screen: name, child, last active, disconnect.
- [x] Wrong-code throttle messaging (friendly wait timer).

Acceptance
- Two browsers: parent logs points → kid device animates within ~5 s; revoke → kid device returns to Welcome on next poll.

Session notes:
- 2026-11-21. Added `qrcode` (user approved). No scanner library: the QR holds a web link (`<origin>/kid?code=NNNNNN`), so any phone camera opens the app with the code; in-app scanning uses the built-in `BarcodeDetector` where it exists, and the 6-digit keypad works everywhere.
- The device key stays in localStorage (`starquest.device-key`, from Phase 4), not IndexedDB; `starquest.pairedChild` marks a paired device so Welcome goes straight to `/kid`. `getMyRole` decides: `#device` → that child's profile (no picker, no picture password, no 🔒); otherwise the key is dropped and pairing is offered.
- `KidProvider` takes either the parent backend or the device backend. While on `/kid` it polls `getChangesSince` every 5 s when visible (and at once on focus/visibility), reloads on news and bumps `pulse`; the profile reruns its catch-up on each pulse, so live points play the same celebrations. `#notAuthorized` on a device → forget key, back to Welcome. Device heartbeat every 5 min.
- Parent side: a 📱 Devices card on the child's edit page (QR, code, countdown, auto-close when the device arrives, device list with last active, disconnect with confirm). No separate all-devices screen yet (Phase 10 settings).
- Wrong codes: the shared keypad shows "Let's wait N seconds" with a live countdown on `#rateLimited`.
- Headless two-browser test: code + QR-link pairing, teleport, reload boots into the profile, parent points animate on the device in ~1.3 s, revoke returns the device to Welcome in ~3.5 s, throttle message; Phase 8 test still passes; no console errors.
- **Not done:** the parent's own screens still don't poll (an approval request appears on the next visit). Not tried on a real phone camera.

---

## Phase 10 — Reports, history, certificates, settings
**Status:** ✅ Done
**Skills:** `dataviz`
**Touches:** `canisters/frontend/*`

Tasks
- [x] Per-child dashboard (today/week/month/year): Recharts points-over-time, good vs oops ratio, most frequent behaviors.
- [x] Weekly summary card (localized sentence).
- [x] Activity history with filters (child, type, date range), pagination, delete entry.
- [x] Reset points with confirmation.
- [x] Printable/shareable certificate for level-ups / big badges (print CSS + `navigator.share` with a canvas-rendered PNG).
- [x] Settings: language, sound, animation intensity, sibling leaderboard (off by default) + leaderboard view, daily in-app reminder (banner at set time if nothing logged today), change PIN, manage caregivers (invite link + remove), manage devices & picture passwords per child.

Acceptance
- Charts render with real data in both themes/languages; settings persist across devices of the same family.

Session notes:
- 2026-11-21. No Recharts (user chose hand-written SVG): `components/Charts.tsx` has the earned-above / lost-below bar chart with hover/focus tooltip, legend and a table view, the good-vs-oops split bar and the top-behaviors list. Chart colors `--chart-earned` / `--chart-lost` (blue/orange) pass the dataviz validator in light and dark; the app's green/red failed the colorblind check.
- Routes: `/parent/children/:id/report` (weekly sentence, today/week/month/year, stat tiles, charts, certificates, reset with confirm) and `/parent/history` (child/type/date filters in the URL, 20 per page with Load more, delete with confirm; reward and reset entries have no delete, as the backend refuses them).
- Certificate: canvas PNG for the current level or any earned badge; Print (print CSS shows only the picture), Share via `navigator.share` with the file, otherwise Save picture.
- Settings: family options card (sibling leaderboard, daily reminder time), change PIN, caregivers (list, invite link, cancel invite, owner removes), links to each child for devices and picture passwords. Language/sound/animation were already there. Invite links open `/parent/onboarding?invite=…`, which offers "Join the family".
- Home: reminder banner after the set time when nothing is logged today (dismissed until tomorrow), leaderboard of this week's stars when turned on, Report link per child, History button.
- `patchSettings` reads the latest settings and queues saves one at a time; three quick toggles used to overwrite each other. History drops replies from older filter requests.
- Generated bindings send an optional `0` as none, so a reminder at 00:00 is saved as 00:01.
- Headless test (two parents, dark + Swedish): all steps pass, no console errors; Phase 8 and 9 tests still pass.
- **Not done:** printing and sharing tried only headless (no real printer or share sheet). Badge, level and behavior names in reports come from the backend in English.

---

## Phase 11 — Avatars, customization, Lottie & sound assets
**Status:** ✅ Done
**Skills:** —
**Touches:** `canisters/frontend/public/assets/*`, avatar components, backend `Child.avatar` (unlocks)

Tasks
- [x] Avatar set: animals / monsters / robots (SVG layers or Lottie), original artwork, small file sizes.
- [x] Unlockable items (hats, glasses, backgrounds) tied to levels/badges; backend `unlockedItems` + `setAvatarConfig` (device or parent).
- [x] Avatar customization screen with preview and equip animations.
- [x] Lottie animations: idle, cheer/jump, wobble, dance, teleport. Lazy-load per screen.
- [x] Sound pack (happy coin, soft oops, fanfare, chest open, pop) — tiny, bundled.

Acceptance
- Unlocked items appear after reaching the right level; total asset payload stays small (target: initial JS+assets < 1.5 MB gzipped).

Session notes:
- **No Lottie** (user's choice): avatars are layered SVG in `components/AvatarArt.tsx` (12 original characters, 9 hats, 5 glasses, 7 backgrounds), animated with framer-motion in `components/Avatar.tsx`: `idle` (bob, tilt, blink), `cheer`, `wobble` (sad face), `dance`; teleport stays in `kid.tsx`. Calm mode turns all of it off. The face changes with the mood, so the old 🥺 emoji in the oops celebration is gone.
- **Backend:** `lib/AvatarItems.mo` holds the item catalog and unlock rules (`#free`, `#level n`, `#badge id`); unlocks are derived from XP level and earned badges, so there is no new stable state and no migration. New `listAvatarItems(childId)` (query) and `setAvatar(childId, avatar)` for the child's own device or any parent. `addChild`/`updateChild` check accessories too. One item per slot; an item already worn stays allowed if an undo lowers the level. Unit tests in `test/lib.test.mo`.
- **Studio:** `/kid/:childId/avatar` (tap the avatar on the kid profile) and `/parent/children/:id/avatar` (Dress up on the child page). Tabs Friend / Hats / Glasses / Places; locked items are greyed with 🔒 and tapping one says what unlocks it. Newly worn items drop in with a spring.
- **Sounds:** `pop`, `coin`, `oops`, `fanfare`, `chest` (original, synthesized, ~150 KB WAV in total, loaded on first play); `ding`/`whoosh` removed. Levels play the fanfare, badges and rewards the chest. SW cache bumped to `starquest-shell-v2`.
- **Size:** all JS + CSS + HTML is ~358 KB gzipped, well under the 1.5 MB target.
- **Verified** headlessly (`p11.cjs`): picker art, parent studio (free items, locked crown hint, save), +130 points unlocks crown/rainbow but not wizard, kid studio save shows on the profile, dark + Swedish + reduced motion. p8–p10 still pass; deployed locally.

---

## Phase 12 — Polish: optimistic UI, a11y, reduced motion, performance, tests
**Status:** ✅ Done (Lighthouse performance 86–89 accepted by the user on 2026-11-22)
**Skills:** `canister-security`, `reviewing-motoko`, `migrating-motoko-actors`
**Touches:** whole repo

Tasks
- [x] Optimistic updates for log/request/approve with gentle rollback animation + toast on failure.
- [x] Reduced-motion audit for every animation; focus states, ARIA labels, contrast in light/dark.
- [x] Mobile/tablet/desktop layout pass; iPhone/iPad PWA test (safe areas, standalone mode).
- [x] Backend tests (`mops test`) for points, streaks, badges, access control; a PocketIC or CLI-script end-to-end test for the main flows.
- [x] Frontend tests (Vitest) for key hooks/reducers.
- [x] Bundle size check, code splitting by route.
- [x] Upgrade test: deploy, add data, `icp deploy --identity anonymous` again (upgrade mode), data intact; `mops check` passes with no migration warnings.
- [x] Clean up PocketIC `/tmp/.tmp*` folders left by tests (only those no running process uses).

Acceptance
- All tests pass; Lighthouse mobile ≥ 90 performance/accessibility; upgrade preserves data.

Session notes:
- Optimistic UI: quick log already applied points at once; a failed save now puts them back with a shake and a red toast (`lib/toast.tsx`, app-wide). Approve/decline removes the request and deducts the balance at once, restoring both on failure. Kid shop shows ⏳ at once and shakes + toasts on failure. Network errors show a short "couldn't reach" message instead of the agent's stack trace.
- A11y: dark text on the green/red/kid-colour buttons and badges (white failed 3:1); kid ink picked by WCAG contrast; darker link colour in light mode, lighter in dark; global `:focus-visible` ring; CSS animations/transitions off under `prefers-reduced-motion`; `role="img"` on PIN dots. Toast container is an `aria-live` region.
- Layout: side safe-area padding, kid page bottom safe area, celebration overlay safe areas; manifest orientation `any` for iPads. p12 browser test: no sideways scroll on 10 routes at 375/820/1180/1440 px. Not tested on a real iPhone/iPad.
- Tests: `mops test` adds PIN hash/lockout; new `tests/e2e/avatars.e2e.mjs` (locks, one per slot, cross-family/anonymous refused, survives upgrade). Vitest 5.1.0 added (`npm run test:frontend`, 8 tests: result/errorText, days, avatar toggle, patchSettings ordering). `npm install` needs `--legacy-peer-deps` (npm arborist bug with vitest's optional peers).
- Bundle: routes were already split by React Router; ~360 KB gzip total. The 160 KB IC SDK chunk loads on every page (auth at the root).
- Upgrade: full e2e → `icp deploy backend --mode upgrade` → `--after-upgrade` checks all pass; `mops check` clean.
- Lighthouse 13.6.0 mobile (local replica): `/` perf 89, `/kid` 86, `/parent` 89; accessibility 100 and best practices 100 on all three. Fixed a 0.4 CLS from the hydrate fallback's collapsing margin; `/kid` skips the role check when the device has no key. Reaching 90 likely needs lazy-loading the IC SDK out of the first paint.
- Removed 7 stale PocketIC temp entries from 2026-11-20 (~94 MB); kept the running network's.

---

## Phase 13 — Mainnet deployment
**Status:** 🟡 In progress (deployed 2026-11-22; smoke test and second controller pending)
**Skills:** `icp-cli`, `cycles-management` (or `buy-cycles`), `user-sign-in` (primary origin), `custom-domains` (optional), `icp-deploy-check` (its checklist is Rust-focused; apply the same five checks to Motoko)
**Touches:** `icp.yaml`, `.icp/data/`

Tasks
- [ ] Decide the primary origin **before** real users: `<frontend-id>.icp0.io` or a custom domain. II principals are permanent per origin; if a custom domain comes later, set `derivationOrigin` + `ii-alternative-origins` from the first deploy.
- [ ] **Get explicit approval** for every mainnet step below (deploy, cycles, controllers).
- [ ] Deploy with `prod-identity` (default identity; password via `--identity-password-file ~/.identity-pw` only — never read or print it); add a second controller for recovery (approval).
- [ ] Estimate cycles (2 canisters × (2T + 100M) + ~10%), check `icp cycles balance -n ic --identity prod-identity`, fund with `icp cycles mint` or `icp cycles buy`; set freezing threshold.
- [ ] Pre-deploy checks: anonymous rejection on every method, no `fetchRootKey()` in shipped frontend, all admin/parent methods guarded, migration chain compiles against an empty `OldActor`, ≥ 2 controllers.
- [ ] `icp deploy -e ic --identity prod-identity --identity-password-file ~/.identity-pw`; commit `.icp/data/mappings/ic.ids.json`.
- [ ] Smoke test on mainnet: II login, onboarding, pairing a real phone, PWA install on iOS.
- [ ] From now on the deployed migrations are applied and frozen: the next non-stable-compatible change starts a new pending migration.
- [ ] Optional: custom domain (`custom-domains` skill) and `/.well-known/ii-app-metadata` to name the app on the II screen.

Acceptance
- App live on `https://<frontend-id>.icp0.io`, a new family can start in under a minute, data survives a re-deploy.

Session notes:
- 2026-11-22: primary origin is `https://mr7nz-giaaa-aaaae-ahgvq-cai.icp0.io` (no custom domain). Backend `mw6ln-lqaaa-aaaae-ahgva-cai`, frontend `mr7nz-giaaa-aaaae-ahgvq-cai`; IDs in `.icp/data/mappings/ic.ids.json`.
- Created with `--cycles 0.8t` each at the user's request (0.5T is the creation fee). That left too little for the 30-day freezing reserve, so install failed until each canister got a 0.1T top-up. prod-identity balance after: about 11.1T.
- Deploy the frontend with `ICP_ENVIRONMENT=ic icp deploy ...`, not `-e ic`: the build reads the variable to drop localhost from the CSP. Verified the served `connect-src` has no localhost.
- `icp` (Rust) needs `SSL_CERT_FILE=~/.local/share/certs/volvo-got-fw-rootca-2026-10.pem` behind the TLS proxy.
- A sync right after an upgrade can hit "canister is stopped"; rerunning the deploy fixes it.
- Second controller skipped for now (user's choice). Still to do: smoke test (II login, onboarding, phone pairing, iOS PWA install).
