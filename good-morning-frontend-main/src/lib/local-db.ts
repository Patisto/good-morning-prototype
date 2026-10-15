/** Read-only access to the retired browser prototype. Never clear its records. */
const DB_NAME = 'good-morning-local';
export async function readLegacySnapshot(): Promise<Record<string, unknown[]>> {
    const databases = await indexedDB.databases();
    if (!databases.some(db => db.name === DB_NAME))
        return {};
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    try {
        const names = Array.from(db.objectStoreNames);
        if (!names.length)
            return {};
        return await new Promise((resolve, reject) => {
            const result: Record<string, unknown[]> = {};
            const tx = db.transaction(names, 'readonly');
            for (const name of names) {
                const request = tx.objectStore(name).getAll();
                request.onsuccess = () => { result[name] = request.result; };
            }
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }
    finally {
        db.close();
    }
}
