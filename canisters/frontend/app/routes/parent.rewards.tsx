import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import type { Reward } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { PageHeader } from "~/components/PageHeader";
import { RewardIcon } from "~/components/RewardForm";
import type { Backend } from "~/lib/auth";
import { useFamily } from "~/lib/family";
import { useRewardImage } from "~/lib/image";
import { errorText, unwrap } from "~/lib/result";

function RewardRow({ backend, reward, onToggle }: { backend: Backend; reward: Reward; onToggle: () => void }) {
  const { t } = useTranslation();
  const src = useRewardImage(backend, reward);
  return (
    <div className={reward.enabled ? "list-row" : "list-row list-row--off"}>
      <span className="list-row__emoji">
        <RewardIcon emoji={reward.emoji} src={src} />
      </span>
      <Link to={`/parent/rewards/${reward.id}`} className="list-row__name">
        {reward.name}
      </Link>
      <span className="list-row__points">⭐ {String(reward.cost)}</span>
      <label className="switch">
        <input type="checkbox" checked={reward.enabled} onChange={onToggle} aria-label={t("behavior.enabled", { name: reward.name })} />
        <span />
      </label>
    </div>
  );
}

export default function Rewards() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, data, update } = useFamily();
  const [error, setError] = useState<string | null>(null);
  if (!data || !backend) return null;

  const put = (r: Reward) => update((d) => ({ ...d, rewards: d.rewards.map((x) => (x.id === r.id ? r : x)) }));

  async function toggle(r: Reward) {
    put({ ...r, enabled: !r.enabled });
    try {
      unwrap(await backend!.setRewardEnabled(r.id, !r.enabled));
    } catch (e) {
      put(r);
      setError(errorText(t, e));
    }
  }

  const sorted = [...data.rewards].sort((a, b) => Number(a.cost - b.cost));
  return (
    <main>
      <PageHeader title={t("nav.rewards")} />
      <BigButton onClick={() => navigate("/parent/rewards/new")}>➕ {t("reward.add")}</BigButton>
      {error && <p role="alert">{error}</p>}
      <Card className="list">
        {sorted.map((r) => (
          <RewardRow key={String(r.id)} backend={backend} reward={r} onToggle={() => void toggle(r)} />
        ))}
        {sorted.length === 0 && <p className="muted">{t("reward.none")}</p>}
      </Card>
    </main>
  );
}
