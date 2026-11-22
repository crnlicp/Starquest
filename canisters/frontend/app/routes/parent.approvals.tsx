import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChildView, MissionTask, RewardRequest } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { Avatar } from "~/components/ChildCard";
import { MissionList } from "~/components/MissionList";
import { PageHeader } from "~/components/PageHeader";
import { RewardIcon } from "~/components/RewardForm";
import type { Backend } from "~/lib/auth";
import { useFamily } from "~/lib/family";
import { useRewardImage } from "~/lib/image";
import { errorText, unwrap } from "~/lib/result";
import { useSound } from "~/lib/sound";
import { useToast } from "~/lib/toast";
import { kidTheme } from "~/lib/theme";

type RowProps = { backend: Backend; request: RewardRequest; child: ChildView | undefined; busy: boolean; onDecide: (approve: boolean) => void };

function RequestRow({ backend, request, child, busy, onDecide }: RowProps) {
  const { t } = useTranslation();
  const { data } = useFamily();
  const src = useRewardImage(backend, data?.rewards.find((r) => r.id === request.rewardId));
  const short = child ? Number(request.cost) - Number(child.balance) : 0;
  return (
    <motion.div layout exit={{ opacity: 0, x: 80 }} className="request" style={child ? kidTheme(child.favoriteColor) : undefined}>
      {child && <Avatar avatar={child.avatar} size="3rem" bounce={false} />}
      <div className="request__body">
        <strong>{t("inbox.wants", { name: child?.name ?? "?", reward: request.title })}</strong>
        <span className="muted">
          ⭐ {String(request.cost)} · {t("inbox.has", { count: Number(child?.balance ?? 0n) })}
        </span>
        {short > 0 && <span className="request__short">{t("inbox.short", { count: short })}</span>}
      </div>
      <RewardIcon emoji={request.emoji} src={src} size="2.5rem" />
      <div className="request__actions">
        <BigButton variant="good" disabled={busy || short > 0} onClick={() => onDecide(true)}>
          ✓ {t("inbox.approve")}
        </BigButton>
        <BigButton variant="secondary" disabled={busy} onClick={() => onDecide(false)}>
          {t("inbox.decline")}
        </BigButton>
      </div>
    </motion.div>
  );
}

export default function Approvals() {
  const { t } = useTranslation();
  const play = useSound();
  const notify = useToast();
  const { backend, data, update, setChild, reloadInbox } = useFamily();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    reloadInbox().catch((e) => setError(errorText(t, e)));
  }, [reloadInbox, t]);

  if (!data || !backend) return null;
  const childOf = (id: bigint) => data.children.find((c) => c.id === id);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError(null);
    try {
      setNotice(await action());
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  // Shown as decided at once; a failed save puts the request and the balance back.
  async function decide(q: RewardRequest, approve: boolean) {
    const before = childOf(q.childId);
    setError(null);
    update((d) => ({ ...d, requests: d.requests.filter((x) => x.id !== q.id) }));
    if (approve && before) setChild({ ...before, balance: before.balance - q.cost });
    play(approve ? "chest" : "pop");
    setNotice(approve ? t("inbox.approved", { reward: q.title }) : t("inbox.declined"));
    try {
      unwrap(await backend!.decideRequest(q.id, approve));
      if (approve) setChild(unwrap(await backend!.getChild(q.childId)));
    } catch (e) {
      update((d) => ({ ...d, requests: d.requests.some((x) => x.id === q.id) ? d.requests : [...d.requests, q].sort((a, b) => Number(a.id - b.id)) }));
      if (before) setChild(before);
      setNotice(null);
      notify(t("errors.rolledBack", { message: errorText(t, e) }));
    }
  }

  const confirmMission = (m: MissionTask) =>
    run(async () => {
      unwrap(await backend.confirmMission(m.id));
      update((d) => ({ ...d, missions: d.missions.filter((x) => x.id !== m.id) }));
      setChild(unwrap(await backend.getChild(m.childId)));
      play("coin");
      return t("mission.confirmed", { count: Number(m.refund) });
    });

  const cancelMission = (m: MissionTask) =>
    run(async () => {
      unwrap(await backend.cancelMission(m.id));
      update((d) => ({ ...d, missions: d.missions.filter((x) => x.id !== m.id) }));
      return t("mission.cancelled");
    });

  const missionKids = data.children.filter((c) => data.missions.some((m) => m.childId === c.id));
  const empty = data.requests.length === 0 && data.missions.length === 0;

  return (
    <main>
      <PageHeader title={t("nav.approvals")} />
      <AnimatePresence>
        {notice && (
          <motion.p className="notice" role="status" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
      {error && <p role="alert">{error}</p>}
      {empty && (
        <Card className="stack">
          <p className="muted">📭 {t("inbox.empty")}</p>
        </Card>
      )}
      {data.requests.length > 0 && (
        <Card className="list">
          <h2>🎁 {t("inbox.requests")}</h2>
          <AnimatePresence initial={false}>
            {data.requests.map((q) => (
              <RequestRow key={String(q.id)} backend={backend} request={q} child={childOf(q.childId)} busy={false} onDecide={(a) => void decide(q, a)} />
            ))}
          </AnimatePresence>
        </Card>
      )}
      {missionKids.map((c, i) => (
        <Card key={String(c.id)} className="list" delay={0.06 * (i + 1)}>
          <h2>
            🤝 {t("mission.title")} · {c.name}
          </h2>
          <MissionList
            missions={data.missions.filter((m) => m.childId === c.id)}
            busy={busy}
            onConfirm={(m) => void confirmMission(m)}
            onCancel={(m) => void cancelMission(m)}
          />
        </Card>
      ))}
    </main>
  );
}
