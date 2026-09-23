// Comprehensive IELTS Academic Speaking Test Pools (Cambridge 16-19 Standard)
import { getAttemptedQuestionSets, clearAttemptedQuestionSets, getQuestionPoolStats } from '../../utils/storage';

export const SPEAKING_TEST_POOLS = [
  {
    id: "sp-c17-t1",
    theme: "History & Personal Background",
    title: "Cambridge Set 1: History, Childhood & Community",
    parts: [
      {
        part: 1,
        title: "Part 1: Introduction & Familiar Topics",
        duration: "4-5 minutes",
        theme: "History & Schooling",
        instructions: "The examiner asks you about yourself, your home, schooling, and personal interests.",
        questions: [
          {
            id: "s1_q1",
            topic: "History at School",
            question: "What did you study in history lessons when you were at school?",
            sampleAnswer: "During secondary school, we covered both domestic and world history, ranging from ancient civilizations like Mesopotamia and the Roman Empire to key modern events such as the Industrial Revolution and the world wars.",
            tip: "Use past tenses accurately and give a couple of specific historical examples."
          },
          {
            id: "s1_q2",
            topic: "Enjoyment",
            question: "Did you enjoy studying history at school? Why or why not?",
            sampleAnswer: "Yes, absolutely! I found history captivating because it felt like uncovering an epic story of human ambition, struggles, and triumphs, rather than merely memorizing dates.",
            tip: "Explain your personal reaction and provide reasons using expressive adjectives."
          },
          {
            id: "s1_q3",
            topic: "Documentaries & Media",
            question: "How often do you watch TV programmes or documentaries about history now?",
            sampleAnswer: "I'd say fairly frequently, perhaps a couple of times a month on streaming platforms. I particularly gravitate toward archaeological discoveries and geopolitical documentaries.",
            tip: "Give a realistic frequency and elaborate on the sub-genre you enjoy."
          },
          {
            id: "s1_q4",
            topic: "Historical Curiosity",
            question: "What period in history would you like to learn more about? Why?",
            sampleAnswer: "I'm especially intrigued by the Renaissance in Europe. It was a remarkable golden age where art, science, philosophy, and commerce collided to reshape civilization.",
            tip: "Use rich vocabulary (e.g., 'intriguing', 'golden age', 'collide', 'civilization')."
          }
        ]
      },
      {
        part: 2,
        title: "Part 2: Long Turn (Cue Card)",
        duration: "3-4 minutes (1 min prep, 1-2 min speaking)",
        cueCard: {
          topic: "Describe the neighbourhood you lived in when you were a child.",
          prompts: [
            "Where in your town/city the neighbourhood was",
            "What kind of people lived there",
            "What it was like to live in this neighbourhood",
            "And explain whether you would like to live in this neighbourhood in the future."
          ],
          prepTimeSeconds: 60,
          speakTimeSeconds: 120,
          modelAnswer: "I’d like to talk about the tranquil suburban enclave on the southern outskirts of my hometown where I spent my formative years.\n\nThe neighbourhood was characterized by tree-lined avenues, red-brick duplex houses, and a large communal park at its heart. It was primarily home to middle-class working families, including teachers, civil servants, and elderly retirees who had resided there for decades. Because it was such a close-knit community, virtually everyone knew their neighbours by name, and there was a profound sense of mutual trust and camaraderie.\n\nGrowing up there was an idyllic experience. As children, we had the freedom to ride our bicycles across the quiet lanes and organize impromptu football matches in the park until dusk, without our parents having to worry about heavy traffic or safety.\n\nAs for whether I would like to live there again in the future, I have mixed feelings. On one hand, I harbor deep nostalgia for its serene ambiance and green spaces. On the other hand, my current professional career demands rapid transit, vibrant cultural venues, and cosmopolitan amenities that a quiet suburb simply cannot offer.",
          keyVocabulary: [
            "tranquil suburban enclave",
            "formative years",
            "tree-lined avenues",
            "close-knit community",
            "camaraderie",
            "idyllic",
            "nostalgia"
          ]
        }
      },
      {
        part: 3,
        title: "Part 3: Two-Way Discussion",
        duration: "4-5 minutes",
        theme: "Community, Neighbours & Urban Infrastructure",
        questions: [
          {
            id: "s3_q1",
            subtopic: "Neighbours & Community",
            question: "What sort of things can neighbours do to help each other?",
            sampleAnswer: "Neighbours can provide essential mutual assistance, from mundane favors like receiving parcel deliveries or watering plants during holidays, to critical support in emergencies, such as caring for elderly residents or organizing community security watches.",
            tip: "Categorize your points: everyday convenience versus emergency safety."
          },
          {
            id: "s3_q2",
            subtopic: "Modern Social Dynamics",
            question: "Do people in your country generally interact with their neighbours as much today as in the past?",
            sampleAnswer: "Regrettably, direct interpersonal contact has diminished significantly. High-rise apartment living and relentless professional schedules encourage insularity, meaning many urban residents barely know the individuals residing adjacent to them.",
            tip: "Contrast traditional collectivism with contemporary urban individualism."
          },
          {
            id: "s3_q3",
            subtopic: "Urban Planning",
            question: "How can city planners design residential areas that foster stronger social cohesion?",
            sampleAnswer: "Planners ought to prioritize walkable public realms, pedestrian plazas, shared community gardens, and accessible community centers rather than designing exclusively around vehicular traffic.",
            tip: "Propose actionable urban design solutions with formal vocabulary."
          }
        ]
      }
    ]
  },
  {
    id: "sp-c18-t1",
    theme: "Travel, Mobility & Global Tourism",
    title: "Cambridge Set 2: Travel, Journeys & Ecotourism",
    parts: [
      {
        part: 1,
        title: "Part 1: Introduction & Familiar Topics",
        duration: "4-5 minutes",
        theme: "Daily Commute & Travel",
        instructions: "The examiner asks you about how you travel, public transit, and holiday destinations.",
        questions: [
          {
            id: "s2_q1",
            topic: "Daily Commute",
            question: "How do you usually travel to work or university every day?",
            sampleAnswer: "I predominantly rely on the municipal metro rail system. It offers punctuality and avoids the notorious morning gridlock that paralyzes our city's arterial ring roads.",
            tip: "Explain both the method of transport and the practical rationale behind your choice."
          },
          {
            id: "s2_q2",
            topic: "Scenic Journeys",
            question: "Do you prefer traveling by train or by airplane for long distances?",
            sampleAnswer: "While aviation is indisputably faster, I derive substantially greater enjoyment from long-distance railway journeys. Trains afford an immersive perspective of undulating rural landscapes.",
            tip: "Use comparative structures: 'while X is..., I derive greater enjoyment from Y'."
          },
          {
            id: "s2_q3",
            topic: "Memorable Vacation",
            question: "What was the most interesting place you visited during a holiday?",
            sampleAnswer: "A couple of summers ago, I explored the Scottish Highlands. The sheer rugged topography and mist-shrouded lochs evoked an almost mystical tranquility.",
            tip: "Employ vivid descriptive adjectives to paint a memorable picture."
          },
          {
            id: "s2_q4",
            topic: "Future Travel Plans",
            question: "Is there any country you haven't visited yet that you are eager to travel to?",
            sampleAnswer: "Japan has long occupied the pinnacle of my travel bucket list, primarily due to its harmonious juxtaposition of hyper-modern bullet trains and preserved feudal shrines.",
            tip: "Highlight an intriguing cultural or architectural contrast."
          }
        ]
      },
      {
        part: 2,
        title: "Part 2: Long Turn (Cue Card)",
        duration: "3-4 minutes (1 min prep, 1-2 min speaking)",
        cueCard: {
          topic: "Describe a memorable journey you made that took longer than anticipated.",
          prompts: [
            "Where you were traveling to and why",
            "What mode of transport you used",
            "Why the journey took longer than expected",
            "And explain how you felt about the unexpected delay."
          ],
          prepTimeSeconds: 60,
          speakTimeSeconds: 120,
          modelAnswer: "I would like to recount an unforgettable journey to a mountainous coastal sanctuary during an autumn break three years ago.\n\nMy friends and I had planned a weekend camping retreat in a remote national park situated approximately two hundred kilometers north of our metropolitan base. We opted to drive in an all-terrain vehicle, anticipating a brisk three-hour expedition along the coastal highway.\n\nHowever, about halfway through the ascent, an unprecedented torrential downpour triggered a localized mudslide, which completely obstructed the two-lane mountain pass. Authorities promptly cordoned off the sector, necessitating a detour across an unpaved, winding logging trail through dense pine forests. Navigating this treacherous, fog-engulfed terrain reduced our speed to barely fifteen kilometers per hour, ultimately extending a straightforward three-hour trip into an arduous eight-hour odyssey.\n\nInitially, we felt palpable frustration and anxiety as dusk descended and cell phone reception evaporated. Nevertheless, once we embraced the unpredictability of the expedition, the collective camaraderie shone through. We shared snacks, sang along to acoustic playlists, and marveled at the ethereal beauty of waterfalls cascading beside the forest track. In retrospect, the delay transformed an ordinary weekend into our most cherished travel memory.",
          keyVocabulary: [
            "unprecedented torrential downpour",
            "cordoned off the sector",
            "treacherous terrain",
            "arduous eight-hour odyssey",
            "palpable frustration",
            "ethereal beauty",
            "in retrospect"
          ]
        }
      },
      {
        part: 3,
        title: "Part 3: Two-Way Discussion",
        duration: "4-5 minutes",
        theme: "Mass Tourism, Ecology & Future Transport",
        questions: [
          {
            id: "s2_p3_q1",
            subtopic: "Overtourism & Ecology",
            question: "How has international mass tourism impacted delicate natural ecosystems?",
            sampleAnswer: "Mass tourism has regrettably inflicted severe ecological degradation, including coral reef bleaching from motorboats and microplastic litter in pristine national parks. Developing sustainable ecotourism caps is paramount.",
            tip: "Present cause-and-effect with academic terminology like 'ecological degradation' and 'sustainable caps'."
          },
          {
            id: "s2_p3_q2",
            subtopic: "High-Speed Rail vs Aviation",
            question: "Do you think governments should invest more in high-speed rail rather than expanding domestic airports?",
            sampleAnswer: "Undoubtedly. High-speed electrified rail networks generate a fraction of the carbon footprint of short-haul aviation while connecting regional city centers seamlessly without lengthy security queues.",
            tip: "Contrast environmental sustainability against passenger logistics."
          },
          {
            id: "s2_p3_q3",
            subtopic: "Cultural Preservation",
            question: "Can tourism help preserve local heritage, or does it commercialize it excessively?",
            sampleAnswer: "It functions as a double-edged sword. On one hand, tourism revenue finances historical restoration and artisan livelihoods; on the other hand, it risks reducing sacred traditions to superficial spectacles for quick selfies.",
            tip: "Use nuanced idiomatic framing: 'functions as a double-edged sword'."
          }
        ]
      }
    ]
  },
  {
    id: "sp-c18-t2",
    theme: "Technology, Innovation & Future of Work",
    title: "Cambridge Set 3: Technology, Digital Skills & Automation",
    parts: [
      {
        part: 1,
        title: "Part 1: Introduction & Familiar Topics",
        duration: "4-5 minutes",
        theme: "Digital Devices & Daily Routines",
        instructions: "The examiner asks you about digital gadgets, online habits, and screen time.",
        questions: [
          {
            id: "s3_q1",
            topic: "Indispensable Gadgets",
            question: "What electronic device do you use most frequently throughout the day?",
            sampleAnswer: "Unquestionably, my laptop workstation. It serves as the primary conduit for my professional research, software engineering tasks, and collaborative communication with global peers.",
            tip: "Elevate everyday nouns: 'conduit for collaborative communication'."
          },
          {
            id: "s3_q2",
            topic: "Technology in Youth",
            question: "Did you use computers frequently when you were a child?",
            sampleAnswer: "Not nearly as extensively as today's generation. In the early 2000s, dial-up internet access was strictly rationed by my parents, so computers were reserved for typing school essays.",
            tip: "Provide a temporal benchmark showing personal growth and tech evolution."
          },
          {
            id: "s3_q3",
            topic: "Screen Time Management",
            question: "Do you find it difficult to switch off your smartphone in the evening?",
            sampleAnswer: "To be completely candid, it is an ongoing struggle. The algorithmically curated feeds are engineered to captivate human attention, so I intentionally utilize greyscale mode to curb nighttime screen time.",
            tip: "Admit a realistic nuance and propose an intentional counter-measure."
          },
          {
            id: "s3_q4",
            topic: "Emerging Tech",
            question: "What recent technological advancement has impressed you the most?",
            sampleAnswer: "The exponential breakthrough in generative artificial intelligence and natural language models. Their ability to synthesize academic literature in seconds is truly revolutionary.",
            tip: "Use precision adjectives: 'exponential breakthrough', 'synthesize academic literature'."
          }
        ]
      },
      {
        part: 2,
        title: "Part 2: Long Turn (Cue Card)",
        duration: "3-4 minutes (1 min prep, 1-2 min speaking)",
        cueCard: {
          topic: "Describe a complex skill you learned that required significant perseverance.",
          prompts: [
            "What the skill was and why you decided to learn it",
            "How you learned it and who helped you",
            "What difficulties you encountered during the learning process",
            "And explain how mastering this skill impacted your confidence."
          ],
          prepTimeSeconds: 60,
          speakTimeSeconds: 120,
          modelAnswer: "I would like to speak about learning full-stack software development and data algorithmic design during my university years.\n\nI made the deliberate decision to tackle computer programming because I wanted to transform abstract conceptual theories into functional, real-world digital applications rather than being a passive consumer of software.\n\nI embarked on this journey through a rigorous combination of university lectures, specialized open-source repositories, and peer coding workshops. A senior graduate researcher acted as an invaluable mentor, imparting clean architectural paradigms and debugging methodologies.\n\nThe learning curve, however, was steep and unforgiving. In the initial months, confronting cryptic compiler errors and wrestling with asynchronous data pipelines triggered intense cognitive fatigue. There were numerous occasions where I spent eight continuous hours resolving a single syntax discrepancy.\n\nOvercoming these hurdles and finally deploying a fully functioning distributed application was profoundly empowering. It fundamentally recalibrated my self-assurance, proving that intellectual tenacity and methodical problem decomposition can conquer virtually any technical obstacle.",
          keyVocabulary: [
            "deliberate decision",
            "rigorous combination",
            "clean architectural paradigms",
            "unforgiving learning curve",
            "cryptic compiler errors",
            "cognitive fatigue",
            "methodical problem decomposition"
          ]
        }
      },
      {
        part: 3,
        title: "Part 3: Two-Way Discussion",
        duration: "4-5 minutes",
        theme: "Artificial Intelligence, Workforce & Ethics",
        questions: [
          {
            id: "s3_p3_q1",
            subtopic: "Automation & Employment",
            question: "Will automation and artificial intelligence render traditional office professions obsolete?",
            sampleAnswer: "Rather than outright obsolescence, I anticipate a profound structural metamorphosis. Routine administrative tasks will be automated, requiring professionals to pivot toward high-order critical synthesis and interpersonal negotiation.",
            tip: "Argue with sophisticated vocabulary: 'structural metamorphosis', 'critical synthesis'."
          },
          {
            id: "s3_p3_q2",
            subtopic: "Education Paradigm",
            question: "How should modern school curricula adapt to prepare students for an AI-dominated economy?",
            sampleAnswer: "Education systems must transition away from rote memorization toward cultivating cognitive flexibility, ethical reasoning, and interdisciplinary problem-solving.",
            tip: "Contrast obsolete methods (rote memorization) with modern necessities (cognitive flexibility)."
          },
          {
            id: "s3_p3_q3",
            subtopic: "Digital Divide",
            question: "Does rapid technological adoption widen the socioeconomic divide between developed and developing nations?",
            sampleAnswer: "Unfortunately, yes. Nations lacking robust broadband infrastructure and capital reserves risk being relegated to digital consumers, while tech pioneers concentrate computational monopolies.",
            tip: "Provide a systemic geopolitical perspective."
          }
        ]
      }
    ]
  },
  {
    id: "sp-c16-t2",
    theme: "Environment, Ecology & Conservation",
    title: "Cambridge Set 4: Green Spaces, Climate & Sustainability",
    parts: [
      {
        part: 1,
        title: "Part 1: Introduction & Familiar Topics",
        duration: "4-5 minutes",
        theme: "Parks & Natural Surroundings",
        instructions: "The examiner asks you about parks in your hometown, outdoor activities, and weather.",
        questions: [
          {
            id: "s4_q1",
            topic: "Urban Parks",
            question: "Do you often spend time in public parks or gardens in your city?",
            sampleAnswer: "Yes, quite regularly. Escaping to the botanical gardens provides an indispensable mental reprieve from the incessant noise and concrete landscape of the financial district.",
            tip: "Use sensory and contrastive vocabulary: 'indispensable mental reprieve', 'incessant noise'."
          },
          {
            id: "s4_q2",
            topic: "Outdoor Exercise",
            question: "What outdoor activities are most popular among people in your country?",
            sampleAnswer: "Cycling along river corridors and weekend hiking in surrounding hill reserves are extraordinarily popular, particularly across younger demographics who prioritize wellness.",
            tip: "Cite specific regional pastimes and demographic trends."
          },
          {
            id: "s4_q3",
            topic: "Weather Preferences",
            question: "What kind of weather do you enjoy the most? Why?",
            sampleAnswer: "I have a strong affinity for crisp, sunlit autumn mornings. The ambient temperature is pleasantly brisk, making brisk walking invigorating without the sweltering heat of summer.",
            tip: "Use sensory phrases like 'crisp, sunlit autumn mornings' and 'pleasantly brisk'."
          },
          {
            id: "s4_q4",
            topic: "Climate Changes",
            question: "Have you noticed any changes in the seasonal patterns in your hometown recently?",
            sampleAnswer: "Alarmingly, yes. Our winters have become increasingly erratic and noticeably milder, punctuated by unseasonal heat spikes that were virtually unheard of twenty years ago.",
            tip: "Connect personal observations to broader climatic trends."
          }
        ]
      },
      {
        part: 2,
        title: "Part 2: Long Turn (Cue Card)",
        duration: "3-4 minutes (1 min prep, 1-2 min speaking)",
        cueCard: {
          topic: "Describe an environmental initiative or project you took part in or learned about.",
          prompts: [
            "What the project was and where it took place",
            "Who organized or participated in it",
            "What specific actions were taken",
            "And explain why you felt this initiative was valuable."
          ],
          prepTimeSeconds: 60,
          speakTimeSeconds: 120,
          modelAnswer: "I would like to highlight a community-driven urban reforestation and wetland rehabilitation initiative executed across my municipality last spring.\n\nThe project was conceived by a collaborative coalition of local university botanists, municipal environmental officers, and passionate resident volunteers. Its primary objective was to rejuvenate a degraded riparian corridor that had suffered decades of industrial runoff and invasive weed proliferation.\n\nOver the course of consecutive weekends, over four hundred volunteers mobilized to remove tons of plastic debris, eradicate choking ivy weeds, and plant more than three thousand native drought-tolerant saplings along the riverbank. Specialist hydrological teams simultaneously installed bio-filtration reed beds to naturally filter urban storm runoff before it emptied into the main river.\n\nThis initiative carried immense ecological and civic value. Beyond visibly mitigating soil erosion and attracting indigenous bird species within months, it fostered a palpable ethos of communal stewardship. It demonstrated to urban dwellers that tangible environmental rejuvenation does not rely solely on distant treaties, but starts with hands-on grassroots commitment.",
          keyVocabulary: [
            "urban reforestation",
            "wetland rehabilitation",
            "riparian corridor",
            "invasive weed proliferation",
            "bio-filtration reed beds",
            "mitigating soil erosion",
            "communal stewardship",
            "grassroots commitment"
          ]
        }
      },
      {
        part: 3,
        title: "Part 3: Two-Way Discussion",
        duration: "4-5 minutes",
        theme: "Global Climate Responsibility & Individual Action",
        questions: [
          {
            id: "s4_p3_q1",
            subtopic: "Individual vs Corporate Responsibility",
            question: "Can individual consumer lifestyle changes effectively counteract climate change, or must the burden fall on major corporations?",
            sampleAnswer: "While individual mindfulness regarding recycling and consumption is commendable, it is essentially dwarfed by corporate emission footprints. Systemic carbon taxation and regulatory mandates on heavy industry are indispensable.",
            tip: "Weigh individual actions against structural corporate mechanisms."
          },
          {
            id: "s4_p3_q2",
            subtopic: "Renewable Energy Transition",
            question: "What are the primary obstacles preventing developing nations from rapidly transitioning to renewable energy?",
            sampleAnswer: "The most formidable bottleneck is upfront capital expenditure. Solar arrays and modern power grids necessitate monumental initial financing, which heavily indebted nations struggle to secure without concessionary international green climate funds.",
            tip: "Identify precise financial and logistical bottlenecks."
          },
          {
            id: "s4_p3_q3",
            subtopic: "Environmental Education",
            question: "At what age should schools introduce climate literacy into the standard curriculum?",
            sampleAnswer: "From primary schooling onwards. Embedding ecological consciousness into early natural science lessons normalizes sustainable living habits as foundational instincts rather than afterthoughts.",
            tip: "Advocate with educational conviction."
          }
        ]
      }
    ]
  },
  {
    id: "sp-c19-t1",
    theme: "Literature, Culture & Digital Media",
    title: "Cambridge Set 5: Books, Storytelling & Cultural Preservation",
    parts: [
      {
        part: 1,
        title: "Part 1: Introduction & Familiar Topics",
        duration: "4-5 minutes",
        theme: "Reading & Media Habits",
        instructions: "The examiner asks you about books, reading formats, and library visits.",
        questions: [
          {
            id: "s5_q1",
            topic: "Reading Frequency",
            question: "How often do you read books in your leisure time?",
            sampleAnswer: "I aim to read for at least thirty minutes prior to sleeping each evening. It serves as an organic digital detox, allowing my mind to decompress away from back-lit monitors.",
            tip: "Describe both the frequency and the psychological benefit."
          },
          {
            id: "s5_q2",
            topic: "E-books vs Print",
            question: "Do you prefer reading physical printed books or reading on digital e-readers?",
            sampleAnswer: "I am an ardent devotee of physical books. The tactile sensation of turning paper pages and the distinct scent of printed ink offer an irreplaceable sensory depth that tablets simply cannot emulate.",
            tip: "Use sensory vocabulary: 'ardent devotee', 'tactile sensation', 'irreplaceable sensory depth'."
          },
          {
            id: "s5_q3",
            topic: "Genre Preference",
            question: "What genre of literature do you find most engaging?",
            sampleAnswer: "I gravitate towards investigative non-fiction and philosophical biographies, as they illuminate the real decision-making frameworks of transformative historical figures.",
            tip: "Specify genre and explain intellectual interest."
          },
          {
            id: "s5_q4",
            topic: "Public Libraries",
            question: "Did you visit public libraries often when you were growing up?",
            sampleAnswer: "Frequently, yes. The central municipal library was my sanctuary after school, offering an endless treasure trove of encyclopedias and a tranquil atmosphere for focused study.",
            tip: "Express nostalgia with rich words like 'sanctuary' and 'treasure trove'."
          }
        ]
      },
      {
        part: 2,
        title: "Part 2: Long Turn (Cue Card)",
        duration: "3-4 minutes (1 min prep, 1-2 min speaking)",
        cueCard: {
          topic: "Describe an influential book or story that left a lasting impression on your worldview.",
          prompts: [
            "What the book or story was and who wrote it",
            "What the central narrative or theme was",
            "When and why you decided to read it",
            "And explain why it had such a profound impact on you."
          ],
          prepTimeSeconds: 60,
          speakTimeSeconds: 120,
          modelAnswer: "I would like to speak about Viktor Frankl’s seminal philosophical masterpiece, 'Man’s Search for Meaning', which I first encountered during my final year of secondary school.\n\nThe work is divided into two poignant halves: first, a harrowing yet deeply analytical psychological memoir of the author's survival in Nazi concentration camps; and second, the theoretical exposition of logotherapy, which asserts that humanity’s fundamental drive is the pursuit of purpose rather than pleasure or power.\n\nI picked up the volume during an intensely demanding examination period when I was grappling with academic pressure and existential uncertainty regarding my future trajectory.\n\nReading Frankl’s testimony was a transformative awakening. His central thesis—that while one cannot always control external circumstances, one retains the inviolable freedom to choose one's attitude in any given predicament—profoundly recalibrated my psychological resilience. Whenever I confront professional setbacks or personal adversity today, I draw upon this timeless wisdom to reframe challenges as catalysts for character formation.",
          keyVocabulary: [
            "seminal philosophical masterpiece",
            "harrowing yet analytical memoir",
            "existential uncertainty",
            "transformative awakening",
            "inviolable freedom",
            "psychological resilience",
            "catalysts for character formation"
          ]
        }
      },
      {
        part: 3,
        title: "Part 3: Two-Way Discussion",
        duration: "4-5 minutes",
        theme: "Digital Media, Literacy & Cultural Preservation",
        questions: [
          {
            id: "s5_p3_q1",
            subtopic: "Bite-Sized Video vs In-Depth Reading",
            question: "Are short-form video algorithms diminishing the capacity of younger generations for deep, focused reading?",
            sampleAnswer: "Empirical cognitive research suggests this is an acute crisis. Algorithmic hyper-stimulation conditions neurochemistry to expect instant gratification, which actively atrophies the sustained cognitive endurance required for complex literary analysis.",
            tip: "Utilize cognitive and neurological terminology: 'atrophies sustained endurance'."
          },
          {
            id: "s5_p3_q2",
            subtopic: "Role of Public Libraries",
            question: "In an era of ubiquitous internet access, are brick-and-mortar public libraries still worth public funding?",
            sampleAnswer: "Crucially so. Modern libraries have evolved far beyond book repositories; they represent egalitarian community hubs offering free high-speed computing, digital literacy courses, and quiet sanctuaries for civic engagement.",
            tip: "Redefine the institution's contemporary social purpose: 'egalitarian community hubs'."
          },
          {
            id: "s5_p3_q3",
            subtopic: "AI in Literature",
            question: "Can artificial intelligence ever compose literature with the authentic emotional depth of human authors?",
            sampleAnswer: "While AI can synthesize stylistic tropes and emulate rhyming structures flawlessly, true literature emanates from lived vulnerability, existential suffering, and mortal consciousness—qualities completely absent in algorithmic computation.",
            tip: "Conclude with philosophical eloquence."
          }
        ]
      }
    ]
  }
];

