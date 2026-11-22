import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { ChildCard } from "~/components/ChildCard";
import { EmojiIcon } from "~/components/EmojiIcon";
import { Leaderboard, ReminderBanner } from "~/components/HomeExtras";
import { useFamily } from "~/lib/family";

export default function FamilyHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, data } = useFamily();
  if (!data || !backend) return null;
  const waiting = data.requests.length + data.missions.length;

  return (
    <main>
      <header className="row">
        <h1>{data.family.name}</h1>
        <Link to="/parent/settings" className="icon-link" aria-label={t("nav.settings")}>
          ⚙️
        </Link>
      </header>
      <ReminderBanner backend={backend} />

      <div className="child-grid">
        {data.children.map((child, i) => (
          <Card key={String(child.id)} delay={i * 0.06} className="plain">
            <ChildCard child={child} onClick={() => navigate(`/parent/log?child=${child.id}`)} />
            <div className="row">
              <Link className="small-link" to={`/parent/children/${child.id}`}>
                ✏️ {t("child.edit")}
              </Link>
              <Link className="small-link" to={`/parent/children/${child.id}/report`}>
                📊 {t("reports.link")}
              </Link>
            </div>
          </Card>
        ))}
        <Card delay={data.children.length * 0.06} className="plain">
          <Link className="child-card child-card--add" to="/parent/children/new">
            <EmojiIcon emoji="➕" size="2.5rem" />
            {t("child.add")}
          </Link>
        </Card>
      </div>

      {data.family.settings.showLeaderboard && data.children.length > 1 && <Leaderboard backend={backend} />}

      <div className="actions">
        <BigButton onClick={() => navigate("/parent/log")} disabled={data.children.length === 0}>
          <EmojiIcon emoji="⭐" /> {t("nav.quickLog")}
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate("/parent/behaviors")}>
          <EmojiIcon emoji="📋" /> {t("nav.behaviors")}
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate("/parent/rewards")}>
          <EmojiIcon emoji="🎁" /> {t("nav.rewards")}
        </BigButton>
        <BigButton variant="secondary" className="with-badge" onClick={() => navigate("/parent/approvals")}>
          <EmojiIcon emoji="📬" /> {t("nav.approvals")}
          {waiting > 0 && (
            <span className="badge" aria-label={t("nav.pending", { count: waiting })}>
              {waiting}
            </span>
          )}
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate("/parent/history")}>
          <EmojiIcon emoji="🕑" /> {t("nav.history")}
        </BigButton>
        <BigButton variant="kid" onClick={() => navigate("/kid")}>
          <EmojiIcon emoji="🚀" /> {t("nav.kidMode")}
        </BigButton>
      </div>
    </main>
  );
}
