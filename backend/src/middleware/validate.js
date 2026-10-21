// Validates req.params / req.query / req.body against Zod schemas.
// Clean values are stored on req.valid; bad input becomes a 400 VALIDATION_ERROR.
const AppError = require('../utils/AppError');

function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || null,
    message: issue.message,
  }));
}

module.exports = function validate(schemas) {
  return (req, res, next) => {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = formatIssues(result.error.issues);
        const message = part === 'params' && details[0] ? details[0].message : 'Please check the highlighted fields.';
        return next(AppError.badRequest('VALIDATION_ERROR', message, details));
      }
      req.valid[part] = result.data;
    }
    return next();
  };
};
