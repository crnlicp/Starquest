import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import type { RewardInput } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { Modal } from "~/components/Modal";
import { PageHeader } from "~/components/PageHeader";
import { RewardForm } from "~/components/RewardForm";
import { useFamily } from "~/lib/family";
import { useRewardImage } from "~/lib/image";
import { errorText, unwrap } from "~/lib/result";

export default function EditReward() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { backend, data, update } = useFamily();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reward = data?.rewards.find((r) => String(r.id) === id);
  const image = useRewardImage(backend, reward);

  if (!data || !backend || !reward) {
    return (
      <main>
        <PageHeader title={t("errors.notFound")} back="/parent/rewards" />
      </main>
    );
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate("/parent/rewards");
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  const save = (input: RewardInput) =>
    act(async () => {
      const updated = unwrap(await backend.updateReward(reward.id, input));
      update((d) => ({ ...d, rewards: d.rewards.map((r) => (r.id === updated.id ? updated : r)) }));
    });

  const remove = () =>
    act(async () => {
      unwrap(await backend.deleteReward(reward.id));
      // The backend declines its open requests too.
      update((d) => ({ ...d, rewards: d.rewards.filter((r) => r.id !== reward.id), requests: d.requests.filter((q) => q.rewardId !== reward.id) }));
    });

  const initial: RewardInput = { name: reward.name, emoji: reward.emoji, cost: reward.cost, image: { __kind__: "keep", keep: null } };

  return (
    <main>
      <PageHeader title={`${reward.emoji} ${reward.name}`} back="/parent/rewards" />
      <Card>
        <RewardForm initial={initial} currentImage={image} submitLabel={t("common.save")} busy={busy} onSubmit={(i) => void save(i)} />
        {error && <p role="alert">{error}</p>}
      </Card>
      <Card delay={0.08} className="stack">
        <BigButton variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
          🗑️ {t("reward.delete")}
        </BigButton>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t("behavior.deleteTitle", { name: reward.name })}>
        <p>{t("reward.deleteHelp")}</p>
        <div className="row">
          <BigButton variant="secondary" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </BigButton>
          <BigButton variant="danger" onClick={() => (setConfirm(false), void remove())}>
            {t("common.delete")}
          </BigButton>
        </div>
      </Modal>
    </main>
  );
}
