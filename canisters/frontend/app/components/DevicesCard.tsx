import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChildView, PairedDevice, PairingView } from "~/bindings/backend";
import type { Backend } from "~/lib/auth";
import { errorText, unwrap } from "~/lib/result";
import { BigButton } from "./BigButton";
import { Card } from "./Card";
import { Modal } from "./Modal";

const nsToMs = (ns: bigint) => Number(ns / 1_000_000n);

// Pair a kid device with a QR code or 6-digit code, and see or disconnect this child's devices.
export function DevicesCard({ backend, child, delay }: { backend: Backend; child: ChildView; delay?: number }) {
  const { t, i18n } = useTranslation();
  const [devices, setDevices] = useState<PairedDevice[] | null>(null);
  const [pairing, setPairing] = useState<PairingView | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PairedDevice | null>(null);

  const load = useCallback(async () => {
    try {
      const mine = unwrap(await backend.listDevices()).filter((d) => d.childId === child.id);
      setDevices(mine);
      return mine;
    } catch (e) {
      setNote(errorText(t, e));
      return null;
    }
  }, [backend, child.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const left = pairing ? Math.max(0, Math.ceil((nsToMs(pairing.expiresAt) - now) / 1000)) : 0;

  // While a code is showing: tick the countdown, and watch for the new device to arrive.
  useEffect(() => {
    if (!pairing || left === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const watch = setInterval(() => {
      void load().then((mine) => {
        if (mine?.some((d) => d.pairedAt >= pairing.expiresAt - 600_000_000_000n)) {
          setPairing(null);
          setNote(t("devices.connected"));
        }
      });
    }, 3000);
    return () => {
      clearInterval(timer);
      clearInterval(watch);
    };
  }, [pairing, left === 0, load, t]); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect() {
    setBusy(true);
    setNote(null);
    try {
      const p = unwrap(await backend.createPairingCode(child.id));
      // A web link, so any phone camera opens the app with the code filled in.
      setQr(await QRCode.toDataURL(`${window.location.origin}/kid?code=${p.code}`, { margin: 1, width: 240 }));
      setNow(Date.now());
      setPairing(p);
    } catch (e) {
      setNote(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(d: PairedDevice) {
    setRemoving(null);
    setBusy(true);
    setNote(null);
    try {
      unwrap(await backend.revokeDevice(d.principal));
      await load();
    } catch (e) {
      setNote(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  const when = (ns: bigint) => new Date(nsToMs(ns)).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <Card delay={delay} className="stack">
      <h2>📱 {t("devices.title")}</h2>
      {pairing && left > 0 ? (
        <div className="pairing" data-testid="pairing">
          <p className="muted">{t("devices.help")}</p>
          {qr && <img src={qr} alt={t("devices.qr")} className="pairing__qr" />}
          <p className="pairing__code" data-testid="pair-code" aria-label={pairing.code.split("").join(" ")}>
            {pairing.code.slice(0, 3)} {pairing.code.slice(3)}
          </p>
          <p className="muted">{t("devices.expires", { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` })}</p>
          <BigButton variant="secondary" onClick={() => setPairing(null)}>
            {t("common.cancel")}
          </BigButton>
        </div>
      ) : (
        <>
          {pairing && <p className="muted">{t("devices.expired")}</p>}
          <BigButton onClick={() => void connect()} disabled={busy}>
            {pairing ? t("devices.newCode") : t("devices.connect")}
          </BigButton>
        </>
      )}
      {devices && devices.length === 0 && <p className="muted">{t("devices.none")}</p>}
      {devices?.map((d) => (
        <div key={d.principal.toText()} className="device row" data-testid="device">
          <span>
            <strong>{d.name}</strong>
            <br />
            <span className="muted">{t("devices.lastActive", { when: when(d.lastActive) })}</span>
          </span>
          <button type="button" className="chip" onClick={() => setRemoving(d)} disabled={busy}>
            {t("devices.disconnect")}
          </button>
        </div>
      ))}
      {note && <p role="status">{note}</p>}
      <Modal open={removing !== null} onClose={() => setRemoving(null)} title={t("devices.disconnectTitle", { name: removing?.name ?? "" })}>
        <p>{t("devices.disconnectHelp")}</p>
        <div className="row">
          <BigButton variant="secondary" onClick={() => setRemoving(null)}>
            {t("common.cancel")}
          </BigButton>
          <BigButton variant="danger" onClick={() => removing && void disconnect(removing)}>
            {t("devices.disconnect")}
          </BigButton>
        </div>
      </Modal>
    </Card>
  );
}
