import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import type { BehaviorInput } from "~/bindings/backend";
import { BehaviorForm } from "~/components/BehaviorForm";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { Modal } from "~/components/Modal";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

export default function EditBehavior() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { backend, data, setBehaviors } = useFamily();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const behavior = data?.behaviors.find((b) => String(b.id) === id);

  if (!data || !backend || !behavior) {
    return (
      <main>
        <PageHeader title={t("errors.notFound")} back="/parent/behaviors" />
      </main>
    );
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate("/parent/behaviors");
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  const save = (input: BehaviorInput) =>
    act(async () => {
      const updated = unwrap(await backend.updateBehavior(behavior.id, input));
      setBehaviors((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));
    });

  const remove = () =>
    act(async () => {
      unwrap(await backend.deleteBehavior(behavior.id));
      setBehaviors((bs) => bs.filter((b) => b.id !== behavior.id));
    });

  const initial: BehaviorInput = {
    name: behavior.name,
    emoji: behavior.emoji,
    points: behavior.points,
    kind: behavior.kind,
    assignedTo: behavior.assignedTo,
    mission: behavior.mission,
  };

  return (
    <main>
      <PageHeader title={`${behavior.emoji} ${behavior.name}`} back="/parent/behaviors" />
      <Card>
        <BehaviorForm initial={initial} kids={data.children} submitLabel={t("common.save")} busy={busy} onSubmit={(i) => void save(i)} />
        {error && <p role="alert">{error}</p>}
      </Card>
      <Card delay={0.08} className="stack">
        <BigButton variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
          🗑️ {t("behavior.delete")}
        </BigButton>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t("behavior.deleteTitle", { name: behavior.name })}>
        <p>{t("behavior.deleteHelp")}</p>
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
