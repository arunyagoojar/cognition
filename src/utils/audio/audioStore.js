// IndexedDB backed Audio Storage for Safari/Chrome Cross-Compatibility
const DB_NAME = 'cognition_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

let dbInstance = null;

function getDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => reject(e.target.error);

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'recordingId' });
      }
    };
  });
}

/**
 * Detect the best audio MIME type supported by the browser.
 * Safari uses audio/mp4. Chrome/Firefox use audio/webm.
 */
export function detectSupportedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';

  const types = [
    'audio/mp4',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ];

  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return 'audio/webm'; // Fallback
}

/**
 * Saves an audio blob to IndexedDB
 */
export async function saveAudioRecording({ recordingId, attemptId, questionId, blob, mimeType, duration }) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const record = {
      recordingId,
      attemptId,
      questionId,
      blob,
      mimeType,
      duration,
      size: blob.size,
      createdAt: new Date().toISOString()
    };

    const request = store.put(record);
    request.onsuccess = () => resolve(recordingId);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Retrieves an audio recording record from IndexedDB
 */
export async function getAudioRecording(recordingId) {
  if (!recordingId) return null;
  
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(recordingId);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Converts Blob chunks to a standardized Audio Blob
 */
export function createAudioBlob(chunks, mimeType) {
  return new Blob(chunks, { type: mimeType });
}

/**
 * Eradicates all audio recordings from IndexedDB, preventing cache accumulation.
 */
export async function clearAudioRecordings() {
  if (typeof indexedDB === 'undefined') return true;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Eradicates all stored audio blobs from IndexedDB.
 */
export async function eradicateAllAudioRecordings() {
  return clearAudioRecordings();
}

