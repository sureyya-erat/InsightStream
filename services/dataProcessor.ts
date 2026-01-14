
import { DataRow, Dataset, ColumnProfile, ColumnType, SchemaMapping } from '../types';
import { MONTH_ORDER, WEEKDAY_ORDER } from '../constants';

export class DataProcessor {
  private static detectType(values: any[]): ColumnType {
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonNull.length === 0) return 'unknown';

    let isNumeric = true;
    let isDate = true;

    for (const val of nonNull) {
      if (isNaN(Number(String(val).replace(/[^0-9.-]+/g, "")))) isNumeric = false;
      const date = new Date(val);
      if (isNaN(date.getTime()) || (typeof val === 'number' && val < 10000)) isDate = false;
    }

    if (isDate) return 'date';
    if (isNumeric) return 'numeric';
    return 'string';
  }

  static profileDataset(rows: DataRow[]): ColumnProfile[] {
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0]);
    return keys.map(key => {
      const values = rows.map(r => r[key]);
      const unique = new Set(values);
      const missing = values.filter(v => v === null || v === undefined || v === '').length;
      return {
        name: key,
        type: this.detectType(values),
        missingRate: missing / rows.length,
        uniqueCount: unique.size,
        sampleValues: values.slice(0, 3)
      };
    });
  }

  static autoMap(profiles: ColumnProfile[]): SchemaMapping {
    const map: SchemaMapping = {
      txId: null, date: null, year: null, month: null, weekday: null,
      city: null, branch: null, category: null, price: null, qty: null,
      margin: null, revenue: null, profit: null, cost: null, discount: null, product: null
    };

    const find = (keywords: string[], type?: ColumnType, excludePattern?: RegExp) => {
      // Prioritize exact matches first, then partial matches
      const exact = profiles.find(p =>
        keywords.some(k => p.name.toLowerCase() === k.toLowerCase()) &&
        (!type || p.type === type) &&
        (!excludePattern || !excludePattern.test(p.name))
      );
      if (exact) return exact.name;

      return profiles.find(p =>
        keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase())) &&
        (!type || p.type === type) &&
        (!excludePattern || !excludePattern.test(p.name))
      )?.name || null;
    };

    map.txId = find(['id', 'tx', 'transaction', 'order', 'işlem', 'islem', 'fiş', 'fis', 'invoice', 'sipariş', 'siparis', 'ref', 'reference']);
    map.date = find(['date', 'tarih', 'zaman', 'time', 'created', 'oluşturma', 'dönem', 'period'], 'date');
    if (!map.date) map.date = find(['date', 'tarih', 'zaman'], 'string'); // Fallback for unparsed dates

    map.year = find(['year', 'yıl', 'yil', 'sene']);
    map.month = find(['month', 'ay']);
    map.weekday = find(['weekday', 'gün', 'gun', 'day']);

    map.city = find(['city', 'şehir', 'sehir', 'il', 'region', 'bölge', 'bolge', 'location', 'lokasyon', 'kent', 'province']);
    map.branch = find(['branch', 'şube', 'sube', 'mağaza', 'magaza', 'store', 'district', 'bayi', 'ofis', 'nokta']);
    map.category = find(['category', 'kategori', 'tip', 'type', 'segment', 'grup', 'group', 'class', 'sınıf', 'tür', 'tur', 'family', 'aile']);
    // Exclude columns containing "id" (case insensitive) for product names to avoid codes like "PROD_ID"
    map.product = find(['product', 'ürün', 'urun', 'malzeme', 'item', 'name', 'ad', 'description', 'tanım', 'cinsi', 'type', 'tip'], undefined, /id/i);

    // Financials
    map.price = find(['price', 'fiyat', 'birim', 'rate', 'unitprice', 'satış fiyatı', 'satis fiyati', 'birim fiyat'], 'numeric');
    map.qty = find(['qty', 'quantity', 'adet', 'miktar', 'units', 'count', 'sayı', 'sayi', 'volume', 'hacim'], 'numeric');
    map.margin = find(['margin', 'marj', 'oran', 'rate', 'kar%', 'kâr%', 'profitability', 'karlılık'], 'numeric');
    map.revenue = find(['revenue', 'sales', 'ciro', 'tutar', 'amount', 'gelir', 'toplam', 'total', 'bedel', 'satış', 'satis'], 'numeric');
    map.profit = find(['profit', 'kar', 'kâr', 'kazanç', 'net', 'earnings', 'fayda'], 'numeric');
    map.cost = find(['cost', 'maliyet', 'gider', 'expense', 'harcama', 'alış', 'alis'], 'numeric');
    map.discount = find(['discount', 'indirim', 'iskonto', 'kampanya', 'rebate'], 'numeric');

    return map;
  }

  static processDataset(name: string, rawRows: DataRow[]): Dataset {
    const profiles = this.profileDataset(rawRows);
    const mapping = this.autoMap(profiles);

    // Mode Detection: Urban Sales requires key fields OR enough info to calculate them
    // Relaxed Rule: effectively always URBAN_SALES if we have at least one dimension and one metric
    const hasDimensions = !!(mapping.date || mapping.category || mapping.city || mapping.branch);
    const hasMetrics = !!(mapping.revenue || (mapping.price && mapping.qty));

    const isUrban = hasDimensions && hasMetrics;

    return {
      name,
      rows: rawRows,
      columns: Object.keys(rawRows[0] || {}),
      profiles,
      mapping,
      mode: isUrban ? 'URBAN_SALES' : 'GENERIC_BI',
      summary: {
        rowCount: rawRows.length,
        colCount: profiles.length,
        missingValues: profiles.reduce((a, b) => a + (b.missingRate * rawRows.length), 0)
      }
    };
  }

  static async parseFile(file: File): Promise<DataRow[]> {
    return new Promise((resolve, reject) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        (window as any).Papa.parse(file, {
          header: true, dynamicTyping: true, skipEmptyLines: true,
          complete: (res: any) => resolve(res.data),
          error: (err: any) => reject(new Error('CSV okuma hatası: ' + err.message))
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = (window as any).XLSX.read(data, { type: 'array' });
          const json = (window as any).XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          resolve(json);
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(JSON.parse(e.target?.result as string));
        reader.readAsText(file);
      } else reject(new Error('Desteklenmeyen dosya formatı.'));
    });
  }
}
