import { useEffect, useState } from "react";
import type { Reward } from "~/bindings/backend";
import type { Backend } from "./auth";
import { unwrap } from "./result";

export const MAX_IMAGE_BYTES = 100_000; // the backend's limit

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("image encoding failed"))), "image/webp", quality),
  );
}

// Shrinks a photo to a square-ish WebP under the backend limit, lowering size and quality until it fits.
export async function toWebp(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const side of [512, 384, 256, 192]) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.7, 0.55, 0.4]) {
        const blob = await encode(canvas, quality);
        // Browsers without WebP encoding fall back to PNG, which the size check still bounds.
        if (blob.size <= MAX_IMAGE_BYTES) return new Uint8Array(await blob.arrayBuffer());
      }
    }
  } finally {
    bitmap.close();
  }
  throw new Error("image is too large even after shrinking");
}

const cache = new Map<string, Promise<string | null>>();

// Object URL for a reward's picture, fetched once per version of the reward.
export function useRewardImage(backend: Backend | null, reward: Reward | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const key = reward?.hasImage ? `${reward.id}:${reward.updatedAt}` : null;

  useEffect(() => {
    if (!backend || !key || !reward) {
      setUrl(null);
      return;
    }
    let live = true;
    let pending = cache.get(key);
    if (!pending) {
      pending = backend.getRewardImage(reward.id).then((r) => {
        const bytes = unwrap(r);
        return bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/webp" })) : null;
      });
      pending.catch(() => cache.delete(key));
      cache.set(key, pending);
    }
    pending.then((u) => live && setUrl(u)).catch((e) => console.error("Loading a reward image failed", e));
    return () => {
      live = false;
    };
  }, [backend, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return url;
}
