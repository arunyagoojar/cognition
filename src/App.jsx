import { readDraft, writeDraft, transitionPracticeSession } from './utils/drafts.js';
import { CONTENT_CATALOG, loadSkillContent, loadAllContent } from './data/production/registry.js';
import { chooseFreshTest } from './utils/practiceSelection.js';
import { readScreenRoute, writeScreenRoute } from './utils/screenRoute.js';
import SyncStatus from './components/common/SyncStatus.jsx';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useUser, useClerk, useAuth } from '@clerk/react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import TopNavigation from './components/dashboard/TopNavigation';
import SettingsModal from './components/dashboard/SettingsModal';

import PerformanceOverview from './components/dashboard/PerformanceOverview';
import PracticeSection from './components/dashboard/PracticeSection';
import FocusedRecommendations from './components/dashboard/FocusedRecommendations.jsx';
import MockHeroCard from './components/dashboard/MockHeroCard';
import LastTestRecheck from './components/dashboard/LastTestRecheck';
import Loader, { PageLoader } from './components/common/Loader';
const PracticeResourceOverlay = lazy(() => import('./components/common/PracticeResourceOverlay.jsx'));
const FocusedDrill = lazy(() => import('./components/views/FocusedDrill.jsx'));
const PerformancePage = lazy(async () => { return import('./components/views/PerformancePage'); });
const LearningHubPage = lazy(async () => { return import('./components/views/LearningHubPage'); });
const SpellingBee = lazy(() => import('./components/views/SpellingBee.jsx'));
const TipsPage = lazy(async () => { return import('./components/views/TipsPage'); });
const HarperWritingPractice = lazy(async () => { await loadSkillContent('writing'); return import('./components/views/HarperWritingPractice'); });
import Onboarding from './components/onboarding/Onboarding';
const ListeningModule = lazy(async () => { await loadSkillContent('listening'); return import('./components/modules/ListeningModule'); });
const ReadingModule = lazy(async () => { await loadSkillContent('reading'); return import('./components/modules/ReadingModule'); });
const WritingModule = lazy(async () => { await loadSkillContent('writing'); return import('./components/modules/WritingModule'); });
const SpeakingModule = lazy(async () => { await loadSkillContent('speaking'); return import('./components/modules/SpeakingModule'); });
const MockExamFlow = lazy(async () => { await loadAllContent(); return import('./components/modules/MockExamFlow'); });
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
  clearActiveMockSession,
  hydrateFromRemoteAttempts,
  saveCompletedLessonsBulk,
  syncLegacySkillScoresFromStore,
} from './utils/storage';
import { subscribePerformanceStore } from './utils/performanceStore';
import { getRandomTestId } from './utils/testQueue';

import {
  setClerkAuth,
  syncUserProvision,
  syncPreferences,
  syncAttempt,
  syncOnboardingComplete,
  fetchAttempts,
  fetchCompletedLessons,
} from './utils/api';
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
  const identity = isSignedIn ? user?.id || '' : 'anon';
  const [readyIdentity, setReadyIdentity] = useState(null);
  const previousIdentity = useRef(null);
  useEffect(() => {
    if (!authLoaded) return;
    const foreign = isSignedIn && claimLocalDataOwner(identity) === 'foreign';
    if (foreign || (previousIdentity.current && previousIdentity.current !== identity)) clearUserScoresOnSignOut();
    setClerkAuth(auth);
    previousIdentity.current = identity;
    let active=true;
    void Promise.resolve().then(() => { if(active) setReadyIdentity(identity); });
    return () => { active=false; };
  }, [authLoaded, isSignedIn, identity, auth]);
  // Prevent flash: don't render the app until Clerk session is resolved
  if (!authLoaded || readyIdentity !== identity) {
    return (
      <div className="app-boot-screen">
        <Loader label="Loading Cognition" size="lg" />
      </div>
    );
  }
  return <AppContent key={identity} isSignedIn={isSignedIn} openSignIn={openSignIn} userId={user?.id || 'anon'} />;
}

