import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { BehaviorKind, type Behavior, type ChildView, type LogResult, type MissionTask } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import type { AvatarAction } from "~/components/Avatar";
import { Avatar, ChildCard } from "~/components/ChildCard";
import { MissionList } from "~/components/MissionList";
import { Modal } from "~/components/Modal";
import { NumberRoller } from "~/components/NumberRoller";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";
import { useSound } from "~/lib/sound";
import { useToast } from "~/lib/toast";
import { kidTheme } from "~/lib/theme";

const UNDO_MS = 8000;

type Float = { id: number; text: string; good: boolean; from: DOMRect; to: DOMRect | undefined };
type Toast = { entryId: bigint; text: string };
type Offer = { entryId: bigint; childId: bigint; suggestion: string; refund: number };

function toNs(local: string): bigint | null {
  return local ? BigInt(new Date(local).getTime()) * 1_000_000n : null;
}

// Mirrors the backend rule (balance never below zero) so the counter can move before the reply.
function optimistic(child: ChildView, delta: number): ChildView {
  const balance = BigInt(Math.max(0, Number(child.balance) + delta));
  const todayPoints = delta > 0 ? child.todayPoints + BigInt(delta) : child.todayPoints;
  return { ...child, balance, todayPoints };
}

export default function QuickLog() {
  const { t } = useTranslation();
  const play = useSound();
  const notify = useToast();
  const { backend, data, setChild, update, reloadInbox } = useFamily();
  const [params, setParams] = useSearchParams();
  const [note, setNote] = useState("");
  const [backdate, setBackdate] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [custom, setCustom] = useState<{ open: boolean; points: string; reason: string }>({ open: false, points: "", reason: "" });
  const [floats, setFloats] = useState<Float[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const avatar = useAnimationControls();
  const [act, setAct] = useState<AvatarAction>("none");
  const actTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextId = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!data || !backend) return null;
  const child = data.children.find((c) => String(c.id) === params.get("child"));

  if (!child) {
    return (
      <main>
        <PageHeader title={t("log.pickChild")} />
        <div className="child-grid">
          {data.children.map((c, i) => (
            <Card key={String(c.id)} delay={i * 0.05} className="plain">
              <ChildCard child={c} onClick={() => setParams({ child: String(c.id) })} />
            </Card>
          ))}
        </div>
      </main>
    );
  }

  const behaviors = data.behaviors.filter((b) => b.enabled && (!b.assignedTo || b.assignedTo.includes(child.id)));
  const good = behaviors.filter((b) => b.kind === BehaviorKind.good);
  const oops = behaviors.filter((b) => b.kind === BehaviorKind.oops);
  const missions = data.missions.filter((m) => m.childId === child.id);
  const setMissions = (change: (ms: MissionTask[]) => MissionTask[]) => update((d) => ({ ...d, missions: change(d.missions) }));

  function animate(delta: number, from: DOMRect) {
    const isGood = delta > 0;
    const id = nextId.current++;
    setFloats((f) => [...f, { id, text: `${isGood ? "+" : ""}${delta}${isGood ? " ⭐" : ""}`, good: isGood, from, to: counter.current?.getBoundingClientRect() }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1400);
    play(isGood ? "coin" : "oops");
    setAct(isGood ? "cheer" : "wobble");
    clearTimeout(actTimer.current);
    actTimer.current = setTimeout(() => setAct("none"), 1200);
    void avatar.start(
      isGood
        ? { y: [0, -30, 0, -12, 0], transition: { duration: 0.6 } }
        : { rotate: [0, -8, 8, -5, 5, 0], transition: { duration: 0.6 } },
    );
  }

  async function submit(current: ChildView, delta: number, from: DOMRect, call: () => Promise<LogResult>, label: string) {
    setError(null);
    setChild(optimistic(current, delta));
    animate(delta, from);
    try {
      const result = await call();
      setChild(unwrap(await backend!.getChild(current.id)));
      setNote("");
      setBackdate("");
      const levelUp = result.leveledUp ? ` · ${t("log.levelUp", { title: result.leveledUp.title })}` : "";
      setToast({ entryId: result.entry.id, text: `${label}${levelUp}` });
    } catch (e) {
      // Put the points back gently and say why, instead of leaving a wrong balance on screen.
      setChild(current);
      void avatar.start({ x: [0, -6, 6, -3, 3, 0], transition: { duration: 0.5 } });
      notify(t("errors.rolledBack", { message: errorText(t, e) }));
    }
  }

  const logBehavior = (b: Behavior, el: HTMLElement) => {
    const delta = b.kind === BehaviorKind.good ? Number(b.points) : -Number(b.points);
    void submit(
      child,
      delta,
      el.getBoundingClientRect(),
      async () => {
        const result = unwrap(await backend.logBehavior(child.id, b.id, note.trim() || null, toNs(backdate)));
        // An oops can come with a way to earn the points back.
        if (b.kind === BehaviorKind.oops && b.mission) {
          const refund = Math.min(Number(b.mission.refund), Math.abs(Number(result.entry.balanceDelta)));
          setOffer({ entryId: result.entry.id, childId: child.id, suggestion: b.mission.suggestion, refund });
        }
        return result;
      },
      `${b.emoji} ${b.name}`,
    );
  };

  const logCustom = (el: HTMLElement) => {
    const points = Math.trunc(Number(custom.points));
    const reason = custom.reason.trim();
    setCustom({ open: false, points: "", reason: "" });
    void submit(
      child,
      points,
      el.getBoundingClientRect(),
      async () => unwrap(await backend.logCustom(child.id, BigInt(points), reason, toNs(backdate))),
      `✏️ ${reason}`,
    );
  };

  async function startMission() {
    if (!offer) return;
    const { entryId } = offer;
    setOffer(null);
    try {
      const m = unwrap(await backend!.startMission(entryId));
      setMissions((ms) => [...ms, m]);
    } catch (e) {
      setError(errorText(t, e));
    }
  }

  const confirmMission = (m: MissionTask, el: HTMLElement) =>
    void submit(
      child,
      Number(m.refund),
      el.getBoundingClientRect(),
      async () => {
        const result = unwrap(await backend.confirmMission(m.id));
        setMissions((ms) => ms.filter((x) => x.id !== m.id));
        return result;
      },
      `🤝 ${t("mission.confirmed", { count: Number(m.refund) })}`,
    );

  async function cancelMission(m: MissionTask) {
    try {
      unwrap(await backend!.cancelMission(m.id));
      setMissions((ms) => ms.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(errorText(t, e));
    }
  }

  async function undo() {
    if (!toast) return;
    const entryId = toast.entryId;
    setToast(null);
    if (offer?.entryId === entryId) setOffer(null);
    try {
      setChild(unwrap(await backend!.deleteLogEntry(entryId)));
      play("oops");
      // Undoing an oops cancels its mission; undoing a refund reopens one.
      await reloadInbox();
    } catch (e) {
      setError(errorText(t, e));
    }
  }

  const behaviorButton = (b: Behavior) => (
    <motion.button
      key={String(b.id)}
      type="button"
      className={`behavior behavior--${b.kind}`}
      whileTap={{ scale: 0.85 }}
      onClick={(e) => logBehavior(b, e.currentTarget)}
    >
      <span className="behavior__emoji" aria-hidden="true">
        {b.emoji}
      </span>
      <span className="behavior__name">{b.name}</span>
      <span className="behavior__points">
        {b.kind === BehaviorKind.good ? "+" : "−"}
        {String(b.points)}
      </span>
    </motion.button>
  );

  const customValid = Number(custom.points) !== 0 && Math.abs(Number(custom.points)) <= 100 && custom.reason.trim() !== "";

  return (
    <main style={kidTheme(child.favoriteColor)}>
      <PageHeader title={t("nav.quickLog")} />
      <Card className="log-child">
        <motion.span animate={avatar}>
          <Avatar avatar={child.avatar} size="4rem" action={act} />
        </motion.span>
        <div>
          <strong>{child.name}</strong>
          <div className="log-child__points">
            ⭐{" "}
            <span ref={counter}>
              <NumberRoller value={Number(child.balance)} />
            </span>
          </div>
        </div>
        {data.children.length > 1 && (
          <button type="button" className="small-link" onClick={() => setParams({})}>
            {t("log.switchChild")}
          </button>
        )}
      </Card>

      <AnimatePresence>
        {offer && offer.childId === child.id && (
          <motion.div className="card mission-offer" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
            <p>
              <strong>{t("mission.oops")}</strong> {t("mission.nextTime")}
            </p>
            <p>
              🤝 {t("mission.offer", { suggestion: offer.suggestion })}
              {offer.refund > 0 && <> {t("mission.refund", { count: offer.refund })}</>}
            </p>
            <div className="row">
              <BigButton variant="good" onClick={() => void startMission()}>
                {t("mission.start")}
              </BigButton>
              <BigButton variant="secondary" onClick={() => setOffer(null)}>
                {t("mission.notNow")}
              </BigButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {missions.length > 0 && (
        <Card className="list">
          <h2>🤝 {t("mission.title")}</h2>
          <MissionList missions={missions} onConfirm={confirmMission} onCancel={(m) => void cancelMission(m)} />
        </Card>
      )}

      <button type="button" className="small-link" aria-expanded={showOptions} onClick={() => setShowOptions((s) => !s)}>
        {showOptions ? "▾" : "▸"} {t("log.options")}
        {(note || backdate) && " •"}
      </button>
      <AnimatePresence>
        {showOptions && (
          <motion.div className="form" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <label>
              {t("log.note")}
              <input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("log.notePlaceholder")} />
            </label>
            <label>
              {t("log.when")}
              <input type="datetime-local" value={backdate} max={new Date().toISOString().slice(0, 16)} onChange={(e) => setBackdate(e.target.value)} />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      <h2>{t("log.good")}</h2>
      <div className="behavior-grid">{good.map(behaviorButton)}</div>
      <h2>{t("log.oops")}</h2>
      <div className="behavior-grid">{oops.map(behaviorButton)}</div>
      {behaviors.length === 0 && <p className="muted">{t("log.noBehaviors")}</p>}

      <BigButton variant="secondary" onClick={() => setCustom((c) => ({ ...c, open: true }))}>
        ✏️ {t("log.custom")}
      </BigButton>
      {error && <p role="alert">{error}</p>}

      <Modal open={custom.open} onClose={() => setCustom((c) => ({ ...c, open: false }))} title={t("log.custom")}>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (customValid) logCustom(e.currentTarget);
          }}
        >
          <label>
            {t("log.customPoints")}
            <input type="number" min={-100} max={100} required value={custom.points} onChange={(e) => setCustom((c) => ({ ...c, points: e.target.value }))} autoFocus />
          </label>
          <label>
            {t("log.reason")}
            <input required maxLength={80} value={custom.reason} onChange={(e) => setCustom((c) => ({ ...c, reason: e.target.value }))} />
          </label>
          <BigButton type="submit" disabled={!customValid}>
            {t("common.save")}
          </BigButton>
        </form>
      </Modal>

      <div className="float-layer" aria-hidden="true">
        <AnimatePresence>
          {floats.map((f) => {
            const x0 = f.from.left + f.from.width / 2;
            const y0 = f.from.top + f.from.height / 2;
            const target = f.good && f.to ? { x: f.to.left - x0, y: f.to.top - y0 } : { x: 0, y: 70 };
            return (
              <motion.span
                key={f.id}
                className={`float float--${f.good ? "good" : "oops"}`}
                style={{ left: x0, top: y0 }}
                initial={{ x: 0, y: 0, scale: 0.6, opacity: 1 }}
                animate={f.good ? { ...target, scale: [0.6, 1.6, 0.8], opacity: [1, 1, 0] } : { ...target, scale: 1, opacity: [1, 0.8, 0] }}
                transition={{ duration: f.good ? 0.9 : 1.3, ease: f.good ? "easeIn" : "easeOut" }}
              >
                {f.text}
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" role="status" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}>
            <span>{toast.text}</span>
            <button type="button" onClick={() => void undo()}>
              {t("log.undo")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
