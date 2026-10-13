import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  ConnectionProtocol,
  DuplexMode,
  MAX_DOCUMENT_SIZE_BYTES,
  PaperSize,
  PaperType,
  PrintQuality,
  PrinterStatus,
} from "print-common";
import {
  DetectedPrinter,
  PrintingSystemPort,
  SubmitPrintJobInput,
  SubmitPrintJobResult,
  SystemJobState,
} from "../../domain/ports/printing-system.port";
import { LoggerPort } from "../../domain/ports/logger.port";

const execFileAsync = promisify(execFile);

/**
 * Drives the local printing system through CUPS's standard
 * command-line tools (lpstat, lp, cancel), which are present on both
 * Ubuntu and Raspberry Pi OS. Deliberately avoids native printing
 * libraries (e.g. node bindings around libcups) so the agent has no
 * native module to rebuild when it later runs on a Pi Zero 2 W.
 *
 * Known limitation (documented in docs/PRINT_COMMON_GAPS.md and
 * docs/ARCHITECTURE.md): `lpstat` cannot reliably distinguish a job
 * that finished printing successfully from one CUPS silently dropped
 * after a driver/hardware error -- both simply disappear from the
 * "not completed" queue. A future revision could shell out to
 * `ipptool`/query IPP `job-state` directly for authoritative status.
 */
export class CupsPrintingSystem implements PrintingSystemPort {
  constructor(private readonly logger: LoggerPort) {}

  async detectPrinters(): Promise<DetectedPrinter[]> {
    const [statusLines, deviceUriByName] = await Promise.all([
      this.listPrinterStatusLines(),
      this.listDeviceUris(),
    ]);

    const printers: DetectedPrinter[] = [];
    for (const line of statusLines) {
      const parsed = parsePrinterStatusLine(line);
      if (!parsed) continue;
      const deviceUri = deviceUriByName.get(parsed.name);
      printers.push({
        localName: parsed.name,
        protocol: deviceUriToProtocol(deviceUri),
        status: parsed.status,
        capabilities: await this.probeCapabilities(parsed.name),
      });
    }
    return printers;
  }

  async getPrinterStatus(localPrinterName: string): Promise<PrinterStatus> {
    try {
      const { stdout } = await execFileAsync("lpstat", ["-p", localPrinterName]);
      const line = stdout.split("\n").find((l) => l.trim().length > 0);
      const parsed = line ? parsePrinterStatusLine(line) : undefined;
      return parsed?.status ?? PrinterStatus.UNKNOWN;
    } catch (err) {
      this.logger.debug("lpstat failed while checking printer status", {
        printer: localPrinterName,
        error: String(err),
      });
      return PrinterStatus.UNKNOWN;
    }
  }

  async submitPrintJob(input: SubmitPrintJobInput): Promise<SubmitPrintJobResult> {
    const supported = await this.getSupportedOptionValues(input.localPrinterName);
    const args = buildLpArgs(input, supported, this.logger);
    try {
      const { stdout } = await execFileAsync("lp", args);
      const match = /request id is (\S+)/.exec(stdout);
      if (!match || !match[1]) {
        throw new Error(`Could not parse CUPS job id from lp output: "${stdout.trim()}"`);
      }
      return { systemJobId: match[1] };
    } catch (err) {
      // execFile rejects with `.stderr` populated for non-zero exit codes --
      // surface it instead of swallowing it into a generic "Command failed".
      const stderr = (err as { stderr?: string })?.stderr;
      throw new Error(`lp failed: ${stderr?.trim() || String(err)}`);
    }
  }

