const express = require('express');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const dotenv = require('dotenv');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const getGeminiApiKey = () => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY not configured. AI features will not work.');
    return '';
  }
  return apiKey;
};

if (process.env.NODE_ENV !== 'production') {
  const prefix = getGeminiApiKey().slice(0, 6);
  console.log(`🔐 Gemini API key prefix loaded: ${prefix ? prefix + '***' : 'missing'}`);
}

const PRIMARY_MODEL = 'gemini-2.5-flash';
const SECONDARY_MODEL = 'gemini-2.5-flash-lite';

// Helper to interact with Gemini API v1beta directly (SDK defaults to v1 usually)
const generateGeminiContent = async (modelName, prompt) => {
  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errBody = await response.json();
      errMsg = errBody.error?.message || errMsg;
    } catch (e) { /* ignore */ }
    throw new Error(`${response.status} ${errMsg}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
};

const withRetry = async (fn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Attempt with primary model first, switch to secondary on retry if quota/rate limit
      const useSecondary = i > 0;
      return await fn(useSecondary ? SECONDARY_MODEL : PRIMARY_MODEL);
    } catch (error) {
      lastError = error;
      const message = error?.message || '';
      const retryable = message.includes('429') || message.includes('503') || message.includes('quota');

      if (!retryable || i === maxRetries - 1) break;

      console.warn(`⚠️  Attempt ${i + 1} failed with ${message.includes('429') ? 'Rate Limit' : 'Error'}. Retrying with fallback model...`);

      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const createSmtpTransporter = () => {
  if (!process.env.SMTP_HOST) return null;

  // Explicitly configure for stability on Render, ensuring IPv4 and Port 587 if possible
  const isGmail = process.env.SMTP_HOST.includes('gmail');

  // If it's Gmail, force Port 587 (STARTTLS) which is more reliable on cloud than 465
  const config = {
    host: process.env.SMTP_HOST,
    port: isGmail ? 587 : parseInt(process.env.SMTP_PORT || '587'),
    secure: isGmail ? false : (process.env.SMTP_SECURE === 'true'), // Gmail 587 requires secure: false
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      ciphers: 'SSLv3', // Compatibility override 
      rejectUnauthorized: false
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    family: 4, // Critical for Render
  };

  return nodemailer.createTransport(config);
};

const MONTH_LABELS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTH_NAME_LOOKUP = {
  ocak: 1, oca: 1, january: 1, jan: 1,
  şubat: 2, subat: 2, şub: 2, sub: 2, february: 2, feb: 2,
  mart: 3, mar: 3, march: 3,
  nisan: 4, nis: 4, april: 4, apr: 4,
  mayıs: 5, mayis: 5, may: 5,
  haziran: 6, haz: 6, june: 6, jun: 6,
  temmuz: 7, tem: 7, july: 7, jul: 7,
  ağustos: 8, agustos: 8, ağus: 8, agus: 8, august: 8, aug: 8,
  eylül: 9, eylul: 9, eyl: 9, september: 9, sep: 9,
  ekim: 10, eki: 10, october: 10, oct: 10,
  kasım: 11, kasim: 11, kas: 11, november: 11, nov: 11,
  aralık: 12, aralik: 12, ara: 12, december: 12, dec: 12,
};
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const sanitizeNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return 0;
    const hasComma = trimmed.includes(',');
    const hasDot = trimmed.includes('.');
    let normalized = trimmed.replace(/[^0-9,.-]/g, '');
    if (hasComma && hasDot) {
      if (trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = normalized.replace(/,/g, '');
      }
    } else if (hasComma) {
      normalized = normalized.replace(/,/g, '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getFieldValue = (row, mapping, field) => {
  const column = mapping?.[field];
  if (!column) return null;
  return row[column];
};

const parseMonthValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value >= 1 && value <= 12) return value;
    return null;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return null;
    if (MONTH_NAME_LOOKUP[cleaned]) return MONTH_NAME_LOOKUP[cleaned];
    const numeric = Number(cleaned.replace(/[^0-9]/g, ''));
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  }
  return null;
};

const getYearFromRow = (row, mapping) => {
  const yearVal = getFieldValue(row, mapping, 'year');
  if (yearVal !== null && yearVal !== undefined) {
    const yearNum = Number(String(yearVal).replace(/[^0-9]/g, ''));
    if (!Number.isNaN(yearNum) && yearNum > 1900) return yearNum;
  }
  const dateVal = getFieldValue(row, mapping, 'date');
  if (dateVal) {
    const parsed = new Date(dateVal);
    if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  return null;
};

const getMonthFromRow = (row, mapping) => {
  const monthVal = getFieldValue(row, mapping, 'month');
  if (monthVal !== null && monthVal !== undefined) {
    const parsed = parseMonthValue(monthVal);
    if (parsed) return parsed;
  }
  const dateVal = getFieldValue(row, mapping, 'date');
  if (dateVal) {
    const parsed = new Date(dateVal);
    if (!Number.isNaN(parsed.getTime())) return parsed.getMonth() + 1;
  }
  return null;
};

const getRevenueFromRow = (row, mapping) => {
  const revenueVal = getFieldValue(row, mapping, 'revenue');
  if (revenueVal !== null && revenueVal !== undefined) {
    return sanitizeNumber(revenueVal);
  }
  const price = sanitizeNumber(getFieldValue(row, mapping, 'price'));
  const qty = sanitizeNumber(getFieldValue(row, mapping, 'qty'));
  if (price && qty) return price * qty;
  const profit = sanitizeNumber(getFieldValue(row, mapping, 'profit'));
  const margin = sanitizeNumber(getFieldValue(row, mapping, 'margin'));
  if (profit && margin) {
    const marginRate = margin > 1 ? margin / 100 : margin;
    if (marginRate > 0) return profit / marginRate;
  }
  return 0;
};

const getProfitFromRow = (row, mapping, revenueValue) => {
  const profitVal = getFieldValue(row, mapping, 'profit');
  if (profitVal !== null && profitVal !== undefined) {
    return sanitizeNumber(profitVal);
  }
  const cost = sanitizeNumber(getFieldValue(row, mapping, 'cost'));
  if (cost) return (revenueValue || getRevenueFromRow(row, mapping)) - cost;
  const margin = sanitizeNumber(getFieldValue(row, mapping, 'margin'));
  const revenue = revenueValue || getRevenueFromRow(row, mapping);
  if (margin) {
    const marginRate = margin > 1 ? margin / 100 : margin;
    return revenue * marginRate;
  }
  return 0;
};

const getQtyFromRow = (row, mapping) => {
  const qtyVal = getFieldValue(row, mapping, 'qty');
  if (qtyVal !== null && qtyVal !== undefined) {
    return sanitizeNumber(qtyVal);
  }
  return 0;
};

const sumMetrics = (items) => {
  const totals = items.reduce((acc, curr) => {
    acc.revenue += curr.revenue || 0;
    acc.profit += curr.profit || 0;
    acc.units += curr.qty || 0;
    acc.transactions += 1;
    return acc;
  }, { revenue: 0, profit: 0, units: 0, transactions: 0 });
  totals.avgBasket = totals.transactions ? totals.revenue / totals.transactions : 0;
  return totals;
};

const computePctChange = (current, previous) => {
  if (!previous || !Number.isFinite(previous)) return previous === 0 ? null : null;
  if (!Number.isFinite(current)) return null;
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const summarizeQuarters = (items) => {
  const summary = QUARTERS.reduce((acc, q) => ({
    ...acc,
    [q]: { revenue: 0, profit: 0, units: 0, count: 0 },
  }), {});
  items.forEach((item) => {
    const month = item.month || 1;
    const quarterIndex = Math.min(4, Math.max(1, Math.ceil(month / 3)));
    const key = `Q${quarterIndex}`;
    summary[key].revenue += item.revenue || 0;
    summary[key].profit += item.profit || 0;
    summary[key].units += item.qty || 0;
    summary[key].count += 1;
  });
  return summary;
};

const aggregateByField = (items, fieldName, mapping, totalRevenue) => {
  const column = mapping?.[fieldName];
  if (!column) return [];
  const buckets = {};
  items.forEach((item) => {
    const labelRaw = item.row?.[column];
    if (labelRaw === null || labelRaw === undefined || labelRaw === '') return;
    const label = String(labelRaw);
    buckets[label] = (buckets[label] || 0) + (item.revenue || 0);
  });
  return Object.entries(buckets)
    .map(([label, revenue]) => ({
      label,
      revenue,
      sharePct: totalRevenue ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
};

const buildMonthlyHeatmap = (items, totals) => {
  const months = MONTH_LABELS_TR.map((label, index) => ({
    label,
    monthIndex: index + 1,
    revenue: 0,
    profit: 0,
    cost: 0,
    count: 0,
  }));

  items.forEach((item) => {
    if (!item.month) return;
    const idx = item.month - 1;
    if (!months[idx]) return;
    const revenue = item.revenue || 0;
    const profit = item.profit || 0;
    months[idx].revenue += revenue;
    months[idx].profit += profit;
    months[idx].cost += revenue - profit;
    months[idx].count += 1;
  });

  const maxRevenue = Math.max(...months.map((m) => m.revenue));
  const maxProfit = Math.max(...months.map((m) => m.profit));
  const activeMonths = months.filter((m) => m.count > 0).length || 1;
  const avgRevenue = totals.revenue / activeMonths || 0;

  return months.map((m) => {
    const revenueIndex = maxRevenue ? Math.round((m.revenue / maxRevenue) * 100) : 0;
    const profitIndex = maxProfit ? Math.round((m.profit / maxProfit) * 100) : 0;
    let status = 'flat';
    if (avgRevenue) {
      if (m.revenue >= avgRevenue * 1.1) status = 'up';
      else if (m.revenue <= avgRevenue * 0.75 && m.count > 0) status = 'down';
    }
    const contributionPct = totals.revenue ? (m.revenue / totals.revenue) * 100 : 0;
    const comment = status === 'up'
      ? 'Ortalamanın üzerinde katkı'
      : status === 'down'
        ? 'Performans baskı altında'
        : 'Stabil seyir';
    const marginPct = m.revenue ? (m.profit / m.revenue) * 100 : 0;
    return {
      month: m.label,
      revenue: m.revenue,
      profit: m.profit,
      cost: m.cost,
      transactions: m.count,
      marginPct,
      revenueIndex,
      profitIndex,
      contributionPct,
      status,
      comment,
    };
  });
};

const buildKpiHighlights = (metrics) => {
  const { totals, yoy, marginPct } = metrics;
  const highlights = [
    {
      id: 'revenue',
      title: 'Toplam Ciro',
      value: totals.revenue,
      unit: 'currency',
      changePct: yoy.revenuePct,
      trend: yoy.revenuePct === null ? 'flat' : (yoy.revenuePct >= 0 ? 'up' : 'down'),
      helper: 'Yıllık toplam satış geliri',
    },
    {
      id: 'profit',
      title: 'Net Kâr',
      value: totals.profit,
      unit: 'currency',
      changePct: yoy.profitPct,
      trend: yoy.profitPct === null ? 'flat' : (yoy.profitPct >= 0 ? 'up' : 'down'),
      helper: 'Faaliyet kârlılığı',
    },
    {
      id: 'margin',
      title: 'Kâr Marjı',
      value: marginPct,
      unit: 'percent',
      changePct: metrics.marginPctChange,
      trend: metrics.marginPctChange === null ? 'flat' : (metrics.marginPctChange >= 0 ? 'up' : 'down'),
      helper: 'Net kâr / Ciro',
    },
    {
      id: 'basket',
      title: 'Ortalama Sepet',
      value: totals.avgBasket,
      unit: 'currency',
      changePct: null,
      trend: 'flat',
      helper: 'İşlem başına gelir',
    },
  ];
  return highlights;
};

const buildFallbackQuarterNarratives = (quarterStats) => {
  const formatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
  return quarterStats.reduce((acc, q) => {
    const yoyText = q.yoyRevenuePct === null
      ? 'Geçen yıl ile karşılaştırma bulunamadı'
      : `${q.yoyRevenuePct >= 0 ? '+' : ''}${(q.yoyRevenuePct).toFixed(1)}% Y/Y ciro değişimi`;
    acc[q.quarter] = `${q.quarter} döneminde ciro ${formatter.format(Math.round(q.revenue))} ₺ seviyesinde gerçekleşti (${yoyText}).`;
    return acc;
  }, {});
};

const buildFallbackExecutiveSummary = (metrics) => {
  const currency = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
  const pct = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return 'veri yok';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };
  const statements = [
    `${metrics.targetYear || 'Bu yıl'} toplam ciro ${currency.format(metrics.totals.revenue || 0)} seviyesine ulaştı (${pct(metrics.yoy.revenuePct)} Y/Y).`,
    `Net kâr ${currency.format(metrics.totals.profit || 0)} olup ortalama kâr marjı ${metrics.marginPct.toFixed(1)}%.`,
    metrics.bestMonth
      ? `${metrics.bestMonth.month} ayında yılın en yüksek hacmi görülürken ${metrics.weakestMonth?.month || 'belirsiz'} döneminde momentum kaybı yaşandı.`
      : 'Aylık bazda dengeli bir performans izlendi.',
  ];
  return statements;
};

const buildFallbackRisks = (metrics) => {
  const risks = [];
  const topCategories = metrics.topCategories || [];
  if (metrics.marginPct < 18) {
    risks.push({
      title: 'Marj Baskısı',
      severity: 'high',
      detail: 'Net kâr marjı %18 seviyesinin altında seyretti.',
      impact: 'Kârlılık sürdürülebilirliği risk altında.',
      action: 'Fiyat/disiplin ve maliyet projeleri hızlandırılmalı.',
    });
  }
  if (metrics.yoy.revenuePct !== null && metrics.yoy.revenuePct < 0) {
    risks.push({
      title: 'Gelir Daralması',
      severity: 'medium',
      detail: 'Toplam ciroda yıllık bazda düşüş var.',
      impact: 'Büyüme hedefleri sapabilir.',
      action: 'Funnel yönetimi ve kampanya planı gözden geçirilmeli.',
    });
  }
  if (topCategories[0]?.sharePct > 35) {
    risks.push({
      title: 'Kategori Yoğunlaşması',
      severity: 'medium',
      detail: `${topCategories[0].label} kategorisi toplam cironun %${topCategories[0].sharePct.toFixed(1)}'ini oluşturuyor.`,
      impact: 'Talep şoku durumunda toplam gelir etkilenir.',
      action: 'Portföy çeşitlendirmesi ve yeni kategori yatırımları değerlendirilmeli.',
    });
  }
  if (!risks.length) {
    risks.push({
      title: 'Operasyonel Takip',
      severity: 'low',
      detail: 'Kritik risk sinyali tespit edilmedi ancak ivme korunmalı.',
      impact: 'Performans takibi devam etmeli.',
      action: 'Ana KPI seti aylık bazda izlenmeli.',
    });
  }
  return risks;
};

