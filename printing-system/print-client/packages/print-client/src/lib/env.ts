/**
 * Central place for reading Vite env vars so the rest of the app
 * never touches `import.meta.env` directly.
 */

function resolvePrintServerUrl(rawServerUrl?: string): string {
  const trimmed = rawServerUrl?.trim();
  if (trimmed) {
    return trimmed.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "0.0.0.0") {
      return `${protocol}//${hostname}:4000`;
    }
  }

  return "http://localhost:4000";
}

export const PRINT_SERVER_URL = resolvePrintServerUrl(import.meta.env.VITE_PRINT_SERVER_URL as string | undefined);

/**
 * Placeholder identity for this LAN client. There is no auth/accounts
 * layer in this app; the print-server is expected to treat any
 * ownerId as an opaque label for grouping jobs.
 */
export const CLIENT_USER_ID = (import.meta.env.VITE_CLIENT_USER_ID as string | undefined) ?? "local-user";
