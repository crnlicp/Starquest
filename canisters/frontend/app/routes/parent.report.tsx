import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { Range, type Badge, type ChildBadge, type ChildStats, type WeeklySummary } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { Certificate, type Achievement } from "~/components/Certificate";
import { PointsChart, RatioBar, TopBehaviors } from "~/components/Charts";
import { Modal } from "~/components/Modal";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

const ranges = [Range.today, Range.week, Range.month, Range.year];

export default function ChildReport() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { backend, data, setChild } = useFamily();
  const child = data?.children.find((c) => String(c.id) === id);
  const [range, setRange] = useState<Range>(Range.week);
  const [stats, setStats] = useState<ChildStats | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [badges, setBadges] = useState<{ defs: Badge[]; earned: ChildBadge[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [award, setAward] = useState<Achievement | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!backend || !child) return;
    let live = true;
    setError(null);
    backend
      .getChildStats(child.id, range)
      .then((r) => live && setStats(unwrap(r)))
      .catch((e) => live && setError(errorText(t, e)));
    return () => {
      live = false;
    };
  }, [backend, child?.id, range, version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!backend || !child) return;
    let live = true;
    Promise.all([backend.getWeeklySummary(child.id), backend.getBadgeDefinitions(), backend.listChildBadges(child.id)])
      .then(([w, defs, earned]) => {
        if (!live) return;
        setWeekly(unwrap(w));
        setBadges({ defs, earned: unwrap(earned) });
      })
      .catch((e) => live && setError(errorText(t, e)));
    return () => {
      live = false;
    };
  }, [backend, child?.id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Things worth a certificate: the current level and every badge earned.
  const achievements = useMemo<Achievement[]>(() => {
    if (!child) return [];
    const level = { emoji: "🏅", title: t("certificate.level", { number: Number(child.level.number), title: child.level.title }) };
    const earned = (badges?.earned ?? []).flatMap((b) => badges?.defs.filter((d) => d.id === b.badgeId) ?? []);
    return [level, ...earned.map((d) => ({ emoji: d.emoji, title: d.name }))];
  }, [child, badges, t]);

  if (!child || !backend || !data) {
    return (
      <main>
        <PageHeader title={t("errors.notFound")} />
      </main>
    );
  }

  async function reset() {
    if (!child || !backend) return;
    setConfirmReset(false);
    setNote(null);
    try {
      setChild(unwrap(await backend.resetPoints(child.id)));
      setNote(t("reports.resetDone"));
      setVersion((v) => v + 1);
    } catch (e) {
      setNote(errorText(t, e));
    }
  }

  const top = weekly?.topBehavior;
  return (
    <main>
      <PageHeader title={t("reports.title", { name: child.name })} />
      {weekly && (
        <Card className="stack" delay={0}>
          <h2>🗓️ {t("reports.weekTitle")}</h2>
          <p data-testid="weekly">
            {t("reports.weekSentence", { name: weekly.name, count: Number(weekly.earned), good: Number(weekly.goodCount), oops: Number(weekly.oopsCount) })}
            {top && ` ${t("reports.weekTop", { title: `${top.emoji ?? ""} ${top.title}`.trim(), count: Number(top.count) })}`}
          </p>
        </Card>
      )}

      <Card delay={0.05}>
        <fieldset className="toggle" aria-label={t("reports.range")}>
          {ranges.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {t(`reports.ranges.${r}`)}
            </button>
          ))}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {stats && stats.range === range && (
          <div className="report">
            <div className="stat-tiles">
              <div className="stat-tile"><span>{t("reports.earned")}</span><strong data-testid="stat-earned">+{Number(stats.earned)}</strong></div>
              <div className="stat-tile"><span>{t("reports.lost")}</span><strong>−{Number(stats.lost)}</strong></div>
              <div className="stat-tile"><span>{t("reports.spent")}</span><strong>{Number(stats.spent)}</strong></div>
            </div>
            {stats.buckets.length > 1 && (
              <>
                <h3>{t("reports.overTime")}</h3>
                <PointsChart buckets={stats.buckets} />
              </>
            )}
            <h3>{t("reports.ratio")}</h3>
            <RatioBar good={Number(stats.goodCount)} oops={Number(stats.oopsCount)} />
            <h3>{t("reports.top")}</h3>
            <TopBehaviors items={stats.topBehaviors} />
          </div>
        )}
      </Card>

      <Card delay={0.1} className="stack">
        <h2>📜 {t("certificate.title")}</h2>
        <div className="certificate-picks">
          {achievements.map((a) => (
            <button key={a.title} type="button" className="chip" onClick={() => setAward(a)}>
              {a.emoji} {a.title}
            </button>
          ))}
        </div>
      </Card>

      <Card delay={0.15} className="stack">
        <BigButton variant="danger" onClick={() => setConfirmReset(true)}>
          🔄 {t("reports.reset")}
        </BigButton>
        {note && <p role="status">{note}</p>}
      </Card>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title={t("reports.resetTitle", { name: child.name })}>
        <p>{t("reports.resetHelp", { count: Number(child.balance) })}</p>
        <div className="row">
          <BigButton variant="secondary" onClick={() => setConfirmReset(false)}>
            {t("common.cancel")}
          </BigButton>
          <BigButton variant="danger" onClick={() => void reset()}>
            {t("reports.reset")}
          </BigButton>
        </div>
      </Modal>
      <Modal open={award !== null} onClose={() => setAward(null)} title={t("certificate.title")}>
        {award && <Certificate name={child.name} family={data.family.name} color={child.favoriteColor} achievement={award} />}
      </Modal>
    </main>
  );
}
