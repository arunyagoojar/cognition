/**
 * Public build configuration (Phase 5 hardening).
 *
 * VITE_CLERK_PUBLISHABLE_KEY is publishable by design — it ships in every
 * client bundle regardless. Baking it as the default here means production
 * builds can never accidentally ship auth-disabled (the recurring blank-page
 * regression), while .env/.env.production still override for other projects.
 */
export const CLERK_PUBLISHABLE_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY) ||
  'pk_test_bXVzaWNhbC1kdWNrLTM5MTcuY2xlcmsuYWNjb3VudHMuZGV2JA';
