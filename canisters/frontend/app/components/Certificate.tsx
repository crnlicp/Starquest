import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BigButton } from "./BigButton";

export type Achievement = { emoji: string; title: string };

const W = 1200;
const H = 850;

// Drawn on a canvas so the same picture can be printed, shared or saved.
async function draw(o: { name: string; family: string; achievement: Achievement; color: string; heading: string; awarded: string; date: string }) {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = "#fff8e7";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = o.color;
  ctx.lineWidth = 28;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = "#ffc107";
  ctx.lineWidth = 6;
  ctx.strokeRect(66, 66, W - 132, H - 132);
  ctx.fillStyle = "#2b2350";
  ctx.textAlign = "center";
  const font = (size: number, weight = 800) => `${weight} ${size}px Nunito, ui-rounded, system-ui, sans-serif`;
  ctx.font = font(72);
  ctx.fillText(`⭐ ${o.heading} ⭐`, W / 2, 190);
  ctx.font = font(34, 600);
  ctx.fillText(o.awarded, W / 2, 260);
  ctx.font = font(96);
  ctx.fillStyle = o.color;
  ctx.fillText(o.name, W / 2, 370);
  ctx.font = font(150, 400);
  ctx.fillText(o.achievement.emoji, W / 2, 545);
  ctx.fillStyle = "#2b2350";
  ctx.font = font(56);
  ctx.fillText(o.achievement.title, W / 2, 650, W - 200);
  ctx.font = font(30, 600);
  ctx.fillStyle = "#6b6390";
  ctx.fillText(`${o.family} · ${o.date}`, W / 2, 740);
  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the picture"))), "image/png"));
}

export function Certificate({ name, family, color, achievement }: { name: string; family: string; color: string; achievement: Achievement }) {
  const { t, i18n } = useTranslation();
  const [png, setPng] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url = "";
    let live = true;
    const date = new Date().toLocaleDateString(i18n.language, { dateStyle: "long" });
    draw({ name, family, achievement, color, heading: t("certificate.heading"), awarded: t("certificate.awarded"), date })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (live) setPng({ blob, url });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [name, family, color, achievement, t, i18n.language]);

  const fileName = `${name}-${achievement.title}.png`.replace(/[^\p{L}\p{N}.-]+/gu, "-");
  const file = png ? new File([png.blob], fileName, { type: "image/png" }) : null;
  const canShare = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: t("certificate.heading") });
    } catch (e) {
      // Closing the share sheet is not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) return <p role="alert">{t("errors.generic", { message: error })}</p>;
  if (!png) return <p className="muted">{t("app.loading")}</p>;
  return (
    <div className="stack">
      <img src={png.url} alt={t("certificate.alt", { name, title: achievement.title })} className="certificate" data-testid="certificate" />
      <div className="row">
        <BigButton variant="secondary" onClick={() => window.print()}>
          🖨️ {t("certificate.print")}
        </BigButton>
        {canShare ? (
          <BigButton onClick={() => void share()}>📤 {t("certificate.share")}</BigButton>
        ) : (
          <a className="big-button big-button--primary" href={png.url} download={fileName}>
            💾 {t("certificate.save")}
          </a>
        )}
      </div>
    </div>
  );
}
