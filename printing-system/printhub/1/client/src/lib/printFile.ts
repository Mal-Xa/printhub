/**
 * Opens a file's real download URL (built by the server from Firebase
 * Storage) so admin staff can view it, and — for browsers that support it —
 * triggers the native print dialog automatically via a hidden iframe.
 *
 * Falls back to a plain new-tab open (where the admin can hit Ctrl/Cmd+P
 * themselves) if the file can't be loaded into an iframe for any reason,
 * e.g. cross-origin restrictions or an unsupported mime type.
 */
export function printFile(url: string, name: string) {
  if (!url) {
    throw new Error(`No print-ready URL available for "${name}". The file may still be uploading.`);
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      cleanup();
    } catch {
      // Cross-origin or unprintable content — fall back to opening it directly.
      window.open(url, "_blank", "noopener,noreferrer");
      cleanup();
    }
  };

  // Safety net: if the iframe never fires onload (blocked, bad mime type, etc.)
  // fall back to a normal tab after a short timeout.
  const timeout = setTimeout(() => {
    if (!done) {
      window.open(url, "_blank", "noopener,noreferrer");
      cleanup();
    }
  }, 4000);
  iframe.addEventListener("load", () => clearTimeout(timeout), { once: true });

  document.body.appendChild(iframe);
}

/** Opens the file in a new tab for viewing (not necessarily printing). */
export function viewFile(url: string, name: string) {
  if (!url) {
    throw new Error(`No preview URL available for "${name}". The file may still be uploading.`);
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
