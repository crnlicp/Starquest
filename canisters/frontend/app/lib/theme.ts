// Applies a child's favorite color as the --kid theme, with readable text on top.
export function kidTheme(color: string): React.CSSProperties {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return {};
  // WCAG relative luminance; pick whichever ink has more contrast.
  const lum = [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const dark = 0.0225; // luminance of #2b2350
  const light = (1.05 / (lum + 0.05)) < ((lum + 0.05) / (dark + 0.05));
  return { "--kid": color, "--kid-ink": light ? "#2b2350" : "#ffffff" } as React.CSSProperties;
}
