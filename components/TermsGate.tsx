import React, { useEffect, useMemo, useState } from "react";

type AcceptanceRecord = {
  accepted: boolean;
  version: string;
  acceptedAt: string; // ISO
};

type TermsGateProps = {
  children?: React.ReactNode;
  /** Terms metni değişince bunu artır: "2026-01" -> "2026-02" gibi */
  version?: string;
  /** localStorage anahtarı */
  storageKey?: string;
  /** true ise modal sadece parent tetiklediğinde açılır */
  triggerMode?: boolean;
  /** triggerMode açıkken modalın görünmesini sağlar */
  active?: boolean;
  onAccepted?: () => void;
};

export const DEFAULT_TERMS_VERSION = "2026-02";
export const DEFAULT_TERMS_STORAGE_KEY = "insightstream_terms_accepted";

/**
 * Uygulama açılışında Terms of Use kabul ettiren gate.
 * Kabul edilmeden children render etmez.
 */
export default function TermsGate({
  children,
  version = DEFAULT_TERMS_VERSION,
  storageKey = DEFAULT_TERMS_STORAGE_KEY,
  triggerMode = false,
  active = false,
  onAccepted,
}: TermsGateProps) {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [hasValidAcceptance, setHasValidAcceptance] = useState(false);

  // Terms metni (istersen ayrı dosyaya taşırsın)
  const termsText = useMemo(
    () => `
 KULLANIM ŞARTLARI (TERMS OF USE)
 Son güncelleme: 13.01.2026 - v2026-02

InsightStream’i kullanarak aşağıdaki şartları kabul etmiş olursunuz.

1) Hizmet Tanımı
InsightStream; veri yükleme, dashboard üretme, analiz/özet çıkarma, simülasyon çalıştırma ve rapor dışa aktarma özellikleri sunan bir prototip/uygulamadır.

2) Sorumluluk Reddi
- Üretilen analizler ve AI çıktıları bilgilendirme amaçlıdır.
- Karar vermeden önce çıktıları doğrulamanız önerilir.
- Uygulama çıktılarından doğan sonuçlardan geliştirici ekip sorumlu tutulamaz.

3) Kabul Edilebilir Kullanım
Kullanıcı şunları yapmamayı kabul eder:
- Kişisel/sensitive veri içeren dosyaları izinsiz paylaşmak
- Zararlı içerik, kötü amaçlı kullanım veya sistem sömürüsü denemeleri
- Başkalarının hesabına/servislerine yetkisiz erişim

4) Fikri Mülkiyet
Uygulamanın arayüzü, tasarımı ve kodu ilgili ekip/proje kapsamında korunur. Kullanıcı kendi verisinin sahibi olmaya devam eder.

5) E-posta Gönderimi
E-posta gönderimi kullanıcının verdiği alıcı adreslerine yapılır. Yanlış adrese gönderimden kullanıcı sorumludur.

6) Değişiklikler
Bu şartlar zamanla güncellenebilir. Güncellenmiş metin uygulamada yayınlandığı anda geçerli olur.
`.trim(),
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setHasValidAcceptance(false);
        setOpen(!triggerMode);
      } else {
        const parsed = JSON.parse(raw) as AcceptanceRecord;
        const isValid = Boolean(parsed?.accepted && parsed.version === version);
        setHasValidAcceptance(isValid);
        setOpen(!isValid && !triggerMode);
      }
    } catch {
      setHasValidAcceptance(false);
      setOpen(!triggerMode);
    } finally {
      setLoading(false);
    }
  }, [storageKey, version, triggerMode]);

  useEffect(() => {
    if (!triggerMode || loading) return;
    if (active && !hasValidAcceptance) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [active, triggerMode, hasValidAcceptance, loading]);

  useEffect(() => {
    if (open) {
      setChecked(false);
      setBlockedMsg(null);
    }
  }, [open]);

  const onAccept = () => {
    const record: AcceptanceRecord = {
      accepted: true,
      version,
      acceptedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify(record));
     setHasValidAcceptance(true);
    setOpen(false);
    onAccepted?.();
  };

  const onDecline = () => {
    // Uygulamaya geçişi engelle: modal açık kalsın + mesaj göster
    setBlockedMsg(
      "Devam etmek için Kullanım Şartları’nı kabul etmelisiniz. Kabul etmezseniz uygulamayı kullanamazsınız."
    );
    setChecked(false);
  };

  if (!triggerMode && loading) return null;

  const overlay = open ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(920px, 96vw)",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            background: "linear-gradient(90deg, #4f46e5, #6d28d9)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>InsightStream</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              Kullanım Şartları
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Sürüm: {version}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 22 }}>
          <p style={{ margin: "0 0 10px", color: "#334155" }}>
            Devam etmek için aşağıdaki metni okuyup kabul etmelisiniz.
          </p>

          {/* Scroll area */}
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 14,
              height: 260,
              overflow: "auto",
              background: "#f8fafc",
              whiteSpace: "pre-wrap",
              color: "#0f172a",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {termsText}
          </div>

          {/* Checkbox */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              userSelect: "none",
              color: "#0f172a",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setChecked(e.target.checked);
                setBlockedMsg(null);
              }}
              style={{ width: 18, height: 18 }}
            />
            Okudum ve kabul ediyorum
          </label>

          {blockedMsg && (
            <div
              style={{
                marginTop: 10,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#9a3412",
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              {blockedMsg}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 18,
            }}
          >
            <button
              type="button"
              onClick={onDecline}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={!checked}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid transparent",
                background: !checked ? "#cbd5e1" : "#4f46e5",
                color: "white",
                fontWeight: 800,
                cursor: !checked ? "not-allowed" : "pointer",
              }}
            >
              Devam Et
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (triggerMode) {
    return (
      <>
        {children}
        {overlay}
      </>
    );
  }

  if (open) return overlay;

  return <>{children}</>;
}
