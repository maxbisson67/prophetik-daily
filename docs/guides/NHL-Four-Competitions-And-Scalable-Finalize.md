# NHL — 4 compétitions isolées + finalize scalable (spec en attente)

**Statut** : planifié, **pas en cours de dev** (priorité ailleurs).  
**Dernière mise à jour spec** : 2025-12 (conversation produit).

---

## Vision produit

- Découper la saison NHL en **4 championnats indépendants** par groupe (même ligue, mêmes membres).
- **Reset** du classement groupe à chaque bloc ; **4 couronnements** / saison / groupe.
- **Pas de cumul** entre blocs → pas de « grand champion » agrégé.
- **MLB** : conserver 2 blocs (régulière + séries).

### Fenêtres cibles (années normales, date métier Toronto)

| # | Nom (FR) | Fenêtre indicative |
|---|----------|-------------------|
| 1 | Ouverture | Début régulière → **30 nov.** |
| 2 | Hiver | **2 déc.** → **1 fév.** |
| 3 | Sprint | **2 fév.** → fin régulière NHL |
| 4 | Séries | Playoffs NHL |

Libellés et dates exactes → config `seasonCompetitions` / `app_config/currentSeason` (pas hardcodées UI).

### Ce qui ne reset pas (à trancher avant code)

- Progression / badges / streaks / stats TRIO cumulées : **transversal** recommandé.
- Ascensions, cagnotte groupe, team split : **décision produit** (annuel vs par bloc).

### UI Classement

- Picker compétition (4 entrées + statuts).
- **Onglet Historique champions** : jusqu’à 4 lignes / saison NHL / groupe (pas de palmarès cumulatif).

---

## Éligibilité finalize (retenu)

| Id | Règle |
|----|--------|
| G1 | Groupe actif |
| G2 | Sport = NHL |
| G3 | Activité sur la compétition : ≥1 membre avec points > 0 sur la clé |
| **G4** | **≥ 2 membres actifs** → sinon skip (`single_member`), pas de champion |

Groupes non éligibles **ne bloquent pas** la clôture catalogue.

---

## Architecture finalize scalable (cible)

**Problème actuel** : `finalizeSeasonCompetitions` → `groups.limit(300)` sans pagination, rebuild lourd / groupe, catalogue `finalized` même si incomplet.

**Cible** :

1. Index **`activeGroups`** (ou flag) au 1er crédit points sur une `competitionKey`.
2. Orchestrateur → **1 Cloud Task / groupe éligible** (fan-out).
3. Worker **`finalizeGroupSeasonCompetition`** **sans rebuild** par défaut (lecture `members` + ex aequo + meta + notif).
4. Job `seasonCompetitionFinalizeJobs/{competitionKey}` : `finalizing` → compteurs → catalogue **`finalized`** seulement à 100 % éligibles traités.
5. Finalize **lazy** au Classement si oubli.

**Code existant** : `functions/leaderboard/finalizeSeasonCompetitions.js`, `seasonCompetitionCore.js`, crédit live `incrementLeaderboardPoints.js`, client `useSportCompetitions`, `CompetitionChampionsSection`.

---

## Pilote 2025-26 (test architecture au 14 déc.)

### Dates pilote (simplifiées)

| | Compétition A (clôture) | Compétition B (suite) |
|--|-------------------------|------------------------|
| Fin / début | **`toYmd` = 2025-12-14** | **`fromYmd` = 2025-12-15** |
| Effet | Derniers points sur A le 14 | Reset classement B le 15 |

Pas de trou 15–17 : enchaînement direct 14 → 15.

### Objectif pilote

- ~**4–5 groupes** actifs.
- **Tester** fan-out + job + éligibilité G3/G4 + finalize léger (pas le cron 300).
- **Protéger** le catalogue : `source: "pilot_override"` ou overrides dans `currentSeason` pour que **l’ingest NHL** ne remette pas régulière oct→avril.

### Clés exemple

- A : `nhl_20252026_regular` *ou* `nhl_20252026_opening` (à figer).
- B : `nhl_20252026_winter` (Hiver).

### Calendrier ops (Toronto)

- **≤ ~10 déc.** : déployer workers + config A/B + anti-écrasement ingest.
- **14 déc.** : derniers points A.
- **15 déc.** : points B + copy « nouveau championnat ».
- **≥ ~17 déc.** (grâce 2 j) : lancer finalize scalable A ; valider job + champions + notifs.

### Critères de succès pilote

- Tous groupes éligibles traités ; catalogue A pas `finalized` avant fin du job.
- Re-run idempotent ; G4 respecté ; crédits 15 déc. sur B uniquement.

---

## Décisions ouvertes (reprise future)

1. Clé A : garder `regular` vs renommer `opening`.
2. `toYmd` de B (Hiver) pour 25–26.
3. G3 obligatoire au pilote ou G4 seul.
4. Cloud Tasks vs Pub/Sub.
5. Implémentation 4 blocs catalogue vs pilote 2 docs puis extension.

---

## Implémentation (ordre suggéré)

1. Finalize scalable + éligibilité + index activité.
2. Pilote 14/15 déc. 2025-26.
3. Catalogue 4 compétitions NHL + UI historique.
4. Ne pas multiplier les rebuilds ; rebuild = repair / pull admin seulement.

---

## Références internes

- One-pager conversation : 4 compétitions isolées, coûts Firestore, limite 300 groupes.
- TRIO / classement : inchangé par cette spec (hors crédit `competitionKey`).
