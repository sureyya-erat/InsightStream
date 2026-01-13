
export const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

export const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const MONTH_MAP: Record<string, number> = {
  "jan": 1, "january": 1, "01": 1, "1": 1, "ocak": 1,
  "feb": 2, "february": 2, "02": 2, "2": 2, "şubat": 2, "subat": 2,
  "mar": 3, "march": 3, "03": 3, "3": 3, "mart": 3,
  "apr": 4, "april": 4, "04": 4, "4": 4, "nisan": 4,
  "may": 5, "05": 5, "5": 5, "mayıs": 5, "mayis": 5,
  "jun": 6, "june": 6, "06": 6, "6": 6, "haziran": 6,
  "jul": 7, "july": 7, "07": 7, "7": 7, "temmuz": 7,
  "aug": 8, "august": 8, "08": 8, "8": 8, "ağustos": 8, "agustos": 8,
  "sep": 9, "september": 9, "09": 9, "9": 9, "eylül": 9, "eylul": 9,
  "oct": 10, "october": 10, "10": 10, "ekim": 10,
  "nov": 11, "november": 11, "11": 11, "kasım": 11, "kasim": 11,
  "dec": 12, "december": 12, "12": 12, "aralık": 12, "aralik": 12
};

export const SAMPLE_DATASET: any[] = [
  { "TRANSACTION ID": "TX001", "DATE": "2023-01-05", "CITY": "Istanbul", "Branch": "Besiktas", "PRODUCT CATEGORY": "Coffee", "UNIT PRICE": "₺85.00", "QTY SOLD": 200, "PROFIT MARGIN (%)": "35%" },
  { "TRANSACTION ID": "TX001", "DATE": "2023-01-05", "CITY": "Istanbul", "Branch": "Besiktas", "PRODUCT CATEGORY": "Snacks", "UNIT PRICE": "₺45.00", "QTY SOLD": 150, "PROFIT MARGIN (%)": "20%" },
  { "TRANSACTION ID": "TX002", "DATE": "2023-01-10", "CITY": "Ankara", "Branch": "Kizilay", "PRODUCT CATEGORY": "Tea", "UNIT PRICE": "45", "QTY SOLD": 300, "PROFIT MARGIN (%)": 0.45 },
  { "TRANSACTION ID": "TX003", "DATE": "2023-02-15", "CITY": "Izmir", "Branch": "Bornova", "PRODUCT CATEGORY": "Desserts", "UNIT PRICE": 120, "QTY SOLD": 100, "PROFIT MARGIN (%)": 25 },
  { "TRANSACTION ID": "TX004", "DATE": "2023-03-20", "CITY": "Istanbul", "Branch": "Kadikoy", "PRODUCT CATEGORY": "Coffee", "UNIT PRICE": 95, "QTY SOLD": 180, "PROFIT MARGIN (%)": 38 },
  { "TRANSACTION ID": "TX005", "DATE": "2023-04-12", "CITY": "Bursa", "Branch": "Nilufer", "PRODUCT CATEGORY": "Snacks", "UNIT PRICE": 55, "QTY SOLD": 250, "PROFIT MARGIN (%)": 15 },
  { "TRANSACTION ID": "TX006", "DATE": "2023-05-25", "CITY": "Antalya", "Branch": "Konyaalti", "PRODUCT CATEGORY": "Cold Drinks", "UNIT PRICE": 65, "QTY SOLD": 400, "PROFIT MARGIN (%)": 30 },
  { "TRANSACTION ID": "TX007", "DATE": "2023-06-30", "CITY": "Istanbul", "Branch": "Besiktas", "PRODUCT CATEGORY": "Desserts", "UNIT PRICE": 130, "QTY SOLD": 80, "PROFIT MARGIN (%)": 22 },
  { "TRANSACTION ID": "TX008", "DATE": "2023-07-04", "CITY": "Ankara", "Branch": "Merkez", "PRODUCT CATEGORY": "Coffee", "UNIT PRICE": 100, "QTY SOLD": 350, "PROFIT MARGIN (%)": 40 },
  { "TRANSACTION ID": "TX009", "DATE": "2023-08-14", "CITY": "Istanbul", "Branch": "Kadikoy", "PRODUCT CATEGORY": "Snacks", "UNIT PRICE": 50, "QTY SOLD": 220, "PROFIT MARGIN (%)": 18 },
  { "TRANSACTION ID": "TX010", "DATE": "2023-09-19", "CITY": "Izmir", "Branch": "Bornova", "PRODUCT CATEGORY": "Coffee", "UNIT PRICE": 110, "QTY SOLD": 140, "PROFIT MARGIN (%)": 32 },
  { "TRANSACTION ID": "TX011", "DATE": "2023-10-22", "CITY": "Ankara", "Branch": "Kizilay", "PRODUCT CATEGORY": "Cold Drinks", "UNIT PRICE": 70, "QTY SOLD": 310, "PROFIT MARGIN (%)": 28 },
  { "TRANSACTION ID": "TX012", "DATE": "2023-11-28", "CITY": "Istanbul", "Branch": "Besiktas", "PRODUCT CATEGORY": "Tea", "UNIT PRICE": 40, "QTY SOLD": 450, "PROFIT MARGIN (%)": 42 },
  { "TRANSACTION ID": "TX013", "DATE": "2023-12-15", "CITY": "Bursa", "Branch": "Nilufer", "PRODUCT CATEGORY": "Coffee", "UNIT PRICE": 105, "QTY SOLD": 190, "PROFIT MARGIN (%)": 36 }
];
