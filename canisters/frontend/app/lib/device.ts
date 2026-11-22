import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { createBackend } from "./actor";
import { readJson, writeJson } from "./storage";

const KEY = "starquest.device-key";

// A kid device signs with its own key, kept on the device; pairing ties that principal to one child.
export function deviceIdentity(): Ed25519KeyIdentity {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return Ed25519KeyIdentity.fromJSON(stored);
  } catch (e) {
    console.warn("Stored device key unreadable, making a new one", e);
  }
  const identity = Ed25519KeyIdentity.generate();
  try {
    localStorage.setItem(KEY, JSON.stringify(identity.toJSON()));
  } catch (e) {
    console.warn("Could not store the device key; pairing will not survive a reload", e);
  }
  return identity;
}

// No stored key means this device was never paired, so there is nothing to ask the backend.
export function hasDeviceKey() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function deviceBackend() {
  const identity = deviceIdentity();
  return { identity, principal: identity.getPrincipal().toText(), backend: createBackend(identity) };
}

// Set once a code is redeemed, so the welcome screen can go straight into Kid Mode.
const PAIRED = "starquest.pairedChild";
export const isPaired = () => readJson<string>(PAIRED) !== null;
export const markPaired = (childId: bigint) => writeJson(PAIRED, String(childId));

// After a revoke the old key is useless; dropping it lets the device pair again cleanly.
export function forgetDevice() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PAIRED);
  } catch (e) {
    console.warn("Could not clear the device key", e);
  }
}

// Shown to the parent in the device list; the backend only needs something non-empty.
export function deviceName() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  return "Computer";
}
