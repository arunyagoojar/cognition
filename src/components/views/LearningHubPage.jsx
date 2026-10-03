import React, { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon';
import Loader from '../common/Loader';
import { LEARNING_SKILLS } from '../../data/learningCatalog';
import {
  getCompletedLessons,
  saveCompletedLesson,
  getLastWatchedLesson,
  saveLastWatchedLesson
} from '../../utils/storage';
import { syncLessonComplete } from '../../utils/api';

const CATEGORY_ORDER = ['reading', 'listening', 'writing', 'speaking'];

export default function LearningHubPage({ initialLessonId = null, onBack, onContextChange, onOpenPractice }) {
  const [completedLessons, setCompletedLessons] = useState(() => getCompletedLessons() || []);

  // Determine initial video & category based on viewing history
  const allLessons = LEARNING_SKILLS.flatMap(s => s.lessons || []);
  const lastWatchedId = getLastWatchedLesson();
  const lastWatchedLesson = lastWatchedId ? allLessons.find(l => l.id === lastWatchedId) : null;

  // If no history, find first lesson of Reading (or first available)
  const defaultSkill = LEARNING_SKILLS.find(s => s.id === 'reading') || LEARNING_SKILLS[0];
  const initialLesson = (initialLessonId && allLessons.find(l => l.id === initialLessonId)) || lastWatchedLesson || defaultSkill.lessons[0];
  const initialCategory = initialLesson?.skill || 'reading';

  const [activeLesson, setActiveLesson] = useState(initialLesson);
  const [openCategory, setOpenCategory] = useState(initialCategory);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const videoRef = useRef(null);

  // Synchronize category with active lesson and notify global contextual navigation
  useEffect(() => {
    if (activeLesson) {
      setOpenCategory(activeLesson.skill);
      saveLastWatchedLesson(activeLesson.id);
      if (onContextChange) {
        onContextChange({
          skill: activeLesson.skill,
          lessonTitle: activeLesson.title || 'Lesson 01',
        });
      }
    }
  }, [activeLesson?.id]);

  const handleSelectLesson = (lesson) => {
    if (lesson.id === activeLesson?.id) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveLesson(lesson);
      setOpenCategory(lesson.skill);
      saveLastWatchedLesson(lesson.id);
      setIsTransitioning(false);
    }, 120);
  };

  const handleToggleCategory = (catId) => {
    // Accordion: clicking opens this category and closes all others
    setOpenCategory(prev => (prev === catId ? catId : catId));
  };

  const handleMarkComplete = (lessonId) => {
    saveCompletedLesson(lessonId);
    syncLessonComplete(lessonId);
    setCompletedLessons(getCompletedLessons());
  };

  const isCurrentDone = completedLessons.includes(activeLesson?.id);

  // Map category data in strict specified order
  const categories = CATEGORY_ORDER.map(catId => {
    const skillData = LEARNING_SKILLS.find(s => s.id === catId);
    return {
      id: catId,
      title: catId.toUpperCase(),
      lessons: skillData?.lessons || [],
      count: skillData?.lessons?.length || 0,
    };
  });

  return (
    <div className="learning-hub-page">

      {/* Main Two-Area Layout */}
      <div className="hub-video-full-wrapper">
        {/* ── TOP: Full-width Visually Dominant Video Player ── */}
        <section className="hub-video-section">
          {/* Large Rounded Video Container */}
          <div className="hub-player-container">
            <div className={`hub-player-inner ${isTransitioning ? 'hub-fade-out' : 'hub-fade-in'}`}>
              {activeLesson?.videoUrl ? (
                <video
                  ref={videoRef}
                  key={activeLesson.id}
                  src={activeLesson.videoUrl}
                  controls
                  playsInline
                  className="hub-html-video"
                  onEnded={() => handleMarkComplete(activeLesson.id)}
                />
              ) : activeLesson?.youtubeId ? (
                <iframe
                  key={activeLesson.id}
                  title={activeLesson.title}
                  src={`https://www.youtube-nocookie.com/embed/${activeLesson.youtubeId}?autoplay=0&rel=0`}
                  className="hub-iframe-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="hub-video-placeholder">
                  <Loader label="Loading video" size="sm" />
                </div>
              )}
            </div>
          </div>

        </section>
      </div>

      <div className="hub-bottom-row">
        {/* ── LEFT (60-65%): Lesson Information Below Video ── */}
        <div className="hub-lesson-info-col">
          <div className={`hub-lesson-info ${isTransitioning ? 'hub-fade-out' : 'hub-fade-in'}`}>
            <div className="hub-info-header">
              <div className="hub-meta-pill-group">
                <span className="pill-badge pill-black">
                  {activeLesson?.skill?.toUpperCase()} · LESSON {String(activeLesson?.lessonNumber || 1).padStart(2, '0')}
                </span>
                <span className="hub-duration-badge">
                  <Icon name="clock" size={13} /> {activeLesson?.duration}
                </span>
                {isCurrentDone && (
                  <span className="hub-completed-badge">
                    <Icon name="check" size={13} /> Watched
                  </span>
                )}
              </div>

              <button
                className={`hub-complete-toggle ${isCurrentDone ? 'done' : ''}`}
                onClick={() => handleMarkComplete(activeLesson.id)}
              >
                <Icon name={isCurrentDone ? 'check' : 'zap'} size={14} />
                <span>{isCurrentDone ? 'Completed' : 'Mark Complete'}</span>
              </button>
            </div>

            <h1 className="hub-lesson-title">
              {activeLesson?.title}
            </h1>

            <p className="hub-lesson-desc">
              {activeLesson?.description}
            </p>
          </div>
        </div>

        {/* ── RIGHT (35–40%): Category-Based Collapsible Playlist ── */}
        <aside className="hub-playlist-aside">
          <div className="hub-playlist-card">
            <div className="hub-playlist-header">
              <h2 className="hub-playlist-heading">Playlist</h2>
              <span className="hub-playlist-sub">
                {allLessons.length} lessons total
              </span>
            </div>

            <div className="hub-accordion-wrap">
              {categories.map((cat) => {
                const isOpen = openCategory === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`hub-category-accordion ${isOpen ? 'open' : 'closed'}`}
                  >
                    {/* Category Header Bar */}
                    <button
                      className="hub-cat-header-btn"
                      onClick={() => handleToggleCategory(cat.id)}
                    >
                      <div className="hub-cat-header-left">
                        <span className="hub-cat-name">{cat.title}</span>
                      </div>
                      <div className="hub-cat-header-right">
                        <span className="hub-cat-count">{cat.count} lessons</span>
                        <span className={`hub-cat-chevron ${isOpen ? 'rotated' : ''}`}>
                          ▼
                        </span>
                      </div>
                    </button>

                    {/* Collapsible Lesson List (Spring Animated Grid) */}
                    <div className="hub-cat-collapse-body">
                      <div className="hub-cat-collapse-inner">
                        <div className="hub-lessons-list">
                          {cat.lessons.map((lesson) => {
                            const isActive = activeLesson?.id === lesson.id;
                            const isDone = completedLessons.includes(lesson.id);

                            return (
                              <div
                                key={lesson.id}
                                className={`hub-lesson-row ${isActive ? 'active' : ''}`}
                                onClick={() => handleSelectLesson(lesson)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && handleSelectLesson(lesson)}
                              >
                                {/* Left Play / Number indicator */}
                                <div className="hub-lesson-num-box">
                                  {isActive ? (
                                    <span className="hub-play-indicator">▶</span>
                                  ) : isDone ? (
                                    <span className="hub-check-indicator">✓</span>
                                  ) : (
                                    <span className="hub-num-text">
                                      {String(lesson.lessonNumber).padStart(2, '0')}
                                    </span>
                                  )}
                                </div>

                                {/* Title & Duration */}
                                <div className="hub-lesson-meta-box">
                                  <div className="hub-row-title">
                                    {lesson.title}
                                  </div>
                                  <div className="hub-row-duration">
                                    {lesson.duration}
                                  </div>
                                </div>

                                {isActive && (
                                  <span className="hub-active-dot" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
