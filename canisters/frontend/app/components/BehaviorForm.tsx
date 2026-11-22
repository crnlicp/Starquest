import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BehaviorKind, type BehaviorInput, type ChildView } from "~/bindings/backend";
import { BigButton } from "./BigButton";

const goodEmoji = ["🪥", "🛏️", "🤝", "📚", "🥦", "💖", "😴", "🧸", "🧹", "🎒", "🍽️", "🐶", "🎨", "🏃", "🙏", "⭐"];
const oopsEmoji = ["👊", "📢", "🙉", "🤥", "📱", "😤", "🚪", "💢", "🙈", "⏰"];

export const blankBehavior: BehaviorInput = { name: "", emoji: "⭐", points: 5n, kind: BehaviorKind.good };

type Props = {
  initial?: BehaviorInput;
  kids: ChildView[];
  submitLabel: string;
  busy?: boolean;
  onSubmit: (input: BehaviorInput) => void;
};

export function BehaviorForm({ initial = blankBehavior, kids, submitLabel, busy, onSubmit }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState<BehaviorInput>(initial);
  const set = (patch: Partial<BehaviorInput>) => setInput((i) => ({ ...i, ...patch }));
  const assigned = input.assignedTo ?? [];
  const palette = input.kind === BehaviorKind.good ? goodEmoji : oopsEmoji;

  function toggleChild(id: bigint) {
    const next = assigned.includes(id) ? assigned.filter((x) => x !== id) : [...assigned, id];
    // An empty list means "every child", which the backend stores as no assignment.
    set({ assignedTo: next.length ? next : undefined });
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        // A mission refund can't exceed the points, so drop a mission that no longer fits.
        const suggestion = input.mission?.suggestion.trim();
        const mission =
          input.mission && suggestion && input.mission.refund <= input.points && input.kind === BehaviorKind.oops ? { ...input.mission, suggestion } : undefined;
        onSubmit({ ...input, name: input.name.trim(), mission });
      }}
    >
      <fieldset className="toggle">
        <legend>{t("behavior.kind")}</legend>
        {[BehaviorKind.good, BehaviorKind.oops].map((kind) => (
          <button key={kind} type="button" aria-pressed={input.kind === kind} onClick={() => set({ kind })}>
            {kind === BehaviorKind.good ? `✅ ${t("log.good")}` : `⚠️ ${t("log.oops")}`}
          </button>
        ))}
      </fieldset>
      <label>
        {t("behavior.name")}
        <input required maxLength={40} value={input.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <fieldset className="picker">
        <legend>{t("behavior.emoji")}</legend>
        {palette.map((emoji) => (
          <button key={emoji} type="button" aria-pressed={input.emoji === emoji} onClick={() => set({ emoji })}>
            {emoji}
          </button>
        ))}
        <input
          className="emoji-input"
          aria-label={t("behavior.ownEmoji")}
          maxLength={8}
          value={input.emoji}
          onChange={(e) => set({ emoji: e.target.value })}
        />
      </fieldset>
      <label>
        {t("behavior.points")}
        <input
          type="number"
          min={1}
          max={100}
          required
          value={Number(input.points)}
          onChange={(e) => {
            const points = BigInt(Math.max(1, Math.min(100, Math.trunc(Number(e.target.value)) || 1)));
            // Keep a mission's refund within the new points instead of dropping the mission.
            set({ points, mission: input.mission && { ...input.mission, refund: input.mission.refund > points ? points : input.mission.refund } });
          }}
        />
      </label>
      {input.kind === BehaviorKind.oops && (
        <fieldset className="form">
          <legend>🤝 {t("mission.title")}</legend>
          <label>
            {t("mission.suggestion")}
            <input
              maxLength={200}
              placeholder={t("mission.suggestionPlaceholder")}
              value={input.mission?.suggestion ?? ""}
              onChange={(e) =>
                set({ mission: e.target.value ? { suggestion: e.target.value, refund: input.mission?.refund ?? input.points } : undefined })
              }
            />
          </label>
          {input.mission && (
            <label>
              {t("mission.refundLabel")}
              <input
                type="number"
                min={1}
                max={Number(input.points)}
                required
                value={Number(input.mission.refund)}
                onChange={(e) => {
                  const refund = BigInt(Math.max(1, Math.min(Number(input.points), Math.trunc(Number(e.target.value)) || 1)));
                  set({ mission: { ...input.mission!, refund } });
                }}
              />
            </label>
          )}
        </fieldset>
      )}
      {kids.length > 1 && (
        <fieldset className="toggle">
          <legend>{t("behavior.assigned")}</legend>
          <button type="button" aria-pressed={assigned.length === 0} onClick={() => set({ assignedTo: undefined })}>
            {t("behavior.everyone")}
          </button>
          {kids.map((k) => (
            <button key={String(k.id)} type="button" aria-pressed={assigned.includes(k.id)} onClick={() => toggleChild(k.id)}>
              {k.name}
            </button>
          ))}
        </fieldset>
      )}
      <BigButton type="submit" disabled={busy || !input.name.trim() || !input.emoji.trim()}>
        {submitLabel}
      </BigButton>
    </form>
  );
}