const buildFallbackActions = (metrics) => {
  const actions = [
    {
      title: 'Marj İyileştirme Sprinti',
      description: 'Tedarik sözleşmeleri, fiyatlandırma ve kampanya ROI gözden geçirilecek.',
      owner: 'Finans & Satınalma',
      timeline: '0-90 gün',
      impact: 'High',
      status: metrics.marginPct < 20 ? 'at-risk' : 'on-track',
    },
    {
      title: 'Bölgesel Büyüme Programı',
      description: 'Geri kalan şehirlerde pazar payını artıracak mikro kampanyalar.',
      owner: 'Satış',
      timeline: 'Q2',
      impact: 'Medium',
      status: 'not-started',
    },
  ];
  return actions;
};

const computeAnnualSnapshot = (dataset = {}, targetYearOverride = null) => {
  const mapping = dataset.mapping || {};
  const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
  const enriched = rows.map((row) => {
    const revenue = getRevenueFromRow(row, mapping);
    const profit = getProfitFromRow(row, mapping, revenue);
    const qty = getQtyFromRow(row, mapping);
    const year = getYearFromRow(row, mapping);
    const month = getMonthFromRow(row, mapping);
    return { row, revenue, profit, qty, year, month };
  }).filter((item) => Number.isFinite(item.revenue) || Number.isFinite(item.profit));

  if (!enriched.length) {
    const emptyTotals = { revenue: 0, profit: 0, units: 0, transactions: 0, avgBasket: 0 };
    return {
      datasetName: dataset.name || 'Dataset',
      targetYear: new Date().getFullYear(),
      prevYear: null,
      totals: emptyTotals,
      prevTotals: emptyTotals,
      yoy: { revenuePct: null, profitPct: null, unitsPct: null },
      marginPct: 0,
      marginPctChange: null,
      quarterStats: QUARTERS.map((q) => ({ quarter: q, revenue: 0, profit: 0, yoyRevenuePct: null, yoyProfitPct: null })),
      monthlyHeatmap: MONTH_LABELS_TR.map((m) => ({ month: m, revenueIndex: 0, profitIndex: 0, contributionPct: 0, status: 'flat', comment: 'Veri yok' })),
      topCategories: [],
      topCities: [],
      topBranches: [],
      bestMonth: null,
      weakestMonth: null,
      riskSignals: {},
      kpiHighlights: buildKpiHighlights({
        totals: emptyTotals,
        yoy: { revenuePct: null, profitPct: null, unitsPct: null },
        marginPct: 0,
        marginPctChange: null,
      }),
      fallbackExecutiveSummary: ['Aktif veri bulunamadı.'],
      fallbackQuarterNarratives: QUARTERS.reduce((acc, q) => ({ ...acc, [q]: 'Veri bulunamadı.' }), {}),
      fallbackRisks: buildFallbackRisks({
        marginPct: 0,
        yoy: { revenuePct: null },
        topCategories: [],
      }),
      fallbackActions: buildFallbackActions({ marginPct: 0 }),
    };
  }

  const availableYears = [...new Set(enriched.map((r) => r.year).filter(Boolean))].sort((a, b) => a - b);
  let targetYear = availableYears.length ? availableYears[availableYears.length - 1] : new Date().getFullYear();
  if (targetYearOverride && availableYears.includes(targetYearOverride)) {
    targetYear = targetYearOverride;
  }
  const prevYear = availableYears.length > 1 ? availableYears[availableYears.length - 2] : null;
  let currentRows = targetYear ? enriched.filter((r) => r.year === targetYear) : enriched;
  if (!currentRows.length) {
    currentRows = enriched;
  }
  const prevRows = prevYear ? enriched.filter((r) => r.year === prevYear) : [];

  const totals = sumMetrics(currentRows);
  const prevTotals = sumMetrics(prevRows);
  const yoy = {
    revenuePct: computePctChange(totals.revenue, prevTotals.revenue),
    profitPct: computePctChange(totals.profit, prevTotals.profit),
    unitsPct: computePctChange(totals.units, prevTotals.units),
  };
  const marginPct = totals.revenue ? (totals.profit / totals.revenue) * 100 : 0;
  const prevMarginPct = prevTotals.revenue ? (prevTotals.profit / prevTotals.revenue) * 100 : null;
  const marginPctChange = computePctChange(marginPct, prevMarginPct);

  const quarterCurrent = summarizeQuarters(currentRows);
  const quarterPrev = summarizeQuarters(prevRows);
  const quarterStats = QUARTERS.map((quarter) => ({
    quarter,
    revenue: quarterCurrent[quarter].revenue,
    profit: quarterCurrent[quarter].profit,
    yoyRevenuePct: computePctChange(quarterCurrent[quarter].revenue, quarterPrev[quarter].revenue),
    yoyProfitPct: computePctChange(quarterCurrent[quarter].profit, quarterPrev[quarter].profit),
  }));

  const monthlyHeatmap = buildMonthlyHeatmap(currentRows, totals);
  const bestMonth = monthlyHeatmap.reduce((best, item) => {
    if (!best || item.revenueIndex > best.revenueIndex) return item;
    return best;
  }, null);
  const weakestMonth = monthlyHeatmap.reduce((worst, item) => {
    if (!worst || item.revenueIndex < worst.revenueIndex) return item;
    return worst;
  }, null);

  const topCategories = aggregateByField(currentRows, 'category', mapping, totals.revenue);
  const topCities = aggregateByField(currentRows, 'city', mapping, totals.revenue);
  const topBranches = aggregateByField(currentRows, 'branch', mapping, totals.revenue);

  const metrics = {
    datasetName: dataset.name || 'Dataset',
    targetYear,
    prevYear,
    totals,
    prevTotals,
    yoy,
    marginPct,
    marginPctChange,
    quarterStats,
    monthlyHeatmap,
    topCategories,
    topCities,
    topBranches,
    bestMonth,
    weakestMonth,
  };

  metrics.kpiHighlights = buildKpiHighlights(metrics);
  metrics.fallbackExecutiveSummary = buildFallbackExecutiveSummary(metrics);
  metrics.fallbackQuarterNarratives = buildFallbackQuarterNarratives(quarterStats);
  metrics.fallbackRisks = buildFallbackRisks(metrics);
  metrics.fallbackActions = buildFallbackActions(metrics);
  metrics.riskSignals = {
    marginPressure: marginPct < 18,
    revenueDecline: yoy.revenuePct !== null && yoy.revenuePct < 0,
    profitDecline: yoy.profitPct !== null && yoy.profitPct < 0,
    categoryConcentration: topCategories[0]?.sharePct > 35,
  };

  return metrics;
};

