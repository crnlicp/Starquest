// React Router's SPA index.html carries inline bootstrap scripts that change every build.
// Allow exactly those by hash instead of 'unsafe-inline'. Also fills in the local-only connect-src.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../build/client/", import.meta.url);
const html = readFileSync(new URL("index.html", dir), "utf8");
const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .filter((body) => body.length > 0)
  .map((body) => `'sha256-${createHash("sha256").update(body).digest("base64")}'`);

const headersUrl = new URL("_headers", dir);
const headers = readFileSync(headersUrl, "utf8");
if (!headers.includes("__INLINE_SCRIPT_HASHES__")) throw new Error("_headers is missing the __INLINE_SCRIPT_HASHES__ placeholder");
// A local build talks to the local replica at localhost:8000; mainnet builds must not list it.
const local = (process.env.ICP_ENVIRONMENT || "local") === "local" ? "http://localhost:8000 http://*.localhost:8000 " : "";
writeFileSync(
  headersUrl,
  headers.replace("__INLINE_SCRIPT_HASHES__", [...new Set(hashes)].join(" ")).replace("__LOCAL_CONNECT__", local),
);
console.log(`CSP: allowed ${hashes.length} inline script(s) by hash`);
