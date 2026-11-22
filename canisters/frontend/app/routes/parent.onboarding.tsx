import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import type { ChildInput } from "~/bindings/backend";
import { BigButton } from "~/components/BigButton";
import { Card } from "~/components/Card";
import { ChildForm } from "~/components/ChildForm";
import { EmojiIcon } from "~/components/EmojiIcon";
import { useAuth } from "~/lib/auth";
import { useFamily } from "~/lib/family";
import { errorText, unwrap } from "~/lib/result";
import { useSound } from "~/lib/sound";

type Step = "family" | "pin" | "child" | "done";
const steps: Step[] = ["family", "pin", "child", "done"];

// Family → PIN → first child. createFamily already enables the starter behaviors and sample rewards.
export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const play = useSound();
  const { session, refreshRole } = useAuth();
  const { reload } = useFamily();
  const [step, setStep] = useState<Step>("family");
  const [familyName, setFamilyName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const invite = params.get("invite");

  if (session.status !== "signedIn") return null;
  const backend = session.backend;

  async function run(action: () => Promise<void>, next: Step) {
    setBusy(true);
    setError(null);
    try {
      await action();
      play("coin");
      setStep(next);
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  const createFamily = () =>
    run(async () => {
      unwrap(await backend.createFamily(familyName.trim(), BigInt(-new Date().getTimezoneOffset())));
    }, "pin");

  const savePin = () =>
    run(async () => {
      unwrap(await backend.setParentPin(pin, null));
    }, "child");

  const addChild = (input: ChildInput) =>
    run(async () => {
      unwrap(await backend.addChild(input));
    }, "done");

  const finish = async () => {
    await refreshRole();
    await reload();
    navigate("/parent", { replace: true });
  };

  // Opened from a caregiver invite link: join that family instead of making one.
  if (invite) {
    const join = async () => {
      setBusy(true);
      setError(null);
      try {
        unwrap(await backend.acceptInvite(invite));
        play("coin");
        await finish();
      } catch (e) {
        setError(errorText(t, e));
        setBusy(false);
      }
    };
    return (
      <main className="center">
        <EmojiIcon emoji="🤝" size="5rem" />
        <h1>{t("caregivers.joinTitle")}</h1>
        <p className="muted">{t("caregivers.joinHelp")}</p>
        <BigButton onClick={() => void join()} disabled={busy}>
          {t("caregivers.join")}
        </BigButton>
        {error && <p role="alert">{error}</p>}
        <button type="button" className="small-link" onClick={() => navigate("/parent/onboarding", { replace: true })}>
          {t("caregivers.ownFamily")}
        </button>
      </main>
    );
  }

  return (
    <main>
      <div className="dots" aria-label={t("onboarding.progress", { step: steps.indexOf(step) + 1, total: steps.length })}>
        {steps.map((s) => (
          <span key={s} className={s === step ? "dot dot--on" : "dot"} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -80 }}>
          {step === "family" && (
            <Card className="stack">
              <EmojiIcon emoji="🏡" size="4rem" />
              <h1>{t("onboarding.familyTitle")}</h1>
              <form className="form" onSubmit={(e) => (e.preventDefault(), void createFamily())}>
                <label>
                  {t("onboarding.familyName")}
                  <input required maxLength={40} value={familyName} onChange={(e) => setFamilyName(e.target.value)} autoFocus />
                </label>
                <BigButton type="submit" disabled={busy || !familyName.trim()}>
                  {t("common.next")}
                </BigButton>
              </form>
            </Card>
          )}
          {step === "pin" && (
            <Card className="stack">
              <EmojiIcon emoji="🔒" size="4rem" />
              <h1>{t("onboarding.pinTitle")}</h1>
              <p className="muted">{t("onboarding.pinHelp")}</p>
              <form className="form" onSubmit={(e) => (e.preventDefault(), void savePin())}>
                <input
                  className="pin-input"
                  inputMode="numeric"
                  autoComplete="new-password"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  aria-label={t("onboarding.pinTitle")}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  autoFocus
                />
                <BigButton type="submit" disabled={busy || pin.length !== 4}>
                  {t("common.next")}
                </BigButton>
              </form>
            </Card>
          )}
          {step === "child" && (
            <Card className="stack">
              <h1>{t("onboarding.childTitle")}</h1>
              <ChildForm submitLabel={t("common.next")} busy={busy} onSubmit={(input) => void addChild(input)} />
            </Card>
          )}
          {step === "done" && (
            <Card className="stack">
              <motion.div animate={{ scale: [0.5, 1.2, 1], rotate: [0, 20, 0] }} transition={{ duration: 0.8 }}>
                <EmojiIcon emoji="🎉" size="5rem" />
              </motion.div>
              <h1>{t("onboarding.doneTitle")}</h1>
              <p className="muted">{t("onboarding.doneHelp")}</p>
              <BigButton onClick={() => void finish()}>{t("onboarding.start")}</BigButton>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
