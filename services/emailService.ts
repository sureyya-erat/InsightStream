
import { ScheduledReport } from '../types';

export interface SmtpHealth {
  ok: boolean;
  providerMode: 'smtp' | 'resend' | 'none';
  resendConfigured: boolean;
  smtpConfigured: boolean;
  hintTR: string;
  errorMessage?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64 string
  encoding: 'base64';
}

export class EmailService {
  private static API_BASE = '/api/email';

  // Builds absolute API URLs when VITE_API_BASE_URL is provided, otherwise stays relative
  private static buildUrl(path: string) {
    const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
    const normalizedBase = configuredBase ? configuredBase.replace(/\/$/, '') : '';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${this.API_BASE}${normalizedPath}`;
  }

  static async getHealth(): Promise<SmtpHealth> {
    try {
      const response = await fetch(this.buildUrl('/health'));
      if (!response.ok) throw new Error('Sunucu hatası');
      return await response.json();
    } catch (e) {
      return { 
        ok: false, 
        providerMode: 'none', 
        resendConfigured: false, 
        smtpConfigured: false, 
        hintTR: 'Backend sunucusuna erişilemiyor veya yapılandırma hatalı.' 
      };
    }
  }

  static async sendWithAttachment(params: { 
    to: string, 
    subject: string, 
    html: string, 
    attachments?: EmailAttachment[] 
  }): Promise<{ success: boolean; error?: string; provider?: string }> {
    try {
      const response = await fetch(this.buildUrl('/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        return { 
          success: false, 
          error: data.hintTR || data.errorMessage || data.error || 'E-posta gönderilemedi.',
          provider: data.provider 
        };
      }
      
      return { success: true, provider: data.provider };
    } catch (error: any) {
      return { success: false, error: 'Sunucuyla iletişim kurulamadı: ' + error.message };
    }
  }

  static async testSmtpConnection(): Promise<{ success: boolean; message: string }> {
    const health = await this.getHealth();
    return { 
      success: health.ok, 
      message: health.hintTR || (health.ok ? "Bağlantı başarılı." : "Bağlantı kurulamadı.") 
    };
  }

  static async sendReport(report: ScheduledReport, datasetSummary: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.sendWithAttachment({
      to: report.email,
      subject: `InsightStream Raporu: ${report.datasetName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5; margin-bottom: 20px;">Zamanlanmış AI Raporu</h2>
          <p style="font-size: 14px; color: #334155; line-height: 1.6;">${datasetSummary}</p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
            Bu e-posta InsightStream BI sistemi tarafından otomatik olarak gönderilmiştir.
          </p>
        </div>
      `
    });
    return { success: result.success, error: result.error };
  }
}