  /**
   * Returns the real, PPD-authoritative keyword sets this printer advertises
   * for `media`/`PageSize`, `ColorModel`, and `MediaType`, parsed from
   * `lpoptions -l` -- the same source of truth CUPS' own GUI print dialogs
   * use to populate their option dropdowns.
   */
  private async getSupportedOptionValues(localPrinterName: string): Promise<SupportedOptionValues> {
    const result: SupportedOptionValues = {
      media: new Set<string>(),
      colorModel: new Set<string>(),
      printColorMode: new Set<string>(),
      printQuality: new Set<string>(),
      stpQuality: new Set<string>(),
      mediaType: new Set<string>(),
    };
    try {
      const { stdout } = await execFileAsync("lpoptions", ["-p", localPrinterName, "-l"]);
      for (const line of stdout.split("\n")) {
        const [name, rest] = line.split(":");
        if (!name || !rest) continue;
        const key = name.split("/")[0]?.trim();
        const values = rest
          .trim()
          .split(/\s+/)
          .map((v) => v.replace(/^\*/, ""))
          .filter(Boolean);
        if (key === "PageSize" || key === "media") values.forEach((v) => result.media.add(v));
        if (key === "ColorModel") values.forEach((v) => result.colorModel.add(v));
        if (key === "print-color-mode") values.forEach((v) => result.printColorMode.add(v));
        if (key === "PrintQuality") values.forEach((v) => result.printQuality.add(v));
        if (key === "StpQuality") values.forEach((v) => result.stpQuality.add(v));
        if (key === "MediaType") values.forEach((v) => result.mediaType.add(v));
      }
    } catch (err) {
      this.logger.warn("lpoptions -l failed; submitting without PPD-validated options", {
        printer: localPrinterName,
        error: String(err),
      });
    }
    return result;
  }

  async getJobState(systemJobId: string): Promise<SystemJobState> {
    try {
      const { stdout: active } = await execFileAsync("lpstat", ["-W", "not-completed", "-o"]);
      if (active.includes(systemJobId)) {
        return active.toLowerCase().includes("processing") ? "processing" : "pending";
      }
    } catch (err) {
      this.logger.debug("lpstat -W not-completed failed", { systemJobId, error: String(err) });
      return "unknown";
    }
    // No longer active. See class-level doc comment: we cannot cheaply distinguish
    // "completed" from "failed and dropped" via lpstat alone, so we treat a job
    // that has left the active queue as completed.
    return "completed";
  }

  async cancelJob(systemJobId: string): Promise<void> {
    await execFileAsync("cancel", [systemJobId]);
  }

  private async listPrinterStatusLines(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync("lpstat", ["-p"]);
      return stdout.split("\n").filter((l) => l.trim().length > 0);
    } catch (err) {
      this.logger.debug("lpstat -p returned no printers or failed", { error: String(err) });
      return [];
    }
  }

  private async listDeviceUris(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const { stdout } = await execFileAsync("lpstat", ["-v"]);
      for (const line of stdout.split("\n")) {
        // e.g. "device for MyPrinter: ipp://localhost/printers/MyPrinter"
        const match = /^device for ([^:]+):\s*(.+)$/.exec(line.trim());
        if (match && match[1] && match[2]) {
          map.set(match[1], match[2]);
        }
      }
    } catch (err) {
      this.logger.debug("lpstat -v failed", { error: String(err) });
    }
    return map;
  }

  private async probeCapabilities(localPrinterName: string) {
    let supportedPaperSizes: string[] = ["A4", "LETTER"];
    let supportsDuplex = false;
    let supportsColor = false;
    try {
      const { stdout } = await execFileAsync("lpoptions", ["-p", localPrinterName, "-l"]);
      supportsDuplex = /^Duplex\/|^Sides\//im.test(stdout);
      supportsColor = /ColorModel\/.*(?:RGB|Color)/i.test(stdout);
      const mediaLine = stdout.split("\n").find((l) => /^(PageSize|media)\//i.test(l));
      if (mediaLine) {
        const values = mediaLine.split(":")[1];
        if (values) {
          supportedPaperSizes = values
            .trim()
            .split(/\s+/)
            .map((token) => token.replace(/^\*/, ""))
            .filter(Boolean);
        }
      }
    } catch (err) {
      this.logger.debug("lpoptions -l failed, using conservative defaults", {
        printer: localPrinterName,
        error: String(err),
      });
    }
    return {
      supportsColor,
      supportsDuplex,
      maxDpi: 600,
      supportedPaperSizes,
      maxCopiesPerJob: 9999,
      maxDocumentSizeBytes: MAX_DOCUMENT_SIZE_BYTES,
    };
  }
}

