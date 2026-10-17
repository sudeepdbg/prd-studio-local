/* ================================================================== */
/*  PDF / DOCX TEXT EXTRACTION                                          */
/*  Improved: preserves paragraph breaks instead of joining every      */
/*  text item with a single space.                                     */
/* ================================================================== */

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Extract text from a PDF, preserving paragraph structure.
 *
 * pdf.js gives us text items with `hasEOL`. We use that to insert
 * line breaks within paragraphs, and double line breaks between
 * paragraphs (heuristic: a vertical gap, or a font size change,
 * indicates a new paragraph). The result is much easier for the
 * LLM parser to map onto the template.
 */
export async function pdfToText(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lines = [];
    let cur = "";
    for (const it of tc.items) {
      if (!it.str) continue;
      cur += it.str;
      if (it.hasEOL) {
        lines.push(cur.trim());
        cur = "";
      }
    }
    if (cur.trim()) lines.push(cur.trim());

    // Join consecutive non-empty lines into paragraphs. A blank line
    // (or a line that looks like a heading: short, no trailing period)
    // starts a new paragraph.
    const paragraphs = [];
    let para = "";
    for (const line of lines) {
      if (!line) {
        if (para) paragraphs.push(para);
        para = "";
        continue;
      }
      if (para) {
        // Heuristic: short lines without sentence-ending punctuation
        // are probably headings or list items, so break the paragraph.
        const looksLikeHeading = line.length < 80 && !/[.,;:!?]$/.test(line);
        if (looksLikeHeading) {
          paragraphs.push(para);
          paragraphs.push(line);
          para = "";
        } else {
          para += " " + line;
        }
      } else {
        para = line;
      }
    }
    if (para) paragraphs.push(para);
    pages.push(paragraphs.join("\n\n"));
  }
  return pages.join("\n\n---\n\n");
}

/** Extract text from a .docx file. Preserves paragraph breaks. */
export async function docxToText(file) {
  const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  // mammoth already uses \n\n between paragraphs; just normalise whitespace.
  return (r.value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract text from an HTML file using the DOMParser. */
export async function htmlToText(file) {
  const doc = new DOMParser().parseFromString(await file.text(), "text/html");
  return (doc.body.innerText || doc.body.textContent || "").trim();
}
