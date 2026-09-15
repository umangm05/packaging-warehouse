import { buildPathFromSvg } from '@/lib/export/pdf';

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e: any) { console.log(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
const count = (h: string, n: string) => (h.match(new RegExp(n, 'g')) || []).length;

console.log('STARK-VD-PDF-QUADRATIC regression tests\n');

test('Q (absolute quadratic) emits curveto', () => {
  const s = buildPathFromSvg('M 10 20 Q 30 40 50 60', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' m ') !== 1) throw new Error(`expected 1 moveto, got ${count(s, ' m ')}`);
  if (count(s, ' c ') !== 1) throw new Error(`expected 1 curveto, got ${count(s, ' c ')}`);
});

test('q (relative quadratic) emits curveto', () => {
  const s = buildPathFromSvg('M 10 20 q 20 20 40 40', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' c ') !== 1) throw new Error(`expected 1 curveto, got ${count(s, ' c ')}`);
});

test('Multi-Q path: no drops', () => {
  const s = buildPathFromSvg('M 10 10 Q 20 0 30 10 Q 20 20 10 10 Z', 50, { r: 0, g: 0, b: 0 });
  if (count(s, ' c ') !== 2) throw new Error(`expected 2 curveto, got ${count(s, ' c ')}`);
  if (count(s, ' h ') !== 1) throw new Error(`expected 1 closepath, got ${count(s, ' h ')}`);
});

test('T (smooth quadratic) emits curveto', () => {
  const s = buildPathFromSvg('M 10 20 Q 30 40 50 60 T 90 60', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' c ') !== 2) throw new Error(`expected 2 curveto, got ${count(s, ' c ')}`);
});

test('S (smooth cubic) emits curveto', () => {
  const s = buildPathFromSvg('M 10 20 C 30 40 50 60 70 80 S 90 100 110 80', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' c ') !== 2) throw new Error(`expected 2 curveto, got ${count(s, ' c ')}`);
});

test('A (arc) emits curveto', () => {
  const s = buildPathFromSvg('M 10 20 A 30 20 0 0 1 70 20', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' c ') < 1) throw new Error(`expected >=1 curveto, got ${count(s, ' c ')}`);
});

test('NaN guard: degenerate Q does not crash', () => {
  const s = buildPathFromSvg('M 10 20 Q NaN NaN 50 60', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' m ') !== 1) throw new Error(`expected 1 moveto, got ${count(s, ' m ')}`);
});

test('Real-world multi-command path (Roboto H)', () => {
  // 3 subpaths: 2 rectangles (4 L each) + 1 Q-based glyph (2 Q's + Z)
  const d = 'M 50.328 0 L 45.072 0 L 45.072 -50.4 L 50.328 -50.4 L 50.328 0 ' +
            'M 45.576 -23.256 L 12.96 -23.256 L 12.96 -27.936 L 45.576 -27.936 L 45.576 -23.256 ' +
            'M 81.72 0.36 Q 75.816 0.36 71.352 -2.124 Q 66.888 -4.608 64.368 -8.964 Z';
  const s = buildPathFromSvg(d, 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' m ') !== 3) throw new Error(`expected 3 moveto, got ${count(s, ' m ')}`);
  if (count(s, ' l ') !== 8) throw new Error(`expected 8 lineto (4+4), got ${count(s, ' l ')}`);
  if (count(s, ' c ') !== 2) throw new Error(`expected 2 curveto (from 2 Q's), got ${count(s, ' c ')}`);
  if (count(s, ' h ') !== 1) throw new Error(`expected 1 closepath, got ${count(s, ' h ')}`);
});

test('BEFORE: Q dropped → 0 curveto; AFTER: Q converted → curveto present', () => {
  const s = buildPathFromSvg('M 10 20 Q 30 40 50 60', 100, { r: 0, g: 0, b: 0 });
  if (count(s, ' c ') !== 1) throw new Error(`regression: Q not converted, got ${count(s, ' c ')} curveto`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
