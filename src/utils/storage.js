// LocalStorage persistence for OmniPrep sessions, skill scores, and Mock tests

const STORAGE_KEY_PREFIX = 'omniprep_';

export function saveTestState(testId, state) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${testId}`, JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString()
    }));
  } catch (e) {
    console.warn('Failed to save to localStorage', e);
  }
}

export function loadTestState(testId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${testId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to load from localStorage', e);
    return null;
  }
}

export function saveSkillScore(skill, scoreData) {
  try {
    const all = getSkillScores();
    all[skill] = {
      ...scoreData,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}skill_scores`, JSON.stringify(all));
  } catch (e) {
    console.warn('Failed to save skill score', e);
  }
}

export function getSkillScores() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}skill_scores`);
    return raw ? JSON.parse(raw) : {
      listening: null,
      reading: null,
      writing: null,
      speaking: null
    };
  } catch (e) {
    return { listening: null, reading: null, writing: null, speaking: null };
  }
}

export function saveCompletedResult(result) {
  try {
    const history = getCompletedResults();
    history.unshift({
      id: 'res_' + Date.now(),
      completedAt: new Date().toISOString(),
      ...result
    });
    localStorage.setItem(`${STORAGE_KEY_PREFIX}history`, JSON.stringify(history.slice(0, 50)));
  } catch (e) {
    console.warn('Failed to save history', e);
  }
}

export function getCompletedResults() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}history`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveApiKey(key) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}gemini_key`, (key || '').trim());
  } catch (e) {
    console.warn('Failed to save API key', e);
  }
}

export function getApiKey() {
  try {
    if (typeof window !== 'undefined') {
      const urlKey = new URLSearchParams(window.location.search).get('aiKey');
      if (urlKey) return urlKey.trim();
    }
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}gemini_key`);
    if (saved && saved.trim()) return saved.trim();
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY.trim();
    }
    return '';
  } catch (e) {
    return '';
  }
}

// ── Standalone Global App Preferences (Font Scale, Theme & API Key) ────────
export function getAppSettings() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}app_settings`);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      theme: parsed.theme || 'dark',
      fontSize: parsed.fontSize || '100%',
      apiKey: getApiKey()
    };
  } catch (e) {
    return { theme: 'dark', fontSize: '100%', apiKey: getApiKey() };
  }
}

export function saveAppSettings(settings) {
  try {
    const current = getAppSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}app_settings`, JSON.stringify({
      theme: updated.theme,
      fontSize: updated.fontSize
    }));
    if (settings.apiKey !== undefined) {
      saveApiKey(settings.apiKey);
    }
    applyAppSettings(updated);
    return updated;
  } catch (e) {
    console.warn('Failed to save app settings', e);
    return settings;
  }
}

export function applyAppSettings(settings) {
  if (typeof document === 'undefined') return;
  try {
    const root = document.documentElement;
    const theme = settings?.theme || 'dark';
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }

    const fontScaleMap = {
      '100%': { px: '14px', scale: '1' },
      '115%': { px: '16px', scale: '1.15' },
      '130%': { px: '18.2px', scale: '1.30' },
      '145%': { px: '20.3px', scale: '1.45' }
    };
    const f = fontScaleMap[settings?.fontSize] || fontScaleMap['100%'];
    root.style.setProperty('--app-font-size', f.px);
    root.style.setProperty('--app-font-scale', f.scale);
  } catch (e) {
    console.warn('Failed to apply app settings to DOM', e);
  }
}

// History-based Question Pool Management (Unattempted vs Attempted Pools)
export function getAttemptedQuestionSets(skill) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}attempted_${skill}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function recordAttemptedQuestionSet(skill, setId) {
  try {
    if (!setId) return;
    const attempted = getAttemptedQuestionSets(skill);
    if (!attempted.includes(setId)) {
      attempted.push(setId);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}attempted_${skill}`, JSON.stringify(attempted));
    }
  } catch (e) {
    console.warn('Failed to record attempted question set', e);
  }
}

export function clearAttemptedQuestionSets(skill) {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}attempted_${skill}`);
  } catch (e) {
    console.warn('Failed to clear attempted question sets', e);
  }
}

