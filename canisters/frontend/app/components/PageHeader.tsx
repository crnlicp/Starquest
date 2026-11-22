import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function PageHeader({ title, back = "/parent", children }: { title: string; back?: string | null; children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <header className="page-header">
      {back && (
        <Link className="back" to={back}>
          ← {t("parent.back")}
        </Link>
      )}
      <div className="row">
        <h1>{title}</h1>
        {children}
      </div>
    </header>
  );
}
