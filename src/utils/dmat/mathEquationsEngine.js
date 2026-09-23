// Mathematical Equations Engine for dMAT
// Aligned with the official g.a.s.t. PDF (Exercises 1-6) and Careerwise dMAT curriculum.
// Variables: A, B, C, D (Integers between 1 and 20).
// Solved strictly through mental substitution (no scratchpad or calculators).

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateMathEquationTask(difficulty = 'medium') {
  if (difficulty === 'low') {
    return generateLowDifficultyTask();
  } else if (difficulty === 'high') {
    return generateHighDifficultyTask();
  }
  return generateMediumDifficultyTask();
}

// Low Difficulty: 2 to 3 equations with direct anchor values (like PDF Ex 1 & 2)
function generateLowDifficultyTask() {
  const variant = randInt(1, 3);

  if (variant === 1) {
    // PDF Ex 1 style: A + k = sum, B - diff = A
    const A = randInt(3, 9);
    const k = randInt(2, 8);
    const sum = A + k;
    const diff = randInt(2, 6);
    const B = A + diff;

    const equations = [
      `${k} + A = ${sum}`,
      `B - ${diff} = A`
    ];

    const target = 'B';
    const answer = B;
    const steps = [
      { text: `From equation (1): ${k} + A = ${sum} ⟹ A = ${sum} - ${k} = ${A}.` },
      { text: `Substitute A = ${A} into equation (2): B - ${diff} = ${A} ⟹ B = ${A} + ${diff} = ${B}.` }
    ];

    return {
      id: `me-low-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'math_equations',
      difficulty: 'low',
      equations,
      targetVariable: target,
      questionText: `Find the integer value of ${target}:`,
      correctAnswer: answer,
      options: generateOptions(answer, 1, 20),
      steps
    };
  }

  // PDF Ex 2 style: B = h * A, B + A = sum
  const A = randInt(2, 5);
  const h = randInt(2, 3);
  const B = h * A;
  const sum = B + A;
  const C = Math.min(20, Math.max(1, B + randInt(2, 5)));

  const equations = [
    `B = ${h} × A`,
    `B + A = ${sum}`,
    `C = B + ${C - B}`
  ];

  const target = 'C';
  const answer = C;
  const steps = [
    { text: `Substitute B = ${h}A into (2): ${h}A + A = ${sum} ⟹ ${h + 1}A = ${sum} ⟹ A = ${A}.` },
    { text: `Find B: B = ${h} × ${A} = ${B}.` },
    { text: `Solve C: C = ${B} + ${C - B} = ${C}.` }
  ];

  return {
    id: `me-low-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type: 'math_equations',
    difficulty: 'low',
    equations,
    targetVariable: target,
    questionText: `Find the integer value of ${target}:`,
    correctAnswer: answer,
    options: generateOptions(answer, 1, 20),
    steps
  };
}

// Medium Difficulty: 3 to 4 equations with 1-2 step substitution chains (like PDF Ex 3 & 4)
function generateMediumDifficultyTask() {
  const variant = randInt(1, 3);

  if (variant === 1) {
    // PDF Ex 4 style: 18 - B = A, 3 * A = C, C - D = k
    const B = randInt(2, 8);
    const sum = randInt(14, 18);
    const A = sum - B; // 6 to 14
    const mult = randInt(1, 2);
    const C = Math.min(20, mult * A);
    const diff = randInt(2, 5);
    const D = Math.max(1, C - diff);

    const equations = [
      `${sum} - B = A`,
      `${mult > 1 ? `${mult} × A` : 'A'} = C`,
      `C - D = ${C - D}`,
      `B = ${B}`
    ];

    const target = 'D';
    const answer = D;
    const steps = [
      { text: `Given B = ${B}, substitute into (1): ${sum} - ${B} = A ⟹ A = ${A}.` },
      { text: `From equation (2): C = ${mult > 1 ? `${mult} × ${A}` : A} = ${C}.` },
      { text: `From equation (3): ${C} - D = ${C - D} ⟹ D = ${C} - ${C - D} = ${D}.` }
    ];

    return {
      id: `me-med-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'math_equations',
      difficulty: 'medium',
      equations,
      targetVariable: target,
      questionText: `Find the integer value of ${target}:`,
      correctAnswer: answer,
      options: generateOptions(answer, 1, 20),
      steps
    };
  }

  // Careerwise template: B = h*A, C = B + x, D = C - k, A + B + C + D = w
  const A = randInt(2, 4);
  const h = randInt(2, 3);
  const B = h * A;
  const x = randInt(2, 4);
  const C = B + x;
  const k = randInt(1, 3);
  const D = Math.max(1, C - k);
  const total = A + B + C + D;

  const equations = [
    `B = ${h} × A`,
    `C = B + ${x}`,
    `D = C - ${k}`,
    `A + B + C + D = ${total}`
  ];

  const target = 'D';
  const answer = D;
  const steps = [
    { text: `Express B, C, D in terms of A: B = ${h}A, C = ${h}A + ${x}, D = ${h}A + ${x - k}.` },
    { text: `Substitute into total sum: A + ${h}A + (${h}A + ${x}) + (${h}A + ${x - k}) = ${total}.` },
    { text: `Simplifying gives ${1 + 3 * h}A + ${2 * x - k} = ${total} ⟹ A = ${A}.` },
    { text: `Solve for D: D = ${h}(${A}) + ${x - k} = ${D}.` }
  ];

  return {
    id: `me-med-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type: 'math_equations',
    difficulty: 'medium',
    equations,
    targetVariable: target,
    questionText: `Find the integer value of ${target}:`,
    correctAnswer: answer,
    options: generateOptions(answer, 1, 20),
    steps
  };
}

// High Difficulty: 4 linked equations with multi-term signs & coefficients (like PDF Ex 5 & 6)
function generateHighDifficultyTask() {
  const variant = randInt(1, 2);

  if (variant === 1) {
    // Official PDF Ex 5 style: A - B + C - D = w, h * B = C, m * B = A, g + B = D
    const B = randInt(2, 4);
    const h = randInt(3, 4);
    const m = randInt(2, 3);
    const g = randInt(2, 5);

    const A = m * B;
    const C = h * B;
    const D = g + B;
    const w = A - B + C - D;

    const equations = [
      `A - B + C - D = ${w}`,
      `${h} × B = C`,
      `${m} × B = A`,
      `${g} + B = D`
    ];

    const target = 'D';
    const answer = D;
    const steps = [
      { text: `Express A, C, D in terms of B: A = ${m}B, C = ${h}B, D = B + ${g}.` },
      { text: `Substitute into first equation: (${m}B) - B + (${h}B) - (B + ${g}) = ${w}.` },
      { text: `Simplifying: ${m - 1 + h - 1}B - ${g} = ${w} ⟹ ${m + h - 2}B = ${w + g} ⟹ B = ${B}.` },
      { text: `Calculate D: D = ${g} + ${B} = ${D}.` }
    ];

    return {
      id: `me-high-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'math_equations',
      difficulty: 'high',
      equations,
      targetVariable: target,
      questionText: `Find the integer value of ${target}:`,
      correctAnswer: answer,
      options: generateOptions(answer, 1, 20),
      steps
    };
  }

  // Official PDF Ex 6 style: C + D - A = T, h * C = D, b - C = A, g * C - j = B
  const C = randInt(2, 4);
  const h = randInt(2, 3);
  const D = h * C;
  const A = randInt(2, 7);
  const b = A + C;
  const g = randInt(2, 3);
  const B = randInt(2, 8);
  const j = g * C - B;
  const T = C + D - A;

  const equations = [
    `C + D - A = ${T}`,
    `${h} × C = D`,
    `${b} - C = A`,
    `${g} × C - ${j} = B`
  ];

  const target = 'B';
  const answer = B;
  const steps = [
    { text: `Substitute D = ${h}C and A = ${b} - C into the first equation: C + ${h}C - (${b} - C) = ${T}.` },
    { text: `Simplifying gives ${h + 2}C - ${b} = ${T} ⟹ ${h + 2}C = ${T + b} ⟹ C = ${C}.` },
    { text: `Solve for B using the fourth equation: B = (${g} × ${C}) - ${j} = ${B}.` }
  ];

  return {
    id: `me-high-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type: 'math_equations',
    difficulty: 'high',
    equations,
    targetVariable: target,
    questionText: `Find the integer value of ${target}:`,
    correctAnswer: answer,
    options: generateOptions(answer, 1, 20),
    steps
  };
}

function generateOptions(correct, min = 1, max = 20) {
  const opts = new Set([correct]);
  const offsets = [-3, -2, -1, 1, 2, 3, 4, -4];
  const shuffledOffsets = shuffle(offsets);

  for (const off of shuffledOffsets) {
    const val = correct + off;
    if (val >= min && val <= max) {
      opts.add(val);
    }
    if (opts.size >= 4) break;
  }

  while (opts.size < 4) {
    opts.add(randInt(min, max));
  }

  return shuffle(Array.from(opts));
}
