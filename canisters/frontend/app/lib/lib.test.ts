import { describe, expect, it, vi } from "vitest";
import { toggle } from "~/components/AvatarStudio";
import type { AvatarItemView, Settings } from "~/bindings/backend";
import { dayToInput, inputToDay, todayDay } from "./days";
import { patchSettings } from "./family";
import { ApiError, errorText, unwrap } from "./result";

const t = ((key: string, o?: { message?: string }) => (o?.message ? `${key}:${o.message}` : key)) as never;

describe("result", () => {
  it("unwraps ok and throws ApiError on err", () => {
    expect(unwrap({ __kind__: "ok", ok: 5 })).toBe(5);
    expect(() => unwrap({ __kind__: "err", err: { __kind__: "notFound", notFound: null } as never })).toThrow(ApiError);
  });
  it("shows backend validation text as is and translates the rest", () => {
    expect(errorText(t, new ApiError({ __kind__: "invalid", invalid: "name is empty" }))).toBe("name is empty");
    expect(errorText(t, new ApiError({ __kind__: "notAuthorized", notAuthorized: null } as never))).toBe("errors.notAuthorized");
    expect(errorText(t, new Error("boom\n  at somewhere"))).toBe("errors.generic:boom");
    expect(errorText(t, new TypeError("Failed to fetch HTTP request: TypeError: Failed to fetch\n at requestSync"))).toBe("errors.offline");
  });
});

describe("days", () => {
  it("round-trips date inputs", () => {
    expect(inputToDay("1970-01-02")).toBe(1);
    expect(dayToInput(inputToDay("2026-11-22")!)).toBe("2026-11-22");
    expect(inputToDay("")).toBeNull();
  });
  it("shifts today by the family time zone, like the backend", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 0, 1, 23, 30));
    const utc = todayDay(0);
    expect(todayDay(60)).toBe(utc + 1);
    expect(todayDay(-60)).toBe(utc);
    vi.useRealTimers();
  });
});

describe("avatar toggle", () => {
  const item = (id: string, slot: string) => ({ id, slot }) as unknown as AvatarItemView;
  const items = [item("hat-a", "hat"), item("hat-b", "hat"), item("bg-a", "background")];
  it("replaces the item in the same slot and keeps the others", () => {
    const next = toggle({ character: "fox", accessories: ["hat-a", "bg-a"] }, items[1], items);
    expect(next.accessories.sort()).toEqual(["bg-a", "hat-b"]);
  });
  it("takes off a worn item", () => {
    expect(toggle({ character: "fox", accessories: ["hat-a"] }, items[0], items).accessories).toEqual([]);
  });
});

describe("patchSettings", () => {
  it("runs saves one at a time so quick changes don't undo each other", async () => {
    let stored = { showLeaderboard: false, reminderMinute: undefined } as unknown as Settings;
    const backend = {
      getMyFamily: vi.fn(async () => ({ __kind__: "ok", ok: { settings: stored } })),
      updateSettings: vi.fn(async (s: Settings) => {
        await new Promise((r) => setTimeout(r, 5));
        stored = s;
        return { __kind__: "ok", ok: null };
      }),
    };
    await Promise.all([
      patchSettings(backend as never, { showLeaderboard: true }),
      patchSettings(backend as never, { reminderMinute: 1140n }),
    ]);
    expect(stored).toMatchObject({ showLeaderboard: true, reminderMinute: 1140n });
  });
  it("keeps going after a failed save", async () => {
    const backend = {
      getMyFamily: vi.fn(async () => ({ __kind__: "ok", ok: { settings: {} } })),
      updateSettings: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ __kind__: "ok", ok: null }),
    };
    await expect(patchSettings(backend as never, {})).rejects.toThrow("offline");
    await expect(patchSettings(backend as never, {})).resolves.toEqual({});
  });
});
