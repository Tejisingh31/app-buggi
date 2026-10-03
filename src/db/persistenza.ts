/**
 * Chiede al browser di non cancellare i dati di Buggi quando il telefono
 * ha poco spazio. Restituisce true se lo spazio è protetto.
 */
export async function richiediSpazioPersistente(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function spazioPersistente(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
