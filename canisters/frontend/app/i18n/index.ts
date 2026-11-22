import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import sv from "./sv.json";

export const languages = ["en", "sv"] as const;
export type Lang = (typeof languages)[number];

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, sv: { translation: sv } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React already escapes
});

export default i18n;
