
export interface DataRow {
  [key: string]: any;
}

export type ColumnType = 'numeric' | 'string' | 'date' | 'boolean' | 'unknown';

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  missingRate: number;
  uniqueCount: number;
  sampleValues: any[];
}

export interface CalculatedField {
  id: string;
  name: string;
  expression: string; // Örn: "[Revenue] - [Cost]"
  type: 'numeric' | 'string';
  description?: string;
}

export interface SchemaMapping {
  txId: string | null;
  date: string | null;
  year: string | null;
  month: string | null;
  weekday: string | null;
  city: string | null;
  branch: string | null;
  category: string | null;
  price: string | null;
  qty: string | null;
  margin: string | null;
  revenue: string | null;
  profit: string | null;
  cost: string | null;
}

export interface AnalysisRecord {
  id: string;
  type: 'chat' | 'simulation' | 'insight' | 'recommendation' | 'dashboard_snapshot';
  datasetId: string;
  titleTR: string;
  createdAt: number;
  filterStateSnapshot: FilterState;
  payload: any;
  pinned?: boolean;
}

export interface ScheduledReport {
  id: string;
  datasetId: string;
  datasetName: string;
  email: string;
  reportType: 'manager' | 'detail';
  frequency: 'daily' | 'weekly' | 'monthly';
  day?: string;
  time: string;
  isEnabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastStatus?: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  mapping: SchemaMapping;
  mode: 'URBAN_SALES' | 'GENERIC_BI';
  filters: FilterState;
  isLocked: boolean;
  createdAt: number;
  calculatedFields?: CalculatedField[];
}

export interface PinnedChart {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'composed';
  data: any[];
  plan: any;
  createdAt: number;
}

export interface Dataset {
  name: string;
  rows: DataRow[];
  columns: string[];
  profiles: ColumnProfile[];
  mapping: SchemaMapping;
  mode: 'URBAN_SALES' | 'GENERIC_BI';
  summary: {
    rowCount: number;
    colCount: number;
    missingValues: number;
  };
}

export interface FilterState {
  years: number[] | "ALL";
  months: number[] | "ALL";
  cities: string[] | "ALL";
  branches: string[] | "ALL";
  categories: string[] | "ALL";
  genericFilters: Record<string, string[] | "ALL">;
}

export enum Page {
  Landing = 'landing',
  Home = 'home',
  Dashboard = 'dashboard',
  DataQuality = 'data-quality',
  Simulation = 'simulation',
  Chat = 'chat',
  Scheduling = 'scheduling',
  History = 'history',
  AnnualSummary = 'annual-summary'
}

export interface AnnualKPIHighlight {
  id: string;
  title: string;
  value: number;
  unit: 'currency' | 'percent' | 'number';
  changePct: number | null;
  trend: 'up' | 'down' | 'flat';
  helper: string;
}

export interface QuarterlyPerformanceSummary {
  quarter: string;
  revenue: number;
  profit: number;
  yoyRevenuePct: number | null;
  yoyProfitPct: number | null;
  narrative: string;
}

export interface MonthlyHeatmapEntry {
  month: string;
  revenue: number;
  profit: number;
  cost: number;
  transactions: number;
  marginPct: number;
  revenueIndex: number;
  profitIndex: number;
  contributionPct: number;
  status: 'up' | 'down' | 'flat';
  comment: string;
}

export interface RiskAlert {
  title: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
  impact: string;
  action: string;
}

export interface StrategicAction {
  title: string;
  description: string;
  owner: string;
  timeline: string;
  impact: 'High' | 'Medium' | 'Low';
  status: 'on-track' | 'at-risk' | 'not-started';
}

export interface StrategicAnnualSummary {
  datasetName: string;
  year: number;
  generatedAt: string;
  totals: {
    revenue: number;
    profit: number;
    units: number;
    transactions: number;
    avgBasket: number;
  };
  yoy: {
    revenuePct: number | null;
    profitPct: number | null;
    unitsPct: number | null;
  };
  marginPct: number;
  kpiHighlights: AnnualKPIHighlight[];
  executiveSummary: string[];
  quarterlyPerformance: QuarterlyPerformanceSummary[];
  monthlyHeatmap: MonthlyHeatmapEntry[];
  riskAlerts: RiskAlert[];
  strategicActions: StrategicAction[];
  metadata?: Record<string, any>;
}
