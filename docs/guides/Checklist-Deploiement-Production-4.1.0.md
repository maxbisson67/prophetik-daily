# Prophetik — Checklist déploiement Production (v4.1.0)

**Contexte bêta :** 15 jours · 15 testeurs actifs (closed test) · build bêta **4.0.2**  
**Build de lancement :** **4.1.0** (canal EAS `production`)  
**Date cible :** _______________

> La bêta 4.0.2 a validé le processus Google Play. Le lancement public doit utiliser une **nouvelle build native** : les mises à jour OTA des 15 derniers jours ont été poussées sur le canal **`internal`**, pas **`production`**.

---

## Phase 0 — Avant de builder

### Code & backend

- [ ] Tous les correctifs critiques mergés (crash FGC solo, MLB Live, notifs, etc.)
- [ ] Functions Firebase déployées :
  ```bash
  firebase deploy --only functions:updateMlbLiveGamesNow,functions:updateMlbLiveGamesCron
  # + toute autre function modifiée depuis la bêta
  ```
- [ ] Firestore rules / indexes à jour si modifiés
- [ ] Tester manuellement sur device : auth, défis, abonnements sandbox, MLB Live, NHL Live

### Version

- [x] `app.json` → `"version": "4.1.0"`
- [x] `android/app/build.gradle` → `versionName "4.1.0"` (alignement local ; EAS gère versionCode à distance)
- [ ] `runtimeVersion` : garder `"1.0.0"` si **aucune** dépendance native nouvelle ; sinon bump + rebuild obligatoire
- [ ] Texte « Nouveautés » préparé (FR + EN) pour les stores

---

## Phase 1 — Builds EAS (profil `production`)

Les builds `production` utilisent le canal OTA **`production`** (pas `internal`).

### Android

```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

- [ ] Build terminée sur [expo.dev](https://expo.dev)
- [ ] AAB soumis (track **production** via `eas.json`)
- [ ] Noter le **versionCode** assigné (autoIncrement EAS)

### iOS

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

- [ ] Build traitée par Apple (15–30 min)
- [ ] Build visible dans **App Store Connect** → TestFlight / App Store
- [ ] Noter le **build number** assigné

### OTA initial sur le canal production

Juste après les builds natives (aligne le JS actuel avec le binaire store) :

```bash
eas update --channel production --message "Lancement store v4.1.0"
```

- [ ] Update publiée sur le canal `production`
- [ ] Vérifier sur un device avec build production que l'update se charge (`ON_LOAD`)

---

## Phase 2 — Google Play Console (Android)

### 2A — Demander l'accès Production

> Prérequis : **12+ testeurs opt-in pendant 14 jours consécutifs** — vous avez **15 jours / 15 testeurs**.

1. [ ] **Play Console** → tableau de bord → **Demander l'accès Production**
2. [ ] Remplir le questionnaire (réponses **spécifiques à Prophetik**, pas génériques) :

**Exemples de points à mentionner :**
- Closed test via liste de testeurs (tester.com / courriels Google)
- 15 testeurs actifs pendant 15 jours sur build 4.0.2
- Bugs trouvés et corrigés : crash modal défi solo, améliorations MLB Live, notifications, etc.
- Mises à jour iteratives pendant la bêta (OTA canal internal)
- Build de lancement **4.1.0** plus récente et représentative
- Abonnements testés en sandbox ; suppression de compte conforme

3. [ ] Attendre approbation Google (**~2 à 7 jours**)

### 2B — Fiche Play Store (Production)

- [ ] **Titre** : Prophetik
- [ ] **Description courte / longue** (FR — langue principale si applicable)
- [ ] **Captures d'écran** téléphone (min. 2, recommandé 8)
- [ ] **Icône** et **bannière** feature graphic
- [ ] **Catégorie** et **courriel de contact**
- [ ] **Politique de confidentialité** : URL valide (ex. `https://capitaine.web.app/fr/privacy.html` ou équivalent)
- [ ] **Data safety** : données collectées (auth, analytics, achats, etc.)
- [ ] **Classification du contenu** (questionnaire)
- [ ] **Public cible** et conformité enfants
- [ ] **Abonnements** : produits actifs, liés à RevenueCat, prix affichés

### 2C — Release Production

- [ ] Créer une release **Production** avec l'AAB **4.1.0**
- [ ] Notes de version (FR)
- [ ] **Déploiement progressif** recommandé : 10 % → surveiller Crashlytics → 50 % → 100 %
- [ ] Soumettre pour **revue Google Play**

### 2D — Après approbation

- [ ] Copier l'URL Play Store : `https://play.google.com/store/apps/details?id=com.prophetik`
- [ ] Mettre à jour `app_config/mobile` Firestore (voir Phase 4)
- [ ] Garder la piste **Closed testing** active pour futures bêtas (ne pas supprimer)

---

## Phase 3 — App Store Connect (iOS)

Pas de règle « 14 jours / 12 testeurs » — peut avancer **en parallèle** d'Android.

### 3A — Métadonnées App Store

- [ ] **Nom** : Prophetik
- [ ] **Sous-titre** et **description** (FR + EN si bilingue)
- [ ] **Mots-clés**
- [ ] **Captures** iPhone (6,7" et 6,5" minimum)
- [ ] **URL support** et **URL confidentialité**
- [ ] **Catégorie**
- [ ] **Classification d'âge**
- [ ] **App Privacy** (nutrition labels)

### 3B — Achats intégrés

