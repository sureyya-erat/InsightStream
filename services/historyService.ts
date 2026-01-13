
import { AnalysisRecord, FilterState } from '../types';

export class HistoryService {
  private static getStorageKey(datasetId: string): string {
    return `insightstream_history_${datasetId}`;
  }

  static saveRecord(datasetId: string, record: Omit<AnalysisRecord, 'id' | 'createdAt' | 'pinned'>): AnalysisRecord {
    const newRecord: AnalysisRecord = {
      ...record,
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      pinned: false
    };

    const key = this.getStorageKey(datasetId);
    const existing = this.getRecords(datasetId);
    const updated = [newRecord, ...existing];
    localStorage.setItem(key, JSON.stringify(updated));
    return newRecord;
  }

  static getRecords(datasetId: string): AnalysisRecord[] {
    const key = this.getStorageKey(datasetId);
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  static togglePin(datasetId: string, recordId: string): void {
    const key = this.getStorageKey(datasetId);
    const records = this.getRecords(datasetId);
    const updated = records.map(r => r.id === recordId ? { ...r, pinned: !r.pinned } : r);
    localStorage.setItem(key, JSON.stringify(updated));
  }

  static deleteRecord(datasetId: string, recordId: string): void {
    const key = this.getStorageKey(datasetId);
    const records = this.getRecords(datasetId);
    const updated = records.filter(r => r.id !== recordId);
    localStorage.setItem(key, JSON.stringify(updated));
  }

  static clearHistory(datasetId: string): void {
    localStorage.removeItem(this.getStorageKey(datasetId));
  }
}
