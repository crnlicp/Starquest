import { useTranslation } from "react-i18next";
import { AnimationLevel, Language } from "~/bindings/backend";
import { usePrefs } from "~/lib/prefs";

function Toggle<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="toggle">
      <legend>{label}</legend>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

export function PrefsPanel() {
  const { t } = useTranslation();
  const { prefs, setPrefs } = usePrefs();
  return (
    <div className="prefs">
      <Toggle
        label={t("settings.language")}
        value={prefs.language}
        options={[
          { value: Language.en, label: "English" },
          { value: Language.sv, label: "Svenska" },
        ]}
        onChange={(language) => setPrefs({ language })}
      />
      <Toggle
        label={t("settings.sound")}
        value={prefs.soundOn ? "on" : "off"}
        options={[
          { value: "on", label: t("settings.on") },
          { value: "off", label: t("settings.off") },
        ]}
        onChange={(v) => setPrefs({ soundOn: v === "on" })}
      />
      <Toggle
        label={t("settings.motion")}
        value={prefs.animation}
        options={[
          { value: AnimationLevel.full, label: t("settings.full") },
          { value: AnimationLevel.reduced, label: t("settings.reduced") },
        ]}
        onChange={(animation) => setPrefs({ animation })}
      />
    </div>
  );
}
