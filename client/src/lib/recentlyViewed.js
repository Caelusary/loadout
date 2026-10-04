// Recently viewed products, kept per browser (like most stores do for signed-out and signed-in visitors).
const KEY = 'loadout_recent_v1';
const MAX = 8;

export function readRecent() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordRecent(id) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not saved; nothing depends on it.
  }
}
