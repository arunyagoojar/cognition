import React, { useState, useEffect, useRef } from 'react';
import { useUser, useClerk, useAuth } from '@clerk/react';
import { motion, AnimatePresence } from 'motion/react';
import TopNavigation from './components/dashboard/TopNavigation';
import SettingsModal from './components/dashboard/SettingsModal';
import ScoreSummary from './components/dashboard/ScoreSummary';
import PerformanceOverview from './components/dashboard/PerformanceOverview';
import PracticeSection from './components/dashboard/PracticeSection';
import MockHeroCard from './components/dashboard/MockHeroCard';
import LastTestRecheck from './components/dashboard/LastTestRecheck';
import Loader from './components/common/Loader';
import PerformancePage from './components/views/PerformancePage';
import LearningHubPage from './components/views/LearningHubPage';
import TipsPage from './components/views/TipsPage';
import Onboarding from './components/onboarding/Onboarding';
import ListeningModule from './components/modules/ListeningModule';
import ReadingModule from './components/modules/ReadingModule';
import WritingModule from './components/modules/WritingModule';
import SpeakingModule from './components/modules/SpeakingModule';
import MockExamFlow from './components/modules/MockExamFlow';
import {
  getSkillScores,
  saveSkillScore,
  resetSkillScores,
  clearUserScoresOnSignOut,
  claimLocalDataOwner,
  getTargetBand,
  saveTargetBand,
  getCompletedLessons,
  getActiveMockSession,
} from './utils/storage';
import { subscribePerformanceStore } from './utils/performanceStore';
import { getRandomTestId } from './utils/testQueue';
import { PRODUCTION_READING, PRODUCTION_WRITING, PRODUCTION_SPEAKING } from './data/production/productionContent.js';
import { setClerkAuth, syncUserProvision, syncPreferences, syncAttempt, syncOnboardingComplete } from './utils/api';
import { createAttemptId } from './utils/storage';
import { shouldShowOnboarding, markOnboardingComplete, hasCompletedOnboardingLocally } from './utils/onboarding';

import { CLERK_PUBLISHABLE_KEY as PUBLISHABLE_KEY } from './config.js';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { resetWindowScroll } from './components/common/resetWindowScroll.js';

export default function App() {
  const hasClerk = Boolean(PUBLISHABLE_KEY);
  return (
    <ErrorBoundary>
      {hasClerk ? <AppWithAuth /> : <AppContent signedIn={true} openSignIn={() => {}} />}
    </ErrorBoundary>
  );
}

function AppWithAuth() {
  const { isLoaded: authLoaded, isSignedIn, user } = useUser();
  const { openSignIn } = useClerk();
  const auth = useAuth();
  setClerkAuth(auth);
  // Prevent flash: don't render the app until Clerk session is resolved
  if (!authLoaded) {
    return (
      <div className="app-boot-screen">
        <Loader label="Loading Cognition" size="lg" />
      </div>
    );
  }
  return <AppContent isSignedIn={isSignedIn} openSignIn={openSignIn} userId={user?.id || 'anon'} />;
}

