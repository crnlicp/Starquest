// Decorative emoji are hidden from screen readers; meaningful ones get a label.
export function EmojiIcon({ emoji, label, size = "1.5em" }: { emoji: string; label?: string; size?: string }) {
  return label ? (
    <span role="img" aria-label={label} style={{ fontSize: size }}>
      {emoji}
    </span>
  ) : (
    <span aria-hidden="true" style={{ fontSize: size }}>
      {emoji}
    </span>
  );
}
