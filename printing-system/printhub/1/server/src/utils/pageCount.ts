import AdmZip from 'adm-zip';
import { PDFDocument } from 'pdf-lib';

/**
 * Best-effort detection of how many pages a document contains, so pricing
 * ("Printing (N pages × copies)") reflects the real file instead of a
 * placeholder.
 *
 * - Images are always a single page.
 * - PDFs: parsed with pdf-lib to get an exact page count.
 * - DOCX: OOXML documents store the last-computed page count Word wrote out
 *   in `docProps/app.xml` (`<Pages>`). It's not guaranteed to be perfectly
 *   up to date (Word only refreshes it on save/print), but it's the same
 *   number Word itself shows, and computing an exact repagination would
 *   require a full layout engine.
 * - PPTX: one slide = one page, counted directly from the slide parts in
 *   the package — this one is always exact.
 * - Anything else/unrecognized falls back to 1 rather than guessing.
 *
 * Never throws — a file that can't be parsed still uploads fine, just with
 * a conservative page count instead of blocking the user.
 */
export async function computePageCount(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<number> {
  try {
    const ext = originalName.split('.').pop()?.toLowerCase() ?? '';

    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext)) {
      return 1;
    }

    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return await countPdfPages(buffer);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      return countDocxPages(buffer);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ext === 'pptx'
    ) {
      return countPptxSlides(buffer);
    }

    return 1;
  } catch (err) {
    console.warn(`[pageCount] Falling back to 1 page for "${originalName}":`, err);
    return 1;
  }
}

async function countPdfPages(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, {
    // We only need page count, not to fix up the document — skip work and
    // avoid choking on documents with unusual/broken metadata.
    updateMetadata: false,
    ignoreEncryption: true,
  });
  return Math.max(1, doc.getPageCount());
}

function countDocxPages(buffer: Buffer): number {
  const zip = new AdmZip(buffer);
  const appXmlEntry = zip.getEntry('docProps/app.xml');
  if (!appXmlEntry) return 1;

  const xml = appXmlEntry.getData().toString('utf-8');
  const match = xml.match(/<Pages>(\d+)<\/Pages>/i);
  if (!match || !match[1]) return 1;

  const pages = parseInt(match[1], 10);
  return Number.isFinite(pages) && pages > 0 ? pages : 1;
}

function countPptxSlides(buffer: Buffer): number {
  const zip = new AdmZip(buffer);
  const slideCount = zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName)).length;
  return Math.max(1, slideCount);
}
