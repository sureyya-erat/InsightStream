import { Dataset, StrategicAnnualSummary } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const buildApiUrl = (path: string) => {
  const base = API_BASE_URL || '';
  return `${base}${path}`;
};

const inferMockPlan = (question: string) => {
  const q = question.toLowerCase();

  if (q.includes('kâr') || q.includes('kar') || q.includes('kazanç') || q.includes('profit')) {
    if (q.includes('şube') || q.includes('mağaza') || q.includes('istanbul') || q.includes('ankara')) {
      return { chart: 'bar', groupBy: 'Branch', metric: 'profit', titleTR: 'Şube Bazlı Kârlılık (Demo)', intent: 'aggregation', filters: {} };
    }
    if (q.includes('ay') || q.includes('trend') || q.includes('zaman')) {
      return { chart: 'line', groupBy: 'Month', metric: 'profit', titleTR: 'Aylık Kâr Trendi (Demo)', intent: 'trend', filters: {} };
    }
    return { chart: 'bar', groupBy: 'Category', metric: 'profit', titleTR: 'Kategori Bazlı Kârlılık (Demo)', intent: 'aggregation', filters: {} };
  }

  if (q.includes('şube') || q.includes('şehir') || q.includes('bölge')) {
    return { chart: 'bar', groupBy: 'Branch', metric: 'revenue', titleTR: 'Şube Bazlı Ciro (Demo)', intent: 'aggregation', filters: {} };
  }

  if (q.includes('kategori') || q.includes('ürün')) {
    return { chart: 'pie', groupBy: 'Category', metric: 'revenue', titleTR: 'Kategori Satış Dağılımı (Demo)', intent: 'aggregation', filters: {} };
  }

  // Default
  return {
    chart: 'bar',
    groupBy: 'Branch',
    metric: 'revenue',
    titleTR: 'Örnek Satış Analizi (Demo Modu)',
    intent: 'aggregation',
    filters: {}
  };
};

const MOCK_ANNUAL_SUMMARY = {
  executiveSummary: [
    "Demo Modu: API kotası aşıldığı için örnek veri gösteriliyor.",
    "Genel performans stabil görünüyor.",
    "Kâr marjlarında dönemsel artışlar mevcut."
  ],
  riskAlerts: [
    { title: "Demo Risk", detail: "API kotası dolu.", impact: "Yüksek", action: "Daha sonra tekrar deneyin." }
  ],
  strategicActions: [],
  quarterlyPerformance: [],
  monthlyHeatmap: []
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, fallbackValue?: T): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error.message?.includes('429') || error.message?.includes('usage limits') || error.message?.includes('quota');

      if (isRateLimit) {
        console.warn("API Quota exceeded, using fallback if available.");
        if (fallbackValue !== undefined) {
          return typeof fallbackValue === 'function' ? (fallbackValue as any)() : fallbackValue;
        }
        throw new Error("AI kullanım kotası aşıldı. Lütfen daha sonra tekrar deneyiniz veya planınızı kontrol ediniz.");
      }

      const isRetryable = error.message?.includes('503') || error.message?.includes('network');
      if (!isRetryable || i === maxRetries - 1) break;

      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const postAIRequest = async <T>(path: string, payload: unknown, fallback?: T): Promise<T> => {
  return withRetry(async () => {
    const response = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorBody: Record<string, any> = {};
      try {
        errorBody = await response.json();
      } catch (_) {
        // Ignore JSON parsing errors if the body isn't JSON
      }
      throw new Error(errorBody.errorMessage || errorBody.error?.message || `AI endpoint error (${response.status})`);
    }

    return response.json() as Promise<T>;
  }, 3, fallback);
};

export const getAIInsights = async (dataset: Dataset, filters: any): Promise<string> => {
  try {
    const data = await postAIRequest<{ text: string }>(
      '/api/ai/insights',
      { dataset, filters }
    );
    return data.text || "AI service error.";
  } catch (error) {
    console.error('getAIInsights error', error);
    return "AI service error.";
  }
};

export const getChartExplanation = async (chartTitle: string, chartType: string): Promise<string> => {
  try {
    const data = await postAIRequest<{ text: string }>(
      '/api/ai/chart-explanation',
      { chartTitle, chartType }
    );
    return data.text || "Açıklama üretilemedi.";
  } catch (error) {
    console.error('getChartExplanation error', error);
    return "Açıklama üretilemedi.";
  }
};

export const getChatQueryPlan = async (question: string, dataset: Dataset): Promise<any> => {
  return postAIRequest<any>('/api/ai/chat-plan', { question, dataset });
};

export const getStrategicAnnualSummary = async (dataset: Dataset, year?: number): Promise<StrategicAnnualSummary> => {
  // For annual summary, we might want to construct a more dynamic mock but the basic one prevents crashing
  const fallback = {
    datasetName: dataset.name,
    year: year || new Date().getFullYear(),
    generatedAt: new Date().toISOString(),
    totals: { revenue: 0, profit: 0, units: 0, transactions: 0, avgBasket: 0 }, // Handled by UI mostly
    yoy: { revenuePct: 0, profitPct: 0, unitsPct: 0 },
    marginPct: 0,
    kpiHighlights: [],
    ...MOCK_ANNUAL_SUMMARY
  } as any;
  // Fallback disabled for testing server-side failover
  return postAIRequest<StrategicAnnualSummary>('/api/ai/annual-summary', { dataset, year });
};
