const STORAGE_PREFIX = 'casbinjs_';

const isLocalStorageAvailable: boolean = (() => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return false;
    }
    try {
        const key = 'fUjXn2r59'; // A random key
        window.localStorage.setItem(key, 'test');
        window.localStorage.getItem(key);
        window.localStorage.removeItem(key);
        return true;
    } catch (e) {
        return false;
    }
})();

function storageKey(key: string): string {
    return `${STORAGE_PREFIX}${key}`;
}

/**
 * Save a permission to localStorage.
 * @returns 0 on success, -1 when the cache is unavailable. Failing to cache
 * the permission is not fatal, the caller can still use the in-memory copy.
 */
export function saveToLocalStorage(key: string, value: string, expired: number): number {
    if (!isLocalStorageAvailable) {
        return -1;
    }
    const savedItem = {
        value: value,
        expired: Date.now() + 1000 * expired,
    };
    try {
        window.localStorage.setItem(storageKey(key), JSON.stringify(savedItem));
        return 0;
    } catch (e) {
        // Typically QuotaExceededError. The cache is only an optimization.
        return -1;
    }
}

/***
 * Load a permission from localStorage.
 * @returns The saved value, or null when there is no such entry or it expired.
 */
export function loadFromLocalStorage(key: string): string | null {
    if (!isLocalStorageAvailable) {
        return null;
    }
    let itemStr: string | null;
    try {
        itemStr = window.localStorage.getItem(storageKey(key));
    } catch (e) {
        // Storage can become unavailable at runtime (for example in private mode).
        return null;
    }
    if (itemStr === null) {
        return null;
    }
    let item: unknown;
    try {
        item = JSON.parse(itemStr);
    } catch (e) {
        // A corrupted entry (another script, a manual edit) must not break the caller.
        removeLocalStorage(key);
        return null;
    }
    if (item === null || typeof item !== 'object') {
        removeLocalStorage(key);
        return null;
    }
    const { value, expired } = item as { value?: unknown; expired?: unknown };
    if (typeof value !== 'string' || typeof expired !== 'number') {
        removeLocalStorage(key);
        return null;
    }
    if (Date.now() > expired) {
        removeLocalStorage(key);
        return null;
    }
    return value;
}

export function removeLocalStorage(key: string): void {
    if (!isLocalStorageAvailable) {
        return;
    }
    try {
        window.localStorage.removeItem(storageKey(key));
    } catch (e) {
        // Nothing to do, the entry is gone from the cache one way or another.
    }
}
