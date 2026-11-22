import type { TFunction } from "i18next";
import type { Error_ } from "~/bindings/backend";

export class ApiError extends Error {
  constructor(public readonly err: Error_) {
    super(err.__kind__ === "invalid" ? err.invalid : err.__kind__);
  }
}

export function unwrap<T>(r: { __kind__: "ok"; ok: T } | { __kind__: "err"; err: Error_ }): T {
  if (r.__kind__ === "err") throw new ApiError(r.err);
  return r.ok;
}

// Backend `invalid` messages are English validation text; the other kinds are translated.
export function errorText(t: TFunction, e: unknown): string {
  if (e instanceof ApiError) {
    const err = e.err;
    if (err.__kind__ === "invalid") return err.invalid;
    if (err.__kind__ === "rateLimited") return t("errors.rateLimited");
    return t(`errors.${err.__kind__}`);
  }
  const message = e instanceof Error ? e.message : String(e);
  // The agent's network errors carry a whole stack trace; parents only need to know it didn't reach us.
  if (/failed to fetch|network|timeout|timed out/i.test(message)) return t("errors.offline");
  return t("errors.generic", { message: message.split("\n")[0].slice(0, 160) });
}
