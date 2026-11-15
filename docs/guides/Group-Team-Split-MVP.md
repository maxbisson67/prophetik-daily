# Duel par équipes (MVP client + Firestore)

Opt-in sur **groupes existants**. Pas d’impact join / autopilot / création groupe.

## Données — `groups/{groupId}.teamSplit`

```json
{
  "teamA": { "id": "a", "name": "Parents" },
  "teamB": { "id": "b", "name": "Ados" },
  "roster": { "uid1": "a", "uid2": "b" },
  "ready": true,
  "updatedAt": "<Timestamp>",
  "updatedBy": "<ownerUid>"
}
```

- **`ready`** : au moins un membre en `a` et un en `b` → toggle **Individuel | Équipes** visible pour **tous** les membres au Classement.
- Sans `teamSplit` ou `ready === false` : membres ne voient rien ; le **owner** configure depuis la fiche groupe.

## Backend

Callable **`setGroupTeamSplit`** (owner only, membres participating, Nova exclu).

```bash
firebase deploy --only functions:setGroupTeamSplit
```

## Classement

Moyenne des `pointsTotal` de la **phase sélectionnée** par équipe (membres assignés seulement).
