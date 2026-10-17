/**
 * Strips a leading question number that some extracted stems still carry
 * ("18. whales disappear…" → "whales disappear…"). The badge owns the number.
 */
export function stripLeadingNumber(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/^\s*\d{1,2}\s*[.)]\s*/, '');
}