const normalizeRiskAlerts = (alerts = []) => {
  return alerts.map((alert) => ({
    title: alert.title || 'Risk',
    severity: (alert.severity || 'medium').toLowerCase(),
    detail: alert.detail || '',
    impact: alert.impact || '',
    action: alert.action || '',
  }));
};

const normalizeStrategicActions = (actions = []) => {
  return actions.map((action) => ({
    title: action.title || 'Aksiyon',
    description: action.description || '',
    owner: action.owner || 'Belirlenecek',
    timeline: action.timeline || 'Q1',
    impact: action.impact || 'Medium',
    status: action.status || 'on-track',
  }));
};

const buildAnnualSummaryResponse = (metrics, aiSections = null) => {
  const executiveSummary = aiSections?.executiveSummary?.length
    ? aiSections.executiveSummary
    : metrics.fallbackExecutiveSummary;
  const quarterNarratives = aiSections?.quarterNarratives || {};
  return {
    datasetName: metrics.datasetName,
    year: metrics.targetYear,
    generatedAt: new Date().toISOString(),
    totals: metrics.totals,
    yoy: metrics.yoy,
    marginPct: metrics.marginPct,
    kpiHighlights: metrics.kpiHighlights,
    executiveSummary,
    quarterlyPerformance: metrics.quarterStats.map((quarterStat) => ({
      ...quarterStat,
      narrative: quarterNarratives[quarterStat.quarter] || metrics.fallbackQuarterNarratives[quarterStat.quarter],
    })),
    monthlyHeatmap: metrics.monthlyHeatmap,
    riskAlerts: normalizeRiskAlerts(aiSections?.riskAlerts?.length ? aiSections.riskAlerts : metrics.fallbackRisks),
    strategicActions: normalizeStrategicActions(aiSections?.strategicActions?.length ? aiSections.strategicActions : metrics.fallbackActions),
    metadata: {
      prevYear: metrics.prevYear,
      topCategories: metrics.topCategories.slice(0, 5),
      topBranches: metrics.topBranches.slice(0, 3),
      topCities: metrics.topCities.slice(0, 5),
      bestMonth: metrics.bestMonth,
      weakestMonth: metrics.weakestMonth,
    },
  };
};

