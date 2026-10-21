// An expected error with an HTTP status and a machine-readable code.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(code, message, details) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Please sign in to continue.', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }

  static notFound(message = 'Not found.', code = 'NOT_FOUND') {
    return new AppError(404, code, message);
  }

  static conflict(code, message) {
    return new AppError(409, code, message);
  }
}

module.exports = AppError;
