import QRCode from "qrcode";
import speakerArtwork from "@/assets/speaker-print-artwork.asset.json";
import attendeeArtwork from "@/assets/attendee-print-artwork.asset.json";
import nameFont from "@/assets/badge-name-unicode.asset.json";

export type PrintablePass = { name: string; role: string | null; token: string };
export const BADGE_PRINT = { width: 54, height: 86, bleed: 3, qr: 20 } as const;

async function dataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Print asset unavailable");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid print asset"));
    reader.onerror = () => reject(new Error("Print asset couldn't be read"));
    reader.readAsDataURL(blob);
  });
}

/** Preserve the supplied artwork; only replace name and QR placeholder. */
export async function buildBadgePdf(passes: PrintablePass[], layout: "single" | "sheet") {
  if (!passes.length) throw new Error("No passes to print");
  const { jsPDF } = await import("jspdf");
  const [speaker, attendee, font] = await Promise.all([
    dataUrl(speakerArtwork.url), dataUrl(attendeeArtwork.url), dataUrl(nameFont.url),
  ]);
  const doc = new jsPDF({ unit: "mm", format: layout === "single" ? [60, 92] : "a4" });
  doc.addFileToVFS("badge-name.ttf", font.split(",")[1] ?? "");
  doc.addFont("badge-name.ttf", "BadgeName", "normal");
  for (const [i, pass] of passes.entries()) {
    const slot = layout === "single" ? 0 : i % 4;
    if (i && slot === 0) doc.addPage(layout === "single" ? [60, 92] : "a4");
    const x = layout === "single" ? 0 : 40 + (slot % 2) * 70;
    const y = layout === "single" ? 0 : 45 + Math.floor(slot / 2) * 105;
    doc.addImage(pass.role === "SPEAKER" ? speaker : attendee, "PNG", x, y, 60, 92);
    // Name field: retain the supplied label and rounded box, erase its dotted line.
    doc.setFillColor(249, 245, 252);
    doc.rect(x + 11, y + 44.3, 38, 3.8, "F");
    doc.setTextColor(53, 18, 79);
    doc.setFont("BadgeName", "normal");
    let size = 8;
    let lines: string[] = [];
    do {
      doc.setFontSize(size);
      lines = doc.splitTextToSize(pass.name, 37);
      if (lines.length <= 2) break;
      size -= 0.25;
    } while (size > 3);
    if (lines.length > 2) throw new Error("Name is too long for this badge; shorten it before printing");
    doc.text(lines, x + 30, y + (lines.length === 1 ? 46.8 : 45.3), { align: "center", lineHeightFactor: 1.05 });
    // The existing QR remains the door authority, not a public networking link.
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 19.5, y + 57, 21, 21, "F");
    const qr = await QRCode.toDataURL(pass.token, { margin: 4, width: 600, errorCorrectionLevel: "M" });
    doc.addImage(qr, "PNG", x + 20, y + 57.5, BADGE_PRINT.qr, BADGE_PRINT.qr);
    // Replace misleading networking caption; do not expose a badge token as a URL.
    doc.setFillColor(255, 255, 255); doc.rect(x + 17, y + 79, 26, 2.5, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(4.5);
    doc.text("SCAN FOR ENTRY", x + 30, y + 80.8, { align: "center" });
    doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.15);
    for (const cx of [x + 3, x + 57]) {
      doc.line(cx, y, cx, y + 2); doc.line(cx, y + 90, cx, y + 92);
    }
    for (const cy of [y + 3, y + 89]) {
      doc.line(x, cy, x + 2, cy); doc.line(x + 58, cy, x + 60, cy);
    }
  }
  return doc;
}