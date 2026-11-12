# Reading practice availability

As of the 12 November 2026 source audit, 36 Reading sets with unresolved original book/test cluster identities are excluded from practice. The active pool contains 73 sets: 33 identifiable Cambridge sources (including Trainer), 17 other named commercial practice-book sets, and 23 recall-collection or named website mock sets. Retention does not certify official provenance or answer-key accuracy.

`src/data/production/readingAvailability.js` holds the reversible exclusion policy. It filters the startup catalog and the shared full-test selection pool, covering standalone practice, focused drills, and assembled mocks. Explicit new-practice lookups also reject excluded IDs and their aliases. Saved unfinished sessions containing excluded content cannot resume.

All 109 records remain in the runtime banks and content archive. Completed results can still resolve the original passages, questions, answer keys, and manual correction controls through the review-specific lookup. No question data or completed history is deleted. Regenerating the content banks does not overwrite this separate policy.

`test/reading_availability.test.js` checks the 73-set selection pool, all 109 original records, explicit aliases, random standalone/focused selection, both mock assemblers, and archived answer review.
