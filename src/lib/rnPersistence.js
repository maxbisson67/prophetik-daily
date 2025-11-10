// Adapter de persistance Firebase pour React Native basé sur AsyncStorage
// Compatible avec initializeAuth() (Firebase v9/v10)
// Réf. interface: Persistence (type, _isAvailable, set, get, remove)
export function getReactNativePersistence(AsyncStorage) {
  return {
    type: 'LOCAL',
    async _isAvailable() { 
      try { await AsyncStorage.setItem('__fb_test__', '1'); await AsyncStorage.removeItem('__fb_test__'); return true; } 
      catch { return false; }
    },
    async set(key, value) { await AsyncStorage.setItem(key, value); },
    async get(key) { return await AsyncStorage.getItem(key); },
    async remove(key) { await AsyncStorage.removeItem(key); },
  };
}