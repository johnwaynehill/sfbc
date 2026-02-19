'use strict';

const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Dev mode: no SMTP configured → log to console
  if (!config.smtp.host) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

/**
 * Send a magic link sign-in email.
 * Falls back to console logging when SMTP is not configured.
 */
async function sendMagicLink(email, token) {
  const url = `${config.appUrl}/auth/callback?token=${token}`;
  const transport = getTransporter();

  if (!transport) {
    // Dev mode: log to console
    console.log('');
    console.log('  [DEV] Magic link for %s', email);
    console.log('  %s', url);
    console.log('');
    return;
  }

  await transport.sendMail({
    from: config.smtp.from || `"${config.club.name}" <noreply@example.com>`,
    to: email,
    subject: `Sign in to ${config.club.name}`,
    text: [
      `Click this link to sign in to ${config.club.name}:`,
      '',
      url,
      '',
      'This link expires in 15 minutes.',
      'If you didn\'t request this, you can safely ignore this email.',
    ].join('\n'),
    html: [
      `<p>Click the link below to sign in to <strong>${config.club.name}</strong>:</p>`,
      `<p><a href="${url}" style="display:inline-block;padding:10px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px;font-family:sans-serif;">Sign In</a></p>`,
      '<p style="color:#999;font-size:13px;">This link expires in 15 minutes. If you didn\'t request this, you can safely ignore this email.</p>',
    ].join('\n'),
  });
}

module.exports = { sendMagicLink };