function parsePrinterStatusLine(line: string): { name: string; status: PrinterStatus } | undefined {
  const match = /^printer\s+(\S+)\s+(.*)$/i.exec(line.trim());
  if (!match || !match[1]) return undefined;
  const name = match[1];
  const rest = (match[2] ?? "").toLowerCase();
  let status: PrinterStatus;
  if (rest.includes("now printing")) {
    status = PrinterStatus.BUSY;
  } else if (rest.includes("disabled")) {
    status = PrinterStatus.OFFLINE;
  } else if (rest.includes("is idle")) {
    status = PrinterStatus.ONLINE;
  } else {
    status = PrinterStatus.UNKNOWN;
  }
  return { name, status };
}

function deviceUriToProtocol(deviceUri: string | undefined): ConnectionProtocol {
  if (!deviceUri) return ConnectionProtocol.IPP;
  const scheme = deviceUri.split(":")[0]?.toLowerCase();
  switch (scheme) {
    case "ipp":
    case "ipps":
      return ConnectionProtocol.IPP;
    case "lpd":
      return ConnectionProtocol.LPD;
    case "usb":
      return ConnectionProtocol.USB;
    case "socket":
      return ConnectionProtocol.RAW_SOCKET;
    default:
      return ConnectionProtocol.IPP;
  }
}

interface SupportedOptionValues {
  media: Set<string>;
  colorModel: Set<string>;
  printColorMode: Set<string>;
  printQuality: Set<string>;
  stpQuality: Set<string>;
  mediaType: Set<string>;
}

export function buildLpArgs(
  input: SubmitPrintJobInput,
  supported: SupportedOptionValues,
  logger: LoggerPort
): string[] {
  const { localPrinterName, filePath, options } = input;
  const args: string[] = ["-d", localPrinterName];

  args.push("-n", String(options.copies));
  if (options.pageRanges) {
    args.push("-P", options.pageRanges);
  }
  args.push("-o", `sides=${mapDuplexToCupsSides(options.duplexMode)}`);

  addQualityOption(args, options.quality, supported, logger);

  const mediaCandidates = mapPaperSizeToCupsMediaCandidates(options.paperSize);
  if (mediaCandidates.length > 0) {
    addFirstSupported(args, "PageSize", mediaCandidates, supported.media, logger);
  }

  addColorOptions(args, options.colorMode, supported, logger);

  const mediaTypeCandidates = mapPaperTypeToCupsMediaTypeCandidates(options.paperType);
  if (mediaTypeCandidates.length > 0) {
    addFirstSupported(args, "MediaType", mediaTypeCandidates, supported.mediaType, logger);
  }

  args.push(filePath);
  return args;
}

/**
 * Only forces a `-o key=value` flag when the PPD actually advertises that
 * exact value (case-sensitive, as escpr and similar strict filters treat
 * it). If it's not in the advertised set, the flag is omitted entirely so
 * the driver falls back to its own default -- exactly what happens when
 * printing from Image Viewer / LibreOffice / "Print Test Page", and what
 * avoids a strict filter (e.g. Epson's rastertoescpr) hard-failing on an
 * unrecognized keyword instead of silently ignoring it.
 */
function addIfSupported(
  args: string[],
  key: string,
  value: string,
  supportedValues: Set<string>,
  logger: LoggerPort
): void {
  if (supportedValues.size === 0) {
    args.push("-o", `${key}=${value}`);
    return;
  }

  const normalizedValue = normalizeOptionValue(value);
  const resolvedValue = [...supportedValues].find((supportedValue) => normalizeOptionValue(supportedValue) === normalizedValue);

  if (resolvedValue) {
    args.push("-o", `${key}=${resolvedValue}`);
  } else {
    logger.warn("Skipping unsupported CUPS option; letting driver default apply", {
      key,
      requested: value,
      supported: [...supportedValues],
    });
  }
}

/**
 * CUPS drivers do not agree on the name of their monochrome ColorModel
 * value (common variants include Gray, Black, Mono and Grayscale).  The
 * standard IPP `print-color-mode` option is preferred where it is exposed,
 * with the driver's advertised ColorModel sent as well when available.
 * This prevents a B&W request from silently falling back to a colour
 * printer's default just because it does not call the option "Gray".
 */
