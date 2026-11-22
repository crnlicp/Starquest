import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ParentKind, type InviteView, type Parent, type Settings } from "~/bindings/backend";
import type { Backend } from "~/lib/auth";
import { nsToDate } from "~/lib/days";
import { patchSettings, useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";
import { BigButton } from "./BigButton";
import { Card } from "./Card";
import { Modal } from "./Modal";

const toTime = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const fromTime = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  // The generated bindings send an optional 0 as "none", which would turn the reminder off; midnight becomes 00:01.
  return Math.max(1, h * 60 + m);
};

// Family-wide options that live in the backend, so every parent device sees the same.
export function FamilyOptionsCard({ backend, delay }: { backend: Backend; delay?: number }) {
  const { t } = useTranslation();
  const { data, update } = useFamily();
  const [note, setNote] = useState<string | null>(null);
  if (!data) return null;
  const settings = data.family.settings;

  // Shown at once, put back if the save fails.
  async function save(patch: Partial<Settings>) {
    setNote(null);
    const put = (s: Settings) => update((d) => ({ ...d, family: { ...d.family, settings: s } }));
    put({ ...settings, ...patch });
    try {
      put(await patchSettings(backend, patch));
    } catch (e) {
      put(settings);
      setNote(errorText(t, e));
    }
  }

  const reminder = settings.reminderMinute === undefined || settings.reminderMinute === null ? null : Number(settings.reminderMinute);
  return (
    <Card delay={delay} className="stack settings-card">
      <h2>👪 {t("settings.family")}</h2>
      <div className="row setting">
        <span>
          <strong>{t("settings.leaderboard")}</strong>
          <br />
          <span className="muted">{t("settings.leaderboardHelp")}</span>
        </span>
        <label className="switch">
          <input type="checkbox" checked={settings.showLeaderboard} onChange={(e) => void save({ showLeaderboard: e.target.checked })} aria-label={t("settings.leaderboard")} />
          <span />
        </label>
      </div>
      <div className="row setting">
        <span>
          <strong>{t("settings.reminder")}</strong>
          <br />
          <span className="muted">{t("settings.reminderHelp")}</span>
        </span>
        <label className="switch">
          <input
            type="checkbox" checked={reminder !== null} aria-label={t("settings.reminder")}
            onChange={(e) => void save({ reminderMinute: e.target.checked ? BigInt(19 * 60) : undefined })}
          />
          <span />
        </label>
      </div>
      {reminder !== null && (
        <label className="field">
          {t("settings.reminderTime")}
          <input
            type="time" value={toTime(reminder)}
            onChange={(e) => {
              const m = fromTime(e.target.value);
              if (m !== null) void save({ reminderMinute: BigInt(m) });
            }}
          />
        </label>
      )}
      {note && <p role="alert">{note}</p>}
    </Card>
  );
}

export function PinCard({ backend, hasPin, delay }: { backend: Backend; hasPin: boolean; delay?: number }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{4}$/.test(next) && (!hasPin || /^\d{4}$/.test(current));

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const r = await backend.setParentPin(next, hasPin ? current : null);
      if (r.__kind__ === "err" && r.err.__kind__ === "notAuthorized") {
        setNote(t("settings.pinWrong"));
        return;
      }
      unwrap(r);
      setCurrent("");
      setNext("");
      setNote(t("settings.pinSaved"));
    } catch (e) {
      setNote(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card delay={delay}>
      <form className="form" onSubmit={(e) => (e.preventDefault(), void save())}>
        <h2>🔢 {t("settings.pin")}</h2>
        {hasPin && (
          <label className="field">
            {t("settings.pinCurrent")}
            <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} />
          </label>
        )}
        <label className="field">
          {t("settings.pinNew")}
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} />
        </label>
        <BigButton type="submit" disabled={busy || !valid}>
          {t("common.save")}
        </BigButton>
        {note && <p role="status">{note}</p>}
      </form>
    </Card>
  );
}

