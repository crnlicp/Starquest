import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AvatarSlot, type Avatar as AvatarData, type AvatarItemView, type Badge, type ChildView } from "~/bindings/backend";
import type { Backend } from "~/lib/auth";
import { characters } from "~/lib/avatars";
import { errorText, unwrap } from "~/lib/result";
import { useSound } from "~/lib/sound";
import { Avatar, type AvatarAction } from "./Avatar";
import { BigButton } from "./BigButton";
import { useShake } from "./KidPads";

type Tab = "friend" | AvatarSlot;
const tabs: { tab: Tab; emoji: string }[] = [
  { tab: "friend", emoji: "🐾" },
  { tab: AvatarSlot.hat, emoji: "🎩" },
  { tab: AvatarSlot.glasses, emoji: "👓" },
  { tab: AvatarSlot.background, emoji: "🌈" },
];

// Wearing an item replaces whatever was in its slot; tapping the worn item takes it off.
export function toggle(avatar: AvatarData, item: AvatarItemView, items: AvatarItemView[]): AvatarData {
  if (avatar.accessories.includes(item.id)) return { ...avatar, accessories: avatar.accessories.filter((a) => a !== item.id) };
  const sameSlot = new Set(items.filter((i) => i.slot === item.slot).map((i) => i.id));
  return { ...avatar, accessories: [...avatar.accessories.filter((a) => !sameSlot.has(a)), item.id] };
}

export function AvatarStudio({ backend, child, onSaved }: { backend: Backend; child: ChildView; onSaved: (child: ChildView) => void }) {
  const { t } = useTranslation();
  const play = useSound();
  const { controls, shake } = useShake();
  const [items, setItems] = useState<AvatarItemView[] | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [draft, setDraft] = useState<AvatarData>(child.avatar);
  const [tab, setTab] = useState<Tab>(AvatarSlot.hat);
  const [action, setAction] = useState<AvatarAction>("idle");
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([backend.listAvatarItems(child.id), backend.getBadgeDefinitions()])
      .then(([r, defs]) => {
        if (!live) return;
        setItems(unwrap(r));
        setBadges(defs);
      })
      .catch((e) => live && setError(errorText(t, e)));
    return () => {
      live = false;
    };
  }, [backend, child.id, t]);

  function cheer() {
    setAction("cheer");
    setTimeout(() => setAction("idle"), 700);
  }

  function need(item: AvatarItemView) {
    const u = item.unlock;
    if (u.__kind__ === "level") return t("avatar.needLevel", { number: Number(u.level) });
    if (u.__kind__ === "badge") {
      const b = badges.find((x) => x.id === u.badge);
      return t("avatar.needBadge", { badge: b ? `${b.emoji} ${b.name}` : u.badge });
    }
    return "";
  }

  function pick(item: AvatarItemView) {
    if (!items) return;
    if (!item.unlocked && !child.avatar.accessories.includes(item.id)) {
      setHint(need(item));
      shake();
      return;
    }
    setHint(null);
    setDraft((d) => toggle(d, item, items));
    play("pop");
    cheer();
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(unwrap(await backend.setAvatar(child.id, draft)));
      play("chest");
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  }

  const changed = draft.character !== child.avatar.character || draft.accessories.join() !== child.avatar.accessories.join();
  const shown = tab === "friend" ? null : (items ?? []).filter((i) => i.slot === tab);

  return (
    <div className="studio">
      <motion.div className="studio__preview" animate={controls} data-testid="studio-preview">
        <Avatar avatar={draft} size="10rem" action={action} pop />
      </motion.div>
      <p className="studio__hint" role="status">{hint ?? " "}</p>
      <div className="studio__tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.tab} type="button" role="tab" aria-selected={tab === x.tab} onClick={() => setTab(x.tab)}>
            <span aria-hidden="true">{x.emoji}</span> {t(`avatar.tabs.${x.tab}`)}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {!items && !error && <p className="muted">{t("app.loading")}</p>}
      <div className="studio__grid">
        {tab === "friend"
          ? characters.map((key) => (
              <button
                key={key} type="button" className="studio__item" aria-pressed={draft.character === key} aria-label={t(`avatar.characters.${key}`)}
                onClick={() => (setDraft((d) => ({ ...d, character: key })), play("pop"), cheer())}
              >
                <Avatar avatar={{ character: key, accessories: [] }} size="4rem" bounce={false} />
              </button>
            ))
          : shown?.map((item) => {
              const open = item.unlocked || child.avatar.accessories.includes(item.id);
              return (
                <button
                  key={item.id} type="button" data-testid={`item-${item.id}`}
                  className={open ? "studio__item" : "studio__item studio__item--locked"}
                  aria-pressed={draft.accessories.includes(item.id)}
                  aria-label={open ? t(`avatar.items.${item.id}`) : `${t(`avatar.items.${item.id}`)}: ${need(item)}`}
                  onClick={() => pick(item)}
                >
                  <Avatar avatar={{ character: draft.character, accessories: [item.id] }} size="4rem" bounce={false} />
                  {!open && <span className="studio__lock" aria-hidden="true">🔒</span>}
                </button>
              );
            })}
      </div>
      <BigButton onClick={() => void save()} disabled={busy || !changed} data-testid="studio-save">
        ✨ {t("avatar.save")}
      </BigButton>
    </div>
  );
}
