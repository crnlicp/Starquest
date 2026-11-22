import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useKid, setKidMode } from "~/lib/kid";
import { ApiError } from "~/lib/result";
import { PinPad, ReadAloud } from "./KidPads";
import { Modal } from "./Modal";

// Top bar of every Kid Mode screen: back, read aloud, and the PIN-locked way out.
export function KidBar({ back, speech }: { back?: string; speech: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, device } = useKid();
  const [pin, setPin] = useState(false);

  async function check(value: string) {
    try {
      const r = await backend.verifyParentPin(value);
      if (r.__kind__ === "err") throw new ApiError(r.err);
      if (!r.ok) return "wrong" as const;
      setKidMode(false);
      navigate("/parent");
      return "ok" as const;
    } catch (e) {
      if (e instanceof ApiError && e.err.__kind__ === "rateLimited") return { waitMs: Number(e.err.rateLimited.retryAfterNs / 1_000_000n) };
      console.error("Checking the PIN failed", e);
      return "wrong" as const;
    }
  }

  return (
    <header className="kid-bar">
      {back ? (
        <motion.button type="button" className="kid-icon" aria-label={t("parent.back")} whileTap={{ scale: 0.85 }} onClick={() => navigate(back)}>
          ⬅️
        </motion.button>
      ) : (
        <span />
      )}
      <ReadAloud text={speech} />
      {/* The child's own device has no parent area to return to. */}
      {device ? <span /> : <motion.button type="button" className="kid-icon" aria-label={t("kidMode.exit")} whileTap={{ scale: 0.85 }} onClick={() => setPin(true)}>
        🔒
      </motion.button>}
      <Modal open={pin} onClose={() => setPin(false)} title={t("kidMode.pinTitle")}>
        <PinPad check={check} />
      </Modal>
    </header>
  );
}
