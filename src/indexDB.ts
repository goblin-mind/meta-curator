// indexDB.ts

const DB_NAME = 'myDatabase'
const OBJECT_STORE_NAME = 'files'

// Open a connection to IndexedDB
export function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)

        request.onerror = (event) => reject('Could not open the database')
        request.onupgradeneeded = (event) => {
            const db: IDBDatabase = (event.target as IDBOpenDBRequest).result
            db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'path' })
        }
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result)
    })
}

// Add blobs to IndexedDB
export function addBlobs(db: IDBDatabase, pairs: { path: string; blob: Blob }[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([OBJECT_STORE_NAME], 'readwrite')
        const objectStore = transaction.objectStore(OBJECT_STORE_NAME)

        pairs.forEach((pair) => {
            objectStore.add(pair)
        })

        transaction.oncomplete = () => resolve()
        transaction.onerror = (e) => reject('Failed to add blobs' + JSON.stringify(e))
    })
}

// Retrieve blobs from IndexedDB
export function retrieveBlobs(db: IDBDatabase, paths: string[]): Promise<{ path: string; blob: Blob }[]> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([OBJECT_STORE_NAME])
        const objectStore = transaction.objectStore(OBJECT_STORE_NAME)

        const results: { path: string; blob: Blob }[] = []

        paths.forEach((path) => {
            const request = objectStore.get(path)
            request.onsuccess = (event) => {
                const result = (event.target as IDBRequest).result
                if (result) {
                    results.push(result)
                }
            }
        })

        transaction.oncomplete = () => resolve(results)
        transaction.onerror = () => reject('Failed to retrieve blobs')
    })
}
