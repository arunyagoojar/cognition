// Comprehensive IELTS Academic Writing Task Pools (Cambridge 14-19 Standard)
import { getAttemptedQuestionSets, clearAttemptedQuestionSets, getQuestionPoolStats } from '../../utils/storage';

export const WRITING_TASK_POOLS = [
  {
    id: "wr-c17-t1",
    title: "Cambridge Set 1: Norbiton Site & High-Risk Activities",
    task1: {
      title: "Task 1: Map & Urban Development Report",
      timeSuggestedMinutes: 20,
      minWords: 150,
      image: "/images/norbiton_map.png",
      prompt: `The two maps below show an industrial area in the town of Norbiton, and planned future development of the site.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.`,
      modelBand8: {
        band: "Band 8.0 Model Report",
        text: `The two maps illustrate the proposed transformation of the Norbiton industrial area into a modern residential precinct.

Overall, the planned redevelopment will replace all industrial buildings with extensive residential housing, introduce substantial civic and commercial facilities, and enhance road connectivity, including a newly constructed river crossing.

At present, the site consists entirely of factories situated along a central road that terminates in a roundabout on the southern boundary. Farmland borders the northern boundary beyond the river, while a town lies to the west.

Under the planned development, all industrial factories will be demolished. In their place, a large network of housing will be constructed along new branch roads extending eastward. A primary school, a playground, and several retail shops will be introduced to support the new populace. In addition, a smaller roundabout will be added in the center of the site to facilitate traffic circulation. Furthermore, a new bridge spanning the river will connect the community directly to the northern farmland, where additional residential dwellings will be erected.`
      }
    },
    task2: {
      title: "Task 2: Academic Discursive Essay",
      timeSuggestedMinutes: 40,
      minWords: 250,
      prompt: `Some people think that people who choose high-risk professions (such as pilots, soldiers, or firefighters) or engage in extreme sports should be responsible for their own rescue costs if things go wrong.

To what extent do you agree or disagree?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words.`,
      modelBand85: {
        band: "Band 8.5 Model Essay",
        text: `It is occasionally argued that individuals who voluntarily partake in perilous sporting endeavors or enter high-risk occupations should personally shoulder the financial burden of rescue operations when emergencies arise. While this perspective holds intuitive appeal regarding thrill-seeking recreation, I largely disagree with applying this principle broadly, particularly toward vital public-interest professions.

To begin with, high-risk vocations provide indispensable societal functions that warrant collective protection. Firefighters, frontline soldiers, and commercial aviators do not endanger their lives for frivolous excitement, but rather to preserve public safety and sustain critical infrastructure. If emergency rescue personnel or military operatives were required to self-insure against extraction costs, recruitment into these essential fields would collapse, inflicting catastrophic harm on public resilience. Therefore, the state possesses an unquestionable moral and civic duty to unconditionally underwrite rescue operations for these personnel.

On the other hand, extreme sports enthusiasts engage in life-threatening activities solely for individual gratification and sensory stimulation. In cases where reckless hikers venture into hazardous alpine conditions despite explicit meteorological warnings, allocating public resources for expensive helicopter evacuations places an undue burden on taxpayers. Even in such scenarios, however, conditioning emergency medical intervention on upfront financial solvency violates fundamental humanitarian ethics. A more equitable solution is mandating specialized insurance policies when acquiring permits or equipment, thereby internalizing the fiscal risk without compromising prompt emergency triage.

In conclusion, although recreational risk-takers should contribute to contingency funds through mandatory insurance schemes, emergency rescue services for essential workers must remain unconditionally funded by the public purse. Ultimately, preserving human life must remain the supreme priority of modern civil society, irrespective of the circumstances that precipitated the emergency.`
      }
    }
  },
  {
    id: "wr-c18-t1",
    title: "Cambridge Set 2: Hydroelectric Plant & Remote Work Paradigm",
    task1: {
      title: "Task 1: Process Diagram & Technical Summary",
      timeSuggestedMinutes: 20,
      minWords: 150,
      image: "/images/hydroelectric_diagram.png",
      prompt: `The diagram below illustrates the process by which hydroelectric power is generated in a pumped-storage reservoir system.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.`,
      modelBand8: {
        band: "Band 8.0 Model Report",
        text: `The diagram demonstrates the cyclical mechanics involved in generating hydroelectricity utilizing a pumped-storage system consisting of two reservoirs at distinct elevations.

Overall, the generation process operates in two primary phases: water descends during the day to generate power for the electrical grid during peak demand, whereas during the night, water is pumped back into the upper reservoir to prepare for the subsequent cycle.

During the daylight phase, water stored in the high-elevation reservoir flows downward through an intake pipe into a power generation facility. The gravitational force of the descending water drives massive turbines, which in turn activate generators that feed electricity directly into the national grid and commercial substations. The discharged water subsequently collects in a lower reservoir.

Conversely, during off-peak nighttime hours, the system operates in reverse. Reversible turbines function as heavy-duty pumps, propelled by surplus off-peak electricity, to propel water from the lower reservoir back up into the high reservoir, ensuring that gravitational potential energy is fully restored before morning.`
      }
    },
    task2: {
      title: "Task 2: Academic Discursive Essay",
      timeSuggestedMinutes: 40,
      minWords: 250,
      prompt: `In many countries, a growing proportion of companies now permit employees to work entirely from home.

Do the advantages of this trend for society and individuals outweigh the potential disadvantages?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words.`,
      modelBand85: {
        band: "Band 8.5 Model Essay",
        text: `In recent years, the proliferation of cloud computing and high-speed digital communications has prompted a widespread transition toward telecommuting. While remote employment presents legitimate concerns regarding occupational isolation and work-life balance erosion, I firmly contend that its substantial benefits for personal autonomy and environmental sustainability far outweigh these drawbacks.

The primary disadvantage associated with teleworking centers on interpersonal disengagement and psychological strain. In an exclusively digital working environment, the informal hallway conversations and serendipitous collaborations that frequently cultivate corporate camaraderie are substantially attenuated. Furthermore, when domestic quarters double as office workstations, employees frequently struggle to delineate work hours from personal respite, culminating in chronic digital burnout and fatigue.

Nevertheless, the advantages for individuals and broader society are transformative. At an individual level, eliminating the daily commute liberates hundreds of hours annually, enabling professionals to prepare wholesome meals, participate in regular physical fitness, and spend meaningful time with their families. Concurrently, geographical liberation permits families to settle in affordable rural or suburban regions rather than competing for hyper-inflated urban real estate adjacent to commercial business districts.

From an ecological perspective, the societal benefits are equally profound. Fewer commuters translate directly into reduced vehicular carbon emissions, decreased municipal expenditure on highway maintenance, and the alleviation of urban traffic gridlock. This structural decentralization cultivates cleaner air and revitalizes local regional economies across provincial towns.

In conclusion, although organizations must deliberately institute collaborative check-ins to counteract professional loneliness, the personal flexibility and macroscopic environmental dividends of remote employment make it an overwhelmingly advantageous evolution for contemporary civilization.`
      }
    }
  },
  {
    id: "wr-c18-t3",
    title: "Cambridge Set 3: Renewable Energy Transition & Tertiary Education",
    task1: {
      title: "Task 1: Comparative Bar Chart & Statistical Report",
      timeSuggestedMinutes: 20,
      minWords: 150,
      image: "/images/renewable_energy_chart.png",
      prompt: `The chart below illustrates the proportion of total national electricity generated from renewable sources across four European countries between 2010 and 2020.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.`,
      modelBand8: {
        band: "Band 8.0 Model Report",
        text: `The bar chart provides a comparative breakdown of the percentage of electricity derived from renewable energy sources in Germany, the United Kingdom, Spain, and Denmark from 2010 to 2020.

Overall, renewable energy consumption experienced an upward trajectory across all four evaluated nations over the decade, with Denmark consistently maintaining the predominant share and the United Kingdom exhibiting the most dramatic proportional surge.

In 2010, Denmark led the group decisively, producing approximately 32% of its domestic electricity from clean renewables, followed by Spain at 22% and Germany at 17%. The United Kingdom registered the lowest baseline, generating barely 7% of its total output from sustainable infrastructure.

Over the succeeding ten years, Denmark reinforced its leadership position, with green generation escalating to nearly 58% by 2020. Meanwhile, the United Kingdom underwent an exponential four-fold expansion, soaring past both Spain and Germany to reach 38% in 2020. In contrast, Germany and Spain demonstrated steady, moderate increments, concluding the decade at 34% and 31% respectively.`
      }
    },
    task2: {
      title: "Task 2: Academic Discursive Essay",
      timeSuggestedMinutes: 40,
      minWords: 250,
      prompt: `Some educators believe that universities should focus exclusively on imparting specialized technical knowledge required for specific careers, while others argue that higher education should cultivate broad intellectual and critical thinking capacities regardless of employment outcomes.

Discuss both views and give your own opinion.

Write at least 250 words.`,
      modelBand85: {
        band: "Band 8.5 Model Essay",
        text: `The fundamental purpose of university education has sparked enduring debate between advocates of vocational career training and proponents of liberal intellectual cultivation. While specialized professional instruction offers undeniable advantages for immediate post-graduate employment, I firmly believe that universities must preserve their foundational mission of developing comprehensive critical thinking and multidisciplinary reasoning.

On one hand, the argument for utilitarian, career-focused curricula is grounded in contemporary economic reality. In an increasingly competitive and automated global economy, employers seek graduates who possess tangible, industry-specific competencies, such as computer software engineering, surgical techniques, or financial auditing. When tertiary institutions prioritize concrete vocational skills, graduates experience swifter transitions into the workforce, mitigating post-collegiate unemployment and ensuring that state-subsidized higher education directly fuels economic productivity and national innovation.

On the other hand, focusing narrowly on technical vocations risks leaving graduates ill-equipped for rapid technological disruption. Specific software tools and technical methodologies routinely become obsolete within a single decade. Conversely, an academic curriculum steeped in philosophical inquiry, literature, historical analysis, and scientific deduction cultivates cognitive adaptability, moral judgment, and rigorous analytical scrutiny. These transferable intellectual capacities empower graduates to assimilate novel technologies, challenge obsolete conventions, and assume enlightened civic leadership throughout their entire careers.

In my view, a modern university should not view these paradigms as mutually exclusive. The most exemplary institutions incorporate rigorous vocational apprenticeships alongside mandatory foundational seminars in ethics, rhetoric, and scientific epistemology, preparing students for both practical employment and lifelong intellectual fulfillment.

In conclusion, while specialized vocational mastery is undeniably practical, the true hallmark of higher learning lies in cultivating resilient, critical intellects capable of navigating unpredictable societal evolutions.`
      }
    }
  },
  {
    id: "wr-c18-t2",
    title: "Cambridge Set 4: Urban Population in Asian Countries & Climate Responsibility",
    task1: {
      title: "Task 1: Line Graph & Demographic Trends",
      timeSuggestedMinutes: 20,
      minWords: 150,
      image: "/images/asian_cities_graph.png",
      prompt: `The graph below shows the percentage of the population in four Asian countries living in cities between 1970 and 2020, with predictions for 2030 and 2040.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.`,
      modelBand8: {
        band: "Band 8.0 Model Report",
        text: `The line graph portrays the proportion of residents living in urban areas across four Asian nations—the Philippines, Malaysia, Thailand, and Indonesia—from 1970 to 2020, accompanied by projected figures through 2040.

Overall, all four countries display consistent upward trajectories in urban population percentages throughout the seventy-year timeframe. Malaysia demonstrates the most pronounced urbanization, while Thailand is projected to record the lowest city-dwelling proportion by 2040.

In 1970, the Philippines possessed the highest urban population rate at approximately 32%, followed closely by Malaysia at roughly 30%. Thailand and Indonesia exhibited significantly lower urbanization rates, hovering around 19% and 13% respectively. Over the subsequent three decades, Malaysia experienced a sharp acceleration, surpassing the Philippines in the early 1980s and reaching over 70% by 2010.

Between 2020 and 2040, Malaysia's urban proportion is forecasted to climb further to over 80%. Indonesia is also expected to undergo substantial growth, reaching upwards of 60% by 2040, thereby overtaking the Philippines, which plateaus at approximately 55%. Meanwhile, Thailand is anticipated to grow steadily, concluding the period at around 48%.`
      }
    },
    task2: {
      title: "Task 2: Academic Discursive Essay",
      timeSuggestedMinutes: 40,
      minWords: 250,
      prompt: `Some people argue that companies and governments, rather than individuals, should bear the primary responsibility for tackling climate change.

To what extent do you agree or disagree?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words.`,
      modelBand85: {
        band: "Band 8.5 Model Essay",
        text: `Anthropogenic climate disruption represents one of the most pressing existential crises facing contemporary society. While many emphasize personal lifestyle adjustments, an increasing consensus argues that governments and major corporations must bear the foremost responsibility for emissions reduction. I strongly concur with this position, as macroscopic legislative and industrial transformations possess far greater efficacy than fragmented individual actions.

To begin with, multinational corporations and energy conglomerates account for the overwhelming majority of global greenhouse gas emissions. Heavy industries, industrial agriculture, and fossil fuel extractors drive systemic environmental degradation on a scale that dwarfed domestic consumer choices. Without binding environmental regulations, profit-maximizing enterprises have negligible financial incentive to adopt sustainable practices. For instance, carbon pricing mechanisms and mandated clean-energy subsidies can instantly decarbonize entire electrical grids, achieving reductions that individual conservation could never match.

Furthermore, state governments uniquely possess the legislative authority and capital resources necessary to build sustainable infrastructure. Individuals cannot independently construct high-speed electrified railway networks, re-engineer national power grids, or subsidize large-scale offshore wind farms. Only governments can enforce stringent emissions standards on vehicle manufacturers, ban non-recyclable packaging, and subsidize green retrofits for residential architecture. In addition, municipal authorities must finance green public transit, institute strict zoning laws to curb urban sprawl, and enforce strict industrial pollution penalties. While individual mindfulness is commendable, civic virtue alone cannot compensate for the absence of institutional clean-energy infrastructure.

In conclusion, while citizens should cultivate responsible consumption habits and minimize domestic waste, systemic decarbonization fundamentally necessitates corporate compliance and aggressive governmental leadership. Therefore, governments and commercial enterprises must assume the central burden of climate mitigation.`
      }
    }
  },
  {
    id: "wr-c14-t4",
    title: "Cambridge Set 5: Grange Park Redevelopment & Technological Dependence",
    task1: {
      title: "Task 1: Map Comparison & Historical Transformation",
      timeSuggestedMinutes: 20,
      minWords: 150,
      image: "/images/grange_park_map.png",
      prompt: `The plans below show Grange Park when it opened in 1920 and today.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

Write at least 150 words.`,
      modelBand8: {
        band: "Band 8.0 Model Report",
        text: `The two plans depict the architectural alterations that have taken place in Grange Park from its inaugural layout in 1920 to its present-day configuration.

Overall, the park has been extensively modernized with an emphasis on interactive recreation and entertainment facilities, replacing traditional ornamental gardens while adding a new southern entrance.

In 1920, Grange Park had two entrances situated along Arnold Avenue in the north and Eldon Street in the south. The central area was dominated by a large ornamental fountain, flanked by a stage for musicians to the west and a glasshouse along the southeastern edge. Rose gardens surrounded by seating occupied both the northwest and southwest quadrants.

In the contemporary layout, the central fountain has been replaced by a square rose garden with perimeter seating. The musician stage on the western side has been converted into an expansive amphitheatre for concerts. Furthermore, the glasshouse in the southeast has made way for a children's play area with adjacent water features, while the underground entrance in the south-east now provides direct access to an expansive cafe.`
      }
    },
    task2: {
      title: "Task 2: Academic Discursive Essay",
      timeSuggestedMinutes: 40,
      minWords: 250,
      prompt: `Nowadays, many people rely on technology such as computers and smartphones to perform everyday tasks. Some believe this makes people less creative and independent.

To what extent do you agree or disagree?

Write at least 250 words.`,
      modelBand85: {
        band: "Band 8.5 Model Essay",
        text: `The omnipresence of computing devices and automated algorithms in modern life has elicited widespread skepticism regarding human self-reliance. While critics contend that ubiquitous digital tools degrade our creative faculties and render us helplessly dependent, I disagree with this pessimistic assessment. Instead, modern technology serves as a powerful cognitive amplifier that liberates individuals from repetitive drudgery and unlocks unprecedented creative frontiers.

Admittedly, extreme reliance on automated navigation systems and memory aids can diminish basic navigational instincts and mental arithmetic skills. When individuals depend entirely on GPS to traverse familiar cities or automated spelling checkers to compose basic prose, certain routine cognitive muscles may atrophy. Nonetheless, mistaking algorithmic assistance for a decline in innate human intelligence overlooks the fundamental evolution of cognitive tools across human history.

Crucially, rather than stifling creativity, digital technology democratizes and amplifies it. Complex tasks that formerly required multimillion-dollar production facilities—such as digital graphic design, cinematographic editing, and orchestral music composition—are now universally accessible on a handheld tablet. Independent artists, programmers, and authors can synthesize ideas and share novel concepts with global audiences instantly. By automating logistical friction, technological tools enable creators to concentrate on visionary concepts rather than administrative burdens.

Furthermore, digital connectivity enhances autonomy rather than diminishes it. With smartphones and cloud infrastructure, individuals can operate international enterprises independently from remote locations, access worldwide research repositories, and teach themselves sophisticated disciplines without institutional gatekeepers.

In conclusion, rather than inducing cognitive helplessness, digital technology fundamentally expands creative expression and empowers personal autonomy on an unprecedented scale. Indeed, human ingenuity has always flourished by building upon prior innovations, and our contemporary digital ecosystem is simply the latest, most empowering manifestation of that enduring journey.`
      }
    }
  }
];

