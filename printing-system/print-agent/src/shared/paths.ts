import * as os from "node:os";
import * as path from "node:path";

/**
 * Resolves the directory used to persist agent-local state (identity,
 * queue, printer cache, downloaded files). Purely an operational
 * concern of this service -- not part of the print-common contract.
 */
export function defaultStateDir(): string {
  const isRoot = process.platform === "linux" && typeof process.getuid === "function" && process.getuid() === 0;
  if (isRoot) {
    return "/var/lib/print-agent";
  }
  return path.join(os.homedir(), ".local", "state", "print-agent");
}
