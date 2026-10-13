import { PrinterId } from "print-common";
import { AgentIdentity } from "../domain/entities/agent-identity.entity";

/** Finds the local (CUPS) printer name mapped to the given server-assigned PrinterId, if any. */
export function resolveLocalPrinterName(identity: AgentIdentity, printerId: PrinterId): string | undefined {
  for (const [localName, id] of Object.entries(identity.printerIdByLocalName)) {
    if (id === printerId) return localName;
  }
  return undefined;
}