const generateNarrativeSections = async (metrics) => {
  const context = {
    datasetName: metrics.datasetName,
    targetYear: metrics.targetYear,
    yoy: metrics.yoy,
    marginPct: metrics.marginPct,
    topCategories: metrics.topCategories.slice(0, 3),
    topBranches: metrics.topBranches.slice(0, 3),
    bestMonth: metrics.bestMonth,
    weakestMonth: metrics.weakestMonth,
    quarterStats: metrics.quarterStats,
    riskSignals: metrics.riskSignals,
  };
  const prompt = `InsightStream CFO asistanısın. Sana verilen KPI özetine dayanarak Türkçe bir yıllık yönetici özeti üret.
Sadece aşağıdaki JSON şemasına %100 uyan geçerli JSON döndür. Markdown veya açıklama ekleme.
Şema:
{
  "executiveSummary": ["madde", "madde", "madde"],
  "quarterNarratives": { "Q1": "...", "Q2": "...", "Q3": "...", "Q4": "..." },
  "riskAlerts": [
    {"title":"", "severity":"high|medium|low", "detail":"", "impact":"", "action":""}
  ],
  "strategicActions": [
    {"title":"", "description":"", "owner":"", "timeline":"", "impact":"High|Medium|Low", "status":"on-track|at-risk|not-started"}
  ]
}
Veriyi aynen kullan ve rakamları yorumla. JSON dışına çıkma.
KPI özeti: ${JSON.stringify(context)}`;

  const response = await withRetry(async (modelName) => {
    const text = await generateGeminiContent(modelName, prompt);
    if (!text) throw new Error('Boş AI yanıtı');
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  });
  return response;
};

