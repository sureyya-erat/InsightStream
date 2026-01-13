
const express = require('express');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const dotenv = require('dotenv');
const cors = require('cors');

// Yapılandırmayı yükle
dotenv.config();

const app = express();
// PDF ve büyük veri setleri için limit artırıldı
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Resend istemcisi kurulumu
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * SMTP Transporter Yapılandırması (Fallback)
 */
const createSmtpTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  const port = parseInt(process.env.SMTP_PORT || '587');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { 
      user: process.env.SMTP_USER, 
      pass: process.env.SMTP_PASS 
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 5000
  });
};

/**
 * @route GET /api/email/health
 * @desc E-posta servislerinin durumunu ve aktif sağlayıcıyı kontrol eder
 */
app.get('/api/email/health', async (req, res) => {
  const resendConfigured = !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  let providerMode = "none";
  if (resendConfigured) providerMode = "resend";
  else if (smtpConfigured) providerMode = "smtp";

  let health = {
    ok: providerMode !== "none",
    providerMode,
    resendConfigured,
    smtpConfigured,
    hintTR: "E-posta sağlayıcısı yapılandırılmamış. Lütfen .env dosyasını kontrol edin."
  };

  if (providerMode === "resend") {
    health.hintTR = "Resend (HTTP API) aktif ve hazır ✅";
  } else if (providerMode === "smtp") {
    try {
      const transporter = createSmtpTransporter();
      if (transporter) {
        await transporter.verify();
        health.hintTR = "SMTP bağlantısı doğrulandı ✅";
      }
    } catch (e) {
      health.ok = false;
      health.errorMessage = e.message;
      health.hintTR = `SMTP Hatası (${e.code}): Bağlantı kurulamadı. Resend kullanılması önerilir.`;
    }
  }

  res.json(health);
});

/**
 * @route POST /api/email/send
 * @desc E-posta gönderimi yapar. Resend önceliklidir, SMTP fallback olarak kullanılır.
 */
app.post('/api/email/send', async (req, res) => {
  const { to, subject, html, attachments } = req.body;

  if (!to) {
    return res.status(400).json({ ok: false, errorMessage: "Alıcı adresi eksik." });
  }

  // Alıcı listesini normalize et
  const recipients = to.split(',').map(e => e.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return res.status(400).json({ ok: false, errorMessage: "Geçerli bir alıcı adresi bulunamadı." });
  }

  // 1. Sağlayıcı: RESEND (Öncelikli)
  if (resend && process.env.RESEND_FROM) {
    try {
      const resendPayload = {
        from: process.env.RESEND_FROM,
        to: recipients,
        subject,
        html,
        attachments: (attachments || []).map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64')
        }))
      };

      const { data, error } = await resend.emails.send(resendPayload);

      if (error) throw error;

      return res.json({ ok: true, provider: "resend", id: data.id });
    } catch (error) {
      console.error("Resend Gönderim Hatası:", error);
      // SMTP varsa devam et, yoksa hata dön
      if (!process.env.SMTP_HOST) {
        return res.status(500).json({
          ok: false,
          provider: "resend",
          errorMessage: error.message || "Resend üzerinden gönderim başarısız.",
          hintTR: "Resend API hatası. Lütfen API anahtarını kontrol edin."
        });
      }
    }
  }

  // 2. Sağlayıcı: SMTP (Fallback)
  const transporter = createSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"InsightStream" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject,
        html,
        attachments: (attachments || []).map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64')
        }))
      });
      return res.json({ ok: true, provider: "smtp", messageId: info.messageId });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        provider: "smtp",
        errorMessage: error.message,
        hintTR: "SMTP sunucusu üzerinden gönderim başarısız oldu."
      });
    }
  }

  res.status(400).json({
    ok: false,
    provider: "none",
    errorMessage: "Aktif bir e-posta sağlayıcısı bulunamadı.",
    hintTR: "RESEND_API_KEY veya SMTP bilgilerini .env dosyanıza ekleyip sunucuyu yeniden başlatın."
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('---------------------------------------------');
  console.log(`🚀 InsightStream API Sunucusu Başlatıldı`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`📧 Resend: ${process.env.RESEND_API_KEY ? 'Yapılandırıldı' : 'Eksik'}`);
  console.log(`📧 SMTP: ${process.env.SMTP_HOST ? 'Yapılandırıldı' : 'Eksik'}`);
  console.log('---------------------------------------------');
});
