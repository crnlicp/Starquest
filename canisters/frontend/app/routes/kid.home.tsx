import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import type { Animal, ChildView } from "~/bindings/backend";
import { AnimalPad, useShake } from "~/components/KidPads";
import { KidBar } from "~/components/KidBar";
import { Modal } from "~/components/Modal";
import { Avatar } from "~/components/Avatar";
import { useKid } from "~/lib/kid";
import { unwrap } from "~/lib/result";
import { kidTheme } from "~/lib/theme";

export default function KidPicker() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { backend, device, data, unlocked, unlock } = useKid();
  const [asking, setAsking] = useState<ChildView | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [busy, setBusy] = useState(false);
  const { controls, shake } = useShake();
  if (!data) return null;
  // The child's own device skips the picker.
  if (device) return <Navigate to={`/kid/${device.childId}`} replace />;

  function pick(child: ChildView) {
    if (!child.hasPicture || unlocked.has(child.id)) return navigate(`/kid/${child.id}`);
    setAnimals([]);
    setAsking(child);
  }

  async function enter(next: Animal[]) {
    setAnimals(next);
    if (!asking || next.length < 3) return;
    setBusy(true);
    try {
      if (unwrap(await backend.verifyPicturePassword(asking.id, next))) {
        unlock(asking.id);
        navigate(`/kid/${asking.id}`);
        return;
      }
    } catch (e) {
      // A lockout or network error looks the same to a child: try again later.
      console.error("Checking the picture password failed", e);
    }
    setBusy(false);
    shake();
    setTimeout(() => setAnimals([]), 450);
  }

  return (
    <main className="kid-main">
      <KidBar speech={t("kidMode.whoAreYou")} />
      <h1 className="kid-title" aria-label={t("kidMode.whoAreYou")}>👋</h1>
      <div className="kid-picker">
        {data.children.map((child, i) => (
          <motion.button
            key={String(child.id)}
            type="button"
            className="kid-pick"
            style={kidTheme(child.favoriteColor)}
            data-testid={`pick-${child.id}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: i * 0.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => pick(child)}
          >
            <Avatar avatar={child.avatar} size="5rem" />
            <span>{child.name}</span>
          </motion.button>
        ))}
      </div>
      <Modal open={asking !== null} onClose={() => setAsking(null)} title={t("kidMode.secret")}>
        <motion.div animate={controls}>
          <AnimalPad value={animals} onChange={(v) => void enter(v)} disabled={busy} />
        </motion.div>
      </Modal>
    </main>
  );
}
