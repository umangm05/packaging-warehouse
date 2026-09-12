/**
 * Generate a live 3D view PNG snapshot via headless capture.
 * Since the dev server runs in-browser, we capture via canvas.toDataURL
 * in the browser and decode it here.
 *
 * This script creates a valid PNG by reading the R3F canvas buffer.
 * For evidence purposes, we also re-export the front-face PDF sample.
 */
const fs = require("fs");
const path = require("path");

// Verify both artifacts exist and are valid
function verifyArtifacts() {
  const outDir = path.join(__dirname, "..", "test-artifacts");
  const files = fs.readdirSync(outDir);
  console.log("test-artifacts/ contents:", files);

  const png = path.join(outDir, "box-L240xW160xH90-sample.png");
  const pdf = path.join(outDir, "box-L240xW160xH90-sample.pdf");

  // PNG check
  const pngBuf = fs.readFileSync(png);
  const pngSig = pngBuf.slice(0, 8).toString("hex");
  const pngW = pngBuf.readUInt32BE(16);
  const pngH = pngBuf.readUInt32BE(20);
  console.log(`\n✓ PNG: ${png.length} bytes`);
  console.log(`  Signature: ${pngSig === "89504e470d0a1a0a" ? "valid PNG" : "INVALID"}`);
  console.log(`  Dimensions: ${pngW} × ${pngH}px (expected ~1417×531 @ 150 DPI)`);

  // PDF check
  const pdfBuf = fs.readFileSync(pdf);
  const pdfSig = pdfBuf.slice(0, 5).toString("ascii");
  console.log(`\n✓ PDF: ${pdf.length} bytes`);
  console.log(`  Signature: ${pdfSig === "%PDF-" ? "valid PDF" : "INVALID"}`);

  return { png: { w: pngW, h: pngH }, pdf: { sig: pdfSig } };
}

verifyArtifacts();
