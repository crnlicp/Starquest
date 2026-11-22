import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { MissionTask } from "~/bindings/backend";

type Props = {
  missions: MissionTask[];
  busy?: boolean;
  onConfirm: (m: MissionTask, el: HTMLElement) => void;
  onCancel: (m: MissionTask) => void;
};

export function MissionList({ missions, busy, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <ul className="missions">
      <AnimatePresence initial={false}>
        {missions.map((m) => (
          <motion.li key={String(m.id)} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}>
            <span aria-hidden="true">🤝</span>
            <span className="missions__text">
              {m.suggestion}
              <small>{t("mission.refund", { count: Number(m.refund) })}</small>
            </span>
            <button type="button" className="chip chip--good" disabled={busy} onClick={(e) => onConfirm(m, e.currentTarget)}>
              ✓ {t("mission.done")}
            </button>
            <button type="button" className="chip" disabled={busy} onClick={() => onCancel(m)} aria-label={t("mission.cancel")}>
              ✕
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
