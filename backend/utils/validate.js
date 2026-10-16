const { fail } = require('./response');

/**
 * SECURITY CONTROL: Input Validation
 * A small, dependency-free validator (no Joi/Zod needed for this project's
 * size). Each controller defines a `rules` object describing what it expects
 * for req.body, and calls `validate(req.body, rules)` before touching the
 * database. Returns an array of human-readable error strings — empty means
 * the input passed.
 *
 * Rule shape per field:
 *   { required: true, type: 'string'|'number'|'boolean'|'date', min, max,
 *     enum: [...], pattern: /regex/, label: 'Friendly name' }
 */
function validate(body, rules) {
  const errors = [];
  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    const value = body[field];
    const present = value !== undefined && value !== null && value !== '';

    if (rule.required && !present) {
      errors.push(`${label} is required`);
      continue;
    }
    if (!present) continue; // optional and not provided — skip further checks

    if (rule.type === 'number' && (typeof value !== 'number' || Number.isNaN(value))) {
      errors.push(`${label} must be a number`);
    }
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push(`${label} must be text`);
    }
    if (rule.type === 'string' && typeof value === 'string') {
      if (rule.min && value.trim().length < rule.min) errors.push(`${label} must be at least ${rule.min} characters`);
      if (rule.max && value.trim().length > rule.max) errors.push(`${label} must be at most ${rule.max} characters`);
    }
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      errors.push(`${label} is not in a valid format`);
    }
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${label} must be one of: ${rule.enum.join(', ')}`);
    }
  }
  return errors;
}

/** Express middleware factory: validates req.body against `rules`, and
 *  responds 400 with the error list if any fail — controller code never runs. */
function validateBody(rules) {
  return (req, res, next) => {
    const errors = validate(req.body || {}, rules);
    if (errors.length) return fail(res, errors[0], 400, errors);
    next();
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,30}$/;

module.exports = { validate, validateBody, EMAIL_PATTERN, USERNAME_PATTERN };
