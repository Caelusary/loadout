import User from '../../models/User.js';
import { AppError, invalid } from '../../lib/AppError.js';
import { pick } from '../../lib/request.js';
import { endSession, startSession } from '../../middleware/auth.js';
import { notify } from '../notifications/service.js';
import { hashToken, sendResetLink } from './reset.js';

export async function register(req, res) {
  const user = await User.create(pick(req.body, ['name', 'email', 'password']));
  await startSession(res, user);
  res.status(201).json({ user });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  const fields = {};
  if (!email) fields.email = 'Email is required';
  if (!password) fields.password = 'Password is required';
  if (Object.keys(fields).length) throw invalid(fields);

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  if (!user || !(await user.comparePassword(String(password)))) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Email or password is incorrect.');
  }
  if (!user.isActive) throw new AppError(401, 'UNAUTHENTICATED', 'This account has been deactivated.');
  await startSession(res, user);
  res.json({ user });
}

export async function logout(req, res) {
  await endSession(req, res);
  res.json({ ok: true });
}

export function me(req, res) {
  res.json({ user: req.user });
}

// Always the same answer, whether or not the email has an account, so this can't be used to find out
// who is registered. A failed send is logged, not shown, for the same reason.
export async function forgotPassword(req, res) {
  const email = String(req.body?.email ?? '').toLowerCase().trim();
  if (!email) throw invalid({ email: 'Email is required' });
  const user = await User.findOne({ email });
  // Not awaited: waiting on the email provider only for real accounts would make the reply measurably
  // slower for them, which tells anyone timing it who has an account.
  if (user?.isActive) sendResetLink(user).catch((err) => console.error('Password reset email failed:', err.message));
  res.json({ ok: true });
}

// Uses a reset link: sets the new password, ends every session (whoever else was signed in is out),
// leaves a notice on the account, and signs this device in.
export async function resetPassword(req, res) {
  const { token, password } = req.body ?? {};
  const fields = {};
  if (!password || String(password).length < 8) fields.password = 'Password must be at least 8 characters';
  else if (Buffer.byteLength(String(password), 'utf8') > 72) fields.password = 'Password must be at most 72 characters';
  if (Object.keys(fields).length) throw invalid(fields);
  // Claiming the token and clearing it is one atomic step, so two requests racing with the same
  // link can't both set a password.
  const user =
    typeof token === 'string' && token.length >= 20
      ? await User.findOneAndUpdate(
          { 'passwordReset.tokenHash': hashToken(token), 'passwordReset.expiresAt': { $gt: new Date() } },
          { $unset: { passwordReset: 1 } },
          { new: true },
        ).select('+password')
      : null;
  if (!user || !user.isActive) {
    throw new AppError(400, 'RESET_EXPIRED', 'This link has expired or was already used. Ask for a new one.');
  }
  Object.assign(user, { password: String(password), sessions: [] });
  await user.save();
  await notify({
    user: user._id,
    type: 'account',
    title: 'Your password was changed',
    body: 'It was reset with an emailed link, and every device was signed out.',
    link: '/account',
  });
  await startSession(res, user);
  res.json({ user });
}