export function CaregiversCard({ backend, me, delay }: { backend: Backend; me: string; delay?: number }) {
  const { t, i18n } = useTranslation();
  const [parents, setParents] = useState<Parent[] | null>(null);
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<Parent | null>(null);

  useEffect(() => {
    backend
      .listParents()
      .then((r) => setParents(unwrap(r)))
      .catch((e) => setNote(errorText(t, e)));
  }, [backend, t]);

  const isOwner = parents?.some((p) => p.principal.toText() === me && p.kind === ParentKind.owner) ?? false;
  const link = invite ? `${window.location.origin}/parent/onboarding?invite=${invite.token}` : "";

  async function act(run: () => Promise<void>) {
    setNote(null);
    try {
      await run();
    } catch (e) {
      setNote(errorText(t, e));
    }
  }

  return (
    <Card delay={delay} className="stack">
      <h2>🤝 {t("caregivers.title")}</h2>
      {parents?.map((p) => (
        <div key={p.principal.toText()} className="row device" data-testid="parent">
          <span>
            <strong>{t(`auth.roles.${p.kind}`)}{p.principal.toText() === me ? ` (${t("caregivers.you")})` : ""}</strong>
            <br />
            <code className="muted" title={p.principal.toText()}>{p.principal.toText().slice(0, 11)}…</code>
          </span>
          {isOwner && p.kind !== ParentKind.owner && (
            <button type="button" className="chip" onClick={() => setRemoving(p)}>
              {t("caregivers.remove")}
            </button>
          )}
        </div>
      ))}
      {invite ? (
        <div className="stack" data-testid="invite">
          <p className="muted">{t("caregivers.inviteHelp", { when: nsToDate(invite.expiresAt).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" }) })}</p>
          <code className="invite-link">{link}</code>
          <div className="row">
            <button
              type="button" className="chip"
              onClick={() =>
                void navigator.clipboard.writeText(link).then(
                  () => (setCopied(true), setTimeout(() => setCopied(false), 2000)),
                  (e: unknown) => setNote(errorText(t, e)),
                )
              }
            >
              {copied ? `✓ ${t("common.copied")}` : `📋 ${t("common.copy")}`}
            </button>
            <button type="button" className="chip chip--quiet" onClick={() => void act(async () => (unwrap(await backend.revokeInvite(invite.token)), setInvite(null)))}>
              {t("caregivers.revoke")}
            </button>
          </div>
        </div>
      ) : (
        <BigButton variant="secondary" onClick={() => void act(async () => setInvite(unwrap(await backend.createInvite())))}>
          ✉️ {t("caregivers.invite")}
        </BigButton>
      )}
      {note && <p role="alert">{note}</p>}
      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={t("caregivers.removeTitle")}>
        <p>{t("caregivers.removeHelp")}</p>
        <div className="row">
          <BigButton variant="secondary" onClick={() => setRemoving(null)}>{t("common.cancel")}</BigButton>
          <BigButton
            variant="danger"
            onClick={() => {
              const p = removing;
              setRemoving(null);
              if (p) void act(async () => (unwrap(await backend.removeParent(p.principal)), setParents((ps) => ps?.filter((x) => x !== p) ?? null)));
            }}
          >
            {t("caregivers.remove")}
          </BigButton>
        </div>
      </Modal>
    </Card>
  );
}

// Devices and picture passwords are set per child on the child's page.
export function ChildrenLinksCard({ delay }: { delay?: number }) {
  const { t } = useTranslation();
  const { data } = useFamily();
  if (!data || data.children.length === 0) return null;
  return (
    <Card delay={delay} className="stack">
      <h2>📱 {t("settings.perChild")}</h2>
      <p className="muted">{t("settings.perChildHelp")}</p>
      <div className="certificate-picks">
        {data.children.map((c) => (
          <Link key={String(c.id)} className="chip" to={`/parent/children/${c.id}`}>
            {c.name}
          </Link>
        ))}
      </div>
    </Card>
  );
}
