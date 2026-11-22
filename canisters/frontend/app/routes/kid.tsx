import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate, useSearchParams } from "react-router";
import type { ChildView } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Confetti } from "~/components/Celebrations";
import { Avatar } from "~/components/ChildCard";
import { EmojiIcon } from "~/components/EmojiIcon";
import { PinPad } from "~/components/KidPads";
import { Modal } from "~/components/Modal";
import { useAuth } from "~/lib/auth";
import { deviceBackend, deviceName, forgetDevice, hasDeviceKey, isPaired, markPaired } from "~/lib/device";
import { setKidMode, useKid, useKidDevice, type KidDevice } from "~/lib/kid";
import { useMotionLevel } from "~/lib/motion";
import { ApiError, errorText, unwrap } from "~/lib/result";
import { useSound } from "~/lib/sound";

// Kid Mode on a parent's device or on a paired kid device; any other visitor is offered pairing.
export default function KidLayout() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const parent = session.status === "signedIn" && session.role.__kind__ === "parent" ? session : null;

  // Keyed on a boolean: the page fading out after the PIN exit must not switch Kid Mode back on
  // when the session object refreshes.
  const isParent = parent !== null;
  useEffect(() => {
    if (isParent) setKidMode(true);
  }, [isParent]);

  if (session.status === "loading") return <p className="center muted">{t("app.loading")}</p>;
  if (!parent) return <DeviceGate />;
  return <KidGate />;
}

function KidGate() {
  const { t } = useTranslation();
  const { data, error, reload } = useKid();
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

// Not a parent: a paired device goes straight in; anything else is offered pairing.
function DeviceGate() {
  const { t } = useTranslation();
  const { device, setDevice } = useKidDevice();
  const [unpaired, setUnpaired] = useState(() => !hasDeviceKey());
  const [error, setError] = useState<unknown>(null);

  const check = useCallback(() => {
    setError(null);
    const d = deviceBackend();
    d.backend
      .getMyRole()
      .then((role) => {
        if (role.__kind__ === "device") {
          markPaired(role.device.childId);
          setDevice({ backend: d.backend, childId: role.device.childId });
          return;
        }
        // Revoked while away: start over with a fresh key.
        if (isPaired()) forgetDevice();
        setUnpaired(true);
      })
      .catch((e: unknown) => setError(e));
  }, [setDevice]);

  useEffect(() => {
    if (!device && hasDeviceKey()) check();
  }, [device, check]);

  if (device) return <KidGate />;
  if (error) {
    return (
      <main className="center">
        <p role="alert">{errorText(t, error)}</p>
        <BigButton onClick={check}>{t("common.retry")}</BigButton>
      </main>
    );
  }
  if (!unpaired) return <p className="center muted">{t("app.loading")}</p>;
  return <Pairing onPaired={setDevice} />;
}

// The code from a scanned link, or six digits read off the screen.
function codeFrom(text: string) {
  try {
    const code = new URL(text).searchParams.get("code");
    if (code && /^\d{6}$/.test(code)) return code;
  } catch {
    // Not a link.
  }
  return /^\d{6}$/.test(text.trim()) ? text.trim() : null;
}

type Verdict = "ok" | "wrong" | { waitMs: number };

function Pairing({ onPaired }: { onPaired: (d: KidDevice) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hello, setHello] = useState<ChildView | null>(null);
  const play = useSound();

  const redeem = useCallback(
    async (code: string): Promise<Verdict> => {
      setError(null);
      const d = deviceBackend();
      try {
        const paired = unwrap(await d.backend.redeemPairingCode(code, deviceName()));
        markPaired(paired.childId);
        const child = unwrap(await d.backend.listChildren()).find((c) => c.id === paired.childId) ?? null;
        play("coin");
        setHello(child);
        setTimeout(() => {
          onPaired({ backend: d.backend, childId: paired.childId });
          navigate(`/kid/${paired.childId}`, { replace: true });
        }, 2200);
        return "ok";
      } catch (e) {
        if (e instanceof ApiError && e.err.__kind__ === "notFound") return "wrong";
        if (e instanceof ApiError && e.err.__kind__ === "rateLimited") return { waitMs: Number(e.err.rateLimited.retryAfterNs / 1_000_000n) };
        console.error("Pairing failed", e);
        setError(errorText(t, e));
        return "wrong";
      }
    },
    [navigate, onPaired, play, t],
  );

  // Opened from the QR code with a phone camera: the link carries the code.
  const linked = params.get("code");
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || !linked || !codeFrom(linked)) return;
    tried.current = true;
    void redeem(linked);
  }, [linked, redeem]);

  if (hello) return <Teleport child={hello} />;
  return (
    <main className="kid-main center">
      <button type="button" className="back" onClick={() => navigate("/")}>
        ← {t("parent.back")}
      </button>
      <EmojiIcon emoji="🚀" size="4rem" />
      <h1>{t("kid.pairTitle")}</h1>
      <p className="muted">{t("kid.pairHelp")}</p>
      <PinPad length={6} check={redeem} />
      {error && <p role="alert">{error}</p>}
      {canScan() && (
        <BigButton variant="kid" onClick={() => setScanning(true)}>
          📷 {t("kid.scan")}
        </BigButton>
      )}
      <Modal open={scanning} onClose={() => setScanning(false)} title={t("kid.scan")}>
        {scanning && (
          <Scanner
            onCode={(code) => {
              setScanning(false);
              void redeem(code);
            }}
          />
        )}
      </Modal>
    </main>
  );
}

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;
const detectorClass = () => (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
// Built-in QR reading (Chrome on Android, Safari 17+ on some setups); elsewhere the phone camera or the keypad does it.
const canScan = () => typeof window !== "undefined" && !!detectorClass() && !!navigator.mediaDevices?.getUserMedia;

function Scanner({ onCode }: { onCode: (code: string) => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Barcode = detectorClass();
    if (!Barcode) return;
    const detector = new Barcode({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const look = async () => {
      if (stopped || !video.current) return;
      try {
        for (const found of await detector.detect(video.current)) {
          const code = codeFrom(found.rawValue);
          if (code) return onCode(code);
        }
      } catch {
        // The first frames can be empty; keep looking.
      }
      timer = window.setTimeout(() => void look(), 300);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (stopped || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        void look();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onCode]);

  return (
    <div className="stack">
      <p className="muted">{t("kid.scanHelp")}</p>
      {error ? <p role="alert">{t("errors.generic", { message: error })}</p> : <video ref={video} className="scanner" muted playsInline />}
    </div>
  );
}

// The child's avatar arrives on the new device in a burst of sparkles.
function Teleport({ child }: { child: ChildView | null }) {
  const { t } = useTranslation();
  const calm = useMotionLevel() === "reduced";
  return (
    <div className="celebrate" role="status" data-testid="teleport">
      {!calm && <Confetti bursts={[{ x: 0.5, y: 0.45, delay: 300 }]} />}
      <motion.div
        initial={calm ? false : { scale: 0, rotate: -360, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 12 }}
      >
        {child ? <Avatar avatar={child.avatar} size="6rem" bounce={false} /> : <EmojiIcon emoji="✨" size="6rem" />}
      </motion.div>
      {!calm && <span className="sparkles" aria-hidden="true">✨</span>}
      <p className="celebrate__title">{child ? t("kid.hello", { name: child.name }) : "✨"}</p>
    </div>
  );
}
