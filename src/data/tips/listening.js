// Listening tips — concise, example-driven. One reusable demo model for all skills.
// Demo types rendered by TipCard: beforeAfter | qa | flow | lines | vocab

export const LISTENING_TIPS = {
  id: 'listening',
  name: 'Listening',
  tagline: 'Listen smarter. Catch what actually matters.',
  icon: 'headphones',
  accent: 'var(--c-speaker)',
  categories: [
    {
      id: 'listening-before-audio',
      title: 'Before the Audio',
      blurb: 'Win the section in the reading time.',
      tips: [
        {
          id: 'listen-prep-routine',
          title: 'The 30-Second Routine',
          short: 'You get reading time before each section. Spend it getting ahead of the recording.',
          explanation: 'Never use the prep time to relax — use it to know what is coming. The audio only plays once, so the listeners who finish ahead win.',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Read', text: 'Skim the questions before the audio starts.' },
                { label: 'Underline', text: 'Mark keywords: names, dates, topic words.' },
                { label: 'Predict', text: 'Decide what kind of word fits each gap.' },
              ],
            },
          ],
          takeaway: 'Know the question before the speaker says the answer.',
        },
      ],
    },
    {
      id: 'listening-predict',
      title: 'Predict the Answer',
      blurb: 'Decide what kind of word fits each gap.',
      tips: [
        {
          id: 'listen-predict-type',
          title: 'Predict the Word Type',
          short: 'A gap is never a mystery — grammar tells you what kind of word is coming.',
          explanation: 'Look at the words around the gap and predict: a number? a name? a place? a noun or a verb? Then you only listen for that.',
          demos: [
            {
              type: 'qa',
              question: 'The workshop takes place in the ______.',
              weak: 'Listening for everything.',
              better: 'Predicting a place — a location word.',
              note: 'Now you only catch one word, not the whole recording.',
            },
          ],
          takeaway: 'Gap after "in the"? You are listening for a place.',
        },
      ],
    },
    {
      id: 'listening-question-order',
      title: 'Follow the Question Order',
      blurb: 'The audio answers the questions in order.',
      tips: [
        {
          id: 'listen-keep-place',
          title: 'Keep Your Place, Never Fall Behind',
          short: 'Questions follow the audio. If you miss one, move on immediately.',
          explanation: 'The recording never stops, and it never goes back. If you are still on question 4 while the speaker is on question 6, you will lose both.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Missed one?', text: 'Write your best guess and move to the next question.' },
                { label: 'Lost?', text: 'Listen for a keyword from the next question — you will rejoin there.' },
                { label: 'Never', text: 'Panic-re-read old questions while the audio moves on.' },
              ],
            },
          ],
          takeaway: 'One lost answer is one mark. Falling behind loses five.',
        },
      ],
    },
    {
      id: 'listening-distractors',
      title: 'Distractors',
      blurb: 'Speakers correct themselves on purpose.',
      tips: [
        {
          id: 'listen-self-correction',
          title: 'The Self-Correction Trap',
          short: 'The first answer you hear is often replaced. Keep listening.',
          explanation: 'IELTS audio deliberately mentions a wrong option first, then corrects it. The correction is the answer — not what came before.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'First said',
              before: 'Let’s meet on Tuesday to go over the plan…',
              afterLabel: 'Then corrected',
              after: 'actually, Wednesday works better for me.',
              note: 'The answer is Wednesday. The Tuesday was bait.',
            },
          ],
          takeaway: 'The last thing said wins.',
        },
      ],
    },
    {
      id: 'listening-spelling',
      title: 'Spelling',
      blurb: 'A perfect answer, misspelled, scores zero.',
      tips: [
        {
          id: 'listen-spelling-counts',
          title: 'Spelling Counts',
          short: 'If the spelling is wrong, the answer is wrong — even if you heard it.',
          explanation: 'Names are usually spelled out letter by letter — write them down as you hear them. Words you copy from the question booklet must keep their exact spelling.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Spelled out', text: '“It’s S-M-I-T-H.” → write Smith while you hear it.' },
                { label: 'From the booklet', text: 'Copy section headings exactly — no edits.' },
                { label: 'Watch out', text: 'Double letters: “ll”, “tt”, “ee”.' },
              ],
            },
          ],
          takeaway: 'Hear it, spell it, done.',
        },
      ],
    },
    {
      id: 'listening-numbers-dates',
      title: 'Numbers & Dates',
      blurb: 'Where easy marks are lost.',
      tips: [
        {
          id: 'listen-numbers-formats',
          title: 'Train Your Ear for Numbers',
          short: 'Thirteen vs thirty, double digits, and three ways to say a date.',
          explanation: 'Similar-sounding numbers and casual date phrasing are classic listening traps. Practice until the stress difference is instant.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: '13 vs 30', text: '“THIR-teen” vs “THIR-ty” — the stress moves.' },
                { label: 'Doubles', text: '“double five” → 55. “oh-seven” → 07.' },
                { label: 'Dates', text: '“the third of May” → 3 May (or May 3).' },
              ],
            },
          ],
          takeaway: 'Say numbers out loud while you practice — ear training works.',
        },
      ],
    },
    {
      id: 'listening-word-limits',
      title: 'Word Limits',
      blurb: '“NO MORE THAN TWO WORDS” is a scoring rule.',
      tips: [
        {
          id: 'listen-word-limit',
          title: 'Respect the Limit',
          short: 'A correct answer with too many words scores zero.',
          explanation: 'The instruction is part of the question. If the audio says “a leather wallet” but the limit is ONE WORD ONLY, write “wallet”.',
          demos: [
            {
              type: 'qa',
              question: 'Limit: ONE WORD ONLY. Audio: “Keep it in a leather wallet.”',
              weak: 'leather wallet  ✗ (two words)',
              better: 'wallet  ✓',
              note: 'Correct idea, wrong length — still zero. Count your words.',
            },
          ],
          takeaway: 'Read the limit before the audio starts.',
        },
      ],
    },
    {
      id: 'listening-map-diagram',
      title: 'Map & Diagram Questions',
      blurb: 'Walk the map with the speaker.',
      tips: [
        {
          id: 'listen-map-walkthrough',
          title: 'Orient First, Then Follow the Voice',
          short: 'Find your bearings before the speaker starts moving.',
          explanation: 'Locate the entrance and any labels first. Then follow the speaker’s path words — the answer arrives when you arrive.',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Orient', text: 'Find the entrance, compass or “You are here”.' },
                { label: 'Follow', text: 'Track path words: “as you enter”, “past”, “opposite”.' },
                { label: 'Mark', text: 'Write each label as soon as the speaker reaches it.' },
              ],
            },
          ],
          takeaway: 'The speaker walks the map in order — walk with them.',
        },
      ],
    },
    {
      id: 'listening-multiple-choice',
      title: 'Multiple Choice',
      blurb: 'Every option gets mentioned. Only one survives.',
      tips: [
        {
          id: 'listen-mc-bait',
          title: 'Options Are Bait',
          short: 'Hearing an option’s words does not make it the answer.',
          explanation: 'The audio usually touches on every option — rejecting some and confirming one. Listen for what the speaker agrees with, not what they mention.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Mentioned, then rejected', text: '“Tuesday? No, that’s fully booked.” → wrong.' },
                { label: 'Mentioned + confirmed', text: '“Wednesday works better.” → your answer.' },
                { label: 'Rule', text: 'Meaning decides, not matching words.' },
              ],
            },
          ],
          takeaway: 'Treat every option as innocent until the speaker confirms it.',
        },
      ],
    },
    {
      id: 'listening-common-traps',
      title: 'Common Traps',
      blurb: 'The classics, in one card.',
      tips: [
        {
          id: 'listen-trap-list',
          title: 'The Classics',
          short: 'Most lost marks in Listening come from five small habits.',
          explanation: 'None of these are listening problems — they are transcription problems. Fix them in your review routine.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Plurals', text: 'Hear “bookS”? Write the s. It is marked.' },
                { label: 'Limits', text: '“no more than two words” — count every word.' },
                { label: 'Corrections', text: 'Answer changes = last version counts.' },
                { label: 'Blanks', text: 'Never leave a gap — guess. There is no penalty.' },
              ],
            },
          ],
          takeaway: 'Two minutes of transfer-time checking is free marks.',
        },
      ],
    },
  ],
};
