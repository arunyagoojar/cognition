// Figure Sequences Engine for dMAT (Official 4x4 Dual-Matrix Specification)
// Matches g.a.s.t. PDF (Pages 6-15) & Careerwise dMAT curriculum.
// Each matrix is a 4x4 grid (16 cells). Sequence displays Matrix 1, 2, 3, 4.
// Candidate determines the next TWO matrices: Image 1 and Image 2.
// ALL options are guaranteed mathematically unique with zero duplicates.

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

// 4x4 Border positions in clockwise order (12 outer cells)
export const BORDER_CW = [0, 1, 2, 3, 7, 11, 15, 14, 13, 12, 8, 4];

// Canonical signature of a matrix taking rotational symmetry into account
export function matrixSignature(matrix) {
  if (!matrix || !matrix.symbols || matrix.symbols.length === 0) return 'empty';
  const sorted = [...matrix.symbols].sort((a, b) => a.position - b.position);
  return sorted.map(s => {
    let rot = ((s.rotation || 0) % 360 + 360) % 360;
    if (s.shape === 'circle') rot = 0;
    else if (s.shape === 'square' || s.shape === 'cross') rot = rot % 90;
    return `${s.position}:${s.shape}:${s.color}:${rot}`;
  }).join(';');
}

// Validates that all 4 options in an array have strictly distinct visual signatures
export function ensureStrictlyUniqueOptions(correctMatrix, distractorMatrices) {
  const correctSig = matrixSignature(correctMatrix);
  const uniqueDistractors = [];
  const seenSigs = new Set([correctSig]);

  const candidatePool = [...distractorMatrices];

  // Fallback mutations if any distractor collides
  const fallbackColors = ['black', 'blue', 'red', 'green', 'pink', 'yellow'];
  const fallbackShapes = ['triangle', 'arrow', 'L', 'semicircle'];

  for (const dist of candidatePool) {
    let cur = dist;
    let sig = matrixSignature(cur);

    if (seenSigs.has(sig)) {
      // Mutate position until unique
      for (let offset = 1; offset <= 15; offset++) {
        const mutated = {
          symbols: cur.symbols.map((s, idx) => ({
            ...s,
            position: (s.position + offset) % 16,
            color: idx === 0 ? fallbackColors[(offset) % fallbackColors.length] : s.color
          }))
        };
        const mSig = matrixSignature(mutated);
        if (!seenSigs.has(mSig)) {
          cur = mutated;
          sig = mSig;
          break;
        }
      }
    }

    seenSigs.add(sig);
    uniqueDistractors.push(cur);
    if (uniqueDistractors.length === 3) break;
  }

  // Combine correct answer with the 3 unique distractors and shuffle
  const fullList = [
    { matrix: correctMatrix, isCorrect: true },
    { matrix: uniqueDistractors[0], isCorrect: false },
    { matrix: uniqueDistractors[1], isCorrect: false },
    { matrix: uniqueDistractors[2], isCorrect: false }
  ];

  const shuffled = shuffle(fullList);
  const correctIdx = shuffled.findIndex(item => item.isCorrect);

  return {
    options: shuffled.map(item => item.matrix),
    correctIdx
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFICIAL & CURATED PATTERN LIBRARY (g.a.s.t. dMAT PDF & Careerwise patterns)
// ─────────────────────────────────────────────────────────────────────────────

const OFFICIAL_PATTERNS = [
  // ── LOW DIFFICULTY (Single Symbol Pure Logic) ──────────────────────────────
  {
    id: 'pat-low-1',
    difficulty: 'low',
    title: 'Vertical Bounce in Column 2',
    explanation: [
      'The black square moves vertically one field at a time in the second column (col index 1) and bounces off the boundary.',
      'From Matrix 4 at row 4 col 2 (position 13), bouncing off the lower boundary directs it upwards to row 3 col 2 (position 9) for Image 1, then to row 2 col 2 (position 5) for Image 2.'
    ],
    sequence: [
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 1 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 9 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 13 }] }
    ],
    image1Correct: { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 9 }] },
    image1Distractors: [
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 13 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 1 }] }
    ],
    image2Correct: { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 5 }] },
    image2Distractors: [
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 1 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 9 }] },
      { symbols: [{ id: 's1', shape: 'square', color: 'black', rotation: 0, position: 13 }] }
    ]
  },
  {
    id: 'pat-low-2',
    difficulty: 'low',
    title: 'Horizontal Bounce in Row 3',
    explanation: [
      'The blue triangle moves horizontally across row 3 (positions 8, 9, 10, 11) by one cell per matrix.',
      'From Matrix 4 at position 11 (right boundary), it bounces left to position 10 (Image 1) and position 9 (Image 2).'
    ],
    sequence: [
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 8 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 9 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 10 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 11 }] }
    ],
    image1Correct: { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 10 }] },
    image1Distractors: [
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 11 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 8 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 9 }] }
    ],
    image2Correct: { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 9 }] },
    image2Distractors: [
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 8 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 10 }] },
      { symbols: [{ id: 's1', shape: 'triangle', color: 'blue', rotation: 0, position: 11 }] }
    ]
  },
  {
    id: 'pat-low-3',
    difficulty: 'low',
    title: 'Clockwise Border Traversal',
    explanation: [
      'The green circle traverses the 12 outer border positions clockwise by 1 cell per step.',
      'Position progression: Matrix 1 (0) -> Matrix 2 (1) -> Matrix 3 (2) -> Matrix 4 (3). Image 1 is at pos 7 (row 2 col 4) and Image 2 is at pos 11 (row 3 col 4).'
    ],
    sequence: [
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 0 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 1 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 2 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 3 }] }
    ],
    image1Correct: { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 7 }] },
    image1Distractors: [
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 3 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 11 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 6 }] }
    ],
    image2Correct: { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 11 }] },
    image2Distractors: [
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 7 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 15 }] },
      { symbols: [{ id: 's1', shape: 'circle', color: 'green', rotation: 0, position: 10 }] }
    ]
  },
  {
    id: 'pat-low-4',
    difficulty: 'low',
    title: 'Center Arrow Rotation',
    explanation: [
      'The arrow remains anchored in cell (row 2 col 2, position 5) and rotates 90 degrees clockwise each matrix.',
      'Matrix 1 (0° Up) -> Matrix 2 (90° Right) -> Matrix 3 (180° Down) -> Matrix 4 (270° Left). Image 1 is 0° (Up) and Image 2 is 90° (Right).'
    ],
    sequence: [
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 0, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 90, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 180, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 270, position: 5 }] }
    ],
    image1Correct: { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 0, position: 5 }] },
    image1Distractors: [
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 180, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 270, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 90, position: 5 }] }
    ],
    image2Correct: { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 90, position: 5 }] },
    image2Distractors: [
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 0, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 180, position: 5 }] },
      { symbols: [{ id: 's1', shape: 'arrow', color: 'black', rotation: 270, position: 5 }] }
    ]
  },

  // ── MEDIUM DIFFICULTY (2 Interacting Symbols) ─────────────────────────────
  {
    id: 'pat-med-1',
    difficulty: 'medium',
    title: 'Dual Motion: Cross Horizontal & Triangle Vertical',
    explanation: [
      'Symbol 1 (blue cross): bounces horizontally across row 2 (positions 4, 5, 6, 7). Moving right, it reaches pos 7 in Matrix 4, bouncing back to pos 6 in Image 1 and pos 5 in Image 2.',
      'Symbol 2 (black triangle): bounces vertically in column 3 (positions 2, 6, 10, 14). Reaching pos 14 in Matrix 4, it bounces up to pos 10 in Image 1 and pos 6 in Image 2.'
    ],
    sequence: [
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 4 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 2 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 5 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 6 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 6 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 7 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 14 }
      ]}
    ],
    image1Correct: { symbols: [
      { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 6 },
      { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 10 }
    ]},
    image1Distractors: [
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 7 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 14 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 5 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 6 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 6 }
      ]}
    ],
    image2Correct: { symbols: [
      { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 5 },
      { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 6 }
    ]},
    image2Distractors: [
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 6 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 4 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 2 }
      ]},
      { symbols: [
        { id: 's1', shape: 'cross', color: 'blue', rotation: 0, position: 5 },
        { id: 's2', shape: 'triangle', color: 'black', rotation: 0, position: 2 }
      ]}
    ]
  },
  {
    id: 'pat-med-2',
    difficulty: 'medium',
    title: 'Circle Color Alternation & Rotating L-Shape',
    explanation: [
      'Symbol 1 (circle): moves 1 step along the top row (0, 1, 2, 3) and alternates color between pink and black (pink -> black -> pink -> black). Image 1 must be pink at pos 2 (bounced), Image 2 black at pos 1.',
      'Symbol 2 (L-shape): anchored at position 10, rotates 90° counter-clockwise each matrix (0° -> 270° -> 180° -> 90°). Image 1 is 0° and Image 2 is 270°.'
    ],
    sequence: [
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 0 },
        { id: 's2', shape: 'L', color: 'black', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 1 },
        { id: 's2', shape: 'L', color: 'black', rotation: 270, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 2 },
        { id: 's2', shape: 'L', color: 'black', rotation: 180, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 3 },
        { id: 's2', shape: 'L', color: 'black', rotation: 90, position: 10 }
      ]}
    ],
    image1Correct: { symbols: [
      { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 2 },
      { id: 's2', shape: 'L', color: 'black', rotation: 0, position: 10 }
    ]},
    image1Distractors: [
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 2 }, // Wrong color
        { id: 's2', shape: 'L', color: 'black', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 3 }, // Wrong position
        { id: 's2', shape: 'L', color: 'black', rotation: 90, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 2 },
        { id: 's2', shape: 'L', color: 'black', rotation: 180, position: 10 } // Wrong rotation
      ]}
    ],
    image2Correct: { symbols: [
      { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 1 },
      { id: 's2', shape: 'L', color: 'black', rotation: 270, position: 10 }
    ]},
    image2Distractors: [
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 1 }, // Wrong color
        { id: 's2', shape: 'L', color: 'black', rotation: 270, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 0 },
        { id: 's2', shape: 'L', color: 'black', rotation: 180, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 1 },
        { id: 's2', shape: 'L', color: 'black', rotation: 90, position: 10 }
      ]}
    ]
  },
  {
    id: 'pat-med-3',
    difficulty: 'medium',
    title: 'Clockwise Border Semicircle & Counter-Clockwise Arrow',
    explanation: [
      'Symbol 1 (green semicircle): advances 2 cells clockwise along border (0 -> 2 -> 7 -> 15). Image 1 advances to pos 13, Image 2 to pos 8.',
      'Symbol 2 (red arrow): moves 1 cell counter-clockwise along border (pos 15 -> 14 -> 13 -> 12). Image 1 is at pos 8, Image 2 at pos 4.'
    ],
    sequence: [
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 0 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 15 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 2 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 14 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 7 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 13 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 15 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 12 }
      ]}
    ],
    image1Correct: { symbols: [
      { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 13 },
      { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 8 }
    ]},
    image1Distractors: [
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 14 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 8 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 13 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 4 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 12 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 12 }
      ]}
    ],
    image2Correct: { symbols: [
      { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 8 },
      { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 4 }
    ]},
    image2Distractors: [
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 4 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 4 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 8 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 0 }
      ]},
      { symbols: [
        { id: 's1', shape: 'semicircle', color: 'green', rotation: 0, position: 12 },
        { id: 's2', shape: 'arrow', color: 'red', rotation: 0, position: 8 }
      ]}
    ]
  },

  // ── HIGH DIFFICULTY (3 Interlocking Rules from Official PDF) ───────────────
  {
    id: 'pat-high-1',
    difficulty: 'high',
    title: 'Official g.a.s.t. Exercise 3 (Three Symbols)',
    explanation: [
      'Circle: moves along the outer border clockwise by two squares at a time, alternating colour from black to pink (0 -> 2 -> 7 -> 15 -> 13 -> 8).',
      'Arrow in center (position 5): rotates 90 degrees clockwise every image (0° -> 90° -> 180° -> 270° -> 0° -> 90°).',
      'Triangle: moves along the outer border counter-clockwise one space at a time (15 -> 14 -> 13 -> 12 -> 8 -> 4).'
    ],
    sequence: [
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 0 },
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 0, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 15 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 2 },
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 90, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 14 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 7 },
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 180, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 13 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 15 },
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 270, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 12 }
      ]}
    ],
    image1Correct: { symbols: [
      { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 13 },
      { id: 's2', shape: 'arrow', color: 'blue', rotation: 0, position: 5 },
      { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 8 }
    ]},
    image1Distractors: [
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 13 }, // Wrong circle color
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 0, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 8 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 14 }, // Wrong circle pos
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 180, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 4 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 13 },
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 90, position: 5 }, // Wrong arrow rot
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 8 }
      ]}
    ],
    image2Correct: { symbols: [
      { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 8 },
      { id: 's2', shape: 'arrow', color: 'blue', rotation: 90, position: 5 },
      { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 4 }
    ]},
    image2Distractors: [
      { symbols: [
        { id: 's1', shape: 'circle', color: 'black', rotation: 0, position: 8 }, // Wrong circle color
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 90, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 4 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 4 }, // Wrong pos
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 180, position: 5 },
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 0 }
      ]},
      { symbols: [
        { id: 's1', shape: 'circle', color: 'pink', rotation: 0, position: 8 },
        { id: 's2', shape: 'arrow', color: 'blue', rotation: 0, position: 5 }, // Wrong arrow rot
        { id: 's3', shape: 'triangle', color: 'green', rotation: 0, position: 4 }
      ]}
    ]
  },
  {
    id: 'pat-high-2',
    difficulty: 'high',
    title: 'Cross Bounce + Rotating Semicircle + Accelerating Square',
    explanation: [
      'Square: advances along top border with accelerating steps (+1, +2, +3...): pos 0 -> 1 -> 3 -> 7 -> 12 -> 8.',
      'Semicircle: anchored at pos 6, rotating 90° CW every matrix.',
      'Cross: bounces diagonally across corners (0 -> 5 -> 10 -> 15 -> 10 -> 5).'
    ],
    sequence: [
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 0 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 0, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 0 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 1 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 90, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 5 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 3 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 180, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 7 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 270, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 15 }
      ]}
    ],
    image1Correct: { symbols: [
      { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 12 },
      { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 0, position: 6 },
      { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 10 }
    ]},
    image1Distractors: [
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 11 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 0, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 12 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 90, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 10 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 12 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 0, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 5 }
      ]}
    ],
    image2Correct: { symbols: [
      { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 8 },
      { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 90, position: 6 },
      { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 5 }
    ]},
    image2Distractors: [
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 4 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 90, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 5 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 8 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 0, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 5 }
      ]},
      { symbols: [
        { id: 's1', shape: 'square', color: 'black', rotation: 0, position: 8 },
        { id: 's2', shape: 'semicircle', color: 'yellow', rotation: 90, position: 6 },
        { id: 's3', shape: 'cross', color: 'red', rotation: 0, position: 0 }
      ]}
    ]
  }
];

