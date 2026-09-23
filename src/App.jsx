import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import Navbar from './components/common/Navbar';
import SettingsModal from './components/common/SettingsModal';
import Dashboard from './components/dashboard/Dashboard';
import ListeningModule from './components/modules/ListeningModule';
import ReadingModule from './components/modules/ReadingModule';
import WritingModule from './components/modules/WritingModule';
import SpeakingModule from './components/modules/SpeakingModule';
import MockExamFlow from './components/modules/MockExamFlow';
import ExitScreen from './components/common/ExitScreen';
import GreTrack from './components/tracks/GreTrack';
import DmatTrack from './components/tracks/DmatTrack';
import HomePage from './components/home/HomePage';

import testData from './data/tests/cambridge17_test1.json';
import { getCompletedResults, getApiKey, getAppSettings, applyAppSettings } from './utils/storage';

export default function App() {
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || window.location.hash.replace('#', '') || 'dashboard';
  };

  const getInitialTrack = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('track') || 'HOME';
  };

  const [activeTrack, setActiveTrack] = useState(getInitialTrack);
  const [activeModule, setActiveModuleState] = useState(getInitialTab);
  const [lastBrowsedTrack, setLastBrowsedTrack] = useState(() => {
    return getInitialTrack() || 'HOME';
  });
  const [completedHistory, setCompletedHistory] = useState(getCompletedResults());
  const [isDmatInExam, setIsDmatInExam] = useState(false);
  const [isGreInExam, setIsGreInExam] = useState(false);
  const [greInitialModule, setGreInitialModule] = useState(null);
  const [dmatInitialModule, setDmatInitialModule] = useState(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(() => {
    return new URLSearchParams(window.location.search).get('apiKeyModal') === '1';
  });
  const [apiKey, setApiKey] = useState(getApiKey());

  // Apply saved theme and font scale on startup
  useEffect(() => {
    applyAppSettings(getAppSettings());
  }, []);

  // Listen to browser Back / Forward events
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      const track = params.get('track') || 'HOME';
      setActiveModuleState(tab);
      setActiveTrack(track);
      if (tab === 'dashboard') {
        setLastBrowsedTrack(track);
      }
      setIsDmatInExam(false);
      setIsGreInExam(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setActiveModule = (mod) => {
    if (mod && mod !== 'dashboard' && activeTrack === 'IELTS') {
      setLastBrowsedTrack('IELTS');
    }
    setActiveModuleState(mod);
    const url = new URL(window.location);
    if (!mod || mod === 'dashboard') {
      url.searchParams.delete('tab');
      url.searchParams.delete('setId');
      url.searchParams.delete('showModal');
      if (activeTrack === 'IELTS') {
        url.searchParams.set('track', 'IELTS');
      }
      const queryStr = url.searchParams.toString();
      const cleanPath = queryStr ? `${url.pathname}?${queryStr}` : url.pathname;
      window.history.pushState({}, '', cleanPath);
    } else {
      url.searchParams.set('tab', mod);
      window.history.pushState({}, '', url);
    }
  };

  const handleGoHome = () => {
    setLastBrowsedTrack('HOME');
    setActiveTrack('HOME');
    setIsDmatInExam(false);
    setIsGreInExam(false);
    setGreInitialModule(null);
    setDmatInitialModule(null);
    setActiveModuleState('dashboard');
    const url = new URL(window.location);
    url.searchParams.delete('tab');
    url.searchParams.delete('track');
    url.searchParams.delete('setId');
    url.searchParams.delete('showModal');
    window.history.pushState({}, '', url.pathname);
    window.scrollTo(0, 0);
  };

  const handleExitToLastTab = () => {
    const targetTrack = lastBrowsedTrack || 'IELTS';
    setActiveTrack(targetTrack);
    setIsDmatInExam(false);
    setIsGreInExam(false);
    setGreInitialModule(null);
    setDmatInitialModule(null);
    setActiveModuleState('dashboard');

    const url = new URL(window.location);
    url.searchParams.delete('tab');
    url.searchParams.delete('setId');
    url.searchParams.delete('showModal');
    if (targetTrack === 'HOME') {
      url.searchParams.delete('track');
    } else {
      url.searchParams.set('track', targetTrack);
    }
    const queryStr = url.searchParams.toString();
    const cleanPath = queryStr ? `${url.pathname}?${queryStr}` : url.pathname;
    window.history.pushState({}, '', cleanPath);
    window.scrollTo(0, 0);
  };

  const handleLaunchMock = () => {
    if (activeTrack === 'IELTS') {
      setLastBrowsedTrack('IELTS');
    }
    setActiveTrack('IELTS');
    setIsDmatInExam(false);
    setIsGreInExam(false);
    setActiveModule('mock_test');
    window.scrollTo(0, 0);
  };

  const handleTrackChange = (track, initialMod = null) => {
    if (!initialMod) {
      setLastBrowsedTrack(track);
    }
    setActiveTrack(track);
    setIsDmatInExam(false);
    setIsGreInExam(false);
    setGreInitialModule(track === 'GRE' ? initialMod : null);
    setDmatInitialModule(track === 'DMAT' ? initialMod : null);
    const url = new URL(window.location);
    if (track === 'HOME') {
      url.searchParams.delete('track');
      url.searchParams.delete('tab');
    } else if (track === 'IELTS') {
      url.searchParams.set('track', 'IELTS');
      if (initialMod) {
        setActiveModule(initialMod);
      } else {
        setActiveModule('dashboard');
      }
    } else {
      url.searchParams.set('track', track);
      url.searchParams.delete('tab');
    }
    const queryStr = url.searchParams.toString();
    const cleanPath = queryStr ? `${url.pathname}?${queryStr}` : url.pathname;
    window.history.pushState({}, '', cleanPath);
    window.scrollTo(0, 0);
  };

  const isInMockExam = activeModule === 'mock_test' && activeTrack === 'IELTS';

  // True whenever user is inside any exam/module screen (hides navbar + footer)
  const examModules = ['listening', 'reading', 'writing', 'speaking', 'mock_test'];
  const isInExam = (activeTrack === 'IELTS' && examModules.includes(activeModule)) || 
                   (activeTrack === 'DMAT' && isDmatInExam) ||
                   (activeTrack === 'GRE' && isGreInExam);

  const [isDmatGuidelinesOpen, setIsDmatGuidelinesOpen] = useState(false);

  return (
    <div className={`app-container${isInExam ? ' exam-mode' : ''}`}>
      {!isInExam && (
        <Navbar
          activeTrack={activeTrack}
          setActiveTrack={handleTrackChange}
          onGoHome={handleGoHome}
          onOpenMockTest={handleLaunchMock}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          onOpenDmatGuidelines={() => setIsDmatGuidelinesOpen(true)}
          hasApiKey={Boolean(apiKey)}
          isInMockExam={isInMockExam}
        />
      )}

      <main className={`main-content${isInExam ? ' exam-mode' : ''}`}>
        {/* Track Switching: Home Overview & Performance Radar */}
        {activeTrack === 'HOME' && (
          <div key="home-track" className="page-view-enter">
            <HomePage
              onNavigateTrack={(track) => handleTrackChange(track)}
              onNavigateModule={(track, mod) => handleTrackChange(track, mod)}
            />
          </div>
        )}

        {/* Track Switching: GRE Track */}
        {activeTrack === 'GRE' && (
          <div key="gre-track" className="page-view-enter">
            <GreTrack
              onBackToIelts={() => handleTrackChange('HOME')}
              onExamStateChange={setIsGreInExam}
              initialModule={greInitialModule}
              onExitToLastTab={handleExitToLastTab}
            />
          </div>
        )}

        {/* Track Switching: DMAT Track */}
        {activeTrack === 'DMAT' && (
          <div key="dmat-track" className="page-view-enter">
            <DmatTrack
              onBackToIelts={() => handleTrackChange('HOME')}
              onExamStateChange={setIsDmatInExam}
              isGuidelinesOpen={isDmatGuidelinesOpen}
              setIsGuidelinesOpen={setIsDmatGuidelinesOpen}
              initialModule={dmatInitialModule}
              onExitToLastTab={handleExitToLastTab}
            />
          </div>
        )}

        {/* Track Switching: IELTS Academic Track */}
        {activeTrack === 'IELTS' && (
          <div key={activeModule} className="page-view-enter">
            {activeModule === 'dashboard' && (
              <Dashboard
                onSelectModule={(mod) => {
                  setActiveModule(mod);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onStartMockTest={handleLaunchMock}
                completedHistory={completedHistory}
              />
            )}

            {activeModule === 'listening' && (
              <ListeningModule
                testData={testData}
                onBackToDashboard={handleExitToLastTab}
                onComplete={(result) => {
                  setCompletedHistory(getCompletedResults());
                }}
              />
            )}

            {activeModule === 'reading' && (
              <ReadingModule
                testData={testData}
                onBackToDashboard={handleExitToLastTab}
                onComplete={(result) => {
                  setCompletedHistory(getCompletedResults());
                }}
              />
            )}

            {activeModule === 'writing' && (
              <WritingModule
                testData={testData}
                onBackToDashboard={handleExitToLastTab}
                onComplete={(result) => {
                  setCompletedHistory(getCompletedResults());
                }}
              />
            )}

            {activeModule === 'speaking' && (
              <SpeakingModule
                testData={testData}
                onBackToDashboard={handleExitToLastTab}
                onComplete={(result) => {
                  setCompletedHistory(getCompletedResults());
                }}
              />
            )}

            {activeModule === 'mock_test' && (
              <MockExamFlow
                testData={testData}
                onExitToDashboard={handleExitToLastTab}
              />
            )}
          </div>
        )}
      </main>

      {!isInExam && (
        <footer style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <span>Cognition • Designed with Apple Human Interface &amp; Notion Dark Palette</span>
          </div>
          <div>
            <span>Preparation Tracks: <strong>Home Hub</strong> • <strong>IELTS Academic</strong> • <strong>GRE General</strong> • <strong>dMAT Assessment</strong></span>
          </div>
        </footer>
      )}

      {/* Standalone Display Settings Trigger during active exam mode */}
      {isInExam && (
        <button
          className="nav-icon-btn"
          onClick={() => setIsApiKeyModalOpen(true)}
          title="Exam Preferences: Resize Font & Switch Theme"
          style={{
            position: 'fixed',
            top: 14,
            right: 18,
            zIndex: 800,
            boxShadow: 'var(--shadow-md)'
          }}
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      )}

      {/* Standalone Preferences & Gemini AI Engine Settings Modal */}
      <SettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          setApiKey(getApiKey());
        }}
        onSettingsChanged={(newSettings) => {
          setApiKey(newSettings.apiKey);
        }}
      />
    </div>
  );
}
