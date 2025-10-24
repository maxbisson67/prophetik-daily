import AsyncStorage from '@react-native-async-storage/async-storage';

// Sauvegarde des méthodes originales
const _multiRemove = AsyncStorage.multiRemove?.bind(AsyncStorage);
const _clear = AsyncStorage.clear?.bind(AsyncStorage);

function filterKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.filter((k) => typeof k === 'string' && k.length > 0);
}

// Patch de multiRemove pour éviter les crashs Hermes
if (_multiRemove) {
  AsyncStorage.multiRemove = async (keys, ...rest) => {
    const safe = filterKeys(keys);
    if (__DEV__) {
      if (!Array.isArray(keys) || safe.length !== keys.length) {
        console.warn('[AsyncStorage] multiRemove: clés invalides filtrées', {
          original: keys,
          safe,
        });
      }
    }
    if (safe.length === 0) return;
    return _multiRemove(safe, ...rest);
  };
}

// Patch optionnel pour sécuriser clear()
if (_clear) {
  AsyncStorage.clear = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const safe = filterKeys(keys);
      if (safe.length === 0) return;
      // On passe par la version patchée
      return AsyncStorage.multiRemove(safe);
    } catch (e) {
      console.warn('[AsyncStorage] clear failed:', e);
    }
  };
}

export default AsyncStorage;