# Star Quest

Family behavior tracker on the Internet Computer. Spec: [docs/specs.md](docs/specs.md) · Build plan: [docs/plan.md](docs/plan.md).

## Prerequisites

- Node.js ≥ 22, `icp` CLI, `ic-wasm`, `mops` (`npm i -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops`)
- Behind a TLS-inspecting proxy: point `NODE_EXTRA_CA_CERTS` at the proxy's root CA (mops talks to the IC directly)

## Run locally

```bash
npm run deploy:local        # starts the project-local network if needed, deploys as anonymous
```

The frontend is then served at `http://frontend.local.localhost:8000`.

For hot reload against the deployed backend:

```bash
npm run dev
```

## Common tasks

```bash
npm run check               # mops check (backend)
npm run gen:candid          # regenerate canisters/backend/src/backend.did after interface changes
npm run typecheck           # frontend types
npm run test:e2e            # backend API checks against the local network (after deploy:local)
```
