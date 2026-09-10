/**
 * Durable local data store for day-to-day operations.
 *
 * This uses IndexedDB in the browser development build. The API is deliberately
 * small and mirrors the repository calls the Tauri/SQLite adapter will use, so
 * stores never depend on the network or on a remote API response.
 */
export type LocalTable = 'rooms' | 'tenants' | 'payments' | 'foodItems' | 'foodRecords' | 'menuItems' | 'restaurantSales' | 'groceryProducts' | 'grocerySales' | 'expenses'

export interface SyncChange {
  id: string
  entity: LocalTable
  entityId: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  createdAt: string
  attempts: number
  lastError?: string
}

const DB_NAME = 'good-morning-local'
const DB_VERSION = 1
const TABLES: LocalTable[] = [
  'rooms', 'tenants', 'payments', 'foodItems', 'foodRecords', 'menuItems',
  'restaurantSales', 'groceryProducts', 'grocerySales', 'expenses',
]
const QUEUE = 'syncQueue'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const table of [...TABLES, QUEUE]) {
        if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function transaction<T>(table: LocalTable | typeof QUEUE, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(table, mode)
    const request = work(tx.objectStore(table))
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    tx.onabort = () => reject(tx.error)
    tx.oncomplete = () => db.close()
  })
}

export async function listLocal<T>(table: LocalTable): Promise<T[]> {
  return transaction<T[]>(table, 'readonly', (store) => store.getAll())
}

export async function putLocal<T extends { id: string }>(table: LocalTable, record: T): Promise<void> {
  await transaction<IDBValidKey>(table, 'readwrite', (store) => store.put(record))
}

export async function replaceLocal<T extends { id: string }>(table: LocalTable, records: T[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite')
    const store = tx.objectStore(table)
    store.clear()
    records.forEach((record) => store.put(record))
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function seedLocal<T extends { id: string }>(table: LocalTable, records: T[]): Promise<T[]> {
  const current = await listLocal<T>(table)
  if (current.length > 0) return current
  await replaceLocal(table, records)
  return records
}

export async function queueChange(entity: LocalTable, entityId: string, operation: SyncChange['operation'] = 'UPDATE'): Promise<void> {
  const change: SyncChange = {
    id: crypto.randomUUID(), entity, entityId, operation,
    createdAt: new Date().toISOString(), attempts: 0,
  }
  await transaction<IDBValidKey>(QUEUE, 'readwrite', (store) => store.put(change))
}

export async function listPendingChanges(): Promise<SyncChange[]> {
  return transaction<SyncChange[]>(QUEUE, 'readonly', (store) => store.getAll())
}