app.get('/api/email/health', async (req, res) => {
  const smtpConfigured = !!process.env.SMTP_HOST;
  const resendConfigured = !!process.env.RESEND_API_KEY;

  if (!smtpConfigured && !resendConfigured) {
    return res.json({
      ok: false,
      providerMode: 'none',
      hintTR: 'E-posta servisi yapılandırılmamış.',
      errorMessage: 'SMTP_HOST veya RESEND_API_KEY eksik.'
    });
  }

  if (resendConfigured) {
    return res.json({
      ok: true,
      providerMode: 'resend',
      hintTR: 'Resend servisi hazır.'
    });
  }

  // SMTP Active Check
  const transporter = createSmtpTransporter();
  try {
    if (transporter) await transporter.verify();
    res.json({
      ok: true,
      providerMode: 'smtp',
      hintTR: 'SMTP bağlantısı başarılı.',
      smtpConfigured: true
    });
  } catch (error) {
    console.error('SMTP Health Check Failed:', error);
    res.json({
      ok: false,
      providerMode: 'smtp',
      hintTR: `SMTP Bağlantı Hatası: ${error.message}`,
      errorMessage: error.message, // Return exact error (e.g. ETIMEDOUT, 535)
      smtpConfigured: true
    });
  }
});

app.post('/api/ai/insights', async (req, res) => {
  const { dataset, filters } = req.body || {};
  if (!dataset) {
    return res.status(400).json({ errorMessage: 'Dataset verisi gerekiyor.' });
  }

  try {
    const text = await withRetry(async (modelName) => {
      const summaryString = JSON.stringify({
        name: dataset.name,
        stats: dataset.summary,
        activeFilters: filters,
      });
      const prompt = `As a Senior BI Analyst, provide narrative "AI Insights" for this dataset summary: ${summaryString}. Executive summary with bullet points. Answer in Turkish.`;
      return await generateGeminiContent(modelName, prompt) || 'Unable to generate insights.';
    });

    res.json({ text });
  } catch (error) {
    console.error('AI Insights Error:', error);
    res.status(500).json({ errorMessage: 'AI service error.' });
  }
});

