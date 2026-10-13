export enum ColorMode {
  COLOR = "COLOR",
  GRAYSCALE = "GRAYSCALE",
  MONOCHROME = "MONOCHROME",
}

export enum DuplexMode {
  SIMPLEX = "SIMPLEX",
  DUPLEX_LONG_EDGE = "DUPLEX_LONG_EDGE",
  DUPLEX_SHORT_EDGE = "DUPLEX_SHORT_EDGE",
}

export enum PaperSize {
  A4 = "A4",
  PHOTO_4X6 = "4x6in",
  A3 = "A3",
  LETTER = "LETTER",
  LEGAL = "LEGAL",
  TABLOID = "TABLOID",
}

/**
 * Media/paper type, distinct from `PaperSize`. Names mirror the
 * "Media Type" dropdown found in Windows inkjet printer drivers
 * (e.g. Epson) so users see familiar terminology. The CUPS layer
 * (see print-agent's cups-printing-system.ts) maps these to the
 * driver-specific PPD MediaType keyword at print time.
 */
export enum PaperType {
  NORMAL = "NORMAL",
  PHOTO_PAPER_GLOSSY = "PHOTO_PAPER_GLOSSY",
  PHOTO_PAPER_MATTE = "PHOTO_PAPER_MATTE",
  EPSON_PREMIUM_GLOSSY = "EPSON_PREMIUM_GLOSSY",
  EPSON_PREMIUM_SEMIGLOSS = "EPSON_PREMIUM_SEMIGLOSS",
  EPSON_PREMIUM_LUSTER = "EPSON_PREMIUM_LUSTER",
  EPSON_ULTRA_PREMIUM_GLOSSY = "EPSON_ULTRA_PREMIUM_GLOSSY",
  EPSON_PREMIUM_PRESENTATION_MATTE = "EPSON_PREMIUM_PRESENTATION_MATTE",
  EPSON_ARCHIVAL_MATTE = "EPSON_ARCHIVAL_MATTE",
  CARDSTOCK = "CARDSTOCK",
  ENVELOPE = "ENVELOPE",
}

export enum PrintQuality {
  DRAFT = "DRAFT",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
}

export enum ConnectionProtocol {
  IPP = "IPP",
  LPD = "LPD",
  RAW_SOCKET = "RAW_SOCKET",
  USB = "USB",
}
