import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";
import { LogKind, RequestStatus, type ChildBadge, type ChildView } from "~/bindings/backend";
import { Celebrations, type Celebration } from "~/components/Celebrations";
import { Avatar, StreakFlame } from "~/components/ChildCard";
import { KidBar } from "~/components/KidBar";
import { NumberRoller } from "~/components/NumberRoller";
import { RewardIcon } from "~/components/RewardForm";
import type { Backend } from "~/lib/auth";
import { useRewardImage } from "~/lib/image";
import { useKid, type KidData } from "~/lib/kid";
import { useMotionLevel } from "~/lib/motion";
import { unwrap } from "~/lib/result";
import { readJson, writeJson } from "~/lib/storage";
import { kidTheme } from "~/lib/theme";

type Seen = { at: string; level: number };
const seenKey = (child: ChildView) => `starquest.kidSeen.${child.familyId}.${child.id}`;

// What happened since this child last looked: points, oopses, badges, approved rewards, a new level.
async function catchUp(backend: Backend, child: ChildView, data: KidData): Promise<Celebration[]> {
  const seen = readJson<Seen>(seenKey(child));
  const since = seen ? BigInt(seen.at) : BigInt(Date.now()) * 1_000_000n;
  const changes = unwrap(await backend.getChangesSince(since));
  writeJson(seenKey(child), { at: String(changes.serverTime), level: Number(child.level.number) });
  if (!seen) return [];

  const mine = changes.entries.filter((e) => e.childId === child.id && e.kind !== LogKind.reward);
  const earned = mine.reduce((n, e) => n + Math.max(0, Number(e.balanceDelta)), 0);
  const lost = mine.reduce((n, e) => n + Math.max(0, -Number(e.balanceDelta)), 0);
  const events: Celebration[] = [];
  if (lost > 0) events.push({ kind: "oops", amount: lost });
  if (earned > 0) events.push({ kind: "points", amount: earned });
  for (const b of changes.badges.filter((b) => b.childId === child.id)) {
    const badge = data.badges.find((d) => d.id === b.badgeId);
    if (badge) events.push({ kind: "badge", badge });
  }
  for (const r of changes.requests.filter((r) => r.childId === child.id && r.status === RequestStatus.approved)) {
    events.push({ kind: "reward", title: r.title, emoji: r.emoji });
  }
  if (Number(child.level.number) > seen.level) events.push({ kind: "level", level: child.level });
  return events;
}

// Fills with today's points; bursts with stars once the goal is reached.
function GoalRing({ value, goal }: { value: number; goal: number }) {
  const { t } = useTranslation();
  const calm = useMotionLevel() === "reduced";
  const done = goal > 0 && value >= goal;
  const r = 42;
  const length = 2 * Math.PI * r;
  const part = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <div className="goal-ring" role="img" aria-label={t("kidMode.goal", { value, goal })}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} className="goal-ring__track" />
        <motion.circle
          cx="50" cy="50" r={r} className="goal-ring__fill" strokeDasharray={length}
          initial={{ strokeDashoffset: length }} animate={{ strokeDashoffset: length * (1 - part) }} transition={{ duration: calm ? 0 : 1.2, ease: "easeOut" }}
        />
      </svg>
      <span className="goal-ring__center">{done ? "🌟" : "🎯"}</span>
      {done && !calm &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i} className="goal-ring__star" aria-hidden="true"
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos((i * Math.PI) / 3) * 70, y: Math.sin((i * Math.PI) / 3) * 70, opacity: 0 }}
            transition={{ duration: 1.2, delay: 1, repeat: Infinity, repeatDelay: 3 }}
          >
            ⭐
          </motion.span>
        ))}
    </div>
  );
}

function Bar({ part, label, testId }: { part: number; label: string; testId?: string }) {
  return (
    <div className="kid-bar-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part * 100)} aria-label={label} data-testid={testId}>
      <motion.span initial={{ width: 0 }} animate={{ width: `${Math.min(part, 1) * 100}%` }} transition={{ duration: 1 }} />
    </div>
  );
}

