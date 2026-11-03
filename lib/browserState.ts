/** Browser-private data is always bound to an API origin and authenticated account. */
export function accountScope(explicitAccount?: string): string {
  const base = localStorage.getItem('splitter_api_base') || process.env.NEXT_PUBLIC_INSTANCE_1_URL || process.env.NEXT_PUBLIC_API_URL || 'https://splitter-m0kv.onrender.com/api/v1';
  let account = ''; try { account = JSON.parse(localStorage.getItem('user') || '{}').id || ''; } catch {}
  account = explicitAccount || account;
  if (!account) throw new Error('Sign in before accessing private browser data');
  return `${encodeURIComponent(new URL(base).origin)}:${encodeURIComponent(account)}`;
}
export function scopedStorageKey(name: string, account?: string): string { return `splitter:v2:${accountScope(account)}:${name}`; }
export function keyStorageGet(name: string, account?: string): string | null {
  try { return JSON.parse(localStorage.getItem(scopedStorageKey('keys',account)) || '{}')[name] || null; } catch { return null; }
}
export function keyStorageSet(name: string, value: string): void {
  const storageKey = scopedStorageKey('keys');
  const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (data[name] && data[name] !== value) {
    const history = JSON.parse(localStorage.getItem(scopedStorageKey('key-history')) || '[]');
    history.push({...data, archivedAt: new Date().toISOString()});
    localStorage.setItem(scopedStorageKey('key-history'), JSON.stringify(history));
  }
  localStorage.setItem(storageKey, JSON.stringify({...data, [name]:value}));
}
export function keyStorageRemove(name: string): void {
 const key = scopedStorageKey('keys'); const data = JSON.parse(localStorage.getItem(key) || '{}');
 // Retain revoked/rotated material in account-scoped history for explicit recovery.
 if (data[name]) { keyStorageSet(name, '[revoked]'); delete data[name]; localStorage.setItem(key,JSON.stringify(data)); }
}
export function clearSessionData(): void {
  for (const key of Object.keys(localStorage)) {
    if ((key.startsWith('splitter:v2:') && !key.endsWith(':keys') && !key.endsWith(':key-history')) || key.startsWith('timeline_cache_') || key.startsWith('thread_cache_') || key.startsWith('splitter_dm_offline_queue_')) localStorage.removeItem(key);
  }
  localStorage.removeItem('jwt_token'); localStorage.removeItem('user');
  window.dispatchEvent(new Event('splitter:logout'));
}
/** Migrate only when server key proves ownership; ambiguous legacy material is preserved. */
export function migrateLegacyKeys(user: any): void {
 const signingMatches = user.public_key && user.public_key === localStorage.getItem('public_key');
 const encryptionMatches = user.encryption_public_key && user.encryption_public_key === localStorage.getItem('encryption_public_key');
 for (const name of ['private_key','public_key','did','encryption_private_key','encryption_public_key']) {
   if ((name.startsWith('encryption_') ? encryptionMatches : signingMatches) && localStorage.getItem(name)) {
     keyStorageSet(name,localStorage.getItem(name)!); localStorage.removeItem(name);
   }
 }
}
