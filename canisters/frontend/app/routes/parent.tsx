import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { EmojiIcon } from "~/components/EmojiIcon";
import { useAuth } from "~/lib/auth";
import { useFamily } from "~/lib/family";
import { kidModeOn } from "~/lib/kid";
import { errorText } from "~/lib/result";

// Gate for every /parent page: signed in, then a family (or onboarding), then the page.
export default function ParentLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { session, signIn } = useAuth();
  const { data, error, reload } = useFamily();
  const onboarding = pathname === "/parent/onboarding";

  if (session.status === "loading") return <p className="center muted">{t("app.loading")}</p>;

  if (session.status === "signedOut") {
    return (
      <main className="center">
        <EmojiIcon emoji="👩‍👧" size="5rem" />
        <h1>{t("parent.title")}</h1>
        {session.error && <p role="alert">{t("auth.failed")}</p>}
        <BigButton onClick={() => void signIn()}>{t("auth.signIn")}</BigButton>
      </main>
    );
  }

  const role = session.role.__kind__;
  if (role === "device") return <Navigate to="/kid" replace />;
  if (role === "none") return onboarding ? <Outlet /> : <Navigate to="/parent/onboarding" replace />;
  if (onboarding) return <Navigate to="/parent" replace />;
  // Leaving Kid Mode goes through the PIN pad, which clears this.
  if (kidModeOn()) return <Navigate to="/kid" replace />;

  if (error && !data) {
    return (
      <main className="center">
        <p role="alert">{errorText(t, error)}</p>
        <BigButton onClick={() => void reload()}>{t("common.retry")}</BigButton>
      </main>
    );
  }
  if (!data) return <p className="center muted">{t("app.loading")}</p>;
  return <Outlet />;
}
