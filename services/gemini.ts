import { Dataset, StrategicAnnualSummary } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const buildApiUrl = (path: string) => {
  const base = API_BASE_URL || '';
  return `${base}${path}`;
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.message?.includes('429') || error.message?.includes('503') || error.message?.includes('quota');
      if (!isRetryable || i === maxRetries - 1) break;
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const postAIRequest = async <T>(path: string, payload: unknown): Promise<T> => {
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
      throw new Error(errorBody.errorMessage || `AI endpoint error (${response.status})`);
    }

    return response.json() as Promise<T>;
  });
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
  return postAIRequest<StrategicAnnualSummary>('/api/ai/annual-summary', { dataset, year });
};
