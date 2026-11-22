import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";
import { AvatarStudio } from "~/components/AvatarStudio";
import { KidBar } from "~/components/KidBar";
import { useKid } from "~/lib/kid";
import { kidTheme } from "~/lib/theme";

export default function KidAvatar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { childId: id } = useParams();
  const { backend, data, unlocked, setChild } = useKid();
  const child = data?.children.find((c) => String(c.id) === id);
  if (!data || !child || (child.hasPicture && !unlocked.has(child.id))) return <Navigate to="/kid" replace />;
  return (
    <main className="kid-main" style={kidTheme(child.favoriteColor)}>
      <KidBar back={`/kid/${child.id}`} speech={t("avatar.speech")} />
      <h1 className="kid-title">👕 {t("avatar.title")}</h1>
      <AvatarStudio backend={backend} child={child} onSaved={(c) => (setChild(c), navigate(`/kid/${c.id}`))} />
    </main>
  );
}
