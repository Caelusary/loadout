import mongoose from 'mongoose';
import multer from 'multer';
import { AppError } from '../lib/AppError.js';

const DUPLICATE = {
  email: { field: 'email', message: 'An account with this email already exists.' },
  'sellerProfile.slug': { field: 'shopName', message: 'That shop name is already taken.' },
  slug: { field: 'name', message: 'A product with this name already exists.' },
  user: { message: 'You have already reviewed this product.' },
  code: { field: 'code', message: 'That code already exists.' },
};

function normalize(err) {
  if (err instanceof AppError) return err;
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([path, e]) => [path, e.message]));
    return new AppError(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', { fields });
  }
  if (err instanceof mongoose.Error.CastError) {
    return new AppError(404, 'NOT_FOUND', 'That record does not exist.');
  }
  if (err?.code === 11000) {
    const key = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0];
    const known = DUPLICATE[key] ?? { message: 'That record already exists.' };
    return new AppError(409, 'CONFLICT', known.message, {
      fields: known.field ? { [known.field]: known.message } : undefined,
    });
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Files must be 8 MB or smaller.');
    return new AppError(400, 'VALIDATION_ERROR', 'Upload one file in the "file" field.');
  }
  if (err?.type === 'entity.parse.failed') return new AppError(400, 'VALIDATION_ERROR', 'The request body is not valid JSON.');
  if (err?.type === 'entity.too.large') return new AppError(413, 'FILE_TOO_LARGE', 'The request body is too large.');
  return null;
}

export function notFoundRoute(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}.`));
}

// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument signature to treat this as an error handler.
export function errorHandler(err, req, res, next) {
  const known = normalize(err);
  if (!known) console.error(err);
  const e = known ?? new AppError(500, 'SERVER_ERROR', 'Something went wrong on our side. Try again.');
  res.status(e.status).json({
    error: {
      code: e.code,
      message: e.message,
      ...(e.fields && { fields: e.fields }),
      ...(e.details && { details: e.details }),
    },
  });
}
