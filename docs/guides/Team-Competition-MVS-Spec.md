# Compétition par équipes — MVS (création groupe uniquement)

Spécification technique / checklist Firestore, alignée sur `createGroupWithCap`, `joinGroupWithCap`, `onGroupCreated`, autopilot 6h30, Classement existant.

**Principe MVS :** feature **uniquement à la création** du groupe (pas sur groupes existants). Si autopilot + compétition équipes : **date de début** → inscriptions jusqu’à **J−1** → owner **spread** → **J0** autopilot + roster **figé** + somme des `pointsTotal` phase (Nova exclue).

**Hors scope MVS :** activation sur groupe existant, >2 équipes, changement d’équipe, points depuis adhésion.

---

## 1. États du lifecycle

| État | Condition | UI / backend |
|------|-----------|--------------|
| `none` | Groupe sans compétition équipes (défaut historique) | Comportement actuel |
| `scheduled` | `teamCompetition.status === "scheduled"` et `today < competitionStartYmd` | Join OK ; owner spread ; autopilot **off** pour ce groupe |
| `locked` | `today >= competitionStartYmd` et roster validé | Autopilot **on** (si prévu) ; roster **immuable** ; vue Équipes Classement |
| `blocked` | J0 atteint et roster incomplet | Autopilot skip + notif owner (décision produit) |

---

## 2. Champs Firestore — document `groups/{groupId}`

Écrits à la **création** (`createGroupWithCap`). Groupes existants : champs absents → feature invisible.

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `teamCompetitionEnabled` | boolean | Si bloc équipes | `true` seulement si choisi à la création **et** `autopilotEnabled === true` |
| `teamCompetition` | map | Si enabled | Voir sous-tableau |
| `competitionStartYmd` | string | Si enabled | `YYYY-MM-DD` (Toronto) — premier jour défis auto + début score équipes |
| `joinDeadlineYmd` | string | Si enabled | Défaut : `addDays(competitionStartYmd, -1)` — dernier jour join code |
| `autopilotStartsOnYmd` | string | Si enabled | **Même valeur** que `competitionStartYmd` (autopilot effectif seulement à partir de ce jour) |

### `teamCompetition` (map)

| Champ | Type | Description |
|-------|------|-------------|
| `status` | `"scheduled" \| "locked"` | `scheduled` jusqu’à verrouillage J0 |
| `competitionKey` | string | Phase Classement liée (voir §4) — rempli à la création ou au lock |
| `teamA` | `{ id: "a", name: string }` | Nom affiché équipe A |
| `teamB` | `{ id: "b", name: string }` | Nom affiché équipe B |
| `roster` | map `{ [uid]: "a" \| "b" }` | Humains only ; pas `ai` |
| `rosterLockedAt` | Timestamp | Set au passage `locked` (6h30 J0 ou callable veille) |
| `rosterComplete` | boolean | `true` quand tous les humains **participating** ont une entrée dans `roster` |
| `createdAt` / `updatedAt` | Timestamp | Audit |

**Ne pas dupliquer les points** : pas de `teamPoints` persistés en MVS (calcul depuis `leaderboards/.../members`).

---

## 3. `group_memberships` (optionnel MVS)

Alternative : tout dans `teamCompetition.roster` sur le groupe (recommandé MVS — **1 read** Classement).

Si besoin UI membres : miroir read-only `teamId: "a"|"b"|null` sur membership — **écriture owner only** via callable, sync vers `teamCompetition.roster`.

---

## 4. Lien phase Classement (`competitionKey`)

À la **création** :

1. Dériver le sport du groupe (`NHL` / `MLB`).
2. Résoudre la phase catalogue qui **contient** `competitionStartYmd` (`seasonCompetitionCore` / `resolveCompetitionForGroupCredit` côté Functions).
3. Stocker `teamCompetition.competitionKey` (ex. `nhl_20252026_regular`).

**Calcul équipes :** même `competitionKey` que l’onglet Individuel → `groups/{gid}/leaderboards/{competitionKey}/members/{uid}.pointsTotal` (logique `normalizeMemberRow`).

---

## 5. Validation à la création (`createGroupWithCap`)

- [ ] Si `teamCompetitionEnabled` : exiger `autopilotEnabled === true`.
- [ ] `competitionStartYmd` ≥ **demain** (Toronto) ou ≥ **aujourd’hui + 1** (trancher produit).
- [ ] Noms `teamA.name` / `teamB.name` non vides, distincts, longueur max (ex. 24).
- [ ] `joinDeadlineYmd = competitionStartYmd - 1 day` (server-side, pas client).
- [ ] Initialiser `teamCompetition.status = "scheduled"`, `roster = {}`, `rosterComplete = false`.
- [ ] **Ne pas** set `autopilotEnabled: true` effectif pour cron si `today < autopilotStartsOnYmd` — voir §6 (deux approches).

### Payload callable (extension)

```json
{
  "name": "...",
  "sport": "NHL",
  "autopilotEnabled": true,
  "favoriteTeam": { ... },
  "teamCompetitionEnabled": true,
  "competitionStartYmd": "2026-11-01",
  "teamAName": "Parents",
  "teamBName": "Ados"
}
```

