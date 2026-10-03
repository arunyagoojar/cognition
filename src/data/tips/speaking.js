// Speaking tips — concise, example-driven. Same demo model as every other skill.

export const SPEAKING_TIPS = {
  id: 'speaking',
  name: 'Speaking',
  tagline: 'Speak naturally. Show what you actually know.',
  icon: 'mic',
  accent: 'var(--c-lavender)',
  categories: [
    {
      id: 'speaking-part1',
      title: 'Part 1',
      blurb: 'Short questions, real answers.',
      tips: [
        {
          id: 'speak-p1-length',
          title: 'Two to Three Sentences, Every Time',
          short: 'One-word answers throw away marks; five-sentence lectures waste your time.',
          explanation: 'Part 1 is personal and easy. Give a direct answer, one reason, one small detail — then stop confidently.',
          demos: [
            {
              type: 'qa',
              question: '“Do you work, or are you a student?”',
              weak: '“I’m a student.”',
              better: '“I’m a student — I’m in my final year of engineering. It’s busy, but I enjoy the project work most.”',
              note: 'Direct answer + one detail. Nothing forced.',
            },
          ],
          takeaway: 'A direct answer beats a long one.',
        },
      ],
    },
    {
      id: 'speaking-part2',
      title: 'Part 2',
      blurb: 'The two-minute long turn.',
      tips: [
        {
          id: 'speak-p2-notes',
          title: 'Own the Minute of Prep',
          short: 'Plan notes that fill two minutes of speaking, not one.',
          explanation: 'Split your note paper into quadrants — one per bullet point on the cue card. Write short cues, not sentences, and cover all four bullets in order.',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Quadrants', text: 'Four bullets on the card → four boxes on your paper.' },
                { label: 'Cues', text: 'Two or three words per box: who, where, what, why.' },
                { label: 'Talk', text: 'Speak until the examiner stops you. Running early? Add a feeling.' },
              ],
            },
          ],
          takeaway: 'The bullet points are the structure — follow them in order.',
        },
      ],
    },
    {
      id: 'speaking-part3',
      title: 'Part 3',
      blurb: 'Abstract questions, comparative answers.',
      tips: [
        {
          id: 'speak-p3-abstract',
          title: 'Think in Groups, Not Yourself',
          short: 'Part 3 wants general opinions — compare people, places and eras.',
          explanation: 'Move from “I” to “people in general”. Compare groups (“older people… whereas younger people…”) and show both sides before landing on yours.',
          demos: [
            {
              type: 'qa',
              question: '“How has shopping changed in your country?”',
              weak: '“I like shopping online because it’s easy.”',
              better: '“It’s shifted heavily online — older shoppers still value the high street, whereas younger people buy almost everything from their phones.”',
              note: 'Compare two groups → instantly a Part 3 answer.',
            },
          ],
          takeaway: '“It depends — A does this, whereas B does that.”',
        },
      ],
    },
    {
      id: 'speaking-fluency',
      title: 'Fluency',
      blurb: 'Keep going, naturally.',
      tips: [
        {
          id: 'speak-fluency-pacing',
          title: 'Sound Fluent Without Talking Fast',
          short: 'Fluency is steady rhythm, not speed.',
          explanation: 'Slow down slightly and replace long silences with natural markers — “Well…”, “Actually…”, “To be honest…”. They buy thinking time and sound human.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Panicking',
              before: '“Ummmm… uhh… I think… maybe…”',
              afterLabel: 'Steady',
              after: '“Well, to be honest, it depends on the day…”',
              note: 'Same thinking time. Completely different impression.',
            },
          ],
          takeaway: 'Silence is the enemy; fillers are the toolkit.',
        },
      ],
    },
    {
      id: 'speaking-vocabulary',
      title: 'Vocabulary',
      blurb: 'Topic words used naturally.',
      tips: [
        {
          id: 'speak-vocab-topic',
          title: 'One Good Idiom Beats Five Forced Ones',
          short: 'Use topic-specific words you actually own.',
          explanation: 'Examiners reward vocabulary used correctly under pressure. One natural idiom per answer is plenty — forced idioms sound memorized and lower your score.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Forced',
              before: '“Cooking is my cup of tea in the nutshell of my kitchen.”',
              afterLabel: 'Natural',
              after: '“I’m really into cooking — it’s my way of unwinding after work.”',
              note: 'Simple, idiomatic, yours.',
            },
          ],
          takeaway: 'Own a few idioms. Don’t rent a thesaurus.',
        },
      ],
    },
    {
      id: 'speaking-grammar',
      title: 'Grammar',
      blurb: 'Range, not perfection.',
      tips: [
        {
          id: 'speak-grammar-mix',
          title: 'Mix Your Tenses on Purpose',
          short: 'Deliberately drop in one complex structure per answer.',
          explanation: 'Examiners listen for range: a conditional here, a past-perfect there. One well-built complex sentence per answer is enough to show range.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Conditional', text: '“If I had more time, I would cook every day.”' },
                { label: 'Past → present', text: '“I used to hate it, but now I find it relaxing.”' },
                { label: 'Habit', text: '“I’ll usually prepare something simple on weekdays.”' },
              ],
            },
          ],
          takeaway: 'Small errors are fine. Zero complexity is not.',
        },
      ],
    },
    {
      id: 'speaking-pronunciation',
      title: 'Pronunciation',
      blurb: 'Stress carries the meaning.',
      tips: [
        {
          id: 'speak-pron-stress',
          title: 'Stress the Words That Matter',
          short: 'Clarity and intonation matter more than a “perfect” accent.',
          explanation: 'Accent is not assessed — clarity is. Stress content words, let your voice rise and fall naturally, and pronounce word endings clearly.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Flat',
              before: '“i-really-loved-the-film-it-was-amazing.”',
              afterLabel: 'Alive',
              after: '“I really LOVED the film — it was AMAZING.”',
              note: 'Same words. The second one sounds engaged.',
            },
          ],
          takeaway: 'Your voice should show interest — even when faking it.',
        },
      ],
    },
    {
      id: 'speaking-developing-answers',
      title: 'Developing Answers',
      blurb: 'Answer → Reason → Small development.',
      tips: [
        {
          id: 'speak-develop-ard',
          title: 'The A → R → D Formula',
          short: 'Answer, Reason, Detail. Three beats, no more.',
          explanation: 'This formula fixes every “too short” answer. Answer the question, give one reason, add one small development — then stop.',
          demos: [
            {
              type: 'qa',
              question: '“Do you enjoy cooking?”',
              weak: '“Yes, I do.”',
              better: '“Yes, I actually enjoy cooking because it gives me a break from work, especially when I have enough time to experiment with something new.”',
              note: 'ANSWER → REASON → SMALL DEVELOPMENT.',
            },
          ],
          takeaway: 'A → R → D turns “yes” into a band-score answer.',
        },
      ],
    },
    {
      id: 'speaking-examples',
      title: 'Examples',
      blurb: 'Tiny personal stories sell every point.',
      tips: [
        {
          id: 'speak-examples-quick',
          title: 'Have Three Stories Ready',
          short: '“For instance, just last week…” is a superpower.',
          explanation: 'A specific micro-example makes any answer concrete and fluent. Prepare two or three true, reusable stories — a trip, a person, a project — and adapt them live.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Abstract',
              before: '“Technology has changed how we keep in touch.”',
              afterLabel: 'Concrete',
              after: '“For instance, my cousin moved to Canada — we still talk weekly over video calls.”',
              note: 'One tiny story beats three general statements.',
            },
          ],
          takeaway: 'Specific beats impressive.',
        },
      ],
    },
    {
      id: 'speaking-natural',
      title: 'Natural Speaking',
      blurb: 'Real speakers self-correct and contract.',
      tips: [
        {
          id: 'speak-natural-habits',
          title: 'Talk Like a Person',
          short: 'Contractions, self-correction and small repairs are fluency features.',
          explanation: 'Native speakers say “I’m”, “don’t”, “it’s”. They correct themselves mid-sentence. Doing this makes you sound controlled, not careless.',
          demos: [
            {
              type: 'qa',
              question: '“When did you last travel?”',
              weak: '“I travel to Istanbul in 2023. Correction: I travelled…”',
              better: '“It was— sorry, it was two years ago, in 2023, when I visited Istanbul.”',
              note: 'A smooth, natural repair. Examiners hear competence.',
            },
          ],
          takeaway: 'Don’t restart sentences — repair them.',
        },
      ],
    },
    {
      id: 'speaking-memorized',
      title: 'Avoiding Memorized Answers',
      blurb: 'Examiners spot scripts instantly.',
      tips: [
        {
          id: 'speak-memorized-ideas',
          title: 'Prepare Ideas, Not Sentences',
          short: 'Scripts break the moment the examiner changes one word.',
          explanation: 'Memorized answers sound flat and collapse under follow-up questions. Prepare vocabulary and opinions for common topics instead — then build sentences live.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Memorize', text: 'Full sentences about your hometown. ✗' },
                { label: 'Prepare', text: 'Three things you love about it + why. ✓' },
                { label: 'Why it works', text: 'Ideas flex to any question; scripts crack.' },
              ],
            },
          ],
          takeaway: 'Bring the ingredients, not the finished dish.',
        },
      ],
    },
  ],
};
