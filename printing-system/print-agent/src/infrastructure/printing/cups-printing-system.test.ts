import assert from "node:assert/strict";
import test from "node:test";
import { ColorMode, DuplexMode, PaperSize, PaperType, PrintQuality } from "print-common";
import type { LoggerPort } from "../../domain/ports/logger.port";
import type { SubmitPrintJobInput } from "../../domain/ports/printing-system.port";
import { buildLpArgs } from "./cups-printing-system";

const logger: LoggerPort = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => logger,
};

test("buildLpArgs includes print quality and maps paper options to supported CUPS keywords", () => {
  const input: SubmitPrintJobInput = {
    localPrinterName: "L130",
    filePath: "/tmp/test.pdf",
    options: {
      copies: 1,
      colorMode: ColorMode.COLOR,
      duplexMode: DuplexMode.SIMPLEX,
      paperSize: PaperSize.LETTER,
      paperType: PaperType.EPSON_PREMIUM_GLOSSY,
      quality: PrintQuality.HIGH,
    },
  };

  const supported = {
    media: new Set(["Letter", "A4", "4x6in"]),
    colorModel: new Set(["RGB"]),
    printColorMode: new Set(["color", "monochrome"]),
    printQuality: new Set(["Draft", "Standard", "High"]),
    stpQuality: new Set<string>(),
    mediaType: new Set(["PLAIN", "EMATTE", "EPREMGLOSS", "ENVELOPE"]),
  };

  const args = buildLpArgs(input, supported, logger);

  assert.ok(args.includes("-o"));
  assert.ok(args.includes("PrintQuality=High"));
  assert.ok(args.includes("PageSize=Letter"));
  assert.ok(args.includes("MediaType=EPREMGLOSS"));
  assert.ok(args.includes("print-color-mode=color"));
});

test("buildLpArgs maps 4x6 photo jobs to Gutenprint keywords for stp-driven printers (e.g. Epson L130)", () => {
  const input: SubmitPrintJobInput = {
    localPrinterName: "EPSON_L130_Series",
    filePath: "/tmp/photo.jpg",
    options: {
      copies: 1,
      colorMode: ColorMode.COLOR,
      duplexMode: DuplexMode.SIMPLEX,
      paperSize: PaperSize.PHOTO_4X6,
      paperType: PaperType.EPSON_PREMIUM_GLOSSY,
      quality: PrintQuality.HIGH,
    },
  };

  const supported = {
    // Gutenprint's PPD exposes PageSize/MediaType keywords in its own
    // vocabulary, and quality under a wholly different option key
    // (StpQuality, not PrintQuality) -- this is what lpoptions -l
    // reports for the Epson L130 in practice.
    media: new Set(["Letter", "A4", "w288h432"]),
    colorModel: new Set(["RGB"]),
    printColorMode: new Set(["color", "monochrome"]),
    printQuality: new Set<string>(),
    stpQuality: new Set(["None", "Economy", "Draft", "Standard", "High", "Photo", "HighPhoto", "UltraPhoto", "Best"]),
    mediaType: new Set(["Plain", "Photo", "GlossyPhoto", "Semigloss", "Luster", "Matte"]),
  };

  const args = buildLpArgs(input, supported, logger);

  assert.ok(args.includes("PageSize=w288h432"));
  assert.ok(args.includes("MediaType=GlossyPhoto"));
  assert.ok(args.includes("StpQuality=HighPhoto"));
  assert.ok(!args.includes("PrintQuality=High"));
});

test("buildLpArgs uses an advertised monochrome colour model for B&W jobs", () => {
  const input: SubmitPrintJobInput = {
    localPrinterName: "Office printer",
    filePath: "/tmp/test.pdf",
    options: {
      copies: 1,
      colorMode: ColorMode.MONOCHROME,
      duplexMode: DuplexMode.SIMPLEX,
      paperSize: PaperSize.A4,
      paperType: PaperType.NORMAL,
      quality: PrintQuality.NORMAL,
    },
  };

  const args = buildLpArgs(
    input,
    {
      media: new Set(["A4"]),
      colorModel: new Set(["RGB", "Black"]),
      printColorMode: new Set(["color", "monochrome"]),
      printQuality: new Set(["Standard"]),
      stpQuality: new Set<string>(),
      mediaType: new Set(["PLAIN"]),
    },
    logger,
  );

  assert.ok(args.includes("ColorModel=Black"));
  assert.ok(args.includes("print-color-mode=monochrome"));
});

