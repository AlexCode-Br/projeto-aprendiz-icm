export const SUPABASE_AUTH_STORAGE_KEY = 'projeto-aprendiz-auth';
export const SUPABASE_AUTH_PERSISTENCE_KEY = 'projeto-aprendiz-auth-persistence';

function safely(operation, fallback = null) {
  try { return operation(); }
  catch { return fallback; }
}

function managedKeys(storage, storageKey) {
  const keys = [];
  const length = Number(safely(() => storage.length, 0)) || 0;
  for (let index = 0; index < length; index += 1) {
    const key = safely(() => storage.key(index));
    if (key === storageKey || String(key || '').startsWith(`${storageKey}-`)) keys.push(key);
  }
  if (!keys.includes(storageKey) && safely(() => storage.getItem(storageKey)) !== null) keys.push(storageKey);
  return keys;
}

export function createSupabaseAuthStorage({
  localStorage,
  sessionStorage,
  storageKey = SUPABASE_AUTH_STORAGE_KEY,
  persistenceKey = SUPABASE_AUTH_PERSISTENCE_KEY,
}) {
  if (!localStorage || !sessionStorage) throw new Error('Os armazenamentos local e da sessão são obrigatórios.');

  const savedPreference = safely(() => localStorage.getItem(persistenceKey));
  const hasSessionState = safely(() => sessionStorage.getItem(storageKey)) !== null;
  const hasLegacyLocalState = safely(() => localStorage.getItem(storageKey)) !== null;
  let persistent = savedPreference === 'local' || (!hasSessionState && savedPreference === null && hasLegacyLocalState);

  // Existing deployments stored every Supabase session locally and had no
  // preference marker. Preserve those sessions once, then manage them explicitly.
  if (persistent) safely(() => localStorage.setItem(persistenceKey, 'local'));

  const selectedStorage = () => persistent ? localStorage : sessionStorage;
  const otherStorage = () => persistent ? sessionStorage : localStorage;

  const storage = {
    getItem(key) {
      return safely(() => selectedStorage().getItem(key));
    },
    setItem(key, value) {
      safely(() => selectedStorage().setItem(key, value));
      safely(() => otherStorage().removeItem(key));
    },
    removeItem(key) {
      safely(() => localStorage.removeItem(key));
      safely(() => sessionStorage.removeItem(key));
    },
  };

  function setPersistent(nextPersistent) {
    const shouldPersist = Boolean(nextPersistent);
    if (shouldPersist === persistent) {
      if (shouldPersist) safely(() => localStorage.setItem(persistenceKey, 'local'));
      else safely(() => localStorage.removeItem(persistenceKey));
      return;
    }

    const source = selectedStorage();
    const destination = shouldPersist ? localStorage : sessionStorage;
    const obsolete = shouldPersist ? sessionStorage : localStorage;
    const keys = managedKeys(source, storageKey);

    persistent = shouldPersist;
    if (persistent) safely(() => localStorage.setItem(persistenceKey, 'local'));
    else safely(() => localStorage.removeItem(persistenceKey));

    for (const key of keys) {
      const value = safely(() => source.getItem(key));
      if (value !== null) safely(() => destination.setItem(key, value));
      safely(() => obsolete.removeItem(key));
    }
  }

  function clear() {
    const keys = new Set([
      ...managedKeys(localStorage, storageKey),
      ...managedKeys(sessionStorage, storageKey),
      storageKey,
    ]);
    for (const key of keys) storage.removeItem(key);
    safely(() => localStorage.removeItem(persistenceKey));
    persistent = false;
  }

  return {
    storage,
    setPersistent,
    isPersistent: () => persistent,
    clear,
  };
}
