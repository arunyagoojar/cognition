import React, { useState, useEffect } from 'react';
import { useUser, useClerk, useAuth } from '@clerk/react';
import { motion, AnimatePresence } from 'motion/react';
import TopNavigation from './components/dashboard/TopNavigation';
import SettingsModal from './components/dashboard/SettingsModal';
import ScoreSummary from './components/dashboard/ScoreSummary';
import PerformanceOverview from './components/dashboard/PerformanceOverview';
import PracticeSection from './components/dashboard/PracticeSection';
import MockHeroCard from './components/dashboard/MockHeroCard';
import PerformancePage from './components/views/PerformancePage';
import LearningHubPage from './components/views/LearningHubPage';
import ListeningModule from './components/modules/ListeningModule';
import ReadingModule from './components/modules/ReadingModule';
import WritingModule from './components/modules/WritingModule';
import SpeakingModule from './components/modules/SpeakingModule';
import MockExamFlow from './components/modules/MockExamFlow';
import {
  getSkillScores,
  saveSkillScore,
  resetSkillScores,
  getTargetBand,
  saveTargetBand,
  getCompletedLessons,
  getActiveMockSession,
} from './utils/storage';
import { subscribePerformanceStore } from './utils/performanceStore';
import { getRandomTestId } from './utils/testQueue';
import { PRODUCTION_READING } from './data/production/productionContent.js';
import { setClerkAuth, syncUserProvision, syncPreferences, syncAttempt, syncLessonComplete } from './utils/api';
import { createAttemptId } from './utils/storage';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  const hasClerk = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  return hasClerk ? <AppWithAuth /> : <AppContent signedIn={true} openSignIn={() => {}} />;
}

function AppWithAuth() {
  const { isLoaded: authLoaded, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const auth = useAuth();
  setClerkAuth(auth);
  // Prevent flash: don't render the app until Clerk session is resolved
  if (!authLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-canvas)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--c-coral)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }
  return <AppContent isSignedIn={isSignedIn} openSignIn={openSignIn} />;
}

