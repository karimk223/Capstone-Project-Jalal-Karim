// src/utils/apiError.js
// Translates axios/server errors into user-friendly translated messages.
// Addresses Gap 7: the legacy system showed raw codes like "FRM-40350".
// We never show raw codes — every error maps to a key in en.json.

import i18n from '../i18n';

// Maps api-spec.md §9 error codes → en.json keys
const CODE_MAP = {
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  NOT_AUTHENTICATED:   'errors.unauthorized',
  TOKEN_EXPIRED:       'errors.unauthorized',
  FORBIDDEN_ROLE:      'errors.forbidden',
  NOT_FOUND:           'errors.notFound',
  DUPLICATE_EMAIL:     'errors.duplicateEmail',
};

/**
 * getErrorMessage
 * Given an Error thrown by axios, returns a localized string safe to show the user.
 *
 * Priority:
 *   1. Known server error.code → look up i18n key
 *   2. Server returned a plain message string → use it
 *   3. No response (network down) → network message
 *   4. Anything else → generic fallback
 */
export function getErrorMessage(err) {
  if (err && !err.response) {
    return i18n.t('errors.network');
  }
  const serverError = err?.response?.data?.error;
  if (serverError?.code && CODE_MAP[serverError.code]) {
    return i18n.t(CODE_MAP[serverError.code]);
  }
  if (serverError?.message) {
    return serverError.message;
  }
  return i18n.t('errors.generic');
}
