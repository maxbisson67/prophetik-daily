# Prophetik — Checklist admin (inviter des testeurs)

À faire **avant** d'envoyer le PDF aux testeurs.

## Apple — TestFlight

1. **App Store Connect** → Apps → **Prophetik** → **TestFlight**
2. Uploader une build (EAS `internal` ou `production`) et attendre le traitement Apple
3. Choisir le type de test :
   - **Interne** : jusqu'à 100 membres de l'équipe App Store Connect (immédiat)
   - **Externe** : groupe restreint ; première build soumise à **Beta App Review** (~24–48 h)
4. Créer un **groupe de testeurs** (ex. `beta-prophetik-mars-2026`)
5. Ajouter les courriels des testeurs ou activer un **lien public** (limite de places)
6. Copier le **lien TestFlight public** ou confirmer l'envoi des invitations
7. Coller le lien dans le PDF : `[LIEN_TESTFLIGHT]`

**Build EAS typique :**
```bash
eas build --platform ios --profile internal
eas submit --platform ios --profile internal
```

## Google Play — Test fermé (Closed testing)

1. **Google Play Console** → **Prophetik** → **Tests** → **Test fermé**
2. Créer une piste (ex. `Closed testing - Beta`) si absente
3. Publier un **AAB** sur cette piste (EAS build + submit)
4. **Testeurs** → créer une liste (courriels Google) ou utiliser un **lien d'inscription**
5. Copier le **lien opt-in** (format `https://play.google.com/apps/testing/com.prophetik`)
6. Coller dans le PDF : `[LIEN_GOOGLE_PLAY_CLOSED]`

**Build EAS typique :**
```bash
eas build --platform android --profile internal
eas submit --platform android --profile internal
```

> Vérifier que la piste Play Console correspond au track dans `eas.json` (`internal` → track internal, ou closed testing selon config).

## Avant envoi du PDF

- [ ] Remplacer `[EMAIL_SUPPORT]`
- [ ] Remplacer `[LIEN_TESTFLIGHT]`
- [ ] Remplacer `[LIEN_GOOGLE_PLAY_CLOSED]`
- [ ] Remplacer `[DATE_FIN_BETA]` et `[DATE_DOCUMENT]`
- [ ] Regénérer le PDF si le HTML/MD a changé
- [ ] Envoyer le PDF + courriel d'accueil avec les liens en clair

## Regénérer le PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="docs/guides/Guide-Beta-Testeurs-Prophetik.pdf" \
  "file://$(pwd)/docs/guides/Guide-Beta-Testeurs-Prophetik.html"
```
