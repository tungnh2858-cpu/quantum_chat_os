/**
 * EduPulse - Mailer.
 * Uses SMTP if configured via .env (SMTP_HOST/PORT/USER/PASS/FROM).
 * If not configured (or sending fails), falls back to logging the email to the
 * server console so OTP/login-notification flows still work during development
 * or in sandboxed environments without outbound SMTP access.
 */
const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

/**
 * @returns {Promise<{sent: boolean, devFallback: boolean}>}
 */
async function sendMail(to, subject, text) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[EduPulse Mailer - SMTP CHƯA CẤU HÌNH, in ra console thay vì gửi thật]\nĐến: ${to}\nTiêu đề: ${subject}\nNội dung:\n${text}\n`);
    return { sent: false, devFallback: true };
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
    return { sent: true, devFallback: false };
  } catch (e) {
    console.error('[EduPulse Mailer] Gửi email thất bại, in ra console thay thế:', e.message);
    console.log(`Đến: ${to}\nTiêu đề: ${subject}\nNội dung:\n${text}`);
    return { sent: false, devFallback: true };
  }
}

module.exports = { sendMail };
