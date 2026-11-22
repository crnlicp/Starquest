import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { ChildInput } from "~/bindings/backend";
import { Card } from "~/components/Card";
import { ChildForm } from "~/components/ChildForm";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

export default function NewChild() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, setChild } = useFamily();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(input: ChildInput) {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      setChild(unwrap(await backend.addChild(input)));
      navigate("/parent");
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader title={t("child.add")} />
      <Card>
        <ChildForm submitLabel={t("common.save")} busy={busy} onSubmit={(i) => void save(i)} />
        {error && <p role="alert">{error}</p>}
      </Card>
    </main>
  );
}
