
import { DataRow, FilterState, SchemaMapping, CalculatedField } from '../types';
import { MONTH_ORDER, WEEKDAY_ORDER, MONTH_MAP } from '../constants';

export class CalculationModule {
  static normalizeNumeric(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/[₺$€%\s]/g, '');
    if (str.includes('.') && str.includes(',')) {
      const lastDot = str.lastIndexOf('.');
      const lastComma = str.lastIndexOf(',');
      if (lastComma > lastDot) str = str.replace(/\./g, '').replace(/,/g, '.');
      else str = str.replace(/,/g, '');
    } else str = str.replace(/,/g, '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  static evaluateExpression(expression: string, row: any): number {
    try {
      // Güvenli ifade değerlendiricisi: Sadece temel aritmetik ve parantezler
      // [FieldName] formatını row değerleriyle değiştir
      let sanitized = expression.replace(/\[([^\]]+)\]/g, (_, col) => {
        const val = this.normalizeNumeric(row[col]);
        return `(${val})`;
      });

      // Sadece izin verilen karakterleri kontrol et (JS Injection engelleme)
      if (/[^0-9+\-*/().\s]/.test(sanitized)) {
        throw new Error("Geçersiz karakter saptandı.");
      }

      // Eval yerine kontrollü Function constructor (hala riskli ama regex ile kısıtladık)
      return new Function(`return ${sanitized}`)();
    } catch (e) {
      return 0;
    }
  }

  static processRow(row: any, map: SchemaMapping, calcFields: CalculatedField[] = []): DataRow {
    const d = { ...row };

    // Hesaplı alanları uygula (Virtual Columns)
    calcFields.forEach(field => {
      d[field.name] = this.evaluateExpression(field.expression, row);
    });

    const price = this.normalizeNumeric(row[map.price || '']);
    const qty = this.normalizeNumeric(row[map.qty || '']);
    const discount = this.normalizeNumeric(row[map.discount || '']);

    // --- Smart Derivation Logic ---
    let revenue = this.normalizeNumeric(row[map.revenue || '']);
    let profit = this.normalizeNumeric(row[map.profit || '']);
    let cost = this.normalizeNumeric(row[map.cost || '']);
    let marginRate = this.normalizeNumeric(row[map.margin || '']);
    if (marginRate > 1) marginRate = marginRate / 100;

    // 1. Derive Revenue
    if (!revenue && price && qty) {
      revenue = price * qty;
    }

    // 2. Net Revenue Adjustment (if not already net)
    // If we calculated revenue from Price*Qty, it's Gross. If there's a discount, substr.
    // If revenue came from a column, check if 'Net' is in name? (For now assume manual priority)
    if (discount) {
      // If revenue was derived or looks like gross, apply discount
      // Simplification: We treat 'revenue' as the final sales amount.
      // If column matches 'Revenue', we assume it's net unless logic suggests otherwise.
      // Here we subtract discount ONLY if revenue was derived OR explicit logical gap.
      // For safety: Let's assume calculated revenue is Gross.
      if (!row[map.revenue || ''] && price && qty) {
        revenue -= discount;
      }
    }

    // 3. Derive Cost / Profit / Margin Triangulation
    // Equation: Profit = Revenue - Cost

    // Case A: Have Revenue & Cost -> Calc Profit
    if (!profit && revenue && cost) {
      profit = revenue - cost;
    }

    // Case B: Have Revenue & Profit -> Calc Cost
    if (!cost && revenue && profit) {
      cost = revenue - profit;
    }

    // Case C: Have Revenue & Margin -> Calc Profit & Cost
    if (!profit && revenue && marginRate) {
      profit = revenue * marginRate;
      if (!cost) cost = revenue - profit;
    }

    // Case D: Have Cost & Margin -> Calc Revenue & Profit (Markup)
    // Margin here is usually Profit/Revenue. Markup is Profit/Cost. 
    // Let's assume standard margin defined as Profit/Revenue.
    // Rev = Cost / (1 - Margin)
    if (!revenue && cost && marginRate && marginRate < 1) {
      revenue = cost / (1 - marginRate);
      profit = revenue * marginRate;
    }

    // fallback final check
    if (!marginRate && revenue) {
      marginRate = profit / revenue;
    }

    d['REVENUE_final'] = revenue || 0;
    d['PROFIT_final'] = profit || 0;
    d['COST_final'] = cost || (revenue - profit) || 0;
    d['QTY_SOLD_final'] = qty || 0;
    d['UNIT_PRICE_final'] = price || (qty ? revenue / qty : 0);
    d['MARGIN_RATE_final'] = marginRate || 0;

    // Priority: Mapped product column -> Explicit 'Product Name' columns -> Fallback to UNK_PROD
    // We avoid 'ID' columns here if possible, as 'map.product' logic in dataProcessor is now stricter.
    d['PRODUCT_ID_final'] = String(row[map.product || ''] || row['Product Name'] || row['Urun Adi'] || row['Item Name'] || row['Product'] || 'UNK_PROD');
    d['TX_ID_final'] = String(row[map.txId || ''] || 'TX_' + Math.random());

    let jsDate: Date | null = null;
    const dateVal = row[map.date || ''];
    if (typeof dateVal === 'number' && dateVal > 10000) {
      jsDate = new Date(Date.UTC(1899, 11, 30) + dateVal * 86400000);
    } else if (dateVal) {
      const parsed = new Date(dateVal);
      if (!isNaN(parsed.getTime())) jsDate = parsed;
    }

    if (jsDate) {
      d['YEAR_final'] = jsDate.getUTCFullYear();
      d['MONTH_index'] = jsDate.getUTCMonth() + 1;
      d['WEEKDAY_index'] = ((jsDate.getUTCDay() + 6) % 7) + 1;
    } else {
      const rawYear = parseInt(row[map.year || '']);
      d['YEAR_final'] = isNaN(rawYear) ? null : rawYear;
      const rawMonth = String(row[map.month || '']).toLowerCase();
      d['MONTH_index'] = MONTH_MAP[rawMonth] || null;
    }

    // Fix: Cast potentially non-numeric property access to any before subtraction for arithmetic safety.
    d['MONTH_final'] = d['MONTH_index'] ? MONTH_ORDER[(d['MONTH_index'] as any) - 1] : 'Geçersiz';
    // Fix: Cast potentially non-numeric property access to any before subtraction for arithmetic safety.
    d['WEEKDAY_final'] = d['WEEKDAY_index'] ? WEEKDAY_ORDER[(d['WEEKDAY_index'] as any) - 1] : 'Geçersiz';
    d['CITY_final'] = String(row[map.city || ''] || 'Diğer');
    d['BRANCH_final'] = String(row[map.branch || ''] || 'Genel');
    d['CATEGORY_final'] = String(row[map.category || ''] || 'Kategorisiz');
    d['_year'] = d['YEAR_final'];
    d['_month'] = d['MONTH_index'];
    d['_category'] = d['CATEGORY_final'];
    d['_city'] = d['CITY_final'];
    d['_branch'] = d['BRANCH_final'];
    d['_revenue'] = d['REVENUE_final'];
    d['_profit'] = d['PROFIT_final'];
    d['_cost'] = Math.max(0, d['REVENUE_final'] - d['PROFIT_final']);
    return d;
  }

  static applyFilters(rows: DataRow[], filters: FilterState, map: SchemaMapping): DataRow[] {
    return rows.filter(row => {
      const matchYear = filters.years === "ALL" || (row['YEAR_final'] && (filters.years as number[]).includes(row['YEAR_final']));
      const matchMonth = filters.months === "ALL" || (row['MONTH_index'] && (filters.months as number[]).includes(row['MONTH_index']));
      const matchCity = filters.cities === "ALL" || (filters.cities as string[]).includes(row['CITY_final']);
      const matchBranch = filters.branches === "ALL" || (filters.branches as string[]).includes(row['BRANCH_final']);
      const matchCategory = filters.categories === "ALL" || (filters.categories as string[]).includes(row['CATEGORY_final']);
      return matchYear && matchMonth && matchCity && matchBranch && matchCategory;
    });
  }

  static runSimulation(rows: DataRow[], categoryScope: string, priceChange: number, marginChange: number) {
    const priceFactor = 1 + (priceChange / 100);
    const marginDelta = marginChange / 100;

    let baseRev = 0, baseProfit = 0;
    let scnRev = 0, scnProfit = 0;

    rows.forEach(r => {
      baseRev += r['REVENUE_final'];
      baseProfit += r['PROFIT_final'];

      const apply = categoryScope === 'ALL' || r['CATEGORY_final'] === categoryScope;
      if (apply) {
        const sRev = r['REVENUE_final'] * priceFactor;
        const sMargin = Math.min(0.95, Math.max(0, r['MARGIN_RATE_final'] + marginDelta));
        scnRev += sRev;
        scnProfit += sRev * sMargin;
      } else {
        scnRev += r['REVENUE_final'];
        scnProfit += r['PROFIT_final'];
      }
    });

    return {
      base: { revenue: baseRev, profit: baseProfit },
      scenario: { revenue: scnRev, profit: scnProfit }
    };
  }

  static executeQueryPlan(rows: DataRow[], plan: any) {
    const metricKey = plan.metric === 'profit' ? 'PROFIT_final' :
      plan.metric === 'units' ? 'QTY_SOLD_final' :
        plan.metric === 'transactions' ? 'TX_ID_final' : 'REVENUE_final';

    const groupKey = plan.groupBy === 'branch' ? 'BRANCH_final' :
      plan.groupBy === 'city' ? 'CITY_final' :
        plan.groupBy === 'month' ? 'MONTH_final' :
          plan.groupBy === 'weekday' ? 'WEEKDAY_final' : 'CATEGORY_final';

    const indexKey = plan.groupBy === 'month' ? 'MONTH_index' :
      plan.groupBy === 'weekday' ? 'WEEKDAY_index' : null;

    const agg: Record<string, any> = {};
    rows.forEach(r => {
      const k = r[groupKey];
      if (!agg[k]) agg[k] = { label: k, value: plan.metric === 'transactions' ? new Set() : 0, index: indexKey ? r[indexKey] : 0 };
      if (plan.metric === 'transactions') agg[k].value.add(r['TX_ID_final']);
      else agg[k].value += r[metricKey];
    });

    let results = Object.values(agg).map(x => ({
      label: x.label,
      value: plan.metric === 'transactions' ? x.value.size : x.value,
      index: x.index
    }));

    if (indexKey) {
      results.sort((a, b) => a.index - b.index);
    } else {
      results.sort((a, b) => b.value - a.value);
    }

    if (plan.topN) results = results.slice(0, plan.topN);
    return results;
  }

  static getGroupedData(rows: DataRow[], fieldKey: string, valueKey: string, aggregate: 'SUM' | 'COUNT' = 'SUM', limit = 5) {
    const buckets: Record<string, number> = {};
    rows.forEach(row => {
      const labelRaw = row[fieldKey];
      const label = typeof labelRaw === 'string' && labelRaw.trim().length > 0 ? labelRaw : 'Diğer';
      const increment = aggregate === 'COUNT' ? 1 : this.normalizeNumeric(row[valueKey]);
      buckets[label] = (buckets[label] || 0) + increment;
    });

    return Object.entries(buckets)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  static getTransactionsByCategory(rows: DataRow[]) {
    const stats: Record<string, { txIds: Set<string>, rev: number, profit: number }> = {};
    const globalTxIds = new Set<string>();

    rows.forEach(r => {
      const cat = r['CATEGORY_final'] || 'Bilinmeyen';
      const txId = r['TX_ID_final'];
      if (!txId) return;

      if (!stats[cat]) stats[cat] = { txIds: new Set(), rev: 0, profit: 0 };
      stats[cat].txIds.add(txId);
      stats[cat].rev += r['REVENUE_final'];
      stats[cat].profit += r['PROFIT_final'];
      globalTxIds.add(txId);
    });

    const totalTransactions = globalTxIds.size;
    let allCategories = Object.entries(stats).map(([label, data]) => ({
      label,
      value: data.txIds.size,
      rev: data.rev,
      profit: data.profit,
      pay: totalTransactions > 0 ? (data.txIds.size / totalTransactions) * 100 : 0
    })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'tr'));

    if (allCategories.length > 7) {
      const top7 = allCategories.slice(0, 7);
      const othersTxIds = new Set<string>();
      let othersRev = 0;
      let othersProfit = 0;
      Object.entries(stats).forEach(([cat, data]) => {
        if (!top7.find(t => t.label === cat)) {
          data.txIds.forEach(id => othersTxIds.add(id));
          othersRev += data.rev;
          othersProfit += data.profit;
        }
      });
      return [...top7, {
        label: 'Diğer',
        value: othersTxIds.size,
        rev: othersRev,
        profit: othersProfit,
        pay: totalTransactions > 0 ? (othersTxIds.size / totalTransactions) * 100 : 0
      }];
    }
    return allCategories;
  }

  static getPriceQtyBubbleData(rows: DataRow[]) {
    const grouped: Record<string, { totalRev: number, totalQty: number, totalProfit: number, category: string }> = {};
    rows.forEach(r => {
      const pid = r['PRODUCT_ID_final'];
      if (!grouped[pid]) grouped[pid] = { totalRev: 0, totalQty: 0, totalProfit: 0, category: r['CATEGORY_final'] };
      grouped[pid].totalRev += r['REVENUE_final'];
      grouped[pid].totalQty += r['QTY_SOLD_final'];
      grouped[pid].totalProfit += r['PROFIT_final'];
    });
    const data = Object.entries(grouped).map(([pid, stats]) => ({
      label: pid,
      category: stats.category,
      x: stats.totalQty > 0 ? stats.totalRev / stats.totalQty : 0,
      y: stats.totalQty,
      z: Math.max(0, stats.totalProfit)
    }));
    const prices = data.map(d => d.x);
    const maxP = Math.max(...prices);
    const minP = Math.min(...prices);
    if (data.length < 3 || (maxP - minP) < 0.01) {
      return { isFallback: true, fallbackData: this.getTransactionsByCategory(rows).map(d => ({ label: d.label, value: d.value })) };
    }
    return { isFallback: false, data };
  }

  static getTotalKPIs(rows: DataRow[]) {
    return {
      revenue: rows.reduce((s, r) => s + r['REVENUE_final'], 0),
      profit: rows.reduce((s, r) => s + r['PROFIT_final'], 0),
      units: rows.reduce((s, r) => s + r['QTY_SOLD_final'], 0),
      txns: new Set(rows.map(r => r['TX_ID_final'])).size
    };
  }

  static getForecastData(rows: DataRow[]) {
    const valid = rows.filter(r => r['YEAR_final'] && r['MONTH_index']);
    if (valid.length < 1) return [];
    const years = Array.from(new Set(valid.map(r => r['YEAR_final'] as number))).sort();
    const lastY = years[years.length - 1];
    const actuals = Array.from({ length: 12 }, (_, i) => {
      const v = valid.filter(r => r['YEAR_final'] === lastY && r['MONTH_index'] === i + 1).reduce((s, r) => s + r['PROFIT_final'], 0);
      return v === 0 ? null : v;
    });
    if (actuals.filter(v => v !== null).length < 6) return actuals.map((v, i) => ({ label: MONTH_ORDER[i].slice(0, 3), actual: v, forecast: null }));
    let series = actuals.map(v => v ?? 0);
    for (let i = 0; i < 6; i++) {
      const slice = series.slice(-6);
      series.push(slice.reduce((a, b) => a + b, 0) / 6);
    }
    return actuals.map((v, i) => ({ label: MONTH_ORDER[i].slice(0, 3), actual: v, forecast: i === 11 ? v : null })).concat(series.slice(12).map((v, i) => ({ label: MONTH_ORDER[i].slice(0, 3) + '+', actual: null, forecast: v })));
  }

  static getParetoData(rows: DataRow[]) {
    const counts: Record<string, number> = {};
    rows.forEach(r => counts[r['CATEGORY_final']] = (counts[r['CATEGORY_final']] || 0) + r['REVENUE_final']);
    const sorted = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, x) => s + x.value, 0);
    let run = 0;
    return sorted.map(x => { run += x.value; return { ...x, cumulativePercent: total ? (run / total) * 100 : 0 }; });
  }

  static getTopProducts(rows: DataRow[], limit = 10) {
    const products: Record<string, { revenue: number, profit: number }> = {};
    rows.forEach(r => {
      const pid = r['PRODUCT_ID_final'];
      if (!products[pid]) products[pid] = { revenue: 0, profit: 0 };
      products[pid].revenue += r['REVENUE_final'];
      products[pid].profit += r['PROFIT_final'];
    });
    return Object.entries(products)
      .map(([label, stats]) => ({ label, value: stats.revenue, profit: stats.profit }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  static getProfitMarginTrend(rows: DataRow[]) {
    const monthlyStats: Record<string, { revenue: number, profit: number, monthIdx: number }> = {};

    rows.forEach(r => {
      if (!r['MONTH_index']) return;
      const key = r['MONTH_final'];
      if (!monthlyStats[key]) monthlyStats[key] = { revenue: 0, profit: 0, monthIdx: r['MONTH_index'] };
      monthlyStats[key].revenue += r['REVENUE_final'];
      monthlyStats[key].profit += r['PROFIT_final'];
    });

    return Object.values(monthlyStats)
      .sort((a, b) => a.monthIdx - b.monthIdx)
      .map(stats => ({
        label: MONTH_ORDER[stats.monthIdx - 1]?.slice(0, 3) || 'UNK',
        margin: stats.revenue ? (stats.profit / stats.revenue) * 100 : 0
      }));
  }

  static getCumulativeRevenue(rows: DataRow[]) {
    const daily: Record<string, { date: number, revenue: number }> = {};
    let hasDates = false;

    rows.forEach(r => {
      if (r['YEAR_final'] && r['MONTH_index']) {
        hasDates = true;
        // Create a sortable key YYYYMM
        const key = r['YEAR_final'] * 100 + r['MONTH_index'];
        if (!daily[key]) daily[key] = { date: key, revenue: 0 };
        daily[key].revenue += r['REVENUE_final'];
      }
    });

    if (!hasDates) return [];

    const sorted = Object.values(daily).sort((a, b) => a.date - b.date);
    let runningTotal = 0;

    return sorted.map(d => {
      runningTotal += d.revenue;
      const year = Math.floor(d.date / 100);
      const month = d.date % 100;
      const label = `${MONTH_ORDER[month - 1]?.slice(0, 3)} ${year}`;
      return { label, value: runningTotal };
    });
  }
}
