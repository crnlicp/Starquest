import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ImageChange, RewardInput } from "~/bindings/backend";
import { toWebp } from "~/lib/image";
import { BigButton } from "./BigButton";

const rewardEmoji = ["🍦", "🎮", "📺", "🧸", "🎨", "🍕", "🎬", "🛝", "📖", "🎁", "🌙", "🚲", "🍪", "⚽", "🎤", "🏊"];

export const blankReward: RewardInput = { name: "", emoji: "🎁", cost: 20n, image: { __kind__: "keep", keep: null } };

type Props = {
  initial?: RewardInput;
  currentImage?: string | null;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (input: RewardInput) => void;
};

export function RewardForm({ initial = blankReward, currentImage = null, submitLabel, busy, onSubmit }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState<RewardInput>(initial);
  const [preview, setPreview] = useState<string | null>(currentImage);
  const [imageError, setImageError] = useState<string | null>(null);
  const set = (patch: Partial<RewardInput>) => setInput((i) => ({ ...i, ...patch }));

  useEffect(() => setPreview(currentImage), [currentImage]);
  useEffect(() => () => void (preview?.startsWith("blob:") && preview !== currentImage && URL.revokeObjectURL(preview)), [preview, currentImage]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    try {
      const bytes = await toWebp(file);
      setPreview(URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/webp" })));
      set({ image: { __kind__: "set", set: bytes } });
    } catch (e) {
      console.error("Preparing the image failed", e);
      setImageError(t("reward.imageFailed"));
    }
  }

  function removeImage() {
    setPreview(null);
    const image: ImageChange = { __kind__: "remove", remove: null };
    set({ image });
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...input, name: input.name.trim() });
      }}
    >
      <label>
        {t("reward.name")}
        <input required maxLength={40} value={input.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <fieldset className="picker">
        <legend>{t("behavior.emoji")}</legend>
        {rewardEmoji.map((emoji) => (
          <button key={emoji} type="button" aria-pressed={input.emoji === emoji} onClick={() => set({ emoji })}>
            {emoji}
          </button>
        ))}
        <input className="emoji-input" aria-label={t("behavior.ownEmoji")} maxLength={8} value={input.emoji} onChange={(e) => set({ emoji: e.target.value })} />
      </fieldset>
      <fieldset className="image-field">
        <legend>{t("reward.image")}</legend>
        {preview && <img src={preview} alt="" className="reward-img" />}
        <label className="chip">
          📷 {preview ? t("reward.changeImage") : t("reward.addImage")}
          <input type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        {preview && (
          <button type="button" className="chip" onClick={removeImage}>
            {t("reward.removeImage")}
          </button>
        )}
        {imageError && <p role="alert">{imageError}</p>}
      </fieldset>
      <label>
        {t("reward.cost")}
        <input
          type="number"
          min={1}
          max={10000}
          required
          value={Number(input.cost)}
          onChange={(e) => set({ cost: BigInt(Math.max(1, Math.min(10000, Math.trunc(Number(e.target.value)) || 1))) })}
        />
      </label>
      <BigButton type="submit" disabled={busy || !input.name.trim() || !input.emoji.trim()}>
        {submitLabel}
      </BigButton>
    </form>
  );
}

export function RewardIcon({ emoji, src, size = "2rem" }: { emoji: string; src: string | null; size?: string }) {
  return src ? (
    <img src={src} alt="" className="reward-img" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>
      {emoji}
    </span>
  );
}
