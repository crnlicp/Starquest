import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { AvatarStudio } from "~/components/AvatarStudio";
import { Card } from "~/components/Card";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";

export default function ParentAvatar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { backend, data, setChild } = useFamily();
  const child = data?.children.find((c) => String(c.id) === id);
  if (!child || !backend) {
    return (
      <main>
        <PageHeader title={t("errors.notFound")} />
      </main>
    );
  }
  return (
    <main>
      <PageHeader title={t("avatar.titleFor", { name: child.name })} back={`/parent/children/${child.id}`} />
      <Card delay={0}>
        <AvatarStudio backend={backend} child={child} onSaved={(c) => (setChild(c), navigate(`/parent/children/${c.id}`))} />
      </Card>
    </main>
  );
}
