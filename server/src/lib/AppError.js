export class AppError extends Error {
  constructor(status, code, message, { fields, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }
}

export const notFound = (what = 'That record') => new AppError(404, 'NOT_FOUND', `${what} does not exist.`);

export const invalid = (fields) =>
  new AppError(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', { fields });
