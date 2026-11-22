import { execSync } from "node:child_process";
import { reactRouter } from "@react-router/dev/vite";
import { icpBindgen } from "@icp-sdk/bindgen/plugins/vite";
import { defineConfig, type Plugin } from "vite";

const environment = process.env.ICP_ENVIRONMENT || "local";
const CANISTER_NAMES = ["backend"];

function icp(args: string): string {
  return execSync(`icp ${args}`, { encoding: "utf-8", stdio: "pipe" }).trim();
}

// The static-site canister sets the ic_env cookie in production; `vite dev` has to simulate it.
function getDevServerConfig() {
  const networkStatus = JSON.parse(icp(`network status -e ${environment} --json`));
  const canisterParams = CANISTER_NAMES.map(
    (name) => `PUBLIC_CANISTER_ID:${name}=${icp(`canister status ${name} -e ${environment} --id-only`)}`,
  ).join("&");
  return {
    cookie: `ic_env=${encodeURIComponent(`${canisterParams}&ic_root_key=${networkStatus.root_key}`)}; Path=/; SameSite=Lax`,
    proxy: {
      "/api": { target: networkStatus.api_url, changeOrigin: true },
    },
  };
}

// `server.headers` does not reach the HTML React Router serves, so set the cookie on every response.
function icEnvCookie(cookie: string): Plugin {
  return {
    name: "ic-env-cookie",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader("Set-Cookie", cookie);
        next();
      });
    },
  };
}

// `react-router build` also loads this config with command "serve", so check the mode too.
export default defineConfig(({ command, mode }) => {
  const dev = command === "serve" && mode === "development" ? getDevServerConfig() : null;
  return {
    // The `~/` alias from tsconfig; the build resolves it already, the dev server's SSR runner does not.
    resolve: { tsconfigPaths: true },
    plugins: [
      ...(dev ? [icEnvCookie(dev.cookie)] : []),
      icpBindgen({
        didFile: "../backend/src/backend.did",
        outDir: "./app/bindings",
      }),
      reactRouter(),
    ],
    ...(dev ? { server: { proxy: dev.proxy } } : {}),
  };
});
