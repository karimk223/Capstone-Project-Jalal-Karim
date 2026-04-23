/**
 * Custom error class used throughout controllers.
 * Addresses Gap 7: instead of leaking raw SQL / framework errors to the client,
 * controllers throw ApiError with a stable `code` (from api-spec.md §9) and a
 * human-readable English message. The errorHandler middleware formats them
 * into the JSON shape the spec requires.
 */

class ApiError extends Error {
  /**
   * @param {number} status   HTTP status code (e.g. 400, 401, 403, 404, 409)
   * @param {string} code     stable string code from api-spec.md §9 (e.g. 'INVALID_CREDENTIALS')
   * @param {string} message  human-readable English message shown to the user
   */
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = ApiError;
