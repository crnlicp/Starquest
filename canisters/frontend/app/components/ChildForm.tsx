import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChildInput } from "~/bindings/backend";
import { characters, favoriteColors } from "~/lib/avatars";
import { Avatar } from "./Avatar";
import { BigButton } from "./BigButton";

export const blankChild: ChildInput = {
  name: "",
  age: 6n,
  favoriteColor: favoriteColors[0],
  avatar: { character: "lion", accessories: [] },
};

type Props = { initial?: ChildInput; submitLabel: string; busy?: boolean; onSubmit: (input: ChildInput) => void };

export function ChildForm({ initial = blankChild, submitLabel, busy, onSubmit }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState<ChildInput>(initial);
  const set = (patch: Partial<ChildInput>) => setInput((i) => ({ ...i, ...patch }));

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...input, name: input.name.trim() });
      }}
    >
      <label>
        {t("child.name")}
        <input required maxLength={40} value={input.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
      </label>
      <label>
        {t("child.age")}
        <input
          type="number"
          min={0}
          max={18}
          required
          value={Number(input.age)}
          onChange={(e) => set({ age: BigInt(Math.max(0, Math.min(18, Number(e.target.value) || 0))) })}
        />
      </label>
      <fieldset className="picker">
        <legend>{t("child.avatar")}</legend>
        {characters.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={input.avatar.character === key}
            aria-label={t(`avatar.characters.${key}`)}
            onClick={() => set({ avatar: { ...input.avatar, character: key } })}
          >
            <Avatar avatar={{ character: key, accessories: [] }} size="44px" bounce={false} />
          </button>
        ))}
      </fieldset>
      <fieldset className="picker">
        <legend>{t("child.color")}</legend>
        {favoriteColors.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ background: color }}
            aria-pressed={input.favoriteColor === color}
            aria-label={color}
            onClick={() => set({ favoriteColor: color })}
          />
        ))}
      </fieldset>
      <label>
        {t("child.dailyGoal")}
        <input
          type="number"
          min={1}
          max={500}
          value={input.dailyGoal === undefined ? "" : Number(input.dailyGoal)}
          placeholder="20"
          onChange={(e) => set({ dailyGoal: e.target.value ? BigInt(Number(e.target.value)) : undefined })}
        />
      </label>
      <BigButton type="submit" disabled={busy || !input.name.trim()}>
        {submitLabel}
      </BigButton>
    </form>
  );
}
