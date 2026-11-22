import { Language } from "~/bindings/backend";

const voices: Record<Language, string> = { [Language.en]: "en-US", [Language.sv]: "sv-SE" };

// Browsers don't expose a voice's gender, so known female voice names are matched instead.
const FEMALE = /aria|jenny|ava|emma|michelle|samantha|allison|susan|zira|serena|karen|moira|tessa|fiona|victoria|libby|sonia|natasha|sofie|hillevi|alva|klara|google us english|google uk english female|female/i;
const MALE = /guy|davis|tony|andrew|brian|christopher|eric|roger|steffan|ryan|mattias|oskar|david|mark|daniel|alex|fred|male/i;
// Neural and premium voices sound far more natural than the old robotic ones.
const NATURAL = /natural|neural|online|premium|enhanced|google/i;

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

function score(v: SpeechSynthesisVoice) {
  return (FEMALE.test(v.name) ? 10 : 0) - (MALE.test(v.name) && !/female/i.test(v.name) ? 10 : 0) + (NATURAL.test(v.name) ? 5 : 0) + (v.localService ? 0 : 1);
}

function pickVoice(lang: string) {
  const base = lang.slice(0, 2);
  const matching = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(base));
  return matching.sort((a, b) => score(b) - score(a))[0] ?? null;
}

// The voice list loads asynchronously in Chrome; touching it early starts the load.
if (canSpeak()) speechSynthesis.getVoices();

export function speak(text: string, language: Language) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voices[language];
  u.voice = pickVoice(u.lang);
  u.rate = 0.95;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}
