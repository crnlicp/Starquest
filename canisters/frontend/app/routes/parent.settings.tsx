import { useTranslation } from "react-i18next";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { PageHeader } from "~/components/PageHeader";
import { PrefsPanel } from "~/components/PrefsPanel";
import { CaregiversCard, ChildrenLinksCard, FamilyOptionsCard, PinCard } from "~/components/SettingsCards";
import { useAuth } from "~/lib/auth";
import { useFamily } from "~/lib/family";

export default function ParentSettings() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const { data } = useFamily();
  if (session.status !== "signedIn" || !data) return null;
  const role = session.role.__kind__ === "parent" ? session.role.parent.kind : session.role.__kind__;
  return (
    <main>
      <PageHeader title={t("nav.settings")} />
      <Card>
        <PrefsPanel />
      </Card>
      <FamilyOptionsCard backend={session.backend} delay={0.04} />
      <PinCard backend={session.backend} hasPin={data.family.hasPin} delay={0.08} />
      <CaregiversCard backend={session.backend} me={session.principal} delay={0.12} />
      <ChildrenLinksCard delay={0.16} />
      <Card delay={0.2} className="stack">
        <p>
          {t("auth.principal")}: <code data-testid="principal">{session.principal}</code>
        </p>
        <p>
          {t("auth.role")}: <strong data-testid="role">{t(`auth.roles.${role}`)}</strong>
        </p>
        <BigButton variant="secondary" onClick={() => void signOut()}>
          {t("auth.signOut")}
        </BigButton>
      </Card>
    </main>
  );
}
