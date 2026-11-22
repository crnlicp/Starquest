import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import type { Animal, ChildInput } from "~/bindings/backend";
import { Avatar } from "~/components/Avatar";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { AnimalPad } from "~/components/KidPads";
import { ChildForm } from "~/components/ChildForm";
import { DevicesCard } from "~/components/DevicesCard";
import { Modal } from "~/components/Modal";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

export default function EditChild() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { backend, data, setChild, reload } = useFamily();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [pictureNote, setPictureNote] = useState<string | null>(null);
  const child = data?.children.find((c) => String(c.id) === id);

  if (!child || !backend) {
    return (
      <main>
        <PageHeader title={t("errors.notFound")} />
      </main>
    );
  }

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate("/parent");
    } catch (e) {
      setError(errorText(t, e));
      setBusy(false);
    }
  }

  const save = (input: ChildInput) => act(async () => setChild(unwrap(await backend.updateChild(child.id, input))));
  const remove = () =>
    act(async () => {
      unwrap(await backend.deleteChild(child.id));
      await reload();
    });

  async function picture(set: boolean) {
    if (!child || !backend) return;
    setBusy(true);
    setPictureNote(null);
    try {
      unwrap(set ? await backend.setPicturePassword(child.id, animals) : await backend.clearPicturePassword(child.id));
      setChild({ ...child, hasPicture: set });
      setAnimals([]);
      setPictureNote(set ? t("picture.saved") : t("picture.cleared"));
    } catch (e) {
      setPictureNote(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  const initial: ChildInput = {
    name: child.name,
    age: child.age,
    favoriteColor: child.favoriteColor,
    avatar: child.avatar,
    dailyGoal: child.dailyGoal,
  };

  return (
    <main>
      <PageHeader title={child.name} />
      <Card>
        <ChildForm initial={initial} submitLabel={t("common.save")} busy={busy} onSubmit={(i) => void save(i)} />
        {error && <p role="alert">{error}</p>}
      </Card>
      <Card delay={0.03} className="row">
        <Avatar avatar={child.avatar} size="4.5rem" />
        <Link className="big-button big-button--secondary" to={`/parent/children/${child.id}/avatar`} data-testid="dress-up">
          👕 {t("avatar.title")}
        </Link>
      </Card>
      <Card delay={0.05} className="stack">
        <h2>🔐 {t("picture.title")}</h2>
        <p className="muted">{child.hasPicture ? t("picture.on") : t("picture.help")}</p>
        <AnimalPad value={animals} onChange={setAnimals} disabled={busy} />
        <div className="row">
          <BigButton variant="secondary" onClick={() => setAnimals([])} disabled={busy || animals.length === 0}>
            {t("picture.again")}
          </BigButton>
          <BigButton onClick={() => void picture(true)} disabled={busy || animals.length < 3}>
            {t("common.save")}
          </BigButton>
        </div>
        {child.hasPicture && (
          <BigButton variant="secondary" onClick={() => void picture(false)} disabled={busy}>
            {t("picture.clear")}
          </BigButton>
        )}
        {pictureNote && <p role="status">{pictureNote}</p>}
      </Card>
      <DevicesCard backend={backend} child={child} delay={0.08} />
      <Card delay={0.1} className="stack">
        <BigButton variant="danger" onClick={() => setConfirm(true)} disabled={busy}>
          🗑️ {t("child.delete")}
        </BigButton>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t("child.deleteTitle", { name: child.name })}>
        <p>{t("child.deleteHelp")}</p>
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
