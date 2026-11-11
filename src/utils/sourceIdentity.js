const evidence = 'https://cdn.craft.cloud/9ae18b84-7059-4607-bb49-f7ab93975801/assets/Research/investigating-relationship-between-pte-academic-and-ielts-academic-saville-et-al-2021.pdf#page=28';
// The methods text and Table 9 identify these ordered sets as Cambridge 13.
// Fingerprint and passage guards prevent a changed/mixed set inheriting a label.
const verifiedReading = {
  'ielts-reading-test-106': { hash: '69025b4d51c80403', book: 13, test: 2, titles: ['Bringing Cinnamon to Europe', 'Oxytocin', 'Making the most of trends'] },
  'ielts-reading-test-107': { hash: 'e5f649fb201f4c13', book: 13, test: 3, titles: ['The Coconut Palm', 'How Baby Talk Gives Infant Brains a Boost', 'Whatever Happened to the Harappan Civilisation?'] },
};
export function sourceIdentity(test, skill) {
  if (!test) return null;
  const source = test.source || {}, known = verifiedReading[source.slug];
  const primary = `${skill === 'listening' ? 'Listening' : 'Reading'} test ${test.testId ?? '—'}`;
  if (skill === 'reading' && known && source.sha256 === known.hash && test.passages?.length
    && test.passages.length <= 3 && new Set(test.passages.map(p => p.passageNumber)).size === test.passages.length
    && test.passages.every((p, i) => known.titles[p.passageNumber - 1] === p.title && (!i || test.passages[i - 1].passageNumber < p.passageNumber))) {
    return { primary: `Cambridge IELTS ${known.book} · Test ${known.test}`, status: 'Verified identity', code: 'verified', href: evidence,
      detail: `${primary}. Book, test and ordered passages independently checked. This verifies identity, not every answer key.` };
  }
  const reported = skill === 'listening' && test.cambridgeIdentity?.[0];
  const href = source.slug ? `https://practicepteonline.com/${encodeURIComponent(source.slug)}/` : null;
  return { primary: reported ? `Cambridge IELTS ${reported.book} · Test ${reported.test}` : primary,
    status: reported ? 'Source-reported identity' : 'Book identity unverified', code: 'imported', href,
    detail: `${primary}. ${reported ? 'Book/test label comes from the import source.' : 'Original source grouping is preserved.'} Book identity has not been independently verified.` };
}
