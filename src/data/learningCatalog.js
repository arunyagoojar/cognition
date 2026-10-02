// IELTS Video Learning Catalog curated from official IELTS Media library
import { resolveMediaUrl } from '../utils/media.js';

export const LEARNING_SKILLS = [
  {
    id: 'speaking',
    title: 'Speaking Mastery',
    shortDesc: 'Fluency, pronunciation, and structured long-turn strategies',
    lessonCount: 4,
    totalDuration: '1h 17m',
    accentColor: '#c084fc',
    icon: 'Mic',
    lessons: [
      {
        id: 'sp-1',
        skill: 'speaking',
        lessonNumber: 1,
        title: 'Expressing Opinions & Nuanced Views',
        duration: '15m',
        videoUrl: resolveMediaUrl('/videos/Speaking/001 How to give your opinion.mp4'),
        description: 'Learn how to move beyond basic phrases like "I think" to sophisticated stance markers such as "From my perspective" and "I tend to believe".',
        takeaways: [
          'Use epistemic hedging ("It could be argued that...") rather than absolutes',
          'Vary opinion verbs: assert, maintain, contend, perceive',
          'Always justify opinions with immediate concrete rationale'
        ],
        practiceTab: 'speaking'
      },
      {
        id: 'sp-2',
        skill: 'speaking',
        lessonNumber: 2,
        title: 'Mastering Speaking Part 1: Fluency & Speed',
        duration: '18m',
        videoUrl: resolveMediaUrl('/videos/Speaking/002 IELTS Speaking Task 1.mp4'),
        description: 'Overcome hesitation and master the 2-3 sentence formula for personal interview questions without unnatural pauses.',
        takeaways: [
          'Answer directly in sentence 1, elaborate in sentence 2, provide example in sentence 3',
          'Avoid 1-word answers at all costs',
          'Smile and maintain steady natural pacing rather than rushing'
        ],
        practiceTab: 'speaking'
      },
      {
        id: 'sp-3',
        skill: 'speaking',
        lessonNumber: 3,
        title: 'Mastering Speaking Part 2: Long Turn & Cue Card',
        duration: '24m',
        videoUrl: resolveMediaUrl('/videos/Speaking/003 IELTS Speaking Task 2.mp4'),
        description: 'Structure your 1-minute preparation note-taking to sustain a fluent, coherent 2-minute monologue across all 4 cue card prompts.',
        takeaways: [
          'Divide your note-sheet into 4 quadrants matching the 4 bullet points',
          'Use past narrative markers: "Initially", "Before long", "Looking back"',
          'Speak until the examiner stops you to prove stamina'
        ],
        practiceTab: 'speaking'
      },
      {
        id: 'sp-4',
        skill: 'speaking',
        lessonNumber: 4,
        title: 'Mastering Speaking Part 3: Abstract Discussion',
        duration: '20m',
        videoUrl: resolveMediaUrl('/videos/Speaking/004 IELTS Speaking Task 3.mp4'),
        description: 'Transition from personal anecdotes to societal, philosophical, and macroscopic analysis needed for Band 7.5+.',
        takeaways: [
          'Speak in terms of demographics: "Older generations often...", "Younger professionals tend to..."',
          'Discuss both short-term convenience and long-term consequences',
          'Use buy-time phrases gracefully: "That is a multifaceted societal dilemma..."'
        ],
        practiceTab: 'speaking'
      }
    ]
  },
  {
    id: 'writing',
    title: 'Academic Writing',
    shortDesc: 'Report data architecture, essay coherence, and formal transitions',
    lessonCount: 8,
    totalDuration: '2h 23m',
    accentColor: '#fbbf24',
    icon: 'PenTool',
    lessons: [
      {
        id: 'wr-1',
        skill: 'writing',
        lessonNumber: 1,
        title: 'Avoiding Informal Language & Punctuation Traps',
        duration: '12m',
        videoUrl: resolveMediaUrl('/videos/Writing/001 How to use ETC., AND SO ON, ....mp4'),
        description: 'Why phrases like "etc.", "and so on", and exclamation marks are forbidden in Academic Writing and how to replace them.',
        takeaways: [
          'Never write "etc." or "..." in IELTS essays',
          'Use "such as X, Y, and Z" with a complete list',
          'Maintain objective formal academic distance'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-2',
        skill: 'writing',
        lessonNumber: 2,
        title: 'Additive Transitions: In Addition, Moreover, Furthermore',
        duration: '16m',
        videoUrl: resolveMediaUrl('/videos/Writing/002 Writing - Transitions - in addition, moreover, furthermore, another.mp4'),
        description: 'Seamlessly link secondary arguments without sounding repetitive or mechanical.',
        takeaways: [
          'Place transitions adverbially: "This policy, furthermore, mitigates urban gridlock"',
          'Avoid beginning every single sentence with a linker',
          'Reserve "moreover" for intensifying points, not just listing'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-3',
        skill: 'writing',
        lessonNumber: 3,
        title: 'Causal Transitions: Therefore, Thus, Consequently',
        duration: '15m',
        videoUrl: resolveMediaUrl('/videos/Writing/003 Writing - Transitions - THEREFORE, THUS, CONSEQUENTLY.mp4'),
        description: 'Construct airtight logical deductions that boost Coherence and Cohesion to Band 8+.',
        takeaways: [
          'Use "Consequently" to highlight real-world outcomes',
          'Use "Thus" for concise summary clauses: ", thus reducing emissions"',
          'Ensure causal premises are explicitly established first'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-4',
        skill: 'writing',
        lessonNumber: 4,
        title: 'Task 1 Comparisons: 6 Advanced Structures',
        duration: '18m',
        videoUrl: resolveMediaUrl('/videos/Writing/004 Writing - Compare -  6 ways to compare.mp4'),
        description: 'Move beyond "higher than" into sophisticated proportional syntax and comparative ratios.',
        takeaways: [
          'Master twofold, threefold, and exponential increases',
          'Use "whereas" and "while" for clause-level juxtaposition',
          'Report the delta (the difference) rather than only absolute numbers'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-5',
        skill: 'writing',
        lessonNumber: 5,
        title: 'Academic Paragraph Cohesion & Topic Sentences',
        duration: '17m',
        videoUrl: resolveMediaUrl('/videos/Writing/005 Writing Skills- The Paragraph.mp4'),
        description: 'How to construct unified body paragraphs with a single controlling idea, clear supporting evidence, and macroscopic impact.',
        takeaways: [
          'Topic sentence must state the central claim without premature specifics',
          'Support with explanation, followed by a concrete real-world case study',
          'Conclude with a synthesis sentence linking back to the prompt'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-6',
        skill: 'writing',
        lessonNumber: 6,
        title: 'Task 1 Architecture: Overview & Main Features',
        duration: '22m',
        videoUrl: resolveMediaUrl('/videos/Writing/006 Writing Task 1 - What to write.mp4'),
        description: 'The definitive method for identifying macro trends vs micro data points to guarantee Band 7+ in Task Achievement.',
        takeaways: [
          'The overview paragraph is MANDATORY — omit it and your score is capped at Band 5',
          'Never put raw data figures inside the overview paragraph',
          'Group categories into 2 logical body paragraphs'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-7',
        skill: 'writing',
        lessonNumber: 7,
        title: 'Task 2 Architecture: The Band 8+ Introduction',
        duration: '20m',
        videoUrl: resolveMediaUrl('/videos/Writing/007 Writing Task 2 - The Introduction.mp4'),
        description: 'Write effective introductions in 4 minutes: prompt paraphrasing, balanced perspective, and clear thesis statement.',
        takeaways: [
          'Paraphrase the prompt using synonyms and grammatical reordering',
          'Present your clear personal position in the introduction',
          'Keep introduction strictly between 45 and 55 words'
        ],
        practiceTab: 'writing'
      },
      {
        id: 'wr-8',
        skill: 'writing',
        lessonNumber: 8,
        title: 'Tone, Register & Formal Vocabulary',
        duration: '19m',
        videoUrl: resolveMediaUrl('/videos/Writing/008 Writing Letters formal  informal English.mp4'),
        description: 'Distinguish between colloquial and high-register academic vocabulary across IELTS prompts.',
        takeaways: [
          'Avoid contractions: write "do not" instead of "don\'t"',
          'Replace phrasal verbs with Latinate equivalents: "find out" -> "ascertain"',
          'Maintain consistent formal register from start to finish'
        ],
        practiceTab: 'writing'
      }
    ]
  },
  {
    id: 'reading',
    title: 'Academic Reading',
    shortDesc: 'Skimming, scanning, True/False/Not Given, and heading matching',
    lessonCount: 5,
    totalDuration: '1h 34m',
    accentColor: '#34d399',
    icon: 'BookOpen',
    lessons: [
      {
        id: 'rd-1',
        skill: 'reading',
        lessonNumber: 1,
        title: 'Academic vs General Reading Differences',
        duration: '14m',
        videoUrl: resolveMediaUrl('/videos/Reading/001 IELTS Reading - General and Academic.mp4'),
        description: 'Understanding the complex syntax, dense academic journals, and abstract vocabulary characteristic of the Academic test.',
        takeaways: [
          'Academic reading passages are sourced from research journals and scientific publications',
          'Questions strictly follow text chronological order except for Matching Headings',
          'Vocabulary is technical but key concepts are always contextually defined'
        ],
        practiceTab: 'reading'
      },
      {
        id: 'rd-2',
        skill: 'reading',
        lessonNumber: 2,
        title: 'Core Reading Strategies I: Skimming & Scanning',
        duration: '19m',
        videoUrl: resolveMediaUrl('/videos/Reading/002 IELTS Reading Strategies  1.mp4'),
        description: 'How to skim a 900-word passage in 2 minutes for thematic landmarks, then scan for dates, names, and technical terms.',
        takeaways: [
          'Read the first and last sentence of each paragraph during initial skim',
          'Circle or highlight capital letters, digits, and italicized terms',
          'Never read word-for-word before inspecting the questions'
        ],
        practiceTab: 'reading'
      },
      {
        id: 'rd-3',
        skill: 'reading',
        lessonNumber: 3,
        title: 'Core Reading Strategies II: Detailed Analysis',
        duration: '21m',
        videoUrl: resolveMediaUrl('/videos/Reading/003 IELTS Reading strategies 2.mp4'),
        description: 'Tackling True/False/Not Given questions and eliminating ambiguity between False and Not Given.',
        takeaways: [
          'FALSE means the text contradicts the statement',
          'NOT GIVEN means the text neither confirms nor contradicts it',
          'Watch out for extreme qualifiers: "always", "never", "exclusively"'
        ],
        practiceTab: 'reading'
      },
      {
        id: 'rd-4',
        skill: 'reading',
        lessonNumber: 4,
        title: 'Top 10 High-Scoring Reading Tips',
        duration: '16m',
        videoUrl: resolveMediaUrl('/videos/Reading/004 IELTS Reading Top 10 Tips.mp4'),
        description: 'Time allocation management: 17 mins for Passage 1, 20 mins for Passage 2, 23 mins for Passage 3.',
        takeaways: [
          'Transfer answers immediately — there is no 10-minute transfer time in Reading',
          'Never spend more than 90 seconds stuck on a single question',
          'Verify spelling against the passage text directly'
        ],
        practiceTab: 'reading'
      },
      {
        id: 'rd-5',
        skill: 'reading',
        lessonNumber: 5,
        title: 'Achieving Band 8+ in Academic Reading',
        duration: '25m',
        videoUrl: resolveMediaUrl('/videos/Reading/005 How to succeed on IELTS Reading.mp4'),
        description: 'Synthesizing paragraph summaries and tackling the most challenging Passage 3 philosophical texts.',
        takeaways: [
          'Identify synonyms between question stems and passage paraphrases',
          'Understand author attitude, bias, and epistemic tone',
          'Maintain relentless concentration through minute 60'
        ],
        practiceTab: 'reading'
      }
    ]
  },
  {
    id: 'listening',
    title: 'Listening Comprehension',
    shortDesc: 'Note-taking, signposting recognition, and distractor traps',
    lessonCount: 3,
    totalDuration: '52m',
    accentColor: '#38bdf8',
    icon: 'Headphones',
    lessons: [
      {
        id: 'ls-1',
        skill: 'listening',
        lessonNumber: 1,
        title: 'Listening Section Overview & Test Structure',
        duration: '12m',
        videoUrl: resolveMediaUrl('/videos/Listening/001 Listening Overview.mp4'),
        description: 'The progression from Part 1 social conversations through Part 4 continuous university monologues.',
        takeaways: [
          'Part 1: Social inquiry / transaction (2 speakers)',
          'Part 2: Community / cultural talk (1 speaker)',
          'Part 3: Academic seminar / research tutorial (2-4 speakers)',
          'Part 4: Academic lecture monologue (1 speaker, no break)'
        ],
        practiceTab: 'listening'
      },
      {
        id: 'ls-2',
        skill: 'listening',
        lessonNumber: 2,
        title: 'Active Note-Taking & Prediction Skills',
        duration: '18m',
        videoUrl: resolveMediaUrl('/videos/Listening/002 Notetaking Skills.mp4'),
        description: 'Predicting word classes, prepositions, and grammatical formats in the 30-second prep window.',
        takeaways: [
          'Anticipate part of speech: noun, number, adjective, or verb',
          'Pay intense attention to prepositions before blanks ("at the _____")',
          'Underline keywords in question headings during prep time'
        ],
        practiceTab: 'listening'
      },
      {
        id: 'ls-3',
        skill: 'listening',
        lessonNumber: 3,
        title: 'Top 14 Cambridge Listening Strategies',
        duration: '22m',
        videoUrl: resolveMediaUrl('/videos/Listening/003 IELTS Listening  Top 14 tips.mp4'),
        description: 'Detecting speaker self-corrections ("No wait, let me check..."), negative distractors, and spelling rules.',
        takeaways: [
          'Distractor Trap: Speakers frequently change their minds halfway through',
          'British vs American numeric pronunciations (zero / oh / double)',
          'If you miss an answer, let it go immediately to stay anchored on the next'
        ],
        practiceTab: 'listening'
      }
    ]
  }
];

export function getSkillLessons(skillId) {
  return LEARNING_SKILLS.find(s => s.id === skillId) || LEARNING_SKILLS[0];
}

export function getAllLessons() {
  return LEARNING_SKILLS.flatMap(s => s.lessons);
}

export function getLessonById(lessonId) {
  for (const skill of LEARNING_SKILLS) {
    const found = skill.lessons.find(l => l.id === lessonId);
    if (found) return found;
  }
  return null;
}

