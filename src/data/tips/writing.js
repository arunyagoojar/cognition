// Writing tips — primary source: the student's handwritten notes.
// Terminology, organization and intent follow the notes ("Writing System",
// Types 1–5, Task 1 chart notes, map cheat words, fractions, time periods).
// Ambiguous handwriting was intentionally left out — nothing invented.

export const WRITING_TIPS = {
  id: 'writing',
  name: 'Writing',
  tagline: 'Build clearer answers with better structure.',
  icon: 'pen',
  accent: 'var(--c-yellow)',
  categories: [
    // ── TASK 2 ──────────────────────────────────────────────────────────
    {
      id: 'writing-t2-understand',
      title: 'Understand the Question',
      blurb: 'General topic → specific topic → your job.',
      tips: [
        {
          id: 'w-t2-understand-q',
          title: 'What Are They Asking?',
          short: 'Every Task 2 question has a general topic and a specific topic. Find both before writing.',
          explanation: 'The notes’ first rule of the Writing System: separate what the question is generally about from the exact thing it asks you to decide.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Question', text: '“Teenagers should have regular exams at secondary school. Agree or disagree?”' },
                { label: 'General topic', text: 'education / exams.' },
                { label: 'Specific topic', text: 'regular exams for teenagers.' },
                { label: 'Your job', text: 'Agree or disagree — and say why.' },
              ],
            },
          ],
          takeaway: 'Answer the specific topic, not the general one.',
        },
      ],
    },
    {
      id: 'writing-t2-plan',
      title: 'Plan Your Answer',
      blurb: 'Gut feeling → simplest ideas → best 2.',
      tips: [
        {
          id: 'w-t2-plan-ideas',
          title: 'Decide Your Position, Then Generate Ideas',
          short: 'Go with your gut feeling — you can defend any position. Then pick the easiest ideas to write.',
          explanation: 'The notes’ planning method: take a position instantly, then run idea generation — your first idea, the simplest idea, and the “Family Feud” test: what would the top answers be?',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Position', text: 'Agree or disagree? Go with your gut feeling.' },
                { label: 'Ideas', text: 'First idea? Simplest idea? What would the top answers be?' },
                { label: 'Choose', text: 'Pick the best 2 — the easiest to write.' },
              ],
            },
          ],
          takeaway: 'Choose the best 2 ideas — easiest to write, not most clever.',
        },
      ],
    },
    {
      id: 'writing-t2-structures',
      title: 'Essay Structures',
      blurb: 'Five question types, one skeleton.',
      tips: [
        {
          id: 'w-t2-structure-types',
          title: 'The Five Types',
          short: 'Agree/Disagree is the most common. All types share the same 4-part skeleton.',
          explanation: 'Intro → two body paragraphs → conclusion, about 250 words. What changes per type is what each part must contain.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: '1 · Opinion', text: 'Agree/disagree — most common type.' },
                { label: '2 · Discussion', text: 'Both views + your opinion.' },
                { label: '3 · Problem & Solution', text: 'Causes in body 1, solutions in body 2.' },
                { label: '4 · Adv/Disadv', text: 'Weigh both sides, then judge.' },
                { label: '5 · Direct questions', text: 'One body paragraph per question.' },
              ],
            },
          ],
          takeaway: 'Same skeleton — the type tells each part what to carry.',
        },
      ],
    },
    {
      id: 'writing-t2-intro',
      title: 'Introduction',
      blurb: 'Paraphrase it like you would say it.',
      tips: [
        {
          id: 'w-t2-intro-write',
          title: 'Paraphrase + Position + Your Two Ideas',
          short: 'Reword the question in your own voice, state your opinion, and preview your two ideas.',
          explanation: 'The notes: paraphrase the question like you would say it, add synonyms, and replace vague words with concrete ones. Then respond with your opinion and introduce the two ideas your bodies will develop.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Weak',
              before: 'Exams are important in schools.',
              afterLabel: 'Better',
              after: 'Exams are an important feature of secondary education, and I believe frequent exams prepare students for life after school.',
              note: 'Paraphrase the topic → move toward your position.',
            },
          ],
          takeaway: 'Intro = reworded question + clear position + your two ideas.',
        },
      ],
    },
    {
      id: 'writing-t2-body',
      title: 'Body Paragraphs',
      blurb: 'Topic sentence → development → link.',
      tips: [
        {
          id: 'w-t2-body-system',
          title: 'Topic Sentence, Development, Link',
          short: 'The topic sentence simply states your idea. Then develop it — reason, result, example. Link it back to the topic.',
          explanation: 'The notes’ body formula: a topic sentence is a short sentence showing the examiner what they will read about; development is result, reason, example; the link ties the idea back to the question. End with “Therefore…”.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Topic sentence', text: 'Regular exams also push teenagers to develop skills for the world of work.' },
                { label: 'Development', text: 'Taking an exam means planning revision and performing under pressure — building time management and resilience.' },
                { label: 'Link', text: 'Therefore, frequent exams prepare students for demands they will face in any career.' },
              ],
            },
          ],
          takeaway: 'One idea per paragraph. End with “Therefore…”.',
        },
      ],
    },
    {
      id: 'writing-t2-conclusion',
      title: 'Conclusion',
      blurb: 'Basically paraphrases the intro.',
      tips: [
        {
          id: 'w-t2-conclusion-write',
          title: 'Restate + Summarise',
          short: 'Restate your opinion and summarise your ideas. No new information.',
          explanation: 'The notes: the conclusion basically paraphrases the intro — restate your position, summarise your two ideas in one or two sentences.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Weak',
              before: 'That is all I have to say about exams.',
              afterLabel: 'Better',
              after: 'In conclusion, I would argue that regular exams give teenagers useful practice for future study and skills they will need at work.',
              note: '“In conclusion… I would argue…” + your position, restated.',
            },
          ],
          takeaway: 'No new ideas here — just your position, restated.',
        },
      ],
    },
    {
      id: 'writing-t2-question-types',
      title: 'Question Types',
      blurb: 'Each type has its own job list.',
      tips: [
        {
          id: 'w-t2-type-jobs',
          title: 'What Each Type Must Do',
          short: 'Spot the type in 10 seconds — it dictates every paragraph.',
          explanation: 'From the notes’ five types: the special rules matter more than the general skeleton. Discussion wants both views plus opinion; Direct questions want one body per question; Adv/Disadv wants your opinion stated clearly in the conclusion.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Opinion', text: 'Position in the intro, defended in both bodies.' },
                { label: 'Discussion', text: 'Intro: topic + your opinion. Body 1: view 1 + opinion. Body 2: view 2 + opinion.' },
                { label: 'Problem & Solution', text: 'Body 1: causes. Body 2: solutions.' },
                { label: 'Adv/Disadv', text: 'Intro · advantages · disadvantages · conclusion. Clearly state your opinion in the conclusion.' },
                { label: 'Direct questions', text: 'Question 1 — answer it. Question 2 — answer it. One per body.' },
              ],
            },
          ],
          takeaway: 'Adv/Disadv: your opinion must reach the conclusion.',
        },
      ],
    },
    {
      id: 'writing-t2-final-scan',
      title: 'Final Scan',
      blurb: 'Three quick passes before time is up.',
      tips: [
        {
          id: 'w-t2-scan-passes',
          title: 'The 3-Point Scan',
          short: 'Replace simple words, replace repeated words, catch grammar errors.',
          explanation: 'The notes’ last Writing System step: scan your essay — upgrade simple words with better synonyms, kill repeated words, and fix grammar slips.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Before',
              before: 'People use social media because social media is convenient.',
              afterLabel: 'After',
              after: 'People use social media because these platforms are convenient.',
              note: 'Small change. More natural.',
            },
          ],
          takeaway: 'Two minutes of scanning is free marks.',
        },
      ],
    },
    // ── TASK 1 ──────────────────────────────────────────────────────────
    {
      id: 'writing-t1-intro',
      title: 'Task 1 Introduction',
      blurb: 'It does exactly 3 things.',
      tips: [
        {
          id: 'w-t1-intro-3things',
          title: 'Reword It — Three Ways',
          short: 'Use different words, a different structure, and a different description of the time period.',
          explanation: 'The notes’ introduction rule: synonyms, different grammar (if possible), and change how the time period is described. Use the cheat sheet: The line graph / bar chart / pie chart / table / map + shows / presents / illustrates + the number of / the proportion of / information on…',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Prompt',
              before: 'The chart below shows the number of graduate students applying for jobs in different sectors… in 2015 and 2025, and the predicted figure for 2035.',
              afterLabel: 'Your intro',
              after: 'The bar chart illustrates how many university graduates applied for jobs across four sectors in 2015 and 2025, with a prediction for 2035.',
              note: 'Synonym + reworded time phrase. Three changes, done.',
            },
          ],
          takeaway: 'Never copy the prompt sentence — reword it three ways.',
        },
      ],
    },
    {
      id: 'writing-t1-overview',
      title: 'Task 1 Overview',
      blurb: 'One sentence starting with “Overall,”.',
      tips: [
        {
          id: 'w-t1-overview-trends',
          title: 'The Overall Trend, Not the Details',
          short: 'The overview states the main trends — upward, downward, expected — with no specific numbers.',
          explanation: 'Examiners look for this sentence: start with “Overall,” and name the biggest pattern. Predicted future figures belong here too (“is expected to…”).',
          demos: [
            {
              type: 'qa',
              question: 'What goes in the overview?',
              weak: '“In 2013 the total was exactly 2 million visitors.”',
              better: '“Overall, visitor numbers increased markedly across the period.”',
              note: 'A trend, not a data point.',
            },
          ],
          takeaway: 'One sentence. No numbers. Biggest trend only.',
        },
      ],
    },
    {
      id: 'writing-t1-body',
      title: 'Task 1 Body Paragraphs',
      blurb: 'Lump similar information together.',
      tips: [
        {
          id: 'w-t1-body-organise',
          title: 'Organise the Data, Don’t List It',
          short: 'Group categories that behave alike; pick out the biggest changes; compare like with like.',
          explanation: 'The notes’ body-paragraph question is “how to organise the data?” — the answer: put related or similar trends together, drop minor numbers, and compare across groups.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Group', text: 'Two sectors that both rose → one paragraph.' },
                { label: 'Select', text: 'Skip tiny numbers — they add words, not marks.' },
                { label: 'Compare', text: '“Unlike the other sectors, IT declined over the period.”' },
              ],
            },
          ],
          takeaway: 'Two well-grouped body paragraphs beat five data lists.',
        },
      ],
    },
    {
      id: 'writing-t1-line-graphs',
      title: 'Line Graphs',
      blurb: 'Describe change with precise adjectives.',
      tips: [
        {
          id: 'w-t1-line-adjectives',
          title: 'Adjectives of Change: Small → Large',
          short: 'Pick the adjective that matches the size of the change — minimal to sizeable.',
          explanation: 'From the notes’ scale: small changes are minimal, marginal, slight, small; medium are moderate, noticeable, significant, large; large are considerable, substantial, great, steep, sizeable.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Small', text: 'minimal · marginal · slight · small' },
                { label: 'Medium', text: 'moderate · noticeable · significant · large' },
                { label: 'Large', text: 'considerable · substantial · great · steep · sizeable' },
              ],
            },
          ],
          takeaway: 'Anchor the story in time: “At the beginning of the period… Between 2010 and 2013… After 2013… As a result of this increase… In contrast… Together…”.',
        },
      ],
    },
    {
      id: 'writing-t1-bar-charts',
      title: 'Bar Charts',
      blurb: 'Future bars get future language.',
      tips: [
        {
          id: 'w-t1-bar-predicted',
          title: 'Predicted, Projected, Estimated',
          short: 'Bars for future years need prediction vocabulary — and ranking language for comparisons.',
          explanation: 'The notes mark these charts with predicted / projected / estimated. Use just above / just below for close values and overtake when one bar passes another.',
          demos: [
            {
              type: 'qa',
              question: 'A 2035 bar sits far above every 2015 bar.',
              weak: '“The 2035 bar is very big.”',
              better: '“By 2035, applications in IT are projected to rise, overtaking all other sectors.”',
              note: 'predicted / projected / estimated + overtake.',
            },
          ],
          takeaway: 'Future bar = predicted. Close bars = just above / just below.',
        },
      ],
    },
    {
      id: 'writing-t1-pie-charts',
      title: 'Pie Charts',
      blurb: 'Shares and proportions.',
      tips: [
        {
          id: 'w-t1-pie-shares',
          title: 'Constituted, Share, Accounting For',
          short: 'Pie charts are about proportions — the notes’ core verbs: constituted, share, amounting to, accounting for.',
          explanation: 'Describe slices as shares of a whole. Vary the phrasing: “constituted the largest share”, “accounting for 40%”, “amounting to a third of the total”.',
          demos: [
            {
              type: 'qa',
              question: 'One slice is 40%, the biggest on the chart.',
              weak: '“Education was 40%.”',
              better: '“Education constituted the largest share, accounting for 40% of the total.”',
              note: 'constituted · share · accounting for.',
            },
          ],
          takeaway: 'Every slice is a share — say so.',
        },
      ],
    },
    {
      id: 'writing-t1-tables',
      title: 'Tables',
      blurb: 'Dense data — select and compare.',
      tips: [
        {
          id: 'w-t1-table-select',
          title: 'Pick Out Rows, Compare Across Columns',
          short: 'Tables hide trends in grids. Choose the notable cells and summarise the rest.',
          explanation: 'From the notes (a table of satisfaction): describe the stand-out categories with report verbs — was well regarded, attracted the most, represented the smallest.',
          demos: [
            {
              type: 'qa',
              question: 'A satisfaction table with six services and two years.',
              weak: 'Listing all twelve numbers.',
              better: '“Staff helpfulness was consistently well regarded, while ticketing attracted the lowest ratings in both years.”',
              note: 'well regarded · attracted · represented — the notes’ verbs.',
            },
          ],
          takeaway: 'Summarise the grid; never transcribe it.',
        },
      ],
    },
    {
      id: 'writing-t1-process-diagrams',
      title: 'Process Diagrams',
      blurb: 'Count the stages first.',
      tips: [
        {
          id: 'w-t1-process-analysis',
          title: 'Analyse: Stages, First, Last',
          short: 'Before writing: how many stages? What happens first and last? Name two important features.',
          explanation: 'The notes’ process routine: count the stages, find the first and last, note two key features. Call it a linear, multi-stage sequence in your intro.',
          demos: [
            {
              type: 'qa',
              question: 'A diagram: flour → mixer → dough sheets → noodles → drying → cups → labels.',
              weak: 'Starting to describe the mixer.',
              better: '“The diagram illustrates the linear, multi-stage process used to produce instant noodles, from flour storage to final packaging.”',
              note: 'Count stages → first + last → then describe.',
            },
          ],
          takeaway: 'First and last stages anchor your overview.',
        },
      ],
    },
    {
      id: 'writing-t1-maps',
      title: 'Maps',
      blurb: 'What changed vs. what didn’t.',
      tips: [
        {
          id: 'w-t1-map-checklist',
          title: 'The Map Checklist',
          short: 'Analyse → introduce the layout → summarise changes (and what hasn’t changed) → describe map by map.',
          explanation: 'The notes’ checklist: 1) Analyse — what has changed vs what hasn’t. 2) Introduction — the layout. 3) Overview — summarise the changes, lumping similar ones. 4) Body — describe Map 1, then the changes made in Map 2.',
          demos: [
            {
              type: 'flow',
              steps: [
                { label: 'Analyse', text: 'Changed vs. hasn’t changed.' },
                { label: 'Intro', text: 'Describe the layout — “A foyer: a large open space in a public area.”' },
                { label: 'Overview', text: 'Summarise changes; mention what survived.' },
                { label: 'Body', text: 'Map 1: describe. Map 2: changes that have been made.' },
              ],
            },
          ],
          takeaway: 'Lump similar changes into one sentence.',
        },
      ],
    },
    // ── VOCABULARY (unified card system) ────────────────────────────────
    {
      id: 'writing-vocab-bank',
      title: 'Vocabulary Bank',
      blurb: 'Tap a card. Steal the phrase. Keep it natural.',
      kind: 'vocab',
      tips: [
        {
          id: 'w-vocab-upward',
          kind: 'vocab',
          title: 'Upward Trend',
          chips: ['rise', 'climb', 'grow', 'surge', 'increase'],
          quickExample: 'Visitors surged in 2017.',
          quickNote: 'Strong / rapid increase',
          items: [
            { word: 'rise', meaning: 'a general increase', example: 'Costs rose steadily over the decade.', strength: 'Safe default — fits almost any graph.' },
            { word: 'climb', meaning: 'a steady increase', example: 'Sales climbed from 200 to 800.', strength: 'Natural for gradual upward movement.' },
            { word: 'surge', meaning: 'a strong, rapid increase', example: 'The number of visitors surged from 1 million to 2.5 million.', strength: 'Use for a strong/rapid increase — not every rise.' },
            { word: 'grow', meaning: 'to increase over time', example: 'The total grew throughout the period.', strength: 'Works for sizes, numbers and amounts.' },
          ],
        },
        {
          id: 'w-vocab-downward',
          kind: 'vocab',
          title: 'Downward Trend',
          chips: ['fall', 'decline', 'drop', 'decrease'],
          quickExample: 'Attendance dropped to 500.',
          quickNote: 'Sudden fall to a low point',
          items: [
            { word: 'fall', meaning: 'to go down', example: 'Prices fell sharply in the final year.', strength: 'Neutral and safe.' },
            { word: 'decline', meaning: 'a gradual decrease', example: 'Sales declined over the period.', strength: 'Good for slow, long-term downward trends.' },
            { word: 'drop', meaning: 'a sudden fall', example: 'Attendance dropped to 500 in the final month.', strength: 'Implies speed — pair with a figure.' },
            { word: 'decrease', meaning: 'to become smaller', example: 'The figure decreased by 20%.', strength: 'Neutral — vary it with fall/decline.' },
          ],
        },
        {
          id: 'w-vocab-stable',
          kind: 'vocab',
          title: 'Stable Trends',
          chips: ['remain stable', 'remain constant', 'level off'],
          quickExample: 'The figure remained stable at around 1.5 million.',
          quickNote: 'No real change over time',
          items: [
            { word: 'remain stable', meaning: 'to stay at the same level', example: 'Island visitors remained stable at about 1.5 million.', strength: 'The notes’ phrase for flat lines.' },
            { word: 'remain constant', meaning: 'unchanging', example: 'Demand remained constant throughout the decade.', strength: 'Formal, precise, safe.' },
            { word: 'level off', meaning: 'to stop rising or falling', example: 'Growth levelled off after 2015.', strength: 'Perfect after a rise or fall.' },
          ],
        },
        {
          id: 'w-vocab-fluctuations',
          kind: 'vocab',
          title: 'Fluctuations',
          chips: ['fluctuate', 'hit a low of', 'temporary fall'],
          quickExample: 'Numbers fluctuated between 2 and 3 million.',
          quickNote: 'Up-and-down movement',
          items: [
            { word: 'fluctuate', meaning: 'to rise and fall repeatedly', example: 'Visitor numbers fluctuated between 2 and 3 million.', strength: 'Use for zig-zag lines.' },
            { word: 'hit a low of', meaning: 'to reach its lowest point', example: 'Visitors hit a low of 0.5 million in 2011.', strength: 'Names the minimum exactly.' },
            { word: 'a temporary fall', meaning: 'a short-lived drop', example: '…apart from a temporary fall to about 1.25 million in 2016.', strength: 'From the notes’ line-graph paragraph.' },
          ],
        },
        {
          id: 'w-vocab-size',
          kind: 'vocab',
          title: 'Size of Change',
          chips: ['slight', 'noticeable', 'significant', 'substantial'],
          quickExample: 'A slight increase · a steep rise.',
          quickNote: 'Match the adjective to the graph',
          items: [
            { word: 'slight / marginal / minimal', meaning: 'a very small change', example: 'Figures showed a marginal increase.', strength: 'Small end of the notes’ scale.' },
            { word: 'moderate / noticeable', meaning: 'a clear but contained change', example: 'There was a noticeable improvement in rail use.', strength: 'Middle of the scale.' },
            { word: 'significant / large', meaning: 'an obvious, important change', example: 'A significant rise occurred after 2013.', strength: 'Confident but not extreme.' },
            { word: 'considerable / substantial / great / steep / sizeable', meaning: 'a very large change', example: 'Cruise numbers rose substantially.', strength: 'The large end of the notes’ scale.' },
          ],
        },
        {
          id: 'w-vocab-fractions',
          kind: 'vocab',
          title: 'Fractions & Multiples',
          chips: ['doubled', 'tripled', 'halved', 'a quarter'],
          quickExample: 'The figure doubled to 2 million.',
          quickNote: 'Always add -ed: doubled, tripled, halved',
          items: [
            { word: 'doubled / two-fold increase', meaning: '×2', example: 'The figure doubled to 2 million.', strength: 'The notes’ reminder: always add -ed to the verb.' },
            { word: 'tripled / three-fold increase', meaning: '×3', example: 'Exports tripled over the decade.', strength: 'Same rule: tripled, not triple.' },
            { word: 'halved', meaning: '÷2', example: 'Sales halved after 2010.', strength: 'Irregular — no “halfed”.' },
            { word: 'quadrupled / four-fold increase', meaning: '×4', example: 'The workforce quadrupled by 2035.', strength: 'For the biggest jumps.' },
            { word: 'a quarter / one tenth', meaning: '¼ / 1⁄10 of the total', example: 'Roughly a quarter stayed on the island.', strength: 'Softens numbers: around / roughly / approximately.' },
          ],
        },
        {
          id: 'w-vocab-time',
          kind: 'vocab',
          title: 'Time Periods',
          chips: ['over the period', 'throughout', 'a decade later'],
          quickExample: 'In the latter half of the 1980s…',
          quickNote: 'Vary the anchors, don’t repeat “from X to Y”',
          items: [
            { word: 'over the period', meaning: 'across the whole timeline', example: 'Over the period, totals nearly tripled.', strength: 'For the overview sentence.' },
            { word: 'throughout / during the period', meaning: 'for the entire span', example: 'Throughout the period, rail remained popular.', strength: 'Emphasises continuity.' },
            { word: 'in the first half of the 1980s', meaning: 'the early years of a decade', example: 'In the first half of the 1980s, figures held steady.', strength: 'Pairs with “in the latter half of…”.' },
            { word: 'a decade later', meaning: 'ten years after', example: 'A decade later, the pattern had reversed.', strength: 'Elegant gap-filler between points.' },
            { word: 'between X and Y', meaning: 'a bounded span', example: 'Between 2010 and 2013, the overall figure climbed steadily.', strength: 'Straight from the notes’ line-graph paragraph.' },
          ],
        },
        {
          id: 'w-vocab-comparisons',
          kind: 'vocab',
          title: 'Comparisons',
          chips: ['the lowest', 'surpassing', 'just above'],
          quickExample: 'Cruise visitors surpassed island stayers by 2016.',
          quickNote: 'Rank, gap and contrast in one phrase',
          items: [
            { word: 'the lowest among the categories', meaning: 'smallest of all', example: 'IT remained the lowest among the categories.', strength: 'From the notes’ word list.' },
            { word: 'surpassing / outnumbering', meaning: 'going past another figure', example: 'Cruise visitors surpassed island stayers by 2016.', strength: 'The notes’ pair for crossovers.' },
            { word: 'just above / just below', meaning: 'slightly more / less than', example: 'Finance sat just below 500 applicants.', strength: 'For close bars and rows.' },
            { word: 'in contrast / on the other hand', meaning: 'signalling an opposite trend', example: 'In contrast, the number of island visitors changed little.', strength: 'Link two opposing body sentences.' },
          ],
        },
        {
          id: 'w-vocab-map',
          kind: 'vocab',
          title: 'Map Vocabulary',
          chips: ['revamped', 'integrated', 'repurposed'],
          quickExample: 'The reading room was repurposed as a computer room.',
          quickNote: 'The notes’ “map cheat words”',
          items: [
            { word: 'revamped / redeveloped / redesigned', meaning: 'changed and improved', example: 'The entrance was revamped and the courtyard redeveloped.', strength: 'Upgrade “changed”.' },
            { word: 'integrated / introduced / added', meaning: 'brought something new in', example: 'A café was integrated into the main foyer.', strength: 'For new buildings and features.' },
            { word: 'repurposed / allocated', meaning: 'given a new use or space', example: 'The reading room was repurposed; more space was allocated to children’s books.', strength: 'For functions changing, not disappearing.' },
            { word: 'accommodates / availability / across', meaning: 'holds · how much exists · spread over', example: 'The café now accommodates an information desk.', strength: 'The notes’ connective cheat words.' },
            { word: 'foyer / layout / elements such as', meaning: 'entrance hall · arrangement · naming parts', example: 'A foyer: a large open space in a public area.', strength: 'Directly from the notes’ map list.' },
          ],
        },
        {
          id: 'w-vocab-process',
          kind: 'vocab',
          title: 'Process Ordering',
          chips: ['Initially', 'Subsequently', 'Finally'],
          quickExample: 'Initially, flour is stored in silos. Finally, the cups are sealed.',
          quickNote: 'First stage · middle · last stage',
          items: [
            { word: 'Initially / First / Firstly', meaning: 'opens the sequence', example: 'Initially, flour is stored in silos.', strength: 'The notes’ first-stage openers.' },
            { word: 'After that / At this point / The next step is', meaning: 'moves the sequence on', example: 'After that, ingredients are blended into the mixture.', strength: 'Vary these — never “then, then, then”.' },
            { word: 'Subsequently / Second / Secondly', meaning: 'middle-stage sequencing', example: 'Subsequently, the paste is rolled into sheets.', strength: 'Formal middle connectors.' },
            { word: 'Finally / The last step is / The final step is', meaning: 'closes the sequence', example: 'Finally, the cups are labelled and sealed.', strength: 'The notes’ last-stage closers.' },
          ],
        },
      ],
    },
    // ── ASSESSMENT ──────────────────────────────────────────────────────
    {
      id: 'writing-assessment',
      title: 'Assessment',
      blurb: 'How examiners read your work.',
      tips: [
        {
          id: 'w-assess-task',
          title: 'Task Achievement',
          short: 'Answer everything the task asks — position clear, all parts covered.',
          explanation: 'Task 2: answer the whole question (all parts), keep your position visible. Task 1: give an overview plus the key features — and never give opinions in Task 1.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Task 2', text: 'All parts answered + a clear position throughout.' },
                { label: 'Task 1', text: 'Overview present + key features selected.' },
                { label: 'Killer', text: 'Discussing only one of two direct questions.' },
              ],
            },
          ],
          takeaway: 'Re-read the task before you plan — then answer it all.',
        },
        {
          id: 'w-assess-coherence',
          title: 'Coherence & Cohesion',
          short: 'One idea per paragraph, carried by topic sentence → development → link.',
          explanation: 'This is where the notes’ body system earns its marks: topic sentence, development, link — plus connectors like Overall, However, As a result, In contrast.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Paragraph', text: 'One idea only — stated in sentence one.' },
                { label: 'Connect', text: 'Overall · However · As a result · In contrast.' },
                { label: 'Avoid', text: 'Connector soup: two linkers doing one job.' },
              ],
            },
          ],
          takeaway: 'Paragraphing is structure you can see.',
        },
        {
          id: 'w-assess-lexical',
          title: 'Lexical Resource',
          short: 'Better synonyms and zero repetition — used naturally.',
          explanation: 'The Final Scan is your Lexical Resource strategy: replace simple words with advanced synonyms and replace repeated words. But natural usage wins — don’t force exotic synonyms onto simple ideas.',
          demos: [
            {
              type: 'beforeAfter',
              beforeLabel: 'Repeated',
              before: 'People use social media because social media is convenient.',
              afterLabel: 'Varied',
              after: 'People use social media because these platforms are convenient.',
              note: 'Small change. More natural.',
            },
          ],
          takeaway: 'Upgrade repetition first; upgrade vocabulary second.',
        },
        {
          id: 'w-assess-grammar',
          title: 'Grammar',
          short: 'Mix simple and complex sentences — then scan for slips.',
          explanation: 'Range matters: conditionals, relative clauses, contrasting tenses. Accuracy matters just as much — the notes’ final scan exists because slips (agreement, articles, tense) are the cheapest errors to fix.',
          demos: [
            {
              type: 'lines',
              rows: [
                { label: 'Range', text: '“If exams were less frequent, students would retain more.”' },
                { label: 'Scan for', text: 'Plural -s · articles (a/the) · tense agreement.' },
                { label: 'Rule', text: 'A correct simple sentence beats a broken complex one.' },
              ],
            },
          ],
          takeaway: 'Build range early, scan for slips late.',
        },
      ],
    },
  ],
};
