import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { LogKind, type HistoryFilter, type LogEntry } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { Modal } from "~/components/Modal";
import { PageHeader } from "~/components/PageHeader";
import { inputToDay, nsToDate } from "~/lib/days";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";

const PAGE = 20;
const kinds = [LogKind.behavior, LogKind.custom, LogKind.mission, LogKind.reward, LogKind.reset];
// The backend refuses to undo spending or a reset.
const deletable = (e: LogEntry) => e.kind !== LogKind.reward && e.kind !== LogKind.reset;

export default function History() {
  const { t, i18n } = useTranslation();
  const { backend, data, setChild } = useFamily();
  const [params, setParams] = useSearchParams();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [cursor, setCursor] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LogEntry | null>(null);

  // Filters live in the URL, so a filtered view survives a reload and can be linked from a report.
  const child = params.get("child") ?? "";
  const kind = params.get("kind") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const setFilter = (key: string, value: string) =>
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  // Only the newest request may fill the list; an older, slower reply for other filters is dropped.
  const latest = useRef(0);

  const load = useCallback(
    async (after: bigint | null) => {
      if (!backend) return;
      const filter: HistoryFilter = {
        childId: child ? BigInt(child) : undefined,
        kind: (kind as LogKind) || undefined,
        fromDay: inputToDay(from) === null ? undefined : BigInt(inputToDay(from)!),
        toDay: inputToDay(to) === null ? undefined : BigInt(inputToDay(to)!),
      };
      const request = ++latest.current;
      setLoading(true);
      setError(null);
      try {
        const page = unwrap(await backend.getHistory(filter, after, BigInt(PAGE)));
        if (request !== latest.current) return;
        setEntries((old) => (after === null ? page.entries : [...old, ...page.entries]));
        setCursor(page.nextCursor ?? null);
      } catch (e) {
        if (request === latest.current) setError(errorText(t, e));
      } finally {
        if (request === latest.current) setLoading(false);
      }
    },
    [backend, child, kind, from, to, t],
  );

  useEffect(() => void load(null), [load]);

  if (!data || !backend) return null;
  const nameOf = (id: bigint) => data.children.find((c) => c.id === id)?.name ?? "?";

  async function remove(entry: LogEntry) {
    setRemoving(null);
    try {
      setChild(unwrap(await backend!.deleteLogEntry(entry.id)));
      setEntries((es) => es.filter((e) => e.id !== entry.id));
    } catch (e) {
      setError(errorText(t, e));
    }
  }

  return (
    <main>
      <PageHeader title={t("history.title")} />
      <Card className="filters">
        <label>
          {t("history.child")}
          <select value={child} onChange={(e) => setFilter("child", e.target.value)}>
            <option value="">{t("history.all")}</option>
            {data.children.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          {t("history.type")}
          <select value={kind} onChange={(e) => setFilter("kind", e.target.value)}>
            <option value="">{t("history.all")}</option>
            {kinds.map((k) => (
              <option key={k} value={k}>{t(`history.kinds.${k}`)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("history.from")}
          <input type="date" value={from} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label>
          {t("history.to")}
          <input type="date" value={to} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
      </Card>
      {error && <p role="alert">{error}</p>}
      <ul className="history">
        {entries.map((e) => {
          const delta = Number(e.balanceDelta);
          return (
            <li key={String(e.id)} className="history__item" data-testid="history-entry">
              <span className="history__emoji" aria-hidden="true">{e.emoji ?? "⭐"}</span>
              <span className="history__text">
                <strong>{e.title}</strong>
                <span className="muted">
                  {nameOf(e.childId)} · {nsToDate(e.at).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" })}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </span>
              <span className={`history__points ${delta >= 0 ? "is-up" : "is-down"}`}>
                {delta >= 0 ? `+${delta}` : `−${-delta}`}
              </span>
              {deletable(e) && (
                <button type="button" className="icon-button" aria-label={t("history.delete")} onClick={() => setRemoving(e)}>
                  🗑️
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!loading && entries.length === 0 && <p className="center muted">{t("history.empty")}</p>}
      {cursor !== null && (
        <BigButton variant="secondary" onClick={() => void load(cursor)} disabled={loading}>
          {t("history.more")}
        </BigButton>
      )}
      {loading && <p className="center muted">{t("app.loading")}</p>}
      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={t("history.deleteTitle")}>
        <p>{removing && t("history.deleteHelp", { title: removing.title, name: nameOf(removing.childId) })}</p>
        <div className="row">
          <BigButton variant="secondary" onClick={() => setRemoving(null)}>{t("common.cancel")}</BigButton>
          <BigButton variant="danger" onClick={() => removing && void remove(removing)}>{t("common.delete")}</BigButton>
        </div>
      </Modal>
    </main>
  );
}
