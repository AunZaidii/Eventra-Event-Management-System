// Central error handling: every error leaves the API in the same JSON shape:
// { "error": { "code": "...", "message": "...", "details": [...] } }
const AppError = require('../utils/AppError');
const config = require('../config');

function notFound(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found.`, 'ROUTE_NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError)) {
    if (err.type === 'entity.parse.failed') {
      error = AppError.badRequest('INVALID_JSON', 'The request body is not valid JSON.');
    } else if (err.type === 'entity.too.large') {
      error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    } else if (err.code === '23505') {
      error = AppError.conflict('CONFLICT', 'This record already exists.');
    } else {
      // Unexpected: log the details, but never leak them to the client.
      console.error(err);
      error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
      if (!config.isProduction) error.details = [{ field: null, message: err.message }];
    }
  }

  const body = { error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
}

module.exports = { notFound, errorHandler };