function AppContent({ authLoaded = true, isSignedIn = true, openSignIn = () => {}, userId = 'anon' }) {
  const [view, setView] = useState(() => {
    const activeMock = getActiveMockSession();
    if (activeMock && activeMock.status === 'in_progress') {
      return 'mock';
    }
    return 'home';
  }); // home | performance | learning | tips | listening | reading | writing | speaking | mock
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('omniprep_theme') || 'light');
  const [targetBand, setTargetBand] = useState(() => getTargetBand() || '8.0');

  // Tips & Tricks deep entry (null = landing with the four skill cards)
  const [tipsSkill, setTipsSkill] = useState(null);
  const [tipsCategory, setTipsCategory] = useState(null);
  const [learningLessonId, setLearningLessonId] = useState(null);

  // First-run onboarding: shown exactly once per account — right after the
  // first successful sign-in — then never again (no replay anywhere). The
  // server record decides; unknown state (offline / API error) never shows it.
  const [onboardingUser, setOnboardingUser] = useState(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const showOnboarding = Boolean(
    isSignedIn && authLoaded && !onboardingDismissed && shouldShowOnboarding(onboardingUser, userId)
  );

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
      if (user && 'onboarding_completed_at' in user && !user.onboarding_completed_at
          && hasCompletedOnboardingLocally(userId)) {
        // Completed here earlier but the server write was missed — heal it.
        syncOnboardingComplete();
      }
      setOnboardingUser(user || null);
    });
  }, [isSignedIn, authLoaded, userId]);
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
    changeTheme(newTheme);
  };

  // Used by onboarding (and settings) — persists through the existing theme system
  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    syncPreferences({ theme: newTheme });
  };

  const openTips = (skillId = null, categoryId = null) => {
    setTipsSkill(skillId || null);
    setTipsCategory(categoryId || null);
    setView('tips');
  };
  const openLesson = (lessonId = null) => {
    setLearningLessonId(lessonId);
    setView('learning');
  };

  const handleOnboardingComplete = () => {
    markOnboardingComplete(userId);
    setOnboardingDismissed(true);
    syncOnboardingComplete(); // best-effort; the local mark covers a missed write
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

  // Wipe scores and test attempts from localStorage when a user signs out or switches accounts
  const prevUserRef = useRef({ isSignedIn, userId });
  useEffect(() => {
    const prev = prevUserRef.current;
    const switchedHere = prev.isSignedIn && (!isSignedIn || (userId !== 'anon' && prev.userId !== userId));
    // Data left by another account (signed out in another tab / expired session)
    const leftByOtherAccount = isSignedIn && claimLocalDataOwner(userId) === 'foreign';
    if (switchedHere || leftByOtherAccount) {
      if (leftByOtherAccount) setView(v => (v === 'mock' ? 'home' : v));
      clearUserScoresOnSignOut();
      refreshScores();
    }
    prevUserRef.current = { isSignedIn, userId };
  }, [isSignedIn, userId]);

  // Every practice start serves a fresh random test (avoiding recent repeats)
  const startSkill = (skillId) => {
    delete sessionAttemptIds.current[skillId];
    if (skillId === 'listening') {
      setSelectedExamId(getRandomTestId());
    } else if (skillId === 'reading') {
      const pool = PRODUCTION_READING;
      if (pool.length) setSelectedExamId(pool[Math.floor(Math.random() * pool.length)].testId);
    } else if (skillId === 'writing') {
      const pool = PRODUCTION_WRITING;
      if (pool.length) {
        let recent = [];
        try { recent = JSON.parse(localStorage.getItem('cognition_recent_writing_v1') || '[]'); } catch (_) {}
        const available = pool.filter(p => !recent.includes(p.testId));
        const pickPool = available.length ? available : pool;
        const pick = pickPool[Math.floor(Math.random() * pickPool.length)].testId;
        try { localStorage.setItem('cognition_recent_writing_v1', JSON.stringify([pick, ...recent.filter(id => id !== pick)].slice(0, 8))); } catch (_) {}
        setSelectedExamId(pick);
      }
    } else if (skillId === 'speaking') {
      const pool = PRODUCTION_SPEAKING;
      if (pool.length) {
        let recent = [];
        try { recent = JSON.parse(localStorage.getItem('cognition_recent_speaking_v1') || '[]'); } catch (_) {}
        const available = pool.filter(p => !recent.includes(p.id));
        const pickPool = available.length ? available : pool;
        const pick = pickPool[Math.floor(Math.random() * pickPool.length)].id;
        try { localStorage.setItem('cognition_recent_speaking_v1', JSON.stringify([pick, ...recent.filter(id => id !== pick)].slice(0, 8))); } catch (_) {}
        setSelectedExamId(pick);
      }
    }
    setView(skillId);
  };

  // One attempt id per practice session: the automatic save when results
  // appear and the later "Save & Return" click update the same record.
  const sessionAttemptIds = useRef({});

  const persistSkillResult = (skill, scoreData) => {
    const id = scoreData?.attemptId || sessionAttemptIds.current[skill] || createAttemptId(skill);
    sessionAttemptIds.current[skill] = id;
    const testIdForAttempt = scoreData?.testId || selectedExamId;
    saveSkillScore(skill, { ...scoreData, attemptId: id, testId: testIdForAttempt });
    // Modules pass their inner result object (no id/type) — envelope it here so
    // the cloud attempt record is always complete and persistent.
    Promise.resolve(syncAttempt({
      ...scoreData,
      id,
      type: skill,
      testId: testIdForAttempt,
      testLabel: scoreData?.testLabel || '',
    })).catch(() => {});
    refreshScores();
  };

  const handleCompleteSkill = (skill, scoreData) => {
    persistSkillResult(skill, scoreData);
    setView('home');
  };

  const handleResetScores = () => {
    resetSkillScores();
    refreshScores();
  };



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
            onGoBack={view !== 'home' ? () => setView('home') : undefined}
            view={view}
          />
        </header>
      )}

      {/* ── UNIFIED SPATIAL CONTINUITY PAGE CONTAINER ─────────────── */}
      {/* Reset scroll once the outgoing page has left: the incoming page then
          mounts at the top even if the window moved during the exit fade. */}
      <AnimatePresence mode="wait" onExitComplete={resetWindowScroll}>
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

            {/* Re-grade the most recent Writing/Speaking test (latest only) */}
            <LastTestRecheck onRechecked={refreshScores} onOpenSettings={() => setSettingsOpen(true)} />

            {/* 2. Performance Overview (Learning Hub Card & Skill Graph) */}
            <PerformanceOverview
              scores={scores}
              targetBand={targetBand}
              completedLessons={completedLessons}
              onOpenLearningHub={() => setView('learning')}
              onOpenPerformance={() => setView('performance')}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
              onStartPractice={startSkillProtected}
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
              initialLessonId={learningLessonId}
              onBack={() => setView('home')}
              onContextChange={(ctx) => setLearningContext(ctx)}
              onOpenPractice={startSkillProtected}
            />
          </motion.div>
        )}

        {view === 'tips' && (
          <motion.div
            key="tips"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <TipsPage initialSkill={tipsSkill} initialCategory={tipsCategory} />
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
              onSave={(d) => persistSkillResult('listening', d)}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
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
              onSave={(d) => persistSkillResult('reading', d)}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
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
            <ErrorBoundary onReset={() => setView('home')}>
              <WritingModule
                testId={selectedExamId}
                onComplete={(d) => {
                  handleCompleteSkill('writing', d);
                }}
                onSave={(d) => persistSkillResult('writing', d)}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
                onBack={() => setView('home')}
              />
            </ErrorBoundary>
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
              onSave={(d) => persistSkillResult('speaking', d)}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
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
                // evaluateFullMockExam already recorded this mock (all four
                // skills) in the performance store — saving each skill again
                // would double-count it in the band estimate.
                Promise.resolve(syncAttempt({
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
                })).catch(() => {});
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

      {/* ── FIRST-RUN ONBOARDING (skippable; overlays everything) ───── */}
      <AnimatePresence>
        {showOnboarding && (
          <Onboarding
            theme={theme}
            onChangeTheme={changeTheme}
            targetBand={targetBand}
            onChangeTargetBand={(b) => {
              setTargetBand(b);
              saveTargetBand(b);
              syncPreferences({ target_band: b });
            }}
            onComplete={handleOnboardingComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