---

## 6. Autopilot — report jusqu’à `competitionStartYmd`

**Approche recommandée (min diff) :** garder `autopilotEnabled: true` sur le doc, ajouter garde dans `createDailyFgcAutopilot` :

```text
if (group.autopilotStartsOnYmd && todayYmd < group.autopilotStartsOnYmd) skip group
```

**Alternative :** `autopilotEnabled: false` à la création + Function J0 qui set `true` — plus de moving parts.

Fichiers à toucher (implémentation future) :

- `functions/autopilot/createDailyFgcAutopilot.js`
- `functions/autopilot/disableInactiveAutopilot.js` (skip si pas encore démarré)

---

## 7. Join — fermeture J−1

Dans `joinGroupWithCap` :

- [ ] Lire `joinDeadlineYmd` ou `competitionStartYmd`.
- [ ] Si `getProphetikBusinessYmd(now) > joinDeadlineYmd` → `failed-precondition` `TEAM_COMPETITION_JOIN_CLOSED`.
- [ ] Groupes sans `teamCompetitionEnabled` : inchangé.

---

## 8. Spread roster (owner, avant J0)

**Callable dédié** (recommandé) : `setTeamCompetitionRoster`

- Auth owner only.
- `teamCompetition.status === "scheduled"`.
- `today <= joinDeadlineYmd` **ou** `today < competitionStartYmd` (aligné join).
- Body : `{ groupId, roster: { [uid]: "a"|"b" } }`.
- Valider : uids = membres humains actifs participating ; pas `ai` ; chaque uid ∈ {a,b}.
- Set `rosterComplete` si tous les participating couverts.
- **Interdit** de modifier après `status === "locked"`.

**UI :** écran création (noms équipes) + détail groupe « Répartir les équipes » jusqu’à J0.

---

## 9. Verrouillage J0 (6h30 Toronto)

**Cron** (ou piggyback autopilot avant création défis) :

1. Groupes `teamCompetition.status === "scheduled"` et `today >= competitionStartYmd`.
2. Si `!rosterComplete` → log + skip autopilot + push owner (MVS).
3. Sinon → `status = "locked"`, `rosterLockedAt = now`.
4. Lancer autopilot normalement (garde §6 levée).

---

## 10. Classement app

- [ ] `ClassementScreen` : toggle `[ Individuel | Équipes ]` si `teamCompetitionEnabled && status === "locked"`.
- [ ] Vue Équipes : lire `groups/{gid}` (`teamCompetition`) + membres déjà chargés → moyennes, écart.
- [ ] Exclure Nova (`isNovaMember` / uid `ai`).
- [ ] Groupes existants : pas de champs → pas de toggle.

---

## 11. Règles Firestore (esquisse)

- `teamCompetition*` / `competitionStartYmd` : **write** owner via callable only (pas client direct).
- `roster` : read membres du groupe ; write false client.
- Membership inchangé sauf si miroir `teamId`.

---

## 12. Checklist implémentation (ordre suggéré)

| # | Lot | Fichiers / zone |
|---|-----|-----------------|
| 1 | Doc + validation création | `createGroupWithCap.js`, `create.js`, `GroupConfigFields.js`, `createGroupService.js` |
| 2 | Join deadline | `joinGroupWithCap.js`, i18n erreur |
| 3 | Callable roster | `functions/groups/setTeamCompetitionRoster.js`, index export |
| 4 | Autopilot defer | `createDailyFgcAutopilot.js` |
| 5 | Lock J0 | petit cron ou hook début autopilot loop |
| 6 | UI spread owner | `app/(drawer)/groups/[groupId]/*` |
| 7 | Classement toggle + vue | `ClassementScreen.js`, `TeamLeaderboardSection.js`, hook calcul |
| 8 | Tests unitaires | calcul moyenne, validation dates, roster |

**Estimation :** ~12–16 j·dev (aligné analyse précédente, légèrement réduit vs « activer anytime »).

---

## 13. Critères d’acceptation MVS (rappel)

1. Création seulement ; groupes existants inchangés.
2. Date de début + join jusqu’à J−1.
3. Spread owner avant J0 ; roster figé à J0.
4. Défis / points individuels inchangés ; équipes = moyenne `pointsTotal` phase.
5. Autopilot ne crée pas de défis avant `competitionStartYmd`.
6. Nova exclue.

---

## 14. Report Pack A Firestore

Les optimisations coût Firestore (Pack A + index ombre) peuvent glisser **~1 semaine** ; le code amorcé reste en branche / non déployé jusqu’après ce MVS ou en parallèle fin de semaine suivante.

---

## 15. Décisions produit figées (MVS)

- Points équipes = **total phase** à partir de J0 (souvent 0 au lock si aucun défi avant).
- Nouveaux membres **après** J0 : **non** ajoutés au roster (join fermé).
- Membre participating **non assigné** à J0 : autopilot bloqué pour le groupe ou membre exclu des deux équipes — **implémenter « bloquer autopilot + alerte owner »**.
