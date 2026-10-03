import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useReverification } from '@clerk/react';
import { isReverificationCancelledError } from '@clerk/react/errors';
import Icon from '../common/Icon';
import { deleteAccountData } from '../../utils/api';

export default function AccountModal({ isOpen, onClose }) {
  const { user, isLoaded } = useUser();
  // Wraps destructive Clerk calls: when the session is stale, Clerk opens its
  // re-verification modal (password / email code) and retries on success.
  const deleteWithVerification = useReverification();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  if (!isOpen) return null;

  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';

  const clearLocalData = () => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('omniprep_'))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* private mode — nothing to clean */ }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      // 1. Purge Cloudflare-stored data while the session token is still valid.
      //    Never delete the Clerk account first — the session powers this call,
      //    and orphaned server data is worse than a retryable step.
      const purge = await deleteAccountData();
      if (!purge.ok) {
        throw new Error(purge.networkError
          ? 'Couldn’t reach the server to erase your saved data. Check your connection and try again — your account has not been deleted.'
          : (purge.message || 'Could not delete your saved data. Please try again.'));
      }
      // 2. Delete the Clerk account — may require identity re-verification.
      await deleteWithVerification(() => user.delete());
      clearLocalData();
      // Clerk cleans up the session automatically after account deletion.
      onClose();
    } catch (err) {
      if (isReverificationCancelledError(err)) {
        setDeleteError('Verification cancelled — your account was not deleted.');
      } else {
        console.error('Failed to delete account:', err);
        setDeleteError(err?.message || 'Failed to delete account. Please try again.');
      }
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
                    For security, you&apos;ll be asked to verify your identity first.
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
