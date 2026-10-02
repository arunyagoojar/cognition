import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/react';
import Icon from '../common/Icon';

export default function AccountModal({ isOpen, onClose }) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  if (!isOpen) return null;

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await user.delete();
      // Clerk handles session cleanup automatically on user.delete()
      onClose();
    } catch (err) {
      console.error('Failed to delete account:', err);
      setDeleteError(err?.message || 'Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setConfirmDelete(false);
    setDeleteError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        style={{ zIndex: 1100 }}
      >
        <motion.div
          className="account-modal-card"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: 'spring', stiffness: 460, damping: 30 }}
        >
          {/* Header */}
          <div className="account-modal-header">
            <div className="account-modal-title-wrap">
              <span className="account-modal-title">Account</span>
              <span className="account-modal-status-badge">
                <span className="account-status-dot" />
                Active
              </span>
            </div>
            <button
              className="account-modal-close-btn"
              onClick={handleClose}
              aria-label="Close account modal"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Email Section */}
          <div className="account-modal-body">
            <div className="account-field-group">
              <label className="account-field-label">Email</label>
              <div className="account-email-box">
                <div className="account-email-icon-wrap">
                  <Icon name="mail" size={16} />
                </div>
                <span className="account-email-text" title={email}>
                  {email || 'No email available'}
                </span>
                <span className="account-email-verified-badge" title="Verified email">
                  <Icon name="check" size={12} />
                  <span>Verified</span>
                </span>
              </div>
            </div>

            {/* Error Message */}
            {deleteError && (
              <div className="account-delete-error" role="alert">
                <Icon name="alertCircle" size={15} />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Delete Account Section */}
            <div className="account-danger-zone">
              {!confirmDelete ? (
                <button
                  type="button"
                  className="account-delete-btn"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isDeleting || !isLoaded}
                >
                  <Icon name="trash" size={15} />
                  <span>Delete account</span>
                </button>
              ) : (
                <div className="account-confirm-box">
                  <div className="account-confirm-header">
                    <Icon name="alertCircle" size={16} />
                    <span className="account-confirm-title">Delete your account?</span>
                  </div>
                  <p className="account-confirm-desc">
                    This will permanently delete your account, saved test scores, and learning progress. This cannot be undone.
                  </p>
                  <div className="account-confirm-actions">
                    <button
                      type="button"
                      className="account-confirm-cancel-btn"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="account-confirm-delete-btn"
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <span className="account-delete-spinner" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="trash" size={14} />
                          <span>Yes, delete account</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
