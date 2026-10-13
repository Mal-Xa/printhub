const assert = require("node:assert/strict");
const test = require("node:test");
const { ColorMode, DuplexMode, PaperSize, PaperType, PrintQuality } = require("print-common");
const { buildLpArgs } = require("../../../dist/infrastructure/printing/cups-printing-system.js");

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

test("buildLpArgs adds quality and safe media options for non-default paper", () => {
  const input = {
    localPrinterName: "L130",
    filePath: "/tmp/test.pdf",
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
    media: new Set(["Letter", "A4", "4x6in"]),
    colorModel: new Set(["RGB"]),
    printQuality: new Set(["Draft", "Standard", "High"]),
    mediaType: new Set(["PLAIN", "EMATTE", "EPREMGLOSS", "ENVELOPE"]),
  };

  const args = buildLpArgs(input, supported, logger);

  assert.ok(args.includes("PrintQuality=High"));
  assert.ok(args.includes("PageSize=4x6in"));
  assert.ok(args.includes("MediaType=EPREMGLOSS"));
});