- [ ] Abonnements Pro / VIP **approuvés** et associés à la version
- [ ] RevenueCat : produits iOS liés, offering `default` actif
- [ ] Texte renouvellement auto dans l'app (déjà présent)

### 3C — Soumission review

- [ ] Sélectionner la build **4.1.0** (production)
- [ ] « What's New » / Nouveautés
- [ ] **Export compliance** : `ITSAppUsesNonExemptEncryption: false` (déjà dans app.json)
- [ ] Compte démo pour le reviewer si nécessaire (courriel + mot de passe test)
- [ ] Soumettre pour **App Review** (~24–48 h)

### 3D — Publication

- [ ] Choisir publication **manuelle** ou **automatique** après approbation
- [ ] Copier l'URL App Store une fois live
- [ ] Mettre à jour `app_config/mobile` Firestore (voir Phase 4)

---

## Phase 4 — Config app (Firestore)

Document `app_config/mobile` — mettre à jour **après** les URLs store connues :

```json
{
  "ios": {
    "minSupportedVersion": "4.1.0",
    "storeUrl": "https://apps.apple.com/app/idXXXXXXXXX"
  },
  "android": {
    "minSupportedVersion": "4.1.0",
    "storeUrl": "https://play.google.com/store/apps/details?id=com.prophetik"
  },
  "updateMessageFr": "Une nouvelle version de Prophetik est requise. Mets à jour depuis le Store.",
  "updateMessageEn": "A new version of Prophetik is required. Please update from the Store."
}
```

- [ ] URLs store renseignées
- [ ] `minSupportedVersion` = `4.1.0` (forcer update si ancienne bêta 4.0.2 sans canal production)
- [ ] Messages FR/EN vérifiés

Script migration si besoin :
```bash
node functions/scripts/migrateAppConfigMobile.js --min 4.1.0
```

---

## Phase 5 — Site public & communication

- [ ] `public/fr/index.html` et `public/en/index.html` : remplacer liens TestFlight / closed test par App Store + Play Store
- [ ] `public/fr/support.html` / `public/en/support.html` : idem
- [ ] Courriel aux testeurs bêta : annonce du lancement + comment migrer (installer depuis le Store)
- [ ] TestFlight : décider si le lien public reste ouvert (optionnel post-lancement)

---

## Phase 6 — Post-lancement (J+1 à J+7)

- [ ] Surveiller **Crashlytics** et rapports testeurs
- [ ] Surveiller **RevenueCat** / achats réels (plus sandbox)
- [ ] Correctifs JS urgents :
  ```bash
  eas update --channel production --message "Hotfix …"
  ```
- [ ] Ne **pas** pousser de hotfixes sur `internal` seulement — les users store écoutent `production`
- [ ] Répondre aux premiers avis Store si applicable

---

## Récap commandes (ordre recommandé)

```bash
# 1. Backend
firebase deploy --only functions

# 2. Builds store
eas build --platform android --profile production
eas build --platform ios --profile production

# 3. Submit
eas submit --platform android --profile production
eas submit --platform ios

# 4. OTA canal production
eas update --channel production --message "Lancement store v4.1.0"

# 5. Play Console : Apply for production access + release
# 6. App Store Connect : soumettre build 4.1.0
```

---

## Calendrier indicatif

| Jour | Action |
|------|--------|
| J0 | Builds 4.1.0 + OTA production + Apply for production access (Android) |
| J0 | Soumission iOS App Review (parallèle) |
| J1–7 | Approbation accès Production Google |
| J1–3 | Review iOS (souvent plus rapide) |
| J7–10 | Release Android Production (déploiement progressif) |
| J+ | Mise à jour site + app_config/mobile |

---

## Dépannage — `Precondition check failed` (EAS Submit → production)

Si `eas submit --profile production` échoue avec **Precondition check failed** :

1. **Accès Production pas encore accordé** (cause la plus fréquente)  
   Play Console → tableau de bord → **Demander l'accès Production** → attendre approbation (~2–7 jours).

2. **En attendant**, soumettre sur **Closed testing** (piste `alpha`) :
   ```bash
   eas submit --platform android --profile closed --latest
   ```
   Puis publier le brouillon manuellement dans Play Console → Tests → Test fermé.

3. **Brouillons en conflit** dans Play Console → Production → supprimer ou publier les drafts en attente.

4. **Fiche store incomplète** : politique de confidentialité, classification contenu, data safety, captures.

5. Après approbation Production, resoumettre en **draft** (déjà configuré dans `eas.json`) :
   ```bash
   eas submit --platform android --profile production --latest
   ```
   Finaliser la release dans Play Console, puis soumettre pour revue.

---

## Notes importantes

1. **Canal OTA** : bêta = `internal` · store = `production` — deux pipelines distincts.
2. **4.0.2 bêta ≠ 4.1.0 prod** : normal et souhaitable ; la version store doit être fraîche.
3. **Android peut laguer iOS** de quelques jours (approbation accès Production).
4. **RevenueCat** : les clés prod sont déjà en place ; vérifier que les produits Store sont **actifs** au moment du lancement.
5. **Closed test** : conserver la piste pour les prochaines bêtas — ne pas la supprimer.

---

## Texte « Nouveautés » — brouillon v4.1.0

**FR :**
> Améliorations MLB Live (frappeur au bâton, tableau des manches, actions marquantes), corrections de stabilité et optimisations des défis quotidiens.

**EN :**
> MLB Live improvements (batter at the plate, linescore, scoring plays), stability fixes, and daily challenge optimizations.

À adapter selon ce que vous voulez mettre en avant au lancement.