function AppContent({ authLoaded = true, isSignedIn = true, openSignIn = () => {} }) {
  const [view, setView] = useState(() => {
    const activeMock = getActiveMockSession();
    if (activeMock && activeMock.status === 'in_progress') {
      return 'mock';
    }
    return 'home';
  }); // home | performance | learning | listening | reading | writing | speaking | mock
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('omniprep_theme') || 'light');
  const [targetBand, setTargetBand] = useState(() => getTargetBand() || '8.0');

  // Sync preferences from D1 on auth change
  useEffect(() => {
    if (!isSignedIn || !authLoaded) return;
    syncUserProvision().then(user => {
      if (user?.target_band && user.target_band !== getTargetBand()) {
        saveTargetBand(user.target_band);
        setTargetBand(user.target_band);
      }
      if (user?.theme && user.theme !== theme) {
        setTheme(user.theme);
        document.documentElement.setAttribute('data-theme', user.theme);
      }
    });
  }, [isSignedIn, authLoaded]);
  const [scores, setScores] = useState(getSkillScores());
  const [completedLessons, setCompletedLessons] = useState(getCompletedLessons());

  // Learning Hub dynamic breadcrumb context
  const [learningContext, setLearningContext] = useState({
    skill: 'reading',
    lessonTitle: 'Lesson 01',
  });

  // Rotating randomized test queue initial next recommendation
  const [selectedExamId, setSelectedExamId] = useState(() => {
    const activeMock = getActiveMockSession();
    if (activeMock && activeMock.examId) {
      return activeMock.examId;
    }
    return getRandomTestId();
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('omniprep_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    syncPreferences({ theme: newTheme });
  };

  const refreshScores = () => {
    setScores(getSkillScores());
    setCompletedLessons(getCompletedLessons());
  };

  useEffect(() => {
    const unsubscribe = subscribePerformanceStore(() => {
      refreshScores();
    });
    return unsubscribe;
  }, []);

  // Every practice start serves a fresh random test (avoiding recent repeats)
  const startSkill = (skillId) => {
    if (skillId === 'listening') {
      setSelectedExamId(getRandomTestId());
    } else if (skillId === 'reading') {
      const pool = PRODUCTION_READING;
      if (pool.length) setSelectedExamId(pool[Math.floor(Math.random() * pool.length)].testId);
    }
    setView(skillId);
  };

  const handleCompleteSkill = (skill, scoreData) => {
    saveSkillScore(skill, scoreData);
    // Modules pass their inner result object (no id/type) — envelope it here so
    // the cloud attempt record is always complete and persistent.
    syncAttempt({
      ...scoreData,
      id: scoreData?.id || createAttemptId(skill),
      type: skill,
      testId: scoreData?.testId || selectedExamId,
      testLabel: scoreData?.testLabel || '',
    });
    refreshScores();
    setView('home');
  };

  const handleResetScores = () => {
    resetSkillScores();
    refreshScores();
  };

  // Helper for diagnostic weakness/strength pill on Performance
  const L = scores?.listening?.band ? parseFloat(scores.listening.band) : null;
  const R = scores?.reading?.band ? parseFloat(scores.reading.band) : null;
  const W = scores?.writing?.band ? parseFloat(scores.writing.band) : null;
  const S = scores?.speaking?.band ? parseFloat(scores.speaking.band) : null;

  const validSkills = [
    { name: 'Listening', band: L },
    { name: 'Reading', band: R },
    { name: 'Writing', band: W },
    { name: 'Speaking', band: S },
  ].filter(s => s.band !== null).sort((a, b) => b.band - a.band);

  const strongestSkill = validSkills[0] || null;
  const weakestSkill = validSkills.length > 1 ? validSkills[validSkills.length - 1] : null;


  // Shared fluid spatial continuity for all page transitions (280ms)
  const pageVariants = {
    initial: { opacity: 0, y: 10, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.995 },
  };

  const pageTransition = {
    duration: 0.28,
    ease: [0.16, 1, 0.3, 1],
  };

  // Instant scroll to top on every view switch (Fix UX scroll position bug)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view]);

  const isExamFlow = ['listening', 'reading', 'writing', 'speaking', 'mock'].includes(view);

  // ── Auth-gated practice start: app is freely browsable, sign-in required at practice entry ──
  const startSkillProtected = (skillId) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    startSkill(skillId);
  };

  const startMockProtected = (examId) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    if (examId) setSelectedExamId(examId);
    setView('mock');
  };

  return (
    <div className={`app-shell ${isExamFlow ? 'in-exam-flow' : ''}`}>
      {/* ── UNIFIED NAVIGATION ARCHITECTURE (HIDDEN DURING ACTIVE EXAM FLOWS) ─────── */}
      {!isExamFlow && (
        <header className="unified-nav-header">
          <TopNavigation
            onOpenSettings={() => setSettingsOpen(true)}
            onGoHome={() => setView('home')}
            view={view}
          />
        </header>
      )}

      {/* ── UNIFIED SPATIAL CONTINUITY PAGE CONTAINER ─────────────── */}
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.main
            key="home"
            className="content-container"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {/* 1. Score Summary & Continuous Animated Spring Progress */}
            <ScoreSummary
              scores={scores}
              targetBand={targetBand}
            />

            {/* 2. Performance Overview (Learning Hub Card & Skill Graph) */}
            <PerformanceOverview
              scores={scores}
              targetBand={targetBand}
              completedLessons={completedLessons}
              onOpenLearningHub={() => setView('learning')}
              onOpenPerformance={() => setView('performance')}
            />

            {/* 3. Practice Section (Writing, Listening, Speaking, Reading) */}
            <PracticeSection
              scores={scores}
              targetBand={targetBand}
              onStartSkill={startSkillProtected}
            />

            {/* 4. Final Mock Test Hero with Rotating Randomized Test Queue */}
            <MockHeroCard
              scores={scores}
              selectedExam={selectedExamId}
              onSelectExam={setSelectedExamId}
              onStartMock={startMockProtected}
            />
          </motion.main>
        )}

        {view === 'performance' && (
          <motion.div
            key="performance"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <PerformancePage
              scores={scores}
              targetBand={targetBand}
              onBack={() => setView('home')}
              onStartSkill={startSkillProtected}
            />
          </motion.div>
        )}

        {view === 'learning' && (
          <motion.div
            key="learning"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <LearningHubPage
              onBack={() => setView('home')}
              onContextChange={(ctx) => setLearningContext(ctx)}
              onOpenPractice={startSkillProtected}
            />
          </motion.div>
        )}

        {view === 'listening' && (
          <motion.div
            key="listening"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <ListeningModule
              testId={selectedExamId}
              onComplete={(d) => {
                handleCompleteSkill('listening', d);
              }}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}

        {view === 'reading' && (
          <motion.div
            key="reading"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <ReadingModule
              testId={selectedExamId}
              onComplete={(d) => {
                handleCompleteSkill('reading', d);
              }}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}

        {view === 'writing' && (
          <motion.div
            key="writing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <WritingModule
              testId={selectedExamId}
              onComplete={(d) => {
                handleCompleteSkill('writing', d);
              }}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}

        {view === 'speaking' && (
          <motion.div
            key="speaking"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <SpeakingModule
              testId={selectedExamId}
              onComplete={(d) => {
                handleCompleteSkill('speaking', d);
              }}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}

        {view === 'mock' && (
          <motion.div
            key="mock"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <MockExamFlow
              initialExamId={selectedExamId}
              onComplete={(record) => {
                if (record?.skills) {
                  Object.entries(record.skills).forEach(([k, v]) => {
                    if (v && v.status === 'completed') saveSkillScore(k, v);
                  });
                }
                syncAttempt({
                  id: createAttemptId('mock'),
                  type: 'mock',
                  testId: record?.testId || '',
                  testLabel: record?.testLabel || 'Full IELTS Mock Exam',
                  status: record?.status || 'completed',
                  band: record?.overallBand ?? null,
                  data: {
                    skills: record?.skills || null,
                    overallSummary: record?.overallSummary ?? null,
                  },
                });
                refreshScores();
                setView('home');
              }}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SETTINGS MODAL (UNIVERSAL SYSTEM PANEL) ─────────────────── */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        targetBand={targetBand}
        onChangeTargetBand={(b) => {
          setTargetBand(b);
          saveTargetBand(b);
          syncPreferences({ target_band: b });
        }}
        onResetScores={handleResetScores}
      />
    </div>
  );
}
