// Reading tips — concise, example-driven. Same demo model as every other skill.

export const READING_TIPS = {
  id: 'reading',
  name: 'Reading',
  tagline: 'Read strategically. Find answers faster.',
  icon: 'book',
  accent: 'var(--c-coral)',
  categories: [
    {
      id: 'reading-skimming',
      title: 'Skimming',
      blurb: 'Read for the map, not the details.',
      tips: [
        {
          id: 'read-skim-gist',
          title: 'The 3-Minute Skim',
          short: 'Before answering anything, learn where each paragraph lives.',
          explanation: 'Read the title, then the first and last sentence of each paragraph. You are building a mental map so answers take seconds to find later.',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Title', text: 'What is the passage about, overall?' },
                { label: 'Openers', text: 'First sentence of each paragraph = its topic.' },
                { label: 'Closers', text: 'Last sentence often carries the conclusion.' },
              ],
            },
          ],
          takeaway: 'Skimming is navigation. Scanning is search. Never confuse them.',
        },
      ],
    },
    {
      id: 'reading-scanning',
      title: 'Scanning',
      blurb: 'Hunt for anchors that don’t paraphrase.',
      tips: [
        {
          id: 'read-scan-anchors',
          title: 'Hunt for Anchors',
          short: 'Names, dates and numbers usually survive paraphrasing untouched.',
          explanation: 'Proper nouns, years and figures look the same in the question and the passage — use them to jump straight to the right paragraph, then read around them.',
          demos: [
            {
              type: 'qa',
              question: '“When did the research team publish its findings?”',
              weak: 'Reading every paragraph again.',
              better: 'Scan for the team’s name — then read that sentence only.',
              note: 'Names are anchors. They rarely get reworded.',
            },
          ],
          takeaway: 'Anchor first, read second.',
        },
      ],
    },
    {
      id: 'reading-keywords',
      title: 'Keywords',
      blurb: 'Underline the words that carry meaning.',
      tips: [
        {
          id: 'read-keyword-select',
          title: 'Choose Keywords That Can Be Reworded',
          short: 'Content words are what the passage will paraphrase.',
          explanation: 'Skip “the”, “of”, “some”. Underline nouns, verbs and adjectives with real content — those are the words IELTS will reword.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Question',
              before: 'Why did shipping companies slowly adopt the new system?',
              afterLabel: 'Keywords',
              after: 'shipping companies · slowly adopt · new system',
              note: 'Now hunt for those ideas — in any wording.',
            },
          ],
          takeaway: 'Three strong keywords beat ten weak ones.',
        },
      ],
    },
    {
      id: 'reading-paraphrasing',
      title: 'Paraphrasing',
      blurb: 'The golden rule of IELTS Reading.',
      tips: [
        {
          id: 'read-paraphrase-golden',
          title: 'Same Meaning, Different Words',
          short: 'The passage almost never repeats the question’s wording.',
          explanation: 'This is the single most useful Reading fact: every answer is wrapped in a paraphrase. Match meaning, not spelling.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Question',
              before: ' rapidly increased',
              afterLabel: 'Passage',
              after: 'grew at an unprecedented rate',
              note: 'No shared words. Same meaning. That is the match.',
            },
          ],
          takeaway: 'IELTS often paraphrases the wording.',
        },
      ],
    },
    {
      id: 'reading-tfng',
      title: 'True / False / Not Given',
      blurb: 'Three answers, not two.',
      tips: [
        {
          id: 'read-tfng-test',
          title: 'The Three-Way Test',
          short: 'False means the passage contradicts it. Not Given means the passage stays silent.',
          explanation: '“Not Given” is not a fail — it is a real answer. It means the information simply is not there, no matter how likely it sounds in real life.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'TRUE', text: 'Passage says the same thing (in different words).' },
                { label: 'FALSE', text: 'Passage says the opposite. Q: “Sharks hunt in groups.” Passage: “Sharks typically hunt alone.”' },
                { label: 'NOT GIVEN', text: 'Passage never mentions it. Silence is an answer.' },
              ],
            },
          ],
          takeaway: 'Use your knowledge and you will invent facts the passage never stated.',
        },
      ],
    },
    {
      id: 'reading-ynng',
      title: 'Yes / No / Not Given',
      blurb: 'Same test — about the writer’s claims.',
      tips: [
        {
          id: 'read-ynng-opinion',
          title: 'It’s About the Writer, Not the World',
          short: 'Yes/No/NG asks what the writer claims — not what is true.',
          explanation: 'The question is whether the writer agrees or states something, so the answer lives in the writer’s opinions and claims, not in real-world facts.',
          demos: [
            {
              type: 'qa',
              question: '“Did the writer find the experiment convincing?”',
              weak: 'Deciding if the experiment was actually convincing.',
              better: 'Finding the writer’s own verdict — “the results, while promising, left questions open.”',
              note: 'The writer’s hedge = a “No” to full conviction.',
            },
          ],
          takeaway: 'Ask “what does the writer say?”, not “what is true?”',
        },
      ],
    },
    {
      id: 'reading-matching-headings',
      title: 'Matching Headings',
      blurb: 'Main idea, not best example.',
      tips: [
        {
          id: 'read-headings-idea',
          title: 'Headings Summarise, Examples Distract',
          short: 'A heading covers the whole paragraph — not one juicy sentence.',
          explanation: 'Read the paragraph’s first and last sentences for its main claim. If a heading matches only one example inside the paragraph, it is a trap.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Fits', text: 'Heading matches the paragraph’s overall claim.' },
                { label: 'Trap', text: 'Heading matches one vivid example in one sentence.' },
                { label: 'Habit', text: 'Do headings after skimming — never paragraph by paragraph.' },
              ],
            },
          ],
          takeaway: 'The right heading describes the whole, not a part.',
        },
      ],
    },
    {
      id: 'reading-matching-info',
      title: 'Matching Information',
      blurb: 'Find which paragraph contains the detail.',
      tips: [
        {
          id: 'read-match-info',
          title: 'Scan for the Detail’s Keywords',
          short: 'Each statement is a specific fact hidden in one paragraph.',
          explanation: 'Convert each statement into 2–3 search keywords, scan the paragraphs for them, then verify the meaning matches — the wording will differ.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Statement',
              before: 'a mention of an unexpected cost',
              afterLabel: 'Search for',
              after: 'cost words: “expense”, “fee”, “budget”, “£”',
              note: 'Then confirm it was unexpected — “surprisingly”, “nobody anticipated”.',
            },
          ],
          takeaway: 'Keyword in, meaning-check out.',
        },
      ],
    },
    {
      id: 'reading-multiple-choice',
      title: 'Multiple Choice',
      blurb: 'Options paraphrase the text.',
      tips: [
        {
          id: 'read-mc-paraphrase',
          title: 'Right Answers Never Copy the Text',
          short: 'Correct options reword the passage; distractors echo its words.',
          explanation: 'IELTS makes wrong options by lifting phrases straight from the passage and bending them slightly. The right option usually sounds less familiar because it paraphrases.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Suspicious', text: 'An option full of words you just saw in the passage.' },
                { label: 'Check', text: 'Does it match the meaning — or just the vocabulary?' },
                { label: 'Eliminate', text: 'Cross out anything the passage contradicts or omits.' },
              ],
            },
          ],
          takeaway: 'Word-matching feels safe. It is the trap.',
        },
      ],
    },
    {
      id: 'reading-sentence-completion',
      title: 'Sentence Completion',
      blurb: 'Let the grammar pick the answer.',
      tips: [
        {
          id: 'read-complete-grammar',
          title: 'Grammar First, Meaning Second',
          short: 'The sentence itself tells you what form the answer must be.',
          explanation: 'If the gap follows “a”, the answer is a singular noun starting with a consonant sound. Respect the word limit, then choose an answer that fits grammatically.',
          demos: [
            {
              type: 'qa',
              question: 'The scheme was praised for its effect on local ______.',
              weak: 'Any word about the community.',
              better: 'A singular noun: “businesses” fails its; “economy” works.',
              note: '“its” + noun → the gap must be a noun.',
            },
          ],
          takeaway: 'Grammar narrows the options before the passage does.',
        },
      ],
    },
    {
      id: 'reading-time-management',
      title: 'Time Management',
      blurb: '20 minutes per passage. No exceptions.',
      tips: [
        {
          id: 'read-time-budget',
          title: 'The 20/20/20 Budget',
          short: 'Every passage is worth the same marks — treat them equally.',
          explanation: 'Hard questions cost the same as easy ones. Cap each question at about 90 seconds, flag it, move on, and return at the end if time allows.',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Skim', text: '3 minutes to map the passage.' },
                { label: 'Hunt', text: '15 minutes for the questions, 90s cap each.' },
                { label: 'Sweep', text: '2 minutes: fill blanks, check spelling, transfer.' },
              ],
            },
          ],
          takeaway: 'A blank and a wrong answer cost the same — never leave blanks.',
        },
      ],
    },
  ],
};
