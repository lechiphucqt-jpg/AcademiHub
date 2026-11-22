import type { HubState } from '../types/academic';

const DB_NAME = 'interactive_academic_hub_local_v1';
const STORE_NAME = 'hub_snapshots';
const SNAPSHOT_KEY = 'primary_state';
const LS_FALLBACK_KEY = 'interactive_academic_hub_state_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadLocalHubState(): Promise<{ state: HubState | null; engine: 'IndexedDB' | 'localStorage' }> {
  try {
    const db = await openDatabase();
    const state = await new Promise<HubState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SNAPSHOT_KEY);
      req.onsuccess = () => resolve((req.result as HubState | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (state) {
      return { state, engine: 'IndexedDB' };
    }
  } catch {
    // Fall back to localStorage below
  }

  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) {
      return { state: JSON.parse(raw) as HubState, engine: 'localStorage' };
    }
  } catch {
    // Ignore parse error
  }

  return { state: null, engine: 'IndexedDB' };
}

export async function saveLocalHubState(state: HubState): Promise<{ engine: 'IndexedDB' | 'localStorage'; byteSize: number }> {
  const serialized = JSON.stringify(state);
  const byteSize = new Blob([serialized]).size;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(state, SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { engine: 'IndexedDB', byteSize };
  } catch {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, serialized);
    } catch {
      // Storage quota exceeded
    }
    return { engine: 'localStorage', byteSize };
  }
}

export function estimateStateByteSize(state: HubState): number {
  return new Blob([JSON.stringify(state)]).size;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function sanitizeSlug(input: string, fallback = 'item'): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
}
