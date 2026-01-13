
import { DataRow } from '../types';

const DB_NAME = 'InsightStreamDB';
const STORE_NAME = 'datasets';
const DB_VERSION = 1;

export class StorageService {
  private static db: IDBDatabase | null = null;

  private static async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = (event: any) => {
        reject(event.target.error);
      };
    });
  }

  static async saveDataset(id: string, rows: DataRow[]): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(rows, id);

        request.onsuccess = () => resolve();
        request.onerror = (event: any) => reject(event.target.error);
      });
    } catch (e) {
      console.warn('Failed to save to IndexedDB:', e);
    }
  }

  static async getDataset(id: string): Promise<DataRow[] | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event: any) => resolve(event.target.result || null);
        request.onerror = (event: any) => reject(event.target.error);
      });
    } catch (e) {
      console.warn('Failed to read from IndexedDB:', e);
      return null;
    }
  }

  static async clearAll(): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
  }
}