/**
 * Returns the next randomized writing task from the unattempted primary pool.
 * If all tasks have been attempted by the user, the second pool (attempted)
 * cycles back to become the primary pool from where randomness begins again.
 */
export function getNextWritingTask(currentId = null) {
  const attemptedIds = getAttemptedQuestionSets('writing');

  // Primary Pool: Unattempted question sets
  let unattemptedPool = WRITING_TASK_POOLS.filter(t => !attemptedIds.includes(t.id));
  let isCycleReset = false;

  // If the user has attempted all tasks in the primary pool,
  // the second pool (attempted) becomes the primary pool from where randomness restarts
  if (unattemptedPool.length === 0) {
    clearAttemptedQuestionSets('writing');
    unattemptedPool = [...WRITING_TASK_POOLS];
    isCycleReset = true;
  }

  // If more than 1 option available, prevent immediately repeating currentId
  let candidates = unattemptedPool;
  if (currentId && candidates.length > 1) {
    candidates = candidates.filter(t => t.id !== currentId);
  }

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const selectedTask = candidates[randomIndex];

  return {
    task: selectedTask,
    poolInfo: {
      attemptedCount: isCycleReset ? 0 : attemptedIds.length,
      totalCount: WRITING_TASK_POOLS.length,
      remainingInPool: unattemptedPool.length,
      isCycleReset
    }
  };
}

export function getRandomWritingTask(currentId = null) {
  return getNextWritingTask(currentId).task;
}
