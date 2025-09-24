# Prophetik Daily — Cleanup Notes

This package contains a cleaned project:
- Fixed **app.json** (valid JSON, single `plugins`, `scheme`, `extra.firebase` preserved).
- Fixed a syntax typo in `app/(tabs)/_layout.js` (`size={size} />`).
- Ensured `package.json` has `main: "expo-router/entry"` and standard scripts.
- Kept your Firebase RN initialization (`initializeAuth` + `getAuth` fallback).

## Next steps
1. `npm i` (or `pnpm i`, `yarn`).
2. `npx expo start -c`
3. If you see a Linking warning, it's already set via `scheme: "prophetik-daily"`.
4. If Firestore rules are pending, add them and test in the emulator.

