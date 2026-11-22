import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router";
import type { ChildView, Reward } from "~/bindings/backend";
import { useShake } from "~/components/KidPads";
import { KidBar } from "~/components/KidBar";
import { RewardIcon } from "~/components/RewardForm";
import { useRewardImage } from "~/lib/image";
import { useKid } from "~/lib/kid";
import { unwrap } from "~/lib/result";
import { useSound } from "~/lib/sound";
import { useToast } from "~/lib/toast";
import { kidTheme } from "~/lib/theme";

function Item({ child, reward, pending, index }: { child: ChildView; reward: Reward; pending: boolean; index: number }) {
  const { t } = useTranslation();
  const play = useSound();
  const notify = useToast();
  const { backend, setChild, addRequest } = useKid();
  const image = useRewardImage(backend, reward);
  const [busy, setBusy] = useState(false);
  const { controls, shake } = useShake();
  const cost = Number(reward.cost);
  const balance = Number(child.balance);
  const enough = balance >= cost;
  const pinned = child.savingForRewardId === reward.id;

  // Shows as waiting at once; a failed send takes the hourglass away again with a shake.
  async function want() {
    setBusy(true);
    play("coin");
    try {
      addRequest(unwrap(await backend.requestReward(child.id, reward.id)));
    } catch (e) {
      console.error("Requesting the reward failed", e);
      shake();
      notify(t("kidMode.tryAgain"));
    } finally {
      setBusy(false);
    }
  }

  async function pin() {
    try {
      setChild(unwrap(await backend.setSavingGoal(child.id, pinned ? null : reward.id)));
      play("pop");
    } catch (e) {
      console.error("Setting the saving goal failed", e);
      shake();
      notify(t("kidMode.tryAgain"));
    }
  }

  return (
    <motion.li
      className={`shop-item${enough ? " shop-item--ready" : ""}`}
      data-testid={`shop-${reward.id}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <motion.div animate={controls} className="shop-item__body">
        <RewardIcon emoji={reward.emoji} src={image} size="4rem" />
        <span className="shop-item__name">{reward.name}</span>
        <span className="shop-item__cost">⭐ {cost}</span>
        {!enough && (
          <span className="kid-bar-meter" aria-label={`${balance} / ${cost}`}>
            <span style={{ width: `${(balance / cost) * 100}%` }} />
          </span>
        )}
      </motion.div>
      <div className="shop-item__actions">
        {pending || busy ? (
          <span className="shop-pending" data-testid="pending" aria-label={t("kidMode.waiting")}>
            ⏳
          </span>
        ) : (
          <motion.button
            type="button"
            className="shop-want"
            data-testid="want"
            disabled={!enough || busy}
            whileTap={{ scale: 0.85 }}
            onClick={() => void want()}
            aria-label={t("kidMode.want")}
          >
            🙋
          </motion.button>
        )}
        <motion.button
          type="button"
          className="shop-pin"
          data-testid="pin"
          aria-pressed={pinned}
          whileTap={{ scale: 0.85 }}
          onClick={() => void pin()}
          aria-label={t("kidMode.saveFor")}
        >
          📌
        </motion.button>
      </div>
    </motion.li>
  );
}

export default function KidShop() {
  const { t } = useTranslation();
  const { childId: id } = useParams();
  const { data, unlocked } = useKid();
  const child = data?.children.find((c) => String(c.id) === id);
  if (!data || !child || (child.hasPicture && !unlocked.has(child.id))) return <Navigate to="/kid" replace />;

  const rewards = [...data.rewards].sort((a, b) => Number(a.cost - b.cost));
  const speech = t("kidMode.shopSpeech", { count: Number(child.balance) });
  return (
    <main className="kid-main" style={kidTheme(child.favoriteColor)}>
      <KidBar back={`/kid/${child.id}`} speech={speech} />
      <h1 className="kid-title" aria-label={t("kidMode.shop")}>
        🏪 ⭐ {Number(child.balance)}
      </h1>
      <ul className="shop">
        {rewards.map((r, i) => (
          <Item
            key={String(r.id)}
            child={child}
            reward={r}
            index={i}
            pending={data.requests.some((q) => q.childId === child.id && q.rewardId === r.id)}
          />
        ))}
      </ul>
    </main>
  );
}
