import { createHash, randomBytes } from 'node:crypto';
import { User } from '../../models/index.js';
import { sendMail } from '../../lib/mail.js';

const RESET_MINUTES = 30;
// One email per account per this many minutes, so nobody can flood an inbox through the form or an admin.
const RESEND_MINUTES = 2;
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Emails a one-time link that sets a new password. Only a hash of the token is stored, so a database
// leak doesn't hand out working links, and a new link replaces any earlier one. The token travels in
// the URL's #fragment, which browsers never send to a server or in a Referer header.
// Returns false, sending nothing, when an unused link went out in the last RESEND_MINUTES.
export async function sendResetLink(user) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const claimed = await User.updateOne(
    {
      _id: user._id,
      $or: [
        { passwordReset: null },
        { 'passwordReset.sentAt': null },
        { 'passwordReset.sentAt': { $lt: new Date(now - RESEND_MINUTES * 60 * 1000) } },
      ],
    },
    {
      passwordReset: {
        tokenHash: hashToken(token),
        sentAt: new Date(now),
        expiresAt: new Date(now + RESET_MINUTES * 60 * 1000),
      },
    },
  );
  if (!claimed.modifiedCount) return false;
  const site = (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',')[0].trim();
  const link = `${site}/reset-password#${token}`;
  await sendMail({
    to: user.email,
    name: user.name,
    subject: 'Reset your Loadout password',
    text: `Hi ${user.name},\n\nUse this link to choose a new password. It works once and expires in ${RESET_MINUTES} minutes:\n${link}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Use this link to choose a new password. It works once and expires in ${RESET_MINUTES} minutes:</p><p><a href="${link}">Reset my password</a></p><p>If you didn't ask for this, ignore this email; your password stays the same.</p>`,
  });
  return true;
}