// Track task index so sessions cycle smoothly through all patterns without repeating immediately
let patternIndex = 0;

// Generates an authentic 4x4 dMAT figure sequence task
export function generateFigureSequenceTask(difficulty = 'medium') {
  // Filter available curated patterns by difficulty
  let matches = OFFICIAL_PATTERNS.filter(p => p.difficulty === difficulty);
  if (matches.length === 0) {
    matches = OFFICIAL_PATTERNS;
  }

  // Pick pattern sequentially with rollover
  const pat = matches[patternIndex % matches.length];
  patternIndex++;

  // Process options with strict uniqueness guarantees
  const img1 = ensureStrictlyUniqueOptions(pat.image1Correct, pat.image1Distractors);
  const img2 = ensureStrictlyUniqueOptions(pat.image2Correct, pat.image2Distractors);

  return {
    id: `fig-${pat.id}-${Date.now()}`,
    type: 'figure_sequences',
    difficulty: pat.difficulty,
    title: pat.title,
    sequence: pat.sequence,
    image1: {
      options: img1.options,
      correctAnswer: img1.correctIdx
    },
    image2: {
      options: img2.options,
      correctAnswer: img2.correctIdx
    },
    correctAnswer: `${img1.correctIdx}-${img2.correctIdx}`,
    explanation: pat.explanation
  };
}

export function getPdfFigureSequenceExercise(difficulty = 'medium') {
  return generateFigureSequenceTask(difficulty);
}
