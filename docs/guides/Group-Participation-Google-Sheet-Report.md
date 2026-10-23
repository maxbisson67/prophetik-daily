# Rapport quotidien — participation groupes

## MVP PDF (recommandé pour démarrer)

Pas de Google Sheet ni de secret `GROUP_REPORT_SHEETS_SA_JSON` : uniquement **Firestore** (credentials admin habituels).

```bash
cd functions
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-admin.json"
node scripts/runGroupParticipationReport.js --pdf ./group-participation-$(date +%F).pdf
```

Optionnel : `REPORT_YMD=2026-10-17` pour une date précise (sinon **veille** Toronto).

Tu peux automatiser avec **cron sur ton Mac** ou une **GitHub Action** planifiée qui génère le PDF et te l’envoie par e-mail — sans déployer la function Sheets.

---

## Option Google Sheet (historique + graphiques)

Rapport admin **quotidien** pour les groupes créés depuis **2026-09-01** :

- membres actifs / membres « participating »
- défis du jour (SOLO + DUO + TRIO)
- participants uniques (humains, hors Nova)
- **taux du jour** = participants ÷ membres participating (si défis ce jour-là)
- **moyenne 7 jours** = moyenne des taux journaliers (jours avec au moins un défi)

Calendrier : **veille** (fuseau `America/Toronto`), cron **7 h 15**.

## 1. Google Sheet

1. Créer une feuille Google (ex. « Prophetik — Group participation »).
2. Renommer l’onglet en **`Daily`** (ou adapter `SHEET_NAME` dans le code).
3. Copier l’**ID** du spreadsheet (segment de l’URL).

## 2. Compte de service

1. Google Cloud Console → IAM → **Service account** dédié (ex. `prophetik-group-report@…`).
2. Créer une clé JSON.
3. **Partager** la feuille avec l’email du compte de service (rôle **Éditeur**).

## 3. Firebase / Functions

Secrets et paramètres :

```bash
firebase functions:secrets:set GROUP_REPORT_SHEETS_SA_JSON
# coller le JSON complet du compte de service

# Dans functions/.env (non commité) :
# GROUP_REPORT_SHEET_ID=VOTRE_SPREADSHEET_ID
```

Index Firestore (si demandé) :

- Collection `groups`, champ `createdAt` (Ascending)

Déployer :

```bash
firebase deploy --only functions:dailyGroupParticipationReportCron
```

## 4. Test local / manuel

```bash
cd functions
export GROUP_REPORT_SHEET_ID="..."
export GROUP_REPORT_SHEETS_SA_JSON='{"type":"service_account",...}'
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/admin-sdk.json"  # Firestore

# Dry-run (Firestore seulement, pas d’écriture Sheet)
DRY_RUN=1 node scripts/runGroupParticipationReport.js

# Veille par défaut, ou date fixe
REPORT_YMD=2026-10-17 node scripts/runGroupParticipationReport.js
```

## 5. Colonnes (`Daily`)

| Colonne | Description |
|--------|-------------|
| reportDate | Journée de match analysée (YYYY-MM-DD) |
| groupId | ID Firestore |
| groupName | Nom affiché |
| groupCreatedDate | Date création groupe |
| sport | NHL / MLB |
| activeMembers | Membres **encore dans le groupe** (membership actif : pas left/archived/deleted) |
| participatingMembers | Sous-ensemble **éligibles aux défis** (`participation: active`) — **dénominateur du taux** ; exclut owner/admin en « admin only » ou membres en pause |
| dailyChallenges | Nombre de défis SOLO+DUO+TRIO ce jour |
| dailyParticipants | Joueurs uniques (≥1 défi) |
| dailyParticipationRate | % du jour |
| avg7DayParticipationRate | Moyenne glissante 7 jours |
| generatedAt | Horodatage UTC du run |

Cache interne : `internal_reports/groupParticipationDaily/days/{groupId}_{ymd}` (pour la moyenne 7 j).

Groupes exclus (liste dans `EXCLUDED_GROUP_IDS` — `groupParticipationReportCore.js`) : test / internes Prophetik.

Exclusions **par groupe × UID** (compte fantôme, etc.) : `functions/reports/participationReportExclusions.js` (clé = nom du groupe ou `groupId`).

---

## Grille Excel / PDF (tous les groupes)

Même tableau que Classement (**%7j**, **%Total** par participant), une ligne par (groupe × participant).  
Cohorte par défaut : groupes créés depuis **`2026-10-04`** (override `COHORT_START_YMD`).

```bash
cd functions
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-admin.json"
mkdir -p out

node scripts/runGroupParticipationGridExport.js \
  --csv ./out/participation-grid.csv \
  --pdf ./out/participation-grid.pdf
```

Ouvre le **CSV** dans Excel / Google Sheets (grille complète). Le **PDF** affiche **Participant · %7j · %Total** (en-tête de bloc par groupe avec les moyennes).

Colonnes CSV : pas de `groupId` ni de `totalPeriodFrom` / `totalPeriodTo` / `generatedAt`. Chaque groupe se termine par une ligne **`— Moyenne groupe —`** (%7j et %Total = moyenne des membres actifs).

- **%7j** : jours joués ÷ jours avec défis (7 derniers jours)
- **%Total** : idem de `max(createdAt, cohorte)` → veille (max 90 jours scannés)
