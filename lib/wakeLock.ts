// Thin, feature-detected wrapper around the Screen Wake Lock API. Not
// universally supported (works on modern Chrome/Android and Safari iOS
// 16.4+) — every function here degrades to a safe no-op instead of throwing
// when the API is unavailable, since the live session must keep working on
// browsers without it.

export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return null;
  }

  try {
    return await (navigator as Navigator).wakeLock.request("screen");
  } catch {
    return null;
  }
}

export async function releaseWakeLock(
  sentinel: WakeLockSentinel | null,
): Promise<void> {
  if (!sentinel) {
    return;
  }

  try {
    await sentinel.release();
  } catch {
    // Already released or unsupported — nothing more to do.
  }
}
