import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { RewardInput } from "~/bindings/backend";
import { Card } from "~/components/Card";
import { PageHeader } from "~/components/PageHeader";
import { RewardForm } from "~/components/RewardForm";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

export default function NewReward() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, data, update } = useFamily();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data || !backend) return null;

  async function save(input: RewardInput) {
    setBusy(true);
    setError(null);
    try {
      const created = unwrap(await backend!.addReward(input));
      update((d) => ({ ...d, rewards: [...d.rewards, created] }));
      navigate("/parent/rewards");
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader title={t("reward.add")} back="/parent/rewards" />
      <Card>
        <RewardForm submitLabel={t("common.save")} busy={busy} onSubmit={(i) => void save(i)} />
        {error && <p role="alert">{error}</p>}
      </Card>
    </main>
  );
}
