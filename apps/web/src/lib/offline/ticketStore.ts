/**
 * Almacén offline del boleto digital (IndexedDB).
 *
 * Objetivo: que el comprador (tercera edad) pueda **mostrar su boleto y su QR
 * en el sorteo aunque no tenga señal**. Cuando el boleto carga con red lo
 * guardamos aquí; cuando no hay red, lo leemos de aquí y renderizamos igual.
 *
 * Sin dependencias externas: IndexedDB nativo, envuelto en Promises.
 * Falla en silencio (best-effort): si IndexedDB no está disponible —modo
 * incógnito, navegador viejo— las funciones simplemente no guardan/leen y la
 * página sigue funcionando con red.
 */
import type { DigitalTicketDTO } from '@bismark/shared';

const DB_NAME = 'bismark-offline';
const DB_VERSION = 1;
const STORE = 'tickets';

/** Registro guardado: el DTO del boleto + cuándo se guardó (para mostrar "guardado el ..."). */
export interface StoredTicket {
  code: string;
  ticket: DigitalTicketDTO;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'code' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Guarda (o actualiza) el boleto para verlo sin internet. No lanza errores. */
export async function saveTicket(code: string, ticket: DigitalTicketDTO): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const record: StoredTicket = { code, ticket, savedAt: Date.now() };
      const req = tx(db, 'readwrite').put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Lee el boleto guardado (o `null` si no existe / no hay IndexedDB). No lanza errores. */
export async function loadTicket(code: string): Promise<StoredTicket | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<StoredTicket | null>((resolve) => {
    try {
      const req = tx(db, 'readonly').get(code);
      req.onsuccess = () => resolve((req.result as StoredTicket | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
