import { openDB, type IDBPDatabase } from 'idb';
import type { DiagnosisRecord } from '../types';

const DB_NAME = 'plant-scanner-db';
const DB_VERSION = 1;
const STORE_NAME = 'diagnoses';

let db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
  return db;
}

/**
 * Save a new diagnosis to IndexedDB.
 */
export async function saveDiagnosis(record: Omit<DiagnosisRecord, 'id'>): Promise<number> {
  const database = await getDB();
  return database.add(STORE_NAME, record) as Promise<number>;
}

/**
 * Get all diagnoses, sorted newest first.
 */
export async function getAllDiagnoses(): Promise<DiagnosisRecord[]> {
  const database = await getDB();
  const all = await database.getAll(STORE_NAME);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Delete a single diagnosis by ID.
 */
export async function deleteDiagnosis(id: number): Promise<void> {
  const database = await getDB();
  await database.delete(STORE_NAME, id);
}

/**
 * Get a single diagnosis by ID.
 */
export async function getDiagnosis(id: number): Promise<DiagnosisRecord | undefined> {
  const database = await getDB();
  return database.get(STORE_NAME, id);
}
