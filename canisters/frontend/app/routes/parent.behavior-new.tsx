import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { BehaviorInput } from "~/bindings/backend";
import { BehaviorForm } from "~/components/BehaviorForm";
import { Card } from "~/components/Card";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

export default function NewBehavior() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, data, setBehaviors } = useFamily();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data || !backend) return null;

  async function save(input: BehaviorInput) {
    setBusy(true);
    setError(null);
    try {
      const created = unwrap(await backend!.addBehavior(input));
      setBehaviors((bs) => [...bs, created]);
      navigate("/parent/behaviors");
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader title={t("behavior.add")} back="/parent/behaviors" />
      <Card>
        <BehaviorForm kids={data.children} submitLabel={t("common.save")} busy={busy} onSubmit={(i) => void save(i)} />
        {error && <p role="alert">{error}</p>}
      </Card>
    </main>
  );
}
