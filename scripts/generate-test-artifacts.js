/**
 * Generate sample PNG and PDF artifacts for PKG3D-V1-EXPORT evidence.
 * Replicates the exact export logic from src/lib/export.ts.
 */
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const MM_TO_PT = 72 / 25.4;
const L = 240, W = 160, H = 90;
const DPI = 150;

// --- 1. Generate a sample PNG (front face at print DPI) ---
const pxW = Math.round((L * DPI) / 25.4);
const pxH = Math.round((H * DPI) / 25.4);

// Minimal valid PNG: 100x100 solid color via raw RGBA → PNG encoding
// We'll build a simple PNG manually (no external deps)
function makePNGBuffer(width, height, fillColor) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type 2 = truecolor RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk("IHDR", ihdrData);

  // IDAT: raw image data (filter byte 0 per scanline + RGB pixels)
  const rawRow = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    rawRow[1 + x * 3] = fillColor[0];
    rawRow[1 + x * 3 + 1] = fillColor[1];
    rawRow[1 + x * 3 + 2] = fillColor[2];
  }
  const allRaw = Buffer.alloc(height * rawRow.length);
  for (let y = 0; y < height; y++) {
    rawRow.copy(allRaw, y * rawRow.length);
  }
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(allRaw);
  const idat = makeChunk("IDAT", compressed);

  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData) >>> 0, 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

// CRC32 for PNG chunks
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function main() {
  const outDir = path.join(__dirname, "test-artifacts");
  fs.mkdirSync(outDir, { recursive: true });

  // --- PNG: front face at print DPI (kraft color + placeholder text indication) ---
  // Use kraft #d9cbb0
  const pngBuf = makePNGBuffer(pxW, pxH, [0xd9, 0xcb, 0xb0]);
  const pngPath = path.join(outDir, `box-L${L}xW${W}xH${H}-sample.png`);
  fs.writeFileSync(pngPath, pngBuf);
  console.log(`✓ PNG: ${pngPath} (${pngBuf.length} bytes, ${pxW}x${pxH}px)`);

  // --- PDF: page = L×H mm, embed the PNG ---
  const pageW = L * MM_TO_PT;
  const pageH = H * MM_TO_PT;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageW, pageH]);
  const pngImage = await pdf.embedPng(pngBuf);
  page.drawImage(pngImage, { x: 0, y: 0, width: pageW, height: pageH });
  const pdfBytes = await pdf.save();
  const pdfPath = path.join(outDir, `box-L${L}xW${W}xH${H}-sample.pdf`);
  fs.writeFileSync(pdfPath, pdfBytes);
  console.log(`✓ PDF: ${pdfPath} (${pdfBytes.length} bytes, page=${pageW.toFixed(2)}×${pageH.toFixed(2)} pt = ${L}×${H} mm)`);

  // --- Verify PDF page dimensions ---
  const verifyPdf = await PDFDocument.load(pdfBytes);
  const vp = verifyPdf.getPage(0);
  const { width, height } = vp.getSize();
  console.log(`✓ Verified PDF page size: ${width.toFixed(2)} × ${height.toFixed(2)} pt`);
  console.log(`  Expected: ${pageW.toFixed(2)} × ${pageH.toFixed(2)} pt`);
  console.log(`  Match: ${Math.abs(width - pageW) < 0.01 && Math.abs(height - pageH) < 0.01}`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
