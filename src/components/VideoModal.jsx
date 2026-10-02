import React, { useRef, useState, useEffect } from 'react';
import Icon from './common/Icon';
import { saveCompletedLesson } from '../utils/storage';

export default function VideoModal({ lesson, onClose }) {
  const videoRef = useRef(null);
  const [marked, setMarked] = useState(false);

  /* Close on Escape */
  useEffect(() => {
    const fn = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  /* Auto-mark complete when video ends */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => {
      saveCompletedLesson(lesson.id);
      setMarked(true);
    };
    video.addEventListener('ended', handler);
    return () => video.removeEventListener('ended', handler);
  }, [lesson.id]);

  const handleMarkComplete = () => {
    saveCompletedLesson(lesson.id);
    setMarked(true);
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="vmodal" role="dialog" aria-modal="true" aria-label={lesson.title}>

        <div className="vmodal-head">
          <h3>{lesson.title}</h3>
          <button className="vmodal-close" onClick={onClose} aria-label="Close video">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="vwrap">
          <video
            ref={videoRef}
            src={lesson.videoUrl}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        <div className="vmodal-body">
          <p>{lesson.description}</p>

          {lesson.takeaways?.length > 0 && (
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                Key Takeaways
              </p>
              <div className="takeaways">
                {lesson.takeaways.map((t, i) => (
                  <div key={i} className="takeaway">
                    <div className="takeaway-dot" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            {!marked && (
              <button className="btn-s" onClick={handleMarkComplete}>
                <Icon name="check" size={14} />
                Mark as Complete
              </button>
            )}
            {marked && (
              <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                <Icon name="check" size={14} />
                Completed!
              </span>
            )}
            <button className="btn-p" onClick={onClose}>Done</button>
          </div>
        </div>

      </div>
    </div>
  );
}
