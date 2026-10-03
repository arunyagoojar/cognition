import React from 'react';
import Icon from '../common/Icon';
import { resolveRecommendations } from '../../data/recommendations.js';

/**
 * Focus Areas + next steps (Phase 6).
 * Deterministic weaknesses → real content links (lesson / tip / practice).
 */
export default function FocusAreas({ focusAreas, onOpenLesson, onOpenTips, onStartPractice }) {
  if (!focusAreas || focusAreas.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {focusAreas.map((area) => {
        const recs = resolveRecommendations(area);
        return (
          <div key={area.key} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {area.skill.charAt(0).toUpperCase() + area.skill.slice(1)}
            </div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text-primary)', marginBottom: 4 }}>
              {area.label}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              {area.detail}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {recs?.lesson && (
                <button type="button" className="nav-back-btn" style={{ borderColor: 'var(--c-coral)' }}
                  onClick={() => onOpenLesson?.(recs.lesson.id)}>
                  <Icon name="play" size={12} /> Watch lesson
                </button>
              )}
              {recs?.tip && (
                <button type="button" className="nav-back-btn"
                  onClick={() => onOpenTips?.(recs.tip.skill, recs.tip.categoryId)}>
                  <Icon name="book" size={12} /> Read tip
                </button>
              )}
              {recs?.practice && (
                <button type="button" className="nav-back-btn"
                  onClick={() => onStartPractice?.(recs.practice.view)}>
                  <Icon name="target" size={12} /> {recs.practice.label}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
