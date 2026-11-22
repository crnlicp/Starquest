import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChildView } from "~/bindings/backend";
import { Avatar } from "./Avatar";
import { kidTheme } from "~/lib/theme";
import { NumberRoller } from "./NumberRoller";

export { Avatar };

// A flame that grows with the streak.
export function StreakFlame({ streak }: { streak: number }) {
  const { t } = useTranslation();
  if (streak === 0) return null;
  const size = `${Math.min(1 + streak * 0.08, 2)}em`;
  return (
    <span className="streak" aria-label={t("child.streak", { count: streak })}>
      <span aria-hidden="true" style={{ fontSize: size }}>
        🔥
      </span>
      {streak}
    </span>
  );
}

export function ChildCard({ child, onClick }: { child: ChildView; onClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      type="button"
      className="child-card"
      style={kidTheme(child.favoriteColor)}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      layout
    >
      <Avatar avatar={child.avatar} />
      <span className="child-card__name">{child.name}</span>
      <span className="child-card__points">
        ⭐ <NumberRoller value={Number(child.balance)} />
      </span>
      <span className="child-card__meta">
        {t("child.level", { number: Number(child.level.number), title: child.level.title })}
        <StreakFlame streak={Number(child.streak)} />
      </span>
    </motion.button>
  );
}
