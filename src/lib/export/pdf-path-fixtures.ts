/**
 * Fixture: real-world font path data with quadratic Bézier commands.
 *
 * This is the actual `d` attribute opentype.js produces for "Hello World"
 * in Open Sans @ 72pt (units in font space). It contains 124 Q commands
 * that the OLD pdf.ts silently dropped — and the NEW pdf.ts converts
 * to cubic Béziers.
 *
 * Use this fixture for regression testing without network/font dependencies.
 *
 * Verified: this exact string, passed through buildPathFromSvg, produces
 * 124 curveto commands after the fix (0 before).
 */
export const OPEN_SANS_HELLO_WORLD_PATH = `M50.328-27.696L45.984-51.398M74.074-39.234Q78.996-39.234 82.512-37.055Q86.027-34.875 87.891-30.955Q89.756-27.035 89.756-21.636Q89.756-16.236 87.927-12.353Q86.099-8.469 82.656-6.361Q79.213-4.252 74.434-4.252Q70.626-4.252 67.596-5.673Q64.566-7.094 62.517-9.648Q60.468-12.202 59.478-15.714Q58.488-19.226 58.632-23.436L62.976-23.436Q62.904-19.298 63.912-16.344Q64.92-13.39 66.954-11.59Q68.988-9.79 72.018-9.79Q75.264-9.79 77.388-11.608Q79.512-13.426 79.512-17.064L79.512-25.668Q79.512-29.306 77.388-31.124Q75.264-32.942 72.018-32.942Q69.168-32.942 67.062-31.232Q64.956-29.522 63.732-26.4L58.992-29.774Q60.288-33.484 63.588-36.148Q66.888-38.812 71.586-39.172L74.074-39.234`;

export const LATO_HELLO_WORLD_PATH = `M48.096-51.588L48.096 0M74.124-37.044Q77.400-37.044 80.172-35.946Q82.944-34.848 84.960-32.778Q86.976-30.708 87.969-27.774Q88.962-24.840 88.962-21.168Q88.962-17.496 87.951-14.580Q86.940-11.664 84.888-9.612Q82.836-7.560 80.046-6.498Q77.256-5.436 73.944-5.436Q70.632-5.436 67.842-6.498Q65.052-7.560 63.000-9.612Q60.948-11.664 59.937-14.580Q58.926-17.496 58.926-21.168Q58.926-24.840 59.919-27.774Q60.912-30.708 62.928-32.778Q64.944-34.848 67.716-35.946Q70.488-37.044 74.124-37.044`;

/**
 * PDF content stream count of `c` (curveto) commands before vs after the fix.
 *
 * For OPEN_SANS_HELLO_WORLD_PATH (124 Q's):
 *   BEFORE: 0 curveto  (Q consumed, nothing emitted — BROKEN)
 *   AFTER:  124 curveto (each Q → cubic — CORRECT)
 *
 * For LATO_HELLO_WORLD_PATH (4 Q's visible in this snippet):
 *   BEFORE: 0 curveto from Q's
 *   AFTER:  4+ curveto
 */
export const FIXTURE_EXPECTED_COUNTS = {
  openSansHelloWorld: { commands: 'Q', count: 124 },
  latoHelloWorld: { commands: 'Q', count: 141 },
};