export function getQuestionPoolStats(skill, totalCount) {
  const attempted = getAttemptedQuestionSets(skill);
  const attemptedCount = attempted.length;
  const remainingInPool = Math.max(0, totalCount - attemptedCount);
  return {
    attemptedCount,
    totalCount,
    remainingInPool,
    isExhausted: remainingInPool === 0
  };
}

// ── DMAT Specific Storage ──────────────────────────────────────────────────
export function saveDmatScore(section, scoreData) {
  try {
    // Only save if it represents a complete practice exam / mock session
    if (!scoreData || !scoreData.total || scoreData.total < 5 || !scoreData.completed) {
      console.warn('Ignoring uncompleted practice session score:', scoreData);
      return;
    }
    const all = getDmatScores();
    all[section] = {
      ...scoreData,
      completed: true,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}dmat_scores`, JSON.stringify(all));

    // Also record to DMAT history
    saveDmatHistory({
      section,
      percentage: scoreData.percentage,
      correct: scoreData.correct,
      total: scoreData.total,
      completedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Failed to save dmat score', e);
  }
}

export function getDmatScores() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}dmat_scores`);
    if (!raw) {
      return { latin: null, math: null, figures: null, academic: null, mock: null };
    }
    const parsed = JSON.parse(raw);
    const cleaned = { ...parsed };
    let modified = false;

    // Purge any accidental partial/incompleted records from earlier tests (like 1/1 = 100%)
    for (const key of ['latin', 'math', 'figures', 'academic', 'mock']) {
      if (cleaned[key] && (cleaned[key].total < 5 || !cleaned[key].completed)) {
        cleaned[key] = null;
        modified = true;
      }
    }
    if (modified) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}dmat_scores`, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return { latin: null, math: null, figures: null, academic: null, mock: null };
  }
}

export function saveDmatHistory(entry) {
  try {
    const hist = getDmatHistory();
    hist.push({
      id: 'dmat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      ...entry
    });
    localStorage.setItem(`${STORAGE_KEY_PREFIX}dmat_history`, JSON.stringify(hist.slice(-100)));
  } catch (e) {
    console.warn('Failed to save dmat history', e);
  }
}

export function getDmatHistory() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}dmat_history`);
    const list = raw ? JSON.parse(raw) : [];
    // Only return completed exam attempts (total >= 5)
    return list.filter(item => item && item.total >= 5);
  } catch (e) {
    return [];
  }
}

// ── GRE Specific Storage ───────────────────────────────────────────────────
export function saveGreScore(section, scoreData) {
  try {
    // Only save if it represents a fully completed section or mock
    if (!scoreData || !scoreData.completed) {
      console.warn('Ignoring uncompleted GRE session score:', scoreData);
      return;
    }
    const all = getGreScores();
    all[section] = {
      ...scoreData,
      completed: true,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}gre_scores`, JSON.stringify(all));

    // Also append to history log for analytics chart
    saveGreHistory({
      section,
      scaledScore: scoreData.scaledScore,
      percentage: scoreData.percentage,
      correct: scoreData.correct,
      total: scoreData.total,
      completedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Failed to save GRE score', e);
  }
}

export function getGreScores() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}gre_scores`);
    const parsed = raw ? JSON.parse(raw) : { verbal: null, quant: null, writing: null, mock: null };
    const cleaned = { ...parsed };
    let modified = false;

    // Purge any partial/incomplete attempts
    for (const key of ['verbal', 'quant', 'writing', 'mock']) {
      if (cleaned[key] && !cleaned[key].completed) {
        cleaned[key] = null;
        modified = true;
      }
    }
    if (modified) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}gre_scores`, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return { verbal: null, quant: null, writing: null, mock: null };
  }
}

export function saveGreHistory(entry) {
  try {
    const hist = getGreHistory();
    hist.push({
      id: 'gre_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      ...entry
    });
    localStorage.setItem(`${STORAGE_KEY_PREFIX}gre_history`, JSON.stringify(hist.slice(-100)));
  } catch (e) {
    console.warn('Failed to save GRE history', e);
  }
}

export function getGreHistory() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}gre_history`);
    const list = raw ? JSON.parse(raw) : [];
    return list.filter(item => item && (item.total >= 5 || item.section === 'writing' || item.scaledScore !== undefined));
  } catch (e) {
    return [];
  }
}

