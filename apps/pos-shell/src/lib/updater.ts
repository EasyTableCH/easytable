declare global { interface Window { __TAURI_INTERNALS__?: unknown } }

export async function checkForPosUpdate() {
  if (!window.__TAURI_INTERNALS__) return { available: false as const, reason: "browser" as const };
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return { available: false as const, reason: "current" as const };
  return {
    available: true as const,
    version: update.version,
    install: async () => update.downloadAndInstall(),
  };
}
