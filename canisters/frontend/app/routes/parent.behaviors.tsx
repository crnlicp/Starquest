import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { BehaviorKind, type Behavior, type StarterBehavior } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { PageHeader } from "~/components/PageHeader";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

export default function Behaviors() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, data, setBehaviors } = useFamily();
  const [starters, setStarters] = useState<StarterBehavior[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend?.listStarterBehaviors().then(setStarters).catch((e) => setError(errorText(t, e)));
  }, [backend, t]);

  if (!data || !backend) return null;
  const have = new Set(data.behaviors.map((b) => b.starterKey).filter(Boolean));
  const missing = starters.filter((s) => !have.has(s.key));

  async function toggle(b: Behavior) {
    setBehaviors((bs) => bs.map((x) => (x.id === b.id ? { ...x, enabled: !b.enabled } : x)));
    try {
      unwrap(await backend!.setBehaviorEnabled(b.id, !b.enabled));
    } catch (e) {
      setBehaviors((bs) => bs.map((x) => (x.id === b.id ? b : x)));
      setError(errorText(t, e));
    }
  }

  async function enableStarter(key: string) {
    try {
      const all = unwrap(await backend!.enableStarterBehaviors([key])); // the family's full list
      setBehaviors(() => all);
    } catch (e) {
      setError(errorText(t, e));
    }
  }

  const section = (kind: BehaviorKind) => (
    <Card className="list" delay={kind === BehaviorKind.good ? 0 : 0.06}>
      <h2>{kind === BehaviorKind.good ? `✅ ${t("log.good")}` : `⚠️ ${t("log.oops")}`}</h2>
      {data.behaviors
        .filter((b) => b.kind === kind)
        .map((b) => (
          <div key={String(b.id)} className={b.enabled ? "list-row" : "list-row list-row--off"}>
            <span className="list-row__emoji" aria-hidden="true">
              {b.emoji}
            </span>
            <Link to={`/parent/behaviors/${b.id}`} className="list-row__name">
              {b.name}
            </Link>
            <span className="list-row__points">
              {kind === BehaviorKind.good ? "+" : "−"}
              {String(b.points)}
            </span>
            <label className="switch">
              <input type="checkbox" checked={b.enabled} onChange={() => void toggle(b)} aria-label={t("behavior.enabled", { name: b.name })} />
              <span />
            </label>
          </div>
        ))}
    </Card>
  );

  return (
    <main>
      <PageHeader title={t("nav.behaviors")} />
      <BigButton onClick={() => navigate("/parent/behaviors/new")}>➕ {t("behavior.add")}</BigButton>
      {error && <p role="alert">{error}</p>}
      {section(BehaviorKind.good)}
      {section(BehaviorKind.oops)}
      {missing.length > 0 && (
        <Card className="list" delay={0.12}>
          <h2>📚 {t("behavior.library")}</h2>
          {missing.map((s) => (
            <div key={s.key} className="list-row">
              <span className="list-row__emoji" aria-hidden="true">
                {s.emoji}
              </span>
              <span className="list-row__name">{s.name}</span>
              <span className="list-row__points">
                {s.kind === BehaviorKind.good ? "+" : "−"}
                {String(s.points)}
              </span>
              <button type="button" className="chip" onClick={() => void enableStarter(s.key)}>
                {t("behavior.enable")}
              </button>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
