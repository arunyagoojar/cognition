import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Unified Contextual Navigation Row
 * Sits immediately below the global header as part of a single coherent navigation hierarchy.
 *
 * Visual Hierarchy:
 * - Previous levels: dark gray/black, slightly smaller, subtle hover transition
 * - Current level: coral #FF5734, slightly stronger emphasis, non-clickable
 * - Separators: clean subtle "/"
 * - Optional right control: page-specific metadata/tools
 * - Responsive: Collapses intermediate levels into "…" when trail is long
 */
export default function ContextualNav({ items = [], rightSlot = null }) {
  const [expandedEllipsis, setExpandedEllipsis] = useState(false);

  if (!items || items.length === 0) return null;

  // If there are more than 3 items and ellipsis not expanded, collapse middle levels for compact displays
  const shouldCollapse = items.length > 3 && !expandedEllipsis;
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const secondLastItem = items.length >= 3 ? items[items.length - 2] : null;
  const collapsedMiddle = items.slice(1, items.length - 2);

  return (
    <nav className="contextual-nav-bar" aria-label="Breadcrumb hierarchy">
      <div className="contextual-nav-inner">
        {/* Left: Unified Horizontal Breadcrumb Trail */}
        <ol className="breadcrumb-list">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            const isMiddleCollapsed =
              shouldCollapse && idx > 0 && idx < items.length - 2;

            // Render ellipsis placeholder in place of the first collapsed item on mobile
            if (shouldCollapse && idx === 1) {
              return (
                <React.Fragment key="middle-ellipsis-wrap">
                  {/* Desktop view shows all items */}
                  <li className="breadcrumb-item breadcrumb-desktop-only">
                    {item.onClick ? (
                      <motion.button
                        type="button"
                        className="breadcrumb-link"
                        onClick={item.onClick}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {item.label}
                      </motion.button>
                    ) : (
                      <span className="breadcrumb-static">{item.label}</span>
                    )}
                  </li>
                  <li className="breadcrumb-sep breadcrumb-desktop-only" aria-hidden="true">/</li>

                  {/* Mobile view shows collapsed ellipsis button */}
                  <li className="breadcrumb-item breadcrumb-mobile-only">
                    <button
                      type="button"
                      className="breadcrumb-ellipsis-btn"
                      onClick={() => setExpandedEllipsis(true)}
                      title="Show full path"
                      aria-label="Expand hidden navigation levels"
                    >
                      …
                    </button>
                  </li>
                  <li className="breadcrumb-sep breadcrumb-mobile-only" aria-hidden="true">/</li>
                </React.Fragment>
              );
            }

            if (isMiddleCollapsed) {
              return (
                <React.Fragment key={idx}>
                  <li className="breadcrumb-item breadcrumb-desktop-only">
                    {item.onClick ? (
                      <motion.button
                        type="button"
                        className="breadcrumb-link"
                        onClick={item.onClick}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {item.label}
                      </motion.button>
                    ) : (
                      <span className="breadcrumb-static">{item.label}</span>
                    )}
                  </li>
                  {!isLast && (
                    <li className="breadcrumb-sep breadcrumb-desktop-only" aria-hidden="true">/</li>
                  )}
                </React.Fragment>
              );
            }

            return (
              <React.Fragment key={idx}>
                <li
                  className={`breadcrumb-item ${isLast ? 'breadcrumb-item-current' : ''}`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {isLast ? (
                    <span className="breadcrumb-current-text">{item.label}</span>
                  ) : item.onClick ? (
                    <motion.button
                      type="button"
                      className="breadcrumb-link"
                      onClick={item.onClick}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {item.label}
                    </motion.button>
                  ) : (
                    <span className="breadcrumb-static">{item.label}</span>
                  )}
                </li>

                {!isLast && (
                  <li className="breadcrumb-sep" aria-hidden="true">
                    /
                  </li>
                )}
              </React.Fragment>
            );
          })}
        </ol>

        {/* Right: Optional Page-Specific Controls / Context */}
        {rightSlot && (
          <div className="contextual-nav-right">
            {rightSlot}
          </div>
        )}
      </div>
    </nav>
  );
}