// ── User Profile & Onboarding Storage ─────────────────────────────────────
export function getUserProfile() {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}user_profile`);
    if (!raw) {
      return {
        name: '',
        targetExams: ['IELTS', 'GRE', 'DMAT'],
        onboarded: false
      };
    }
    const parsed = JSON.parse(raw);
    return {
      name: parsed.name || '',
      targetExams: Array.isArray(parsed.targetExams) && parsed.targetExams.length > 0 
        ? parsed.targetExams 
        : ['IELTS', 'GRE', 'DMAT'],
      onboarded: Boolean(parsed.onboarded)
    };
  } catch (e) {
    return { name: '', targetExams: ['IELTS', 'GRE', 'DMAT'], onboarded: false };
  }
}

export function saveUserProfile(profile) {
  try {
    const current = getUserProfile();
    const updated = {
      ...current,
      ...profile,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user_profile`, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save user profile', e);
    return profile;
  }
}

// ── Consolidated Cross-Track Analytics & History Aggregator ─────────────────
export function getAllTrackScores() {
  return {
    ielts: getSkillScores(),
    dmat: getDmatScores(),
    gre: getGreScores()
  };
}

export function getAllAttemptHistory() {
  const allAttempts = [];

  // 1. IELTS Completed Results
  const ieltsHistory = getCompletedResults();
  ieltsHistory.forEach(item => {
    allAttempts.push({
      id: item.id || `ielts_${item.completedAt}`,
      track: 'IELTS',
      trackLabel: 'IELTS Academic',
      module: item.skill || (item.overallBand ? 'mock' : 'general'),
      title: item.skill 
        ? `${item.skill.charAt(0).toUpperCase() + item.skill.slice(1)} Practice`
        : 'IELTS Full Mock Exam',
      scoreText: item.bandScore ? `Band ${item.bandScore}` : (item.overallBand ? `Band ${item.overallBand}` : 'Completed'),
      scoreNum: item.bandScore || item.overallBand || null,
      maxScore: 9.0,
      completedAt: item.completedAt || item.updatedAt || new Date().toISOString(),
      raw: item
    });
  });

  // 2. GRE History
  const greHistory = getGreHistory();
  greHistory.forEach(item => {
    const moduleTitles = {
      verbal: 'GRE Verbal Reasoning',
      quant: 'GRE Quantitative Reasoning',
      writing: 'GRE Analytical Writing',
      mock: 'GRE Full Mock Exam'
    };
    allAttempts.push({
      id: item.id || `gre_${item.completedAt}`,
      track: 'GRE',
      trackLabel: 'GRE General',
      module: item.section || 'quant',
      title: moduleTitles[item.section] || 'GRE Practice Test',
      scoreText: item.scaledScore ? `${item.scaledScore} / 170` : (item.percentage !== undefined ? `${item.percentage}%` : 'Completed'),
      scoreNum: item.scaledScore || item.percentage || null,
      maxScore: 170,
      completedAt: item.completedAt || new Date().toISOString(),
      raw: item
    });
  });

  // 3. DMAT History
  const dmatHistory = getDmatHistory();
  dmatHistory.forEach(item => {
    const dmatTitles = {
      latin: 'dMAT Latin Squares Logic',
      math: 'dMAT Math Equations',
      figures: 'dMAT Figure Sequences',
      academic: 'dMAT Academic Text',
      mock: 'dMAT Full Mock Exam'
    };
    allAttempts.push({
      id: item.id || `dmat_${item.completedAt}`,
      track: 'DMAT',
      trackLabel: 'dMAT Aptitude',
      module: item.section || 'latin',
      title: dmatTitles[item.section] || 'dMAT Practice Test',
      scoreText: item.percentage !== undefined ? `${item.percentage}% Accuracy` : (item.correct !== undefined ? `${item.correct}/${item.total}` : 'Completed'),
      scoreNum: item.percentage !== undefined ? item.percentage : null,
      maxScore: 100,
      completedAt: item.completedAt || new Date().toISOString(),
      raw: item
    });
  });

  // Sort newest first
  return allAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

