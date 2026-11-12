// Source audit, 12 November 2026: retain these records for historical review,
// but exclude their unresolved original test identities from all new practice.
export const EXCLUDED_READING_TEST_IDS = Object.freeze([
  11, 109, 113, 119, 135, 192, 194, 206, 221, 235, 237, 239,
  244, 247, 254, 256, 257, 258, 259, 262, 263, 264, 267, 273,
  274, 277, 278, 280, 284, 285, 287, 290, 291, 306, 307, 314,
]);
const excluded = new Set(EXCLUDED_READING_TEST_IDS);

export function isReadingTestEnabled(record) {
  return Boolean(record) && !excluded.has(Number(record.testId));
}