export default function KidProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { childId: id } = useParams();
  const { backend, device, data, unlocked, pulse } = useKid();
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [earned, setEarned] = useState<ChildBadge[]>([]);
  const child = data?.children.find((c) => String(c.id) === id);
  const saving = data?.rewards.find((r) => r.id === child?.savingForRewardId);
  const savingImage = useRewardImage(backend, saving);
  const next = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    if (!child || !data) return;
    let live = true;
    catchUp(backend, child, data)
      .then((events) => live && setQueue((q) => [...q, ...events]))
      .catch((e) => console.error("Checking for news failed", e));
    backend
      .listChildBadges(child.id)
      .then((r) => live && setEarned(unwrap(r)))
      .catch((e) => console.error("Loading badges failed", e));
    return () => {
      live = false;
    };
  }, [backend, child?.id, pulse]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !child) return <Navigate to="/kid" replace />;
  if (child.hasPicture && !unlocked.has(child.id)) return <Navigate to="/kid" replace />;

  const balance = Number(child.balance);
  const xp = Number(child.xp);
  const minXp = Number(child.level.minXp);
  const nextXp = child.nextLevelXp === undefined || child.nextLevelXp === null ? null : Number(child.nextLevelXp);
  const levelPart = nextXp === null ? 1 : (xp - minXp) / Math.max(1, nextXp - minXp);
  const speech = t("kidMode.profileSpeech", { name: child.name, count: balance, level: Number(child.level.number), title: child.level.title });

  return (
    <main className="kid-main" style={kidTheme(child.favoriteColor)}>
      <KidBar back={device ? undefined : "/kid"} speech={speech} />
      <section className="kid-hero">
        <motion.button type="button" className="kid-dress" data-testid="open-avatar" whileTap={{ scale: 0.9 }} onClick={() => navigate(`/kid/${child.id}/avatar`)} aria-label={t("avatar.title")}>
          <Avatar avatar={child.avatar} size="7rem" />
          <span className="kid-dress__tag" aria-hidden="true">👕</span>
        </motion.button>
        <h1>{child.name}</h1>
        <p className="kid-points" data-testid="kid-balance">
          ⭐ <NumberRoller value={balance} />
        </p>
      </section>

      <section className="kid-stats">
        <div className="kid-level">
          <span className="kid-level__badge">{Number(child.level.number)}</span>
          <Bar part={levelPart} label={t("child.level", { number: Number(child.level.number), title: child.level.title })} testId="level-bar" />
        </div>
        <div className="row kid-row">
          <GoalRing value={Number(child.todayPoints)} goal={Number(child.dailyGoal)} />
          <span className="kid-streak">{Number(child.streak) > 0 ? <StreakFlame streak={Number(child.streak)} /> : "🔥0"}</span>
        </div>
      </section>

      <section className="trophy-shelf" aria-label={t("kidMode.trophies")}>
        {data.badges.map((b) => {
          const has = earned.some((e) => e.badgeId === b.id);
          return (
            <span key={b.id} className={has ? "trophy" : "trophy trophy--locked"} title={b.name} aria-label={has ? b.name : t("kidMode.locked")}>
              {has ? b.emoji : "🔒"}
            </span>
          );
        })}
      </section>

      {saving && (
        <motion.button type="button" className="saving" whileTap={{ scale: 0.95 }} onClick={() => navigate(`/kid/${child.id}/shop`)} aria-label={t("kidMode.savingFor", { name: saving.name })}>
          <RewardIcon emoji={saving.emoji} src={savingImage} size="2.5rem" />
          <Bar part={balance / Number(saving.cost)} label={`${balance} / ${saving.cost}`} testId="saving-bar" />
          <span>{balance >= Number(saving.cost) ? "✅" : `${balance}/${saving.cost}`}</span>
        </motion.button>
      )}

      <motion.button type="button" className="kid-shop-button" data-testid="open-shop" whileTap={{ scale: 0.9 }} onClick={() => navigate(`/kid/${child.id}/shop`)} aria-label={t("kidMode.shop")}>
        🏪
      </motion.button>

      <Celebrations queue={queue} avatar={child.avatar} onNext={next} />
    </main>
  );
}