app.post('/api/ai/chart-explanation', async (req, res) => {
  const { chartTitle, chartType } = req.body || {};
  if (!chartTitle || !chartType) {
    return res.status(400).json({ errorMessage: 'Grafik bilgileri eksik.' });
  }

  try {
    const text = await withRetry(async (modelName) => {
      const prompt = `
        As a BI Specialist, explain this specific chart:
        Title: "${chartTitle}"
        Type: "${chartType}"
        
        Provide a Turkish explanation including:
        1. What it shows (1 paragraph)
        2. How to read it (3-5 bullets)
        3. What to watch out for (1 bullet)
        Answer in Turkish language only.
      `;
      return await generateGeminiContent(modelName, prompt) || 'Açıklama üretilemedi.';
    });

    res.json({ text });
  } catch (error) {
    console.error('Chart Explanation Error:', error);
    res.status(500).json({ errorMessage: 'Açıklama üretilemedi.' });
  }
});

app.post('/api/ai/chat-plan', async (req, res) => {
  const { question, dataset } = req.body || {};
  if (!question || !dataset) {
    return res.status(400).json({ errorMessage: 'Soru ve dataset zorunludur.' });
  }

  try {
    const plan = await withRetry(async (modelName) => {
      const schema = JSON.stringify(dataset.mapping);
      const prompt = `You are InsightStream BI Co-Pilot. Convert the user's Turkish question into a JSON query plan. Respond with a valid JSON object only, without any backticks or code fences.

Dataset Schema: ${schema}
User Question: "${question}"

JSON schema:
{
  "intent": "topN | trend | distribution",
  "groupBy": "branch | city | category | month | weekday",
  "metric": "revenue | profit | units | transactions",
  "chart": "bar | line",
  "titleTR": "string",
  "topN": number (optional),
  "filters": {
    "year": number,
    "city": string,
    "category": string
  }
}

Rules:
- If user asks "hangi" or "en", intent is "topN" with topN:3 unless specified.
- Trend/time questions => intent: "trend", groupBy: "month".
- Use Turkish titles for titleTR.`;

      const jsonStr = await generateGeminiContent(modelName, prompt);
      if (!jsonStr) throw new Error('Plan oluşturulamadı');

      const cleaned = jsonStr.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(cleaned);
    });

    res.json(plan);
  } catch (error) {
    console.error('Chat Plan Error:', error);
    res.status(500).json({ errorMessage: error.message || 'Plan oluşturulamadı.' });
  }
});