function addColorOptions(
  args: string[],
  colorMode: string,
  supported: SupportedOptionValues,
  logger: LoggerPort,
): void {
  const requestedPrintColorMode = colorMode === "COLOR" ? "color" : "monochrome";
  addIfSupported(args, "print-color-mode", requestedPrintColorMode, supported.printColorMode, logger);

  const preferredModels =
    colorMode === "COLOR"
      ? ["RGB", "Color", "Colour"]
      : ["Gray", "Grayscale", "Greyscale", "Black", "Mono", "Monochrome", "K"];
  addFirstSupported(args, "ColorModel", preferredModels, supported.colorModel, logger);
}

function addFirstSupported(
  args: string[],
  key: string,
  candidates: string[],
  supportedValues: Set<string>,
  logger: LoggerPort,
): void {
  if (supportedValues.size === 0) {
    // Preserve the old, broadly compatible fallback when probing the printer
    // fails. The standard print-color-mode flag above still covers IPP-only
    // drivers in this case.
    args.push("-o", `${key}=${candidates[0]}`);
    return;
  }

  const resolvedValue = candidates
    .map((candidate) =>
      [...supportedValues].find((supportedValue) => normalizeOptionValue(supportedValue) === normalizeOptionValue(candidate)),
    )
    .find((value): value is string => Boolean(value));

  if (resolvedValue) {
    args.push("-o", `${key}=${resolvedValue}`);
  } else {
    logger.warn("Skipping unsupported CUPS option; letting driver default apply", {
      key,
      requested: candidates,
      supported: [...supportedValues],
    });
  }
}

function normalizeOptionValue(value: string): string {
  return value.trim().toLowerCase();
}

function mapDuplexToCupsSides(duplexMode: DuplexMode): string {
  switch (duplexMode) {
    case DuplexMode.DUPLEX_LONG_EDGE:
      return "two-sided-long-edge";
    case DuplexMode.DUPLEX_SHORT_EDGE:
      return "two-sided-short-edge";
    case DuplexMode.SIMPLEX:
    default:
      return "one-sided";
  }
}

/**
 * CUPS `PageSize` keywords are driver (PPD)-specific -- there is no
 * universal enum, and the two PPD families we see in the wild disagree
 * completely on naming:
 *
 *  - `epson-inkjet-printer-escpr` (escpr) uses human-readable names like
 *    "4x6in".
 *  - Gutenprint (`stp`, common on generic/older Epson setups and on
 *    Linux distro-packaged drivers) uses PostScript-point dimensions in
 *    the form `w<width>h<height>` (72pt = 1in), e.g. "w288h432" for 4x6in.
 *
 * Each paper size therefore maps to an ordered list of candidates rather
 * than a single value. `addFirstSupported` picks whichever candidate this
 * printer's PPD actually advertises (see `getSupportedOptionValues`) and
 * omits the flag entirely if none match, so an unrecognized driver still
 * falls back to its own default instead of failing the job.
 */
function mapPaperSizeToCupsMediaCandidates(paperSize: PaperSize): string[] {
  switch (paperSize) {
    case PaperSize.A4:
      return ["A4"];
    case PaperSize.PHOTO_4X6:
      return ["4x6in", "w288h432"];
    case PaperSize.A3:
      return ["A3"];
    case PaperSize.LETTER:
      return ["Letter"];
    case PaperSize.LEGAL:
      return ["Legal"];
    case PaperSize.TABLOID:
      return ["Tabloid", "w792h1224"];
    default:
      return [];
  }
}

/**
 * Quality is the one option where escpr and Gutenprint disagree on the
 * *option key itself*, not just its values -- escpr calls it
 * `PrintQuality`, Gutenprint calls it `StpQuality`. Sending the right
 * value under the wrong key is silently ignored by the driver just like
 * an unrecognized value would be, so `addQualityOption` below picks
 * whichever key this printer's PPD actually advertises (see
 * `getSupportedOptionValues`) before choosing a value for it.
 */
