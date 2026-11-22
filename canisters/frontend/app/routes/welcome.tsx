import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { BigButton } from "~/components/BigButton";
import { EmojiIcon } from "~/components/EmojiIcon";
import { isPaired } from "~/lib/device";

export default function Welcome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // A paired kid device always opens on that child.
  if (isPaired()) return <Navigate to="/kid" replace />;
  return (
    <main className="center">
      <motion.div
        animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
      >
        <EmojiIcon emoji="⭐" size="6rem" />
      </motion.div>
      <h1>{t("app.name")}</h1>
      <p className="muted">{t("welcome.tagline")}</p>
      <BigButton onClick={() => navigate("/parent")}>
        <EmojiIcon emoji="👩‍👧" /> {t("welcome.parent")}
      </BigButton>
      <BigButton variant="kid" onClick={() => navigate("/kid")}>
        <EmojiIcon emoji="🚀" /> {t("welcome.kid")}
      </BigButton>
    </main>
  );
}