function AppContent({ authLoaded = true, isSignedIn = true, openSignIn = () => {}, userId = 'anon' }) {
  const [view, commitView] = useState(() => {
    const route = readScreenRoute();
    if (route.view) return route.view;
    const activeMock = getActiveMockSession();
    if (activeMock && activeMock.status === 'in_progress') {
      return 'mock';
    }
    return 'home';
  }); // home | performance | learning | tips | listening | reading | writing | speaking | mock
  const [reviewResult, setReviewResult] = useState(null);
  const navigationRef = useRef(null);
  const completedSession = useRef(false);
  const setView = (next, { completed = false } = {}) => {
    if (next === view) return true;
    const finished = completed || completedSession.current || reviewResult ||
      (view === 'spelling-bee' && readDraft('spelling-bee')?.stage === 'summary') ||
      (view === 'harper-writing' && readDraft('harper')?.stage === 'summary') ||
      (view === 'drill' && readDraft('drill-session')?.result);
    if (!transitionPracticeSession(view, next, { finished, confirm: message => window.confirm(message) })) return false;
    if (view === 'mock' || next === 'mock') clearActiveMockSession();
    completedSession.current = false;
    setReviewResult(null);
    commitView(next);
    return true;
  };
  useEffect(() => { navigationRef.current = setView; });
  const [practiceResource, setPracticeResource] = useState(null);
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

  const [scores, setScores] = useState(() => getSkillScores());
  const [completedLessons, setCompletedLessons] = useState(() => getCompletedLessons());

  const refreshScores = useCallback(() => {
    setScores(getSkillScores());
    setCompletedLessons(getCompletedLessons());
  }, []);

  const hydrateUserData = useCallback(async (uid) => {
    if (!isSignedIn || !authLoaded || !uid || uid === 'anon') return;
    try {
      const [attemptsRes, lessonsRes] = await Promise.all([
        fetchAttempts(),
        fetchCompletedLessons()
      ]);
      let changed = false;
      if (Array.isArray(attemptsRes) && attemptsRes.length > 0) {
        const hydrated = hydrateFromRemoteAttempts(attemptsRes, uid);
        if (hydrated) {
          syncLegacySkillScoresFromStore();
          changed = true;
        }
      }
      if (Array.isArray(lessonsRes) && lessonsRes.length > 0) {
        const ids = lessonsRes.map(l => l.lesson_id).filter(Boolean);
        if (ids.length > 0) {
          const lessonsHydrated = saveCompletedLessonsBulk(ids);
          if (lessonsHydrated) changed = true;
        }
      }
      if (changed) {
        refreshScores();
      }
    } catch (err) {
      console.warn('Failed to hydrate user data from cloud:', err);
    }
  }, [isSignedIn, authLoaded, refreshScores]);

  // Sync preferences and hydrate attempts & completed lessons from D1 on auth change
  useEffect(() => {
    if (!isSignedIn || !authLoaded) return;
    syncUserProvision().then(user => {
      if (user?.target_band && user.target_band !== getTargetBand()) {
        saveTargetBand(user.target_band);
        setTargetBand(user.target_band);
      }
      if (user?.theme) {
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

    if (userId && userId !== 'anon') {
      void Promise.resolve().then(() => hydrateUserData(userId));
    }
  }, [isSignedIn, authLoaded, userId, hydrateUserData]);

  // Learning Hub dynamic breadcrumb context

  // Rotating randomized test queue initial next recommendation
  const [selectedExamId, setSelectedExamId] = useState(() => {
    const route = readScreenRoute();
    if (route.testId) return route.testId;
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

  const openTips = (skillId = null, categoryId = null, tipId = null) => {
    if (categoryId) { setPracticeResource({kind:'strategy',tip:{skill:skillId,categoryId,tipId}}); return; }
    setTipsSkill(skillId || null);
    setTipsCategory(categoryId || null);
    setView('tips');
  };
  const openLesson = (lessonId = null) => {
    if (lessonId) { setPracticeResource({kind:'lesson',lesson:{id:lessonId}}); return; }
    setLearningLessonId(lessonId);
    setView('learning');
  };

  const handleOnboardingComplete = () => {
    markOnboardingComplete(userId);
    setOnboardingDismissed(true);
    syncOnboardingComplete(); // best-effort; the local mark covers a missed write
  };

  useEffect(() => {
    const unsubscribe = subscribePerformanceStore(() => {
      refreshScores();
    });
    return unsubscribe;
  }, [refreshScores]);

  // Every practice start serves a fresh random test (avoiding recent repeats)
  // A saved result opened from the dashboard ("View results")

  const viewSavedResult = (skill, result) => {
    if (!setView(skill)) return;
    setSelectedExamId(result?.testId || selectedExamId);
    setReviewResult({
      skill,
      result: skill === 'speaking'
        ? { ...result, overallSpeakingBand: result.overallSpeakingBand ?? result.band, evaluationState: result.evaluationState || 'COMPLETED' }
        : { ...result, evaluationStatus: result.evaluationStatus || 'completed' },
    });
  };

  const startSkill = (skillId) => {
    if (!setView(skillId)) return;
    setReviewResult(null);
    delete sessionAttemptIds.current[skillId];
    const id = chooseFreshTest(skillId, CONTENT_CATALOG[skillId] || []);
    if (id) setSelectedExamId(id);
    const attemptId=createAttemptId(skillId);
    sessionAttemptIds.current[skillId]=attemptId;
    writeDraft(`attempt:${skillId}`,{id:attemptId,testId:id});
  };

  // One attempt id per practice session: the automatic save when results
  // appear and the later "Save & Return" click update the same record.
  const sessionAttemptIds = useRef({});
  const [drillRequest, setDrillRequest] = useState(() => readDraft('active-drill'));
  const previousRoute = useRef(view);
  const selectedRouteId = useRef(selectedExamId);
  useEffect(() => { selectedRouteId.current = selectedExamId; }, [selectedExamId]);
  const fromHistory = useRef(false);
  useEffect(() => {
    const navigate = () => {
      const route = readScreenRoute();
      if (!route.view) return;
      if (!navigationRef.current(route.view)) {
        writeScreenRoute(previousRoute.current, selectedRouteId.current, true);
        return;
      }
      fromHistory.current = true;
      if (route.testId) setSelectedExamId(route.testId);
    };
    window.addEventListener('popstate', navigate);
    window.addEventListener('hashchange', navigate);
    return () => { window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); };
  }, []);
  useEffect(() => {
    if (fromHistory.current) { fromHistory.current = false; previousRoute.current = view; return; }
    writeScreenRoute(view, selectedExamId, previousRoute.current === view);
    previousRoute.current = view;
  }, [view, selectedExamId]);
  const startDrill = request => {
    if (!isSignedIn) { openSignIn(); return; }
    if (!setView('drill')) return;
    setDrillRequest(request);
  };

  const persistSkillResult = (skill, scoreData) => {
    completedSession.current = true;
    const savedAttempt=readDraft(`attempt:${skill}`);
    const restoredId=String(savedAttempt?.testId)===String(scoreData?.testId || selectedExamId) ? savedAttempt?.id : null;
    const id = scoreData?.attemptId || sessionAttemptIds.current[skill] || restoredId || createAttemptId(skill);
    writeDraft(`attempt:${skill}`,{id,testId:scoreData?.testId || selectedExamId});
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
  const reduceMotion = useReducedMotion();
  const pageVariants = {
    initial: { opacity: 0, y: reduceMotion ? 0 : 10, scale: 1 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: reduceMotion ? 0 : -6, scale: 1 },
  };

  const pageTransition = {
    duration: reduceMotion ? 0 : 0.18,
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
    if (!setView('mock')) return;
    if (examId) setSelectedExamId(examId);
  };

  return (
    <div className={`app-shell ${isExamFlow ? 'in-exam-flow' : ''}`}>
      <SyncStatus />
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
      <Suspense fallback={<PageLoader label="Loading practice content…" />}><AnimatePresence mode="wait" onExitComplete={resetWindowScroll}>
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
            {/* Re-grade the most recent Writing/Speaking test (latest only) */}
            <LastTestRecheck onRechecked={refreshScores} onOpenSettings={() => setSettingsOpen(true)} onViewResults={viewSavedResult} />

            {/* Combined 3 Feature Cards (Left) and Unified Scorecard (Right) */}
            <PerformanceOverview
              scores={scores}
              targetBand={targetBand}
              completedLessons={completedLessons}
              onOpenLearningHub={() => setView('learning')}
              onOpenPerformance={() => setView('performance')}
              onOpenTips={openTips}
              onOpenSpellingBee={() => setView('spelling-bee')}
              onOpenHarperWriting={() => setView('harper-writing')}
              onStartPractice={startSkillProtected}
            />

            <FocusedRecommendations onStartDrill={startDrill} onOpenLesson={openLesson} onOpenTips={openTips} onStartSkill={startSkillProtected} />

            {/* 3. Practice Section (Writing, Listening, Speaking, Reading) */}
            <PracticeSection
              scores={scores}
              targetBand={targetBand}
              onStartSkill={startSkillProtected}
              onReviewResult={viewSavedResult}
              onStartDrill={startDrill}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
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

        {view === 'spelling-bee' && <motion.div key="spelling-bee" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}><SpellingBee onBack={() => setView('home')} /></motion.div>}

        {view === 'drill' && <motion.div key="drill" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}><FocusedDrill key={`drill-${drillRequest?.key || 'saved'}`} request={drillRequest} onBack={() => { refreshScores(); setView('performance'); }} onOpenLesson={openLesson} onOpenTips={openTips} /></motion.div>}
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
              onStartDrill={startDrill}
              onOpenLesson={openLesson}
              onOpenTips={openTips}
              onReviewResult={viewSavedResult}
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
              onResumeDrill={startDrill}
              initialLessonId={learningLessonId}
              onBack={() => setView('home')}
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

        {view === 'harper-writing' && (
          <motion.div
            key="harper-writing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <HarperWritingPractice onBack={() => setView('home')} />
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
              initialResult={reviewResult?.skill === 'listening' ? reviewResult.result : null}
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
              initialResult={reviewResult?.skill === 'reading' ? reviewResult.result : null}
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
                key={reviewResult?.skill === 'writing' ? `review-${reviewResult.result.attemptId}` : 'writing-practice'}
                initialResult={reviewResult?.skill === 'writing' ? reviewResult.result : null}
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
              key={reviewResult?.skill === 'speaking' ? `review-${reviewResult.result.attemptId}` : 'speaking-practice'}
              initialResult={reviewResult?.skill === 'speaking' ? reviewResult.result : null}
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
                setView('home', { completed: true });
              }}
              onBack={() => setView('home')}
            />
          </motion.div>
        )}
      </AnimatePresence></Suspense>

      {practiceResource && <Suspense fallback={null}><PracticeResourceOverlay
        resource={practiceResource}
        onClose={() => setPracticeResource(null)}
        onPlayLesson={id => {
          if (!setView('learning')) return;
          setLearningLessonId(id);
          setPracticeResource(null);
        }}
      /></Suspense>}

      {/* ── SETTINGS MODAL (UNIVERSAL SYSTEM PANEL) ─────────────────── */}
      {settingsOpen && <SettingsModal
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
      />}

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
