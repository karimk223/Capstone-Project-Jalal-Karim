/**
 * Joi validation middleware. Factory: call `validate(schema)` and plug the
 * returned middleware into any route that accepts a JSON body.
 *
 * Implements coding-conventions.md §4.5 and NFR-2: every POST/PATCH route
 * passes through here before its controller runs.
 */

const ApiError = require('../utils/apiError');

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,  // surface all failures at once — better UX than one-at-a-time
      stripUnknown: true, // drop fields not in the schema instead of rejecting them
    });
    if (error) {
      // Flatten Joi's error array into a single readable sentence.
      const message = error.details.map(d => d.message).join('; ');
      return next(new ApiError(400, 'VALIDATION_FAILED', message));
    }
    // Replace the body with the validated + sanitized version.
    req.body = value;
    next();
  };
}

module.exports = validate;
