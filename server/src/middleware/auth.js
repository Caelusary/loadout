import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../lib/AppError.js';

const COOKIE = 'loadout_token';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production.');
  return 'dev-only-secret-do-not-use-in-production';
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

const MAX_SESSIONS = 10;

// Starts a session for this device. Only the user id and session id go in the token; the role and
// everything else are read from the database on every request.
export async function startSession(res, user) {
  const sid = randomBytes(16).toString('hex');
  await User.updateOne(
    { _id: user._id },
    { $push: { sessions: { $each: [{ id: sid, createdAt: new Date() }], $slice: -MAX_SESSIONS } } },
  );
  const token = jwt.sign({ sub: user._id.toString(), sid }, secret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: WEEK_MS });
  return sid;
}

function readToken(req) {
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

// Ends this device's session on the server as well, so a copied cookie stops working too.
export async function endSession(req, res) {
  const payload = readToken(req);
  if (payload?.sid) await User.updateOne({ _id: payload.sub }, { $pull: { sessions: { id: payload.sid } } });
  res.clearCookie(COOKIE, cookieOptions());
}

// After a password change: every session but this one ends. `keep` null ends them all.
export const endOtherSessions = (userId, keep) =>
  User.updateOne({ _id: userId }, keep ? { $pull: { sessions: { id: { $ne: keep } } } } : { $set: { sessions: [] } });

async function currentUser(req) {
  const payload = readToken(req);
  if (!payload?.sid) return null;
  const user = await User.findById(payload.sub).select('+sessions');
  if (!user?.isActive || !user.sessions.some((s) => s.id === payload.sid)) return null;
  req.sessionId = payload.sid;
  return user;
}

export async function requireAuth(req, res, next) {
  req.user = await currentUser(req);
  if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  next();
}

export async function optionalAuth(req, res, next) {
  req.user = await currentUser(req);
  next();
}

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) throw new AppError(403, 'FORBIDDEN', "You don't have access to this.");
    next();
  };

// Whether this user may manage one area of the admin panel (see ADMIN_AREAS).
export const canManage = (user, area) =>
  user?.role === 'admin' && (user.isOwner || (user.adminPermissions ?? []).includes(area));

export const requireArea = (area) => (req, res, next) => {
  if (!canManage(req.user, area)) throw new AppError(403, 'FORBIDDEN', "You don't have access to this.");
  next();
};

export const requireOwner = (req, res, next) => {
  if (!req.user.isOwner) throw new AppError(403, 'FORBIDDEN', 'Only the owner can do this.');
  next();
};

export function requireApprovedSeller(req, res, next) {
  if (req.user.role !== 'seller' || req.user.sellerProfile?.status !== 'approved') {
    throw new AppError(403, 'FORBIDDEN', 'Your seller account is not active.');
  }
  next();
}
