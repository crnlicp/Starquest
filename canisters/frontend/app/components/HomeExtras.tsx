import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { WeeklySummary } from "~/bindings/backend";
import type { Backend } from "~/lib/auth";
import { todayDay } from "~/lib/days";
import { useFamily } from "~/lib/family";
import { readJson, writeJson } from "~/lib/storage";
import { Card } from "./Card";
import { Avatar } from "./ChildCard";

const DISMISSED = "starquest.reminderDismissed";

// After the family's reminder time, nudge if nothing has been logged today. Dismissed until tomorrow.
export function ReminderBanner({ backend }: { backend: Backend }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useFamily();
  const [show, setShow] = useState(false);
  const settings = data?.family.settings;
  const tz = Number(settings?.tzOffsetMinutes ?? 0);
  const at = settings?.reminderMinute;
  const today = todayDay(tz);

  useEffect(() => {
    setShow(false);
    if (at === undefined || at === null || readJson<number>(DISMISSED) === today) return;
    const minute = Math.floor((Date.now() / 60_000 + tz) % 1440);
    if (minute < Number(at)) return;
    let live = true;
    backend
      .getHistory({ fromDay: BigInt(today), toDay: BigInt(today) }, null, 1n)
      .then((r) => live && r.__kind__ === "ok" && setShow(r.ok.entries.length === 0))
      .catch((e) => console.error("Checking today's log failed", e));
    return () => {
      live = false;
    };
  }, [backend, at, tz, today]);

  if (!show) return null;
  return (
    <div className="reminder" role="status" data-testid="reminder">
      <span>⏰ {t("reminder.text")}</span>
      <div className="row">
        <button type="button" className="chip" onClick={() => navigate("/parent/log")}>
          {t("nav.quickLog")}
        </button>
        <button type="button" className="chip chip--quiet" aria-label={t("reminder.dismiss")} onClick={() => (writeJson(DISMISSED, today), setShow(false))}>
          ✕
        </button>
      </div>
    </div>
  );
}

// This week's stars per child, highest first. Off unless the family turns it on.
export function Leaderboard({ backend, delay }: { backend: Backend; delay?: number }) {
  const { t } = useTranslation();
  const { data } = useFamily();
  const [rows, setRows] = useState<WeeklySummary[] | null>(null);
  const ids = data?.children.map((c) => c.id) ?? [];
  const key = ids.join(",");

  useEffect(() => {
    let live = true;
    Promise.all(ids.map((id) => backend.getWeeklySummary(id)))
      .then((rs) => live && setRows(rs.flatMap((r) => (r.__kind__ === "ok" ? [r.ok] : [])).sort((a, b) => Number(b.earned - a.earned))))
      .catch((e) => console.error("Loading the leaderboard failed", e));
    return () => {
      live = false;
    };
  }, [backend, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !rows) return null;
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <Card delay={delay} className="stack">
      <h2>🏆 {t("leaderboard.title")}</h2>
      <ol className="leaderboard" data-testid="leaderboard">
        {rows.map((r, i) => {
          const child = data.children.find((c) => c.id === r.childId);
          return (
            <li key={String(r.childId)}>
              <span className="leaderboard__rank">{medals[i] ?? i + 1}</span>
              {child && <Avatar avatar={child.avatar} size="2rem" bounce={false} />}
              <strong>{r.name}</strong>
              <span className="leaderboard__points">⭐ {Number(r.earned)}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