function mapPrintQualityToCupsPrintQuality(printQuality: PrintQuality): string | undefined {
  switch (printQuality) {
    case PrintQuality.DRAFT:
      return "Draft";
    case PrintQuality.NORMAL:
      return "Standard";
    case PrintQuality.HIGH:
      return "High";
    default:
      return undefined;
  }
}

function mapPrintQualityToStpQualityCandidates(printQuality: PrintQuality): string[] {
  switch (printQuality) {
    case PrintQuality.DRAFT:
      return ["Draft", "Economy"];
    case PrintQuality.NORMAL:
      return ["Standard"];
    case PrintQuality.HIGH:
      // Prefer the photo-tuned tiers Gutenprint exposes over its generic
      // "Best", since HIGH is what photo print jobs request.
      return ["HighPhoto", "Photo", "UltraPhoto", "High", "Best"];
    default:
      return [];
  }
}

/**
 * Sends print quality under whichever key this printer's PPD actually
 * advertises. Prefers `StpQuality` (Gutenprint) when the PPD exposes it,
 * since Gutenprint printers advertise both a generic `PrintQuality` some
 * distros synthesize and their own richer `StpQuality` -- `StpQuality` is
 * the one that maps to real photo-quality tiers. Falls back to the old
 * escpr-style blind `PrintQuality` push if probing the printer failed
 * entirely (both sets empty), preserving prior behavior for that case.
 */
function addQualityOption(
  args: string[],
  printQuality: PrintQuality,
  supported: SupportedOptionValues,
  logger: LoggerPort,
): void {
  if (supported.stpQuality.size > 0) {
    const candidates = mapPrintQualityToStpQualityCandidates(printQuality);
    if (candidates.length > 0) {
      addFirstSupported(args, "StpQuality", candidates, supported.stpQuality, logger);
    }
    return;
  }

  const quality = mapPrintQualityToCupsPrintQuality(printQuality);
  if (quality) {
    addIfSupported(args, "PrintQuality", quality, supported.printQuality, logger);
  }
}

/**
 * CUPS's `MediaType` option name and its accepted keyword values are
 * driver (PPD)-specific -- there is no universal enum, and (as with
 * `PageSize` above) escpr and Gutenprint disagree on naming entirely:
 *
 *  - escpr uses short codes: "EPREMGLOSS", "EMATTE", "PLAIN", "ENVELOPE".
 *  - Gutenprint uses its own words: "GlossyPhoto", "Semigloss", "Luster",
 *    "Matte", "Plain", "Envelope" -- and unlike escpr it distinguishes
 *    glossy/semigloss/luster from each other rather than collapsing them
 *    into one glossy keyword.
 *
 * Each paper type maps to an ordered list of candidates; `addFirstSupported`
 * sends whichever one this printer's PPD actually advertises (see
 * `getSupportedOptionValues`) and omits the flag if none match.
 */
function mapPaperTypeToCupsMediaTypeCandidates(paperType: PaperType): string[] {
  switch (paperType) {
    case PaperType.NORMAL:
      return ["PLAIN", "Plain"];
    case PaperType.PHOTO_PAPER_GLOSSY:
    case PaperType.EPSON_PREMIUM_GLOSSY:
    case PaperType.EPSON_ULTRA_PREMIUM_GLOSSY:
      return ["EPREMGLOSS", "GlossyPhoto"];
    case PaperType.EPSON_PREMIUM_SEMIGLOSS:
      return ["EPREMGLOSS", "Semigloss"];
    case PaperType.EPSON_PREMIUM_LUSTER:
      return ["EPREMGLOSS", "Luster"];
    case PaperType.PHOTO_PAPER_MATTE:
    case PaperType.EPSON_PREMIUM_PRESENTATION_MATTE:
    case PaperType.EPSON_ARCHIVAL_MATTE:
      return ["EMATTE", "Matte"];
    case PaperType.CARDSTOCK:
      return ["PLAIN", "Plain"];
    case PaperType.ENVELOPE:
      return ["ENVELOPE", "Envelope"];
    default:
      return [];
  }
}