app.post('/api/ai/annual-summary', async (req, res) => {
  const { dataset, year } = req.body || {};
  if (!dataset || !Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    return res.status(400).json({ errorMessage: 'Dataset verisi zorunludur.' });
  }

  try {
    const metrics = computeAnnualSnapshot(dataset, year);
    let aiSections = null;
    try {
      aiSections = await generateNarrativeSections(metrics);
    } catch (aiError) {
      console.warn('Yıllık özet AI anlatımı üretilemedi, fallback kullanılacak:', aiError?.message || aiError);
    }
    const payload = buildAnnualSummaryResponse(metrics, aiSections);
    res.json(payload);
  } catch (error) {
    console.error('Annual Summary Error:', error);
    res.status(500).json({ errorMessage: 'Yıllık özet oluşturulamadı.' });
  }
});

app.post('/api/email/send', async (req, res) => {
  const { to, subject, html, attachments } = req.body;

  if (!to) {
    return res.status(400).json({ ok: false, errorMessage: 'Alıcı adresi eksik.' });
  }

  const recipients = to
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    return res.status(400).json({ ok: false, errorMessage: 'Geçerli bir alıcı adresi bulunamadı.' });
  }

  let resendError = null;

  if (resend && process.env.RESEND_FROM) {
    try {
      const resendPayload = {
        from: process.env.RESEND_FROM,
        to: recipients,
        subject,
        html,
        attachments: (attachments || []).map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
        })),
      };

      const { data, error } = await resend.emails.send(resendPayload);

      if (error) throw error;

      return res.json({ ok: true, provider: 'resend', id: data.id });
    } catch (error) {
      console.error('Resend Gönderim Hatası:', error);
      resendError = error;
      if (!process.env.SMTP_HOST) {
        return res.status(500).json({
          ok: false,
          provider: 'resend',
          errorMessage: error.message || 'Resend üzerinden gönderim başarısız.',
          hintTR: 'Resend API hatası. Lütfen API anahtarını kontrol edin.',
        });
      }
    }
  }

  const transporter = createSmtpTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"InsightStream" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject,
        html,
        attachments: (attachments || []).map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
        })),
      });
      return res.json({ ok: true, provider: 'smtp', messageId: info.messageId });
    } catch (error) {
      const combinedError = resendError
        ? `Resend: ${resendError.message} | SMTP: ${error.message}`
        : error.message;

      return res.status(500).json({
        ok: false,
        provider: 'smtp',
        errorMessage: combinedError,
        hintTR: resendError
          ? 'Her iki e-posta servisi de hata verdi. Lütfen RESEND_FROM veya SMTP ayarlarını kontrol edin.'
          : 'SMTP sunucusu üzerinden gönderim başarısız oldu.',
      });
    }
  }

  res.status(400).json({
    ok: false,
    provider: 'none',
    errorMessage: 'Aktif bir e-posta sağlayıcısı bulunamadı.',
    hintTR: 'RESEND_API_KEY veya SMTP bilgilerini .env dosyanıza ekleyip sunucuyu yeniden başlatın.',
  });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
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