/**
 * Returns the next randomized speaking test from the unattempted primary pool.
 * If all question sets have been attempted by the user, the second pool (attempted)
 * cycles back to become the primary pool from where randomness begins again.
 */
export function getNextSpeakingTest(currentId = null) {
  const attemptedIds = getAttemptedQuestionSets('speaking');
  
  // Primary Pool: Unattempted question sets
  let unattemptedPool = SPEAKING_TEST_POOLS.filter(t => !attemptedIds.includes(t.id));
  let isCycleReset = false;

  // If the user has attempted all of those questions,
  // that second pool, which has all attempted, becomes the primary pool from where randomness starts again
  if (unattemptedPool.length === 0) {
    clearAttemptedQuestionSets('speaking');
    unattemptedPool = [...SPEAKING_TEST_POOLS];
    isCycleReset = true;
  }

  // If more than 1 option available, prevent immediately repeating currentId
  let candidates = unattemptedPool;
  if (currentId && candidates.length > 1) {
    candidates = candidates.filter(t => t.id !== currentId);
  }

  // Pure randomized selection from the unattempted pool (ensures randomized initial start)
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selectedTest = candidates[randomIndex];

  return {
    test: selectedTest,
    poolInfo: {
      attemptedCount: isCycleReset ? 0 : attemptedIds.length,
      totalCount: SPEAKING_TEST_POOLS.length,
      remainingInPool: unattemptedPool.length,
      isCycleReset
    }
  };
}

export function getRandomSpeakingTest(currentId = null) {
  return getNextSpeakingTest(currentId).test;
}
