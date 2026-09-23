// dMAT General Academic Module (Full Repository)
// Aligned with g.a.s.t. PDF (Pages 33-58) & Careerwise official curriculum.
// Each passage contains 6 to 7 questions, reflecting the real examination standard.

export function getAcademicModulePassages() {
  return [
    {
      id: 'ac-vectors',
      field: 'Engineering & Applied Mathematics',
      title: 'Vector Calculations in 3D Space',
      text: `An engineering team describes displacements using three-dimensional vectors. A vector has three components; a scalar is a single number. Components are added or subtracted separately. Multiplication by a scalar multiplies every component by that scalar.

For a = (a₁, a₂, a₃), its Euclidean length is |a| = √(a₁² + a₂² + a₃²).
The scalar (dot) product is a · b = a₁b₁ + a₂b₂ + a₃b₃ = |a||b| cos θ. Two nonzero vectors with zero dot product are perpendicular (orthogonal).

The vector (cross) product is a × b = (a₂b₃ − a₃b₂, a₃b₁ − a₁b₃, a₁b₂ − a₂b₁). Its length equals the area of the parallelogram spanned by a and b.
The absolute scalar triple product |(a × b) · c| equals the volume of the parallelepiped spanned by the three vectors.

Use the following displacements throughout this task (all components in metres):
Vector a = (6, 8, 0)
Vector b = (0, 0, 2)
Vector c = (1, 0, 0)`,
      table: {
        headers: ['Vector', 'Components (x, y, z)', 'Length |v|', 'Geometric Interpretation'],
        rows: [
          ['a', '(6, 8, 0) m', '10 m', 'Displacement in XY plane'],
          ['b', '(0, 0, 2) m', '2 m', 'Vertical displacement along Z axis'],
          ['c', '(1, 0, 0) m', '1 m', 'Unit displacement along X axis']
        ]
      },
      questions: [
        {
          id: 'vec-q1',
          prompt: 'What is the sum vector a + b?',
          options: [
            { label: 'A', text: '(6, 8, 2) m' },
            { label: 'B', text: '(6, 8, 0) m' },
            { label: 'C', text: '(6, 8, -2) m' },
            { label: 'D', text: '(8, 10, 2) m' }
          ],
          correctAnswer: 'A',
          explanation: 'Add corresponding components: (6+0, 8+0, 0+2) = (6, 8, 2) m.'
        },
        {
          id: 'vec-q2',
          prompt: 'What is the difference vector a − b?',
          options: [
            { label: 'A', text: '(6, 8, -2) m' },
            { label: 'B', text: '(6, 8, 2) m' },
            { label: 'C', text: '(6, 8, 0) m' },
            { label: 'D', text: '(-6, -8, 2) m' }
          ],
          correctAnswer: 'A',
          explanation: 'Subtract corresponding components: (6-0, 8-0, 0-2) = (6, 8, -2) m.'
        },
        {
          id: 'vec-q3',
          prompt: 'What is the resultant vector of 2a − b?',
          options: [
            { label: 'A', text: '(12, 16, -2) m' },
            { label: 'B', text: '(12, 16, 2) m' },
            { label: 'C', text: '(6, 8, -2) m' },
            { label: 'D', text: '(12, 16, -4) m' }
          ],
          correctAnswer: 'A',
          explanation: 'First double vector a: (12, 16, 0). Then subtract b (0, 0, 2) = (12, 16, -2) m.'
        },
        {
          id: 'vec-q4',
          prompt: 'What is the Euclidean length (magnitude) of vector a?',
          options: [
            { label: 'A', text: '10 m' },
            { label: 'B', text: '14 m' },
            { label: 'C', text: '100 m' },
            { label: 'D', text: '48 m' }
          ],
          correctAnswer: 'A',
          explanation: '|a| = √(6² + 8² + 0²) = √(36 + 64) = √100 = 10 m.'
        },
        {
          id: 'vec-q5',
          prompt: 'What is the scalar (dot) product a · c?',
          options: [
            { label: 'A', text: '6' },
            { label: 'B', text: '8' },
            { label: 'C', text: '0' },
            { label: 'D', text: '10' }
          ],
          correctAnswer: 'A',
          explanation: 'a · c = (6 × 1) + (8 × 0) + (0 × 0) = 6 + 0 + 0 = 6.'
        },
        {
          id: 'vec-q6',
          prompt: 'What is the angle θ between vectors a and b?',
          options: [
            { label: 'A', text: '90°' },
            { label: 'B', text: '0°' },
            { label: 'C', text: '45°' },
            { label: 'D', text: '180°' }
          ],
          correctAnswer: 'A',
          explanation: 'a · b = (6×0) + (8×0) + (0×2) = 0. Since both vectors have non-zero magnitude, cos θ = 0 ⟹ θ = 90° (perpendicular).'
        },
        {
          id: 'vec-q7',
          prompt: 'What is the volume of the parallelepiped spanned by vectors a, b, and c?',
          options: [
            { label: 'A', text: '16 m³' },
            { label: 'B', text: '12 m³' },
            { label: 'C', text: '20 m³' },
            { label: 'D', text: '0 m³' }
          ],
          correctAnswer: 'A',
          explanation: 'The cross product a × b = (8×2 − 0, 0 − 6×2, 6×0 − 8×0) = (16, -12, 0). Its dot product with c = (1, 0, 0) is 16×1 + (-12)×0 + 0×0 = 16. Volume = |16| = 16 m³.'
        }
      ]
    },
    {
      id: 'ac-hydrostatics',
      field: 'Mechanical & Marine Engineering',
      title: 'Hydrostatics and Fluid Equilibrium',
      text: `A marine engineering team studies a tank, a submerged telemetry instrument, and a floating calibration block. Treat water as incompressible with density ρ = 1,000 kg/m³ and acceleration due to gravity g = 10 m/s². Surface atmospheric pressure is approximated as p₀ = 100,000 Pa = 1 bar.

At vertical depth h below the surface, absolute pressure is p = p₀ + ρgh. Gauge pressure is p − p₀. Pressure acts equally in every direction and depends only on depth and fluid density, rather than the vessel's shape or volume. Water gauge pressure increases by approximately 1 bar per 10 metres of depth.

The upward buoyant force equals the weight of displaced fluid: Fᵦ = ρgV, where V is the submerged volume. A body in equilibrium without tethering has buoyancy equal to its weight W = mg. An object less dense than water floats partly submerged; its submerged volume fraction equals its density divided by fluid density (ρ_body / ρ_fluid).`,
      table: {
        headers: ['Component', 'Depth / Parameter', 'Volume / Density', 'Condition'],
        rows: [
          ['Submerged Instrument', 'Depth h = 30 m', 'Volume V = 2 m³', 'Neutrally buoyant (suspended)'],
          ['Floating Calibration Block', 'Surface interface', 'Density ρ = 600 kg/m³', 'Partially submerged float'],
          ['Fluid Reservoir', 'Atmospheric p₀ = 1 bar', 'Density ρ = 1,000 kg/m³', 'Incompressible water']
        ]
      },
      questions: [
        {
          id: 'hyd-q1',
          prompt: 'What is the gauge pressure at the instrument depth of 30 m?',
          options: [
            { label: 'A', text: '3 bar' },
            { label: 'B', text: '4 bar' },
            { label: 'C', text: '30 bar' },
            { label: 'D', text: '3.5 bar' }
          ],
          correctAnswer: 'A',
          explanation: 'Gauge pressure = ρgh = 1,000 × 10 × 30 = 300,000 Pa = 3 bar. (Gauge pressure excludes atmospheric pressure).'
        },
        {
          id: 'hyd-q2',
          prompt: 'What is the absolute pressure acting on the instrument at 30 m?',
          options: [
            { label: 'A', text: '4 bar' },
            { label: 'B', text: '3 bar' },
            { label: 'C', text: '5 bar' },
            { label: 'D', text: '40 bar' }
          ],
          correctAnswer: 'A',
          explanation: 'Absolute pressure = p₀ + gauge pressure = 1 bar + 3 bar = 4 bar.'
        },
        {
          id: 'hyd-q3',
          prompt: 'Two points at depth 30 m lie in differently shaped vessels with equal surface pressure. How do their pressures compare?',
          options: [
            { label: 'A', text: 'Their pressures are exactly equal.' },
            { label: 'B', text: 'The narrower vessel has greater pressure.' },
            { label: 'C', text: 'The wider vessel has greater pressure.' },
            { label: 'D', text: 'The vessel with greater total volume has higher pressure.' }
          ],
          correctAnswer: 'A',
          explanation: 'Under p = p₀ + ρgh, hydrostatic pressure depends exclusively on surface pressure p₀, density ρ, gravity g, and depth h. Vessel shape and total fluid volume do not affect pressure at a given depth.'
        },
        {
          id: 'hyd-q4',
          prompt: 'What is the mass of the neutrally buoyant instrument (Volume = 2 m³)?',
          options: [
            { label: 'A', text: '2,000 kg' },
            { label: 'B', text: '200 kg' },
            { label: 'C', text: '20,000 kg' },
            { label: 'D', text: '1,000 kg' }
          ],
          correctAnswer: 'A',
          explanation: 'For neutral buoyancy in equilibrium: mg = ρgV ⟹ m = ρV = 1,000 kg/m³ × 2 m³ = 2,000 kg.'
        },
        {
          id: 'hyd-q5',
          prompt: 'What is the total buoyant force acting on the fully submerged 2 m³ instrument?',
          options: [
            { label: 'A', text: '20 kN' },
            { label: 'B', text: '2 kN' },
            { label: 'C', text: '200 kN' },
            { label: 'D', text: '10 kN' }
          ],
          correctAnswer: 'A',
          explanation: 'Fᵦ = ρgV = 1,000 × 10 × 2 = 20,000 N = 20 kN.'
        },
        {
          id: 'hyd-q6',
          prompt: 'What fraction of the floating block (density 600 kg/m³) is submerged below the water surface?',
          options: [
            { label: 'A', text: '60%' },
            { label: 'B', text: '40%' },
            { label: 'C', text: '6%' },
            { label: 'D', text: '100%' }
          ],
          correctAnswer: 'A',
          explanation: 'Submerged fraction = ρ_block / ρ_water = 600 / 1,000 = 0.60 = 60%.'
        },
        {
          id: 'hyd-q7',
          prompt: 'An object with density 1,200 kg/m³ is released at rest midway in the tank without tethering. What occurs?',
          options: [
            { label: 'A', text: 'It sinks to the bottom because downward gravitational force exceeds buoyant force.' },
            { label: 'B', text: 'It remains suspended in neutral equilibrium.' },
            { label: 'C', text: 'It accelerates upward toward the surface.' },
            { label: 'D', text: 'It dissolves instantaneously due to hydrostatic pressure.' }
          ],
          correctAnswer: 'A',
          explanation: 'Gravitational force W = ρ_obj · g · V = 1,200 · g · V. Maximum buoyant force Fᵦ = 1,000 · g · V. Since W > Fᵦ, the net force is downwards and the object sinks.'
        }
      ]
    },
    {
      id: 'ac-eoq',
      field: 'Industrial Economics & Operations Research',
      title: 'Optimal Order Quantity (EOQ Inventory Model)',
      text: `A distributor must determine how many units (Q) to purchase in each procurement cycle. Annual demand D is known, constant, and spread evenly across the 360-day business year. Each delivery arrives instantaneously when stock reaches zero, meaning inventory decreases linearly from batch size Q to zero, yielding an average inventory of Q / 2.

Every order incurs a fixed setup/ordering cost S independent of order size. An annual holding cost H applies to each unit of average inventory (covering warehousing, insurance, and capital cost). Unit purchase price P is constant and independent of quantity.

Relevant Cost Equations:
• Annual Ordering Cost = (D / Q) × S
• Annual Holding Cost = (Q / 2) × H
• Total Relevant Annual Cost C(Q) = (D × S / Q) + (H × Q / 2)
• Optimal Order Quantity Q* = √(2DS / H)

Purchase cost (D × P) is excluded from C(Q) because it is invariant to batch size Q. At the optimal batch size Q*, annual ordering costs exactly equal annual holding costs.`,
      table: {
        headers: ['Input Parameter', 'Symbol', 'Given Value'],
        rows: [
          ['Annual Demand', 'D', '10,000 units / year'],
          ['Fixed Order Cost', 'S', '$50 per order'],
          ['Annual Unit Holding Cost', 'H', '$4 per unit / year'],
          ['Unit Purchase Price', 'P', '$25 per unit']
        ]
      },
      questions: [
        {
          id: 'eoq-q1',
          prompt: 'What is the optimal order quantity Q* under the given parameters?',
          options: [
            { label: 'A', text: '500 units' },
            { label: 'B', text: '250 units' },
            { label: 'C', text: '1,000 units' },
            { label: 'D', text: '2,000 units' }
          ],
          correctAnswer: 'A',
          explanation: 'Q* = √(2DS / H) = √(2 × 10,000 × 50 / 4) = √(1,000,000 / 4) = √250,000 = 500 units.'
        },
        {
          id: 'eoq-q2',
          prompt: 'What is the average inventory level maintained throughout the year when ordering Q*?',
          options: [
            { label: 'A', text: '250 units' },
            { label: 'B', text: '500 units' },
            { label: 'C', text: '1,000 units' },
            { label: 'D', text: '125 units' }
          ],
          correctAnswer: 'A',
          explanation: 'Average inventory = Q* / 2 = 500 / 2 = 250 units.'
        },
        {
          id: 'eoq-q3',
          prompt: 'How many orders per year does the distributor place when operating at Q*?',
          options: [
            { label: 'A', text: '20 orders' },
            { label: 'B', text: '10 orders' },
            { label: 'C', text: '40 orders' },
            { label: 'D', text: '50 orders' }
          ],
          correctAnswer: 'A',
          explanation: 'Orders per year = D / Q* = 10,000 / 500 = 20 orders.'
        },
        {
          id: 'eoq-q4',
          prompt: 'What is the total annual holding cost incurred at Q*?',
          options: [
            { label: 'A', text: '$1,000' },
            { label: 'B', text: '$500' },
            { label: 'C', text: '$2,000' },
            { label: 'D', text: '$250' }
          ],
          correctAnswer: 'A',
          explanation: 'Holding Cost = (Q* / 2) × H = 250 units × $4/unit = $1,000.'
        },
        {
          id: 'eoq-q5',
          prompt: 'What is the total annual ordering cost incurred at Q*?',
          options: [
            { label: 'A', text: '$1,000' },
            { label: 'B', text: '$500' },
            { label: 'C', text: '$2,500' },
            { label: 'D', text: '$50' }
          ],
          correctAnswer: 'A',
          explanation: 'Ordering Cost = (D / Q*) × S = 20 orders × $50/order = $1,000.'
        },
        {
          id: 'eoq-q6',
          prompt: 'At the optimal batch quantity Q*, what fundamental relationship exists between ordering and holding costs?',
          options: [
            { label: 'A', text: 'Annual ordering costs exactly equal annual holding costs.' },
            { label: 'B', text: 'Holding costs are strictly double ordering costs.' },
            { label: 'C', text: 'Ordering costs are strictly double holding costs.' },
            { label: 'D', text: 'Their sum equals total annual purchase spend.' }
          ],
          correctAnswer: 'A',
          explanation: 'The mathematical minimum of C(Q) occurs precisely where the derivative equals zero, which equates annual ordering cost (DS/Q) to annual holding cost (HQ/2).'
        },
        {
          id: 'eoq-q7',
          prompt: 'Why is the annual purchase spend (D × P = $250,000) excluded from the cost-minimization function C(Q)?',
          options: [
            { label: 'A', text: 'Because constant annual demand D and fixed price P make purchase spend independent of batch size Q.' },
            { label: 'B', text: 'Because purchase price is reimbursed by logistics suppliers.' },
            { label: 'C', text: 'Because annual purchase cost is always negligible compared to warehousing.' },
            { label: 'D', text: 'Because purchase expenses occur only once every decade.' }
          ],
          correctAnswer: 'A',
          explanation: 'D × P is a constant with respect to decision variable Q (derivative d(DP)/dQ = 0). It shifts total expenditure upwards by a fixed sum without altering the location of minimum Q*.'
        }
      ]
    },
    {
      id: 'ac-research',
      field: 'Research Methodology & Empirical Science',
      title: 'Quantitative vs Qualitative Empirical Research Designs',
      text: `A university consortium investigates workforce adaptation to automation. In empirical research, a causal relationship examines whether a factor directly alters an outcome; a causal mechanism concerns the explanatory process connecting them. An observed statistical association alone does not establish causation.

A quantitative strategy tests predefined hypotheses using standardized instruments and large sample statistical modeling. While adequate sample sizing reduces random sampling error, large samples cannot eliminate systematic selection bias or establish causality in observational data without identification strategies.

A qualitative strategy examines small, purposeful samples in depth to understand contextual mechanisms, participant rationale, and complex workflows. Such studies generate rich theory but cannot statistically infer population prevalence. Both methodologies require rigorous documentation to prevent researcher confirmation bias.`,
      table: {
        headers: ['Study Design', 'Sample Size (N)', 'Methodology', 'Key Objective'],
        rows: [
          ['Study A', 'N = 2,400', 'Standardized cross-sectional survey', 'Testing hypothesized correlation with regression'],
          ['Study B', 'N = 14', 'In-depth semi-structured longitudinal interviews', 'Unpacking decision-making mechanisms & perceptions']
        ]
      },
      questions: [
        {
          id: 'res-q1',
          prompt: 'Which description best characterizes the core objective of Study A?',
          options: [
            { label: 'A', text: 'A quantitative study testing a predefined relationship across standardized metrics.' },
            { label: 'B', text: 'A qualitative ethnographic inquiry focused on narrative theory.' },
            { label: 'C', text: 'A randomized controlled laboratory experiment with group control.' },
            { label: 'D', text: 'A bibliographic literature review with secondary citations.' }
          ],
          correctAnswer: 'A',
          explanation: 'Study A utilizes N = 2,400 survey responses to test hypothesized relationships using standardized statistical modeling, defining a quantitative design.'
        },
        {
          id: 'res-q2',
          prompt: 'Which research goal is most effectively addressed by Study B (N = 14 in-depth interviews)?',
          options: [
            { label: 'A', text: 'Explaining the nuanced psychological process and mechanisms experienced by workers.' },
            { label: 'B', text: 'Estimating the precise national statistical percentage of automated workers.' },
            { label: 'C', text: 'Demonstrating that every single company exhibits identical adoption rates.' },
            { label: 'D', text: 'Proving statistical causality through random assignment.' }
          ],
          correctAnswer: 'A',
          explanation: 'Qualitative designs with small purposeful samples are optimized for unpacking "how" and "why" mechanisms, not estimating broad population prevalence.'
        },
        {
          id: 'res-q3',
          prompt: 'Study A identifies a strong positive correlation (r = 0.68, p < 0.001). Which deduction is scientifically valid from this result alone?',
          options: [
            { label: 'A', text: 'The measured variables are correlated, but direct causation cannot be claimed without ruling out confounders.' },
            { label: 'B', text: 'The independent variable definitely caused the outcome directly.' },
            { label: 'C', text: 'Selection bias is mathematically impossible because sample size exceeds 2,000.' },
            { label: 'D', text: 'The result proves identical outcomes will occur in every international country.' }
          ],
          correctAnswer: 'A',
          explanation: 'Correlation does not imply causation. In observational cross-sectional studies, unmeasured third-variable confounding or reverse causality can produce strong correlations without a causal link.'
        },
        {
          id: 'res-q4',
          prompt: 'Why cannot an extremely large sample size (e.g. N = 100,000) rectify systematic selection bias?',
          options: [
            { label: 'A', text: 'Because if the sampling frame systematically excludes certain demographics, collecting more cases only replicates the bias with greater statistical confidence.' },
            { label: 'B', text: 'Because large samples violate the central limit theorem.' },
            { label: 'C', text: 'Because quantitative statistical tests fail when sample sizes exceed 5,000.' },
            { label: 'D', text: 'Because p-values become non-computable in big data samples.' }
          ],
          correctAnswer: 'A',
          explanation: 'Sample size reduces random sampling variance, but systematic bias (non-random missingness or skewed participation) is unaffected by N and persists regardless of volume.'
        },
        {
          id: 'res-q5',
          prompt: 'What is the primary role of qualitative research in mixed-method multi-stage research programs?',
          options: [
            { label: 'A', text: 'Generating inductive hypotheses and identifying operational mechanisms to inform subsequent quantitative scales.' },
            { label: 'B', text: 'Replacing statistical significance testing entirely.' },
            { label: 'C', text: 'Guaranteeing zero standard error across clinical trials.' },
            { label: 'D', text: 'Converting non-parametric distributions into Gaussian normal curves.' }
          ],
          correctAnswer: 'A',
          explanation: 'Qualitative exploratory fieldwork uncovers variables, perspectives, and real-world mechanisms that serve as the theoretical foundation for subsequent quantitative hypothesis testing.'
        },
        {
          id: 'res-q6',
          prompt: 'Why do both quantitative and qualitative research protocols require explicit documentation of methodology changes?',
          options: [
            { label: 'A', text: 'Because altering measurement tools or interview protocols impacts consistency and comparability across data.' },
            { label: 'B', text: 'Because qualitative data automatically becomes quantitative without written records.' },
            { label: 'C', text: 'Because peer review journals reject papers containing fewer than 100 pages of appendices.' },
            { label: 'D', text: 'Because documentation guarantees a statistically significant finding.' }
          ],
          correctAnswer: 'A',
          explanation: 'Methodological transparency is essential for auditability, construct validity, and comparability across research phases.'
        }
      ]
    },
    {
      id: 'ac-circuits',
      field: 'Electrical Engineering & Physics',
      title: 'Series and Parallel Connections of Ohmic Resistors (Official PDF Module)',
      text: `Ohmic resistors in direct current circuits can be connected in series, in parallel, or in mixed network topologies. 

Series Connections:
When n resistors R₁, R₂, ..., Rₙ are connected in series, the identical electric current I flows sequentially through all elements. The total equivalent resistance R_tot is the direct algebraic sum of the individual resistances:
R_tot = R₁ + R₂ + ... + Rₙ
The voltage drop across any individual resistor R_k is directly proportional to its resistance: U_k = I × R_k.

Parallel Connections:
When resistors are connected in parallel, the same electric potential difference (voltage) U is applied across the terminals of all branches. The reciprocal of total equivalent resistance equals the sum of branch reciprocals:
1 / R_tot = (1 / R₁) + (1 / R₂) + ... + (1 / Rₙ)
For two resistors in parallel: R_tot = (R₁ × R₂) / (R₁ + R₂).
If n identical resistors each having resistance R are connected in parallel: R_tot = R / n.
Branch current I_k = U / R_k is inversely proportional to resistance.`,
      table: {
        headers: ['Circuit Configuration', 'Resistor Values', 'Supply Voltage', 'Measured Parameter'],
        rows: [
          ['Circuit 1 (Series)', 'R₁ = 400 Ω, R₂ = 600 Ω', 'U_AB = 100 V', 'Total equivalent resistance R_tot'],
          ['Circuit 2 (Parallel)', 'R₁ = 300 Ω, R₂ = 300 Ω', 'U_AB = 60 V', 'Total equivalent resistance R_tot'],
          ['Circuit 3 (Parallel Identical)', '4 identical resistors, R = 1,200 Ω each', 'U_AB = 24 V', 'Equivalent resistance R_tot'],
          ['Circuit 4 (Voltage Divider)', 'R₁ = 340 Ω, R₂ = 660 Ω (in series)', 'U_AB = 1,000 V', 'Voltage drop across R₁']
        ]
      },
      questions: [
        {
          id: 'cir-q1',
          prompt: 'In Circuit 1, what is the total equivalent resistance between terminals A and B (R₁ = 400 Ω, R₂ = 600 Ω in series)?',
          options: [
            { label: 'A', text: '1,000 Ω' },
            { label: 'B', text: '240 Ω' },
            { label: 'C', text: '200 Ω' },
            { label: 'D', text: '500 Ω' }
          ],
          correctAnswer: 'A',
          explanation: 'In a series circuit, resistances add directly: R_tot = R₁ + R₂ = 400 Ω + 600 Ω = 1,000 Ω.'
        },
        {
          id: 'cir-q2',
          prompt: 'In Circuit 2, what is the equivalent resistance of two 300 Ω resistors connected in parallel?',
          options: [
            { label: 'A', text: '150 Ω' },
            { label: 'B', text: '600 Ω' },
            { label: 'C', text: '300 Ω' },
            { label: 'D', text: '75 Ω' }
          ],
          correctAnswer: 'A',
          explanation: 'For two identical resistors in parallel: R_tot = R / 2 = 300 / 2 = 150 Ω. Or (300 × 300) / (300 + 300) = 90,000 / 600 = 150 Ω.'
        },
        {
          id: 'cir-q3',
          prompt: 'In Circuit 3, what is the equivalent resistance of four identical 1,200 Ω resistors connected in parallel?',
          options: [
            { label: 'A', text: '300 Ω' },
            { label: 'B', text: '4,800 Ω' },
            { label: 'C', text: '600 Ω' },
            { label: 'D', text: '150 Ω' }
          ],
          correctAnswer: 'A',
          explanation: 'Using R_tot = R / n: R_tot = 1,200 Ω / 4 = 300 Ω.'
        },
        {
          id: 'cir-q4',
          prompt: 'In Circuit 4, a total voltage U_AB = 1,000 V is applied across series resistors R₁ = 340 Ω and R₂ = 660 Ω. What is the voltage drop U₁ across R₁?',
          options: [
            { label: 'A', text: '340 V' },
            { label: 'B', text: '660 V' },
            { label: 'C', text: '500 V' },
            { label: 'D', text: '170 V' }
          ],
          correctAnswer: 'A',
          explanation: 'Total resistance R_tot = 340 + 660 = 1,000 Ω. Current I = U / R_tot = 1,000 V / 1,000 Ω = 1 A. Voltage U₁ = I × R₁ = 1 A × 340 Ω = 340 V.'
        },
        {
          id: 'cir-q5',
          prompt: 'If one resistor in a parallel network of three resistors burns out (becomes an open circuit), what happens to the total equivalent resistance?',
          options: [
            { label: 'A', text: 'Total resistance increases.' },
            { label: 'B', text: 'Total resistance decreases.' },
            { label: 'C', text: 'Total resistance remains unchanged.' },
            { label: 'D', text: 'Total resistance immediately drops to zero.' }
          ],
          correctAnswer: 'A',
          explanation: 'Removing a parallel conduction path reduces the total conductance (1/R_tot decreases), which means equivalent resistance R_tot increases.'
        },
        {
          id: 'cir-q6',
          prompt: 'If two resistors R_A = 20 Ω and R_B = 80 Ω are connected in parallel to a 12 V battery, which resistor dissipates more electrical power (P = U² / R)?',
          options: [
            { label: 'A', text: 'Resistor R_A (20 Ω) dissipates 4 times as much power.' },
            { label: 'B', text: 'Resistor R_B (80 Ω) dissipates 4 times as much power.' },
            { label: 'C', text: 'Both resistors dissipate identical power because voltage is equal.' },
            { label: 'D', text: 'Power cannot be calculated without circuit inductance.' }
          ],
          correctAnswer: 'A',
          explanation: 'In parallel, both receive 12 V. Power P = U² / R. For R_A: 144 / 20 = 7.2 W. For R_B: 144 / 80 = 1.8 W. 7.2 W / 1.8 W = 4 times.'
        },
        {
          id: 'cir-q7',
          prompt: 'Two resistors R₁ and R₂ yield an equivalent resistance of 100 Ω in series and 24 Ω in parallel. What are the values of R₁ and R₂?',
          options: [
            { label: 'A', text: '40 Ω and 60 Ω' },
            { label: 'B', text: '30 Ω and 70 Ω' },
            { label: 'C', text: '20 Ω and 80 Ω' },
            { label: 'D', text: '50 Ω and 50 Ω' }
          ],
          correctAnswer: 'A',
          explanation: 'R₁ + R₂ = 100. (R₁ × R₂) / (R₁ + R₂) = 24 ⟹ R₁ × R₂ = 2,400. Factoring: 40 × 60 = 2,400 and 40 + 60 = 100.'
        }
      ]
    }
  ];
}
