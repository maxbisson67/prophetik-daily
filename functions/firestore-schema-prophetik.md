# Documentation Firestore - Prophetik

Généré le: 2026-06-17T10:57:44.675Z

Objectif: documentation automatique du modèle Firestore DEV pour NotebookLM.

## Collections analysées

- _jobs
- app_config
- catalog_avatars
- catalog_group_avatars
- catalog_jerseys
- credit_grants
- defis
- entitlements
- first_goal_challenges
- group_memberships
- groups
- mlb_player_stats_current
- mlb_schedule_daily
- mlb_standings
- nhl_first_goal_games
- nhl_live_games
- nhl_matchups_daily
- nhl_player_stats_current
- nhl_players
- nhl_schedule_daily
- nhl_standings
- nhl_team_daily
- participants
- profiles_public
- revenuecat_events
- team_prediction_challenges
- usage_weekly

---

## Collection: `_jobs`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `source` | string | "players.js" / "nhlInjuriesSync.js (ESPN)" |
| `ok` | boolean | true / true |
| `countPlayers` | number | 785 |
| `written` | number | 785 |
| `ms` | number | 7527 |
| `ranAt` | timestamp | {"_seconds":1781693779,"_nanoseconds":839000000} / {"_seconds":1781625605,"_nanoseconds":596000000} |
| `apiRequestsUsed` | number | 1 |
| `nhlPlayersTotal` | number | 933 |
| `injuriesCleared` | number | 0 |
| `injuriesUpserted` | number | 98 |
| `espnInjuriesTotal` | number | 115 |
| `matchesFound` | number | 98 |
| `matchStats` | map | {...} |
| `matchStats.mediumConfidence` | number | 1 |
| `matchStats.notMatched` | number | 17 |
| `matchStats.total` | number | 98 |
| `matchStats.highConfidence` | number | 96 |
| `runYmd` | string | "2026-06-16" |
| `runId` | string | "1781625603040" |
| `durationMs` | number | 2526 |

### Documents exemples

<details>
<summary>_jobs/refreshNhlPlayers</summary>

```json
{
  "source": "players.js",
  "ok": true,
  "countPlayers": 785,
  "written": 785,
  "ms": 7527,
  "ranAt": {
    "_seconds": 1781693779,
    "_nanoseconds": 839000000
  }
}
```
</details>

<details>
<summary>_jobs/syncNhlInjuries</summary>

```json
{
  "source": "nhlInjuriesSync.js (ESPN)",
  "apiRequestsUsed": 1,
  "ok": true,
  "nhlPlayersTotal": 933,
  "injuriesCleared": 0,
  "injuriesUpserted": 98,
  "espnInjuriesTotal": 115,
  "matchesFound": 98,
  "matchStats": {
    "mediumConfidence": 1,
    "notMatched": 17,
    "total": 98,
    "highConfidence": 96
  },
  "ranAt": {
    "_seconds": 1781625605,
    "_nanoseconds": 596000000
  },
  "runYmd": "2026-06-16",
  "runId": "1781625603040",
  "durationMs": 2526
}
```
</details>


## Collection: `app_config`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `seasonId` | string | "20252026" |
| `sport` | string | "nhl" |
| `label` | string | "Saison NHL 2025-2026" |
| `active` | boolean | true |
| `createdAt` | timestamp | {"_seconds":1767368870,"_nanoseconds":303000000} |
| `billingLive` | boolean | true |
| `toYmd` | string | "2026-06-15" |
| `fromYmd` | string | "2025-10-07" |
| `preSeasonStartYmd` | string | "2025-09-20" |
| `regularSeasonEndYmd` | string | "2026-04-17" |
| `source` | string | "api-web.nhle.com/v1/schedule" |
| `regularSeasonStartYmd` | string | "2025-10-07" |
| `playoffEndYmd` | string | "2026-06-15" |
| `updatedAt` | timestamp | {"_seconds":1781611504,"_nanoseconds":77000000} |
| `androidStoreUrl` | string | "https://play.google.com/apps/internaltest/4701072534551116370" |
| `updateMessageFr` | string | "Une nouvelle version de Prophetik est disponible 🚀" |
| `updateMessageEn` | string | "A new version of Prophetik is available 🚀" |
| `forceUpdate` | boolean | false |
| `iosStoreUrl` | string | "https://testflight.apple.com/join/4DAKMFcD" |
| `minVersion` | string | "54" |
| `latestVersion` | string | "56" |

### Documents exemples

<details>
<summary>app_config/currentSeason</summary>

```json
{
  "seasonId": "20252026",
  "sport": "nhl",
  "label": "Saison NHL 2025-2026",
  "active": true,
  "createdAt": {
    "_seconds": 1767368870,
    "_nanoseconds": 303000000
  },
  "billingLive": true,
  "toYmd": "2026-06-15",
  "fromYmd": "2025-10-07",
  "preSeasonStartYmd": "2025-09-20",
  "regularSeasonEndYmd": "2026-04-17",
  "source": "api-web.nhle.com/v1/schedule",
  "regularSeasonStartYmd": "2025-10-07",
  "playoffEndYmd": "2026-06-15",
  "updatedAt": {
    "_seconds": 1781611504,
    "_nanoseconds": 77000000
  }
}
```
</details>

<details>
<summary>app_config/mobile</summary>

```json
{
  "androidStoreUrl": "https://play.google.com/apps/internaltest/4701072534551116370",
  "updateMessageFr": "Une nouvelle version de Prophetik est disponible 🚀",
  "updateMessageEn": "A new version of Prophetik is available 🚀",
  "forceUpdate": false,
  "iosStoreUrl": "https://testflight.apple.com/join/4DAKMFcD",
  "minVersion": "54",
  "latestVersion": "56"
}
```
</details>


## Collection: `catalog_avatars`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `name` | string | "Le Rought" / "Le cool" |
| `price` | number | 5 / 5 |
| `sort` | number | 1 / 3 |
| `gender` | string | "male" / "male" |
| `active` | boolean | true / true |
| `url` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA1.png? / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png? |

### Documents exemples

<details>
<summary>catalog_avatars/1X4XvijBdtnqcRzMfns1</summary>

```json
{
  "name": "Le Rought",
  "price": 5,
  "sort": 1,
  "gender": "male",
  "active": true,
  "url": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA1.png?alt=media&token=425aadf5-c7e3-4842-ab27-35e4eb77a5ea"
}
```
</details>

<details>
<summary>catalog_avatars/21qopPwKvOJv7wpKhm4y</summary>

```json
{
  "url": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png?alt=media&token=809116c7-42a8-43a7-a72b-db3812f1a98a",
  "active": true,
  "gender": "male",
  "name": "Le cool",
  "price": 5,
  "sort": 3
}
```
</details>

<details>
<summary>catalog_avatars/6FLhxfiEYDR9MIjQ0UTr</summary>

```json
{
  "name": "Le king",
  "url": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA5.png?alt=media&token=00eb6bbf-bdb0-492a-b7ae-9140939abb97",
  "sort": 5,
  "price": 5,
  "active": true
}
```
</details>


## Collection: `catalog_group_avatars`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `name` | string | "Visionnaris" / "Les Loups" |
| `sort` | number | 2 / 1 |
| `price` | number | 5 / 5 |
| `url` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-group%2FG2.png? / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-group%2FG1.png? |

### Documents exemples

<details>
<summary>catalog_group_avatars/BqnwC9es4rhsE7CqUClz</summary>

```json
{
  "name": "Visionnaris",
  "sort": 2,
  "price": 5,
  "url": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-group%2FG2.png?alt=media&token=287e4d6e-2514-4670-873f-118a33ea543b"
}
```
</details>

<details>
<summary>catalog_group_avatars/s86r34l1nEiH8TMac8xJ</summary>

```json
{
  "name": "Les Loups",
  "price": 5,
  "sort": 1,
  "url": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-group%2FG1.png?alt=media&token=f883a2ae-2eba-457a-9246-f9f5639f4a23"
}
```
</details>


## Collection: `catalog_jerseys`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `templateProfilePath` | string | "jerseys/hockey/blue_1_front.png" / "jerseys/hockey/white_1_front.png" |
| `active` | boolean | true / true |
| `templateBackPath` | string | "jerseys/hockey/blue_1_back.png" / "jerseys/hockey/white_1_back.png" |
| `sort` | number | 1 / 2 |
| `templateFrontPath` | string | "jerseys/hockey/blue_1_front.png" / "jerseys/hockey/white_1_front.png" |
| `colors` | map | {...} / {...} |
| `colors.text` | string | "#ffffff" / "#111111" |
| `colors.accent` | string | "#ef4444" / "#ef4444" |
| `colors.primary` | string | "#1e3a8a" / "#f3f4f6" |
| `createdAt` | timestamp | {"_seconds":1774827419,"_nanoseconds":527000000} / {"_seconds":1774827419,"_nanoseconds":605000000} |
| `name` | string | "Bleu" / "Blanc" |
| `sport` | string | "hockey" / "hockey" |
| `updatedAt` | timestamp | {"_seconds":1774827419,"_nanoseconds":527000000} / {"_seconds":1774827419,"_nanoseconds":605000000} |
| `frontZones` | map | {...} / {...} |
| `frontZones.badges` | map | {...} / {...} |
| `frontZones.badges.color` | string | "#ffffff" / "#111111" |
| `frontZones.badges.x` | number | 150 / 150 |
| `frontZones.badges.y` | number | 185 / 185 |
| `frontZones.badges.fontSize` | number | 24 / 24 |
| `frontZones.badges.lineHeight` | number | 36 / 36 |
| `frontZones.captainLetter` | map | {...} / {...} |
| `frontZones.captainLetter.color` | string | "#ffffff" / "#111111" |
| `frontZones.captainLetter.x` | number | 500 / 500 |
| `frontZones.captainLetter.y` | number | 155 / 155 |
| `frontZones.captainLetter.fontSize` | number | 58 / 58 |
| `frontZones.assistantLetter` | map | {...} / {...} |
| `frontZones.assistantLetter.color` | string | "#ffffff" / "#111111" |
| `frontZones.assistantLetter.x` | number | 500 / 500 |
| `frontZones.assistantLetter.y` | number | 155 / 155 |
| `frontZones.assistantLetter.fontSize` | number | 58 / 58 |
| `frontZones.logo` | map | {...} / {...} |
| `frontZones.logo.variant` | string | "light" / "dark" |
| `frontZones.logo.x` | number | 325 / 325 |
| `frontZones.logo.y` | number | 300 / 300 |
| `frontZones.logo.height` | number | 196 / 196 |
| `frontZones.logo.width` | number | 196 / 196 |
| `textZones` | map | {...} / {...} |
| `textZones.backName` | map | {...} / {...} |
| `textZones.backName.color` | string | "#ffffff" / "#111111" |
| `textZones.backName.x` | number | 325 / 325 |
| `textZones.backName.maxWidth` | number | 260 / 260 |
| `textZones.backName.y` | number | 210 / 210 |
| `textZones.backName.fontSize` | number | 46 / 46 |
| `textZones.backName.strokeColor` | string | "#111111" / "#ffffff" |
| `textZones.backName.strokeWidth` | number | 4 / 4 |
| `textZones.backNumber` | map | {...} / {...} |
| `textZones.backNumber.color` | string | "#ffffff" / "#111111" |
| `textZones.backNumber.x` | number | 325 / 325 |
| `textZones.backNumber.y` | number | 330 / 330 |
| `textZones.backNumber.fontSize` | number | 140 / 140 |
| `textZones.backNumber.strokeColor` | string | "#111111" / "#ffffff" |
| `textZones.backNumber.strokeWidth` | number | 8 / 10 |
| `previewFrontUrl` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fblue / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fwhit |
| `previewBackUrl` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fblue / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fwhit |

### Documents exemples

<details>
<summary>catalog_jerseys/blue_1</summary>

```json
{
  "templateProfilePath": "jerseys/hockey/blue_1_front.png",
  "active": true,
  "templateBackPath": "jerseys/hockey/blue_1_back.png",
  "sort": 1,
  "templateFrontPath": "jerseys/hockey/blue_1_front.png",
  "colors": {
    "text": "#ffffff",
    "accent": "#ef4444",
    "primary": "#1e3a8a"
  },
  "createdAt": {
    "_seconds": 1774827419,
    "_nanoseconds": 527000000
  },
  "name": "Bleu",
  "sport": "hockey",
  "updatedAt": {
    "_seconds": 1774827419,
    "_nanoseconds": 527000000
  },
  "frontZones": {
    "badges": {
      "color": "#ffffff",
      "x": 150,
      "y": 185,
      "fontSize": 24,
      "lineHeight": 36
    },
    "captainLetter": {
      "color": "#ffffff",
      "x": 500,
      "y": 155,
      "fontSize": 58
    },
    "assistantLetter": {
      "color": "#ffffff",
      "x": 500,
      "y": 155,
      "fontSize": 58
    },
    "logo": {
      "variant": "light",
      "x": 325,
      "y": 300,
      "height": 196,
      "width": 196
    }
  },
  "textZones": {
    "backName": {
      "color": "#ffffff",
      "x": 325,
      "maxWidth": 260,
      "y": 210,
      "fontSize": 46,
      "strokeColor": "#111111",
      "strokeWidth": 4
    },
    "backNumber": {
      "color": "#ffffff",
      "x": 325,
      "y": 330,
      "fontSize": 140,
      "strokeColor": "#111111",
      "strokeWidth": 8
    }
  },
  "previewFrontUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fblue_1_front.png?alt=media&token=ddf42fe6-bd12-47a2-b79f-7a80abd3c64e",
  "previewBackUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fblue_1_back.png?alt=media&token=0e1ff381-603f-48af-ba90-bd72902742e5"
}
```
</details>

<details>
<summary>catalog_jerseys/white_1</summary>

```json
{
  "templateProfilePath": "jerseys/hockey/white_1_front.png",
  "active": true,
  "templateBackPath": "jerseys/hockey/white_1_back.png",
  "sort": 2,
  "templateFrontPath": "jerseys/hockey/white_1_front.png",
  "colors": {
    "text": "#111111",
    "accent": "#ef4444",
    "primary": "#f3f4f6"
  },
  "createdAt": {
    "_seconds": 1774827419,
    "_nanoseconds": 605000000
  },
  "name": "Blanc",
  "sport": "hockey",
  "updatedAt": {
    "_seconds": 1774827419,
    "_nanoseconds": 605000000
  },
  "frontZones": {
    "badges": {
      "color": "#111111",
      "x": 150,
      "y": 185,
      "fontSize": 24,
      "lineHeight": 36
    },
    "captainLetter": {
      "color": "#111111",
      "x": 500,
      "y": 155,
      "fontSize": 58
    },
    "assistantLetter": {
      "color": "#111111",
      "x": 500,
      "y": 155,
      "fontSize": 58
    },
    "logo": {
      "variant": "dark",
      "x": 325,
      "height": 196,
      "width": 196,
      "y": 300
    }
  },
  "textZones": {
    "backNumber": {
      "color": "#111111",
      "strokeColor": "#ffffff",
      "strokeWidth": 10,
      "fontSize": 140,
      "y": 330,
      "x": 325
    },
    "backName": {
      "color": "#111111",
      "maxWidth": 260,
      "y": 210,
      "fontSize": 46,
      "x": 325,
      "strokeWidth": 4,
      "strokeColor": "#ffffff"
    }
  },
  "previewFrontUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fwhite_1_front.png?alt=media&token=24382af3-9ed9-47a5-9092-96984e75ee8a",
  "previewBackUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/jerseys%2Fhockey%2Fwhite_1_back.png?alt=media&token=73f05b8b-c849-4663-8b01-88431daf6871"
}
```
</details>


## Collection: `credit_grants`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `periodKey` | string | "202512" / "202512" |
| `amount` | number | 30 / 2 |
| `uid` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "45I3FZACt8OTLN39KeSKq7n545G3" |
| `prevBalance` | number | 20 / 18 |
| `planKey` | string | "base" / "free" |
| `computedCap` | null, number | null / 20 |
| `createdAt` | timestamp | {"_seconds":1766114164,"_nanoseconds":744000000} / {"_seconds":1766104561,"_nanoseconds":428000000} |
| `meta` | map | {...} |
| `meta.day` | string | "2025-12-31" |
| `meta.periodKey` | string | "202512" |
| `source` | string | "CREDIT_DAILY_SHOT" |

### Documents exemples

<details>
<summary>credit_grants/45I3FZACt8OTLN39KeSKq7n545G3_202512_base</summary>

```json
{
  "periodKey": "202512",
  "amount": 30,
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "prevBalance": 20,
  "planKey": "base",
  "computedCap": null,
  "createdAt": {
    "_seconds": 1766114164,
    "_nanoseconds": 744000000
  }
}
```
</details>

<details>
<summary>credit_grants/45I3FZACt8OTLN39KeSKq7n545G3_202512_free</summary>

```json
{
  "computedCap": 20,
  "amount": 2,
  "periodKey": "202512",
  "prevBalance": 18,
  "planKey": "free",
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "createdAt": {
    "_seconds": 1766104561,
    "_nanoseconds": 428000000
  }
}
```
</details>

<details>
<summary>credit_grants/dailyshot_45I3FZACt8OTLN39KeSKq7n545G3_2025-12-31</summary>

```json
{
  "meta": {
    "day": "2025-12-31",
    "periodKey": "202512"
  },
  "source": "CREDIT_DAILY_SHOT",
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "amount": 1,
  "createdAt": {
    "_seconds": 1767234074,
    "_nanoseconds": 346000000
  }
}
```
</details>


## Collection: `defis`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `createdBy` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `gameDate` | string | "2025-11-24" / "2025-10-24" |
| `groupId` | string | "65zw10b11xwq8rq4" / "ctzdscog11kfapoq" |
| `participationCost` | number | 3 / 5 |
| `type` | number | 3 / 5 |
| `title` | string | "Défi 3x3" / "Défi 5x5" |
| `firstGameUTC` | timestamp | {"_seconds":1764028800,"_nanoseconds":0} / {"_seconds":1761346800,"_nanoseconds":0} |
| `signupDeadline` | timestamp | {"_seconds":1764025200,"_nanoseconds":0} / {"_seconds":1761343200,"_nanoseconds":0} |
| `createdAt` | timestamp | {"_seconds":1764020456,"_nanoseconds":15000000} / {"_seconds":1761341815,"_nanoseconds":505000000} |
| `games` | array | [2025020353,2025020354,2025020355,2025020356,2025020357,2025020358,2025020359] |
| `participantsCount` | number | 2 / 2 |
| `pot` | number | 6 / 10 |
| `updatedAt` | timestamp | {"_seconds":1764020597,"_nanoseconds":164000000} / {"_seconds":1761341953,"_nanoseconds":634000000} |
| `winners` | array | ["45I3FZACt8OTLN39KeSKq7n545G3"] / ["45I3FZACt8OTLN39KeSKq7n545G3"] |
| `completedAt` | timestamp | {"_seconds":1764064804,"_nanoseconds":698000000} / {"_seconds":1761382805,"_nanoseconds":89000000} |
| `winnerShares` | map | {...} / {...} |
| `winnerShares.45I3FZACt8OTLN39KeSKq7n545G3` | number | 6 / 10 |
| `status` | string | "completed" / "completed" |
| `defiKey` | string | "2025-12-27_5x5" |
| `poolGameDate` | string | "2025-12-27" |
| `poolSeasonId` | string | "20252026" |
| `poolCount` | number | 150 |
| `poolStatus` | string | "ready" |
| `poolFrozenAt` | timestamp | {"_seconds":1766842695,"_nanoseconds":643000000} |
| `novaLockedAt` | timestamp | {"_seconds":1766842742,"_nanoseconds":72000000} |
| `activatedAt` | timestamp | {"_seconds":1766842784,"_nanoseconds":746000000} |
| `isActivated` | boolean | true |
| `payoutAppliedAt` | timestamp | {"_seconds":1767002406,"_nanoseconds":889000000} |
| `payoutAppliedVersion` | string | "v3_group_points_2025-12-28" |
| `payoutAppliedTo` | string | "group_memberships" |

### Documents exemples

<details>
<summary>defis/19fkOV3Bf5lwxJ8Tjx5j</summary>

```json
{
  "createdBy": "45I3FZACt8OTLN39KeSKq7n545G3",
  "gameDate": "2025-11-24",
  "groupId": "65zw10b11xwq8rq4",
  "participationCost": 3,
  "type": 3,
  "title": "Défi 3x3",
  "firstGameUTC": {
    "_seconds": 1764028800,
    "_nanoseconds": 0
  },
  "signupDeadline": {
    "_seconds": 1764025200,
    "_nanoseconds": 0
  },
  "createdAt": {
    "_seconds": 1764020456,
    "_nanoseconds": 15000000
  },
  "games": [
    2025020353,
    2025020354,
    2025020355,
    2025020356,
    2025020357,
    2025020358,
    2025020359
  ],
  "participantsCount": 2,
  "pot": 6,
  "updatedAt": {
    "_seconds": 1764020597,
    "_nanoseconds": 164000000
  },
  "winners": [
    "45I3FZACt8OTLN39KeSKq7n545G3"
  ],
  "completedAt": {
    "_seconds": 1764064804,
    "_nanoseconds": 698000000
  },
  "winnerShares": {
    "45I3FZACt8OTLN39KeSKq7n545G3": 6
  },
  "status": "completed"
}
```
</details>


### Collection: `defis/19fkOV3Bf5lwxJ8Tjx5j/live`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `playerGoals` | map | {...} |
| `playerGoals.8474037` | number | 1 |
| `playerGoals.8474590` | number | 1 |
| `playerGoals.8475170` | number | 1 |
| `playerGoals.8476389` | number | 1 |
| `playerGoals.8476880` | number | 1 |
| `playerGoals.8476887` | number | 1 |
| `playerGoals.8477015` | number | 1 |
| `playerGoals.8477409` | number | 1 |
| `playerGoals.8477933` | number | 1 |
| `playerGoals.8477935` | number | 1 |
| `playerGoals.8477946` | number | 1 |
| `playerGoals.8477964` | number | 1 |
| `playerGoals.8477998` | number | 1 |
| `playerGoals.8478055` | number | 1 |
| `playerGoals.8478414` | number | 1 |
| `playerGoals.8478421` | number | 2 |
| `playerGoals.8478519` | number | 1 |
| `playerGoals.8478542` | number | 1 |
| `playerGoals.8479337` | number | 1 |
| `playerGoals.8479345` | number | 2 |
| `playerGoals.8479542` | number | 2 |
| `playerGoals.8479996` | number | 1 |
| `playerGoals.8480002` | number | 1 |
| `playerGoals.8480003` | number | 1 |
| `playerGoals.8480188` | number | 1 |
| `playerGoals.8480796` | number | 1 |
| `playerGoals.8481726` | number | 1 |
| `playerGoals.8482077` | number | 1 |
| `playerGoals.8482109` | number | 1 |
| `playerGoals.8482699` | number | 1 |
| `playerGoals.8482730` | number | 1 |
| `playerGoals.8482768` | number | 1 |
| `playerGoals.8483431` | number | 4 |
| `playerGoals.8483485` | number | 1 |
| `playerGoals.8483565` | number | 1 |
| `playerAssists` | map | {...} |
| `playerAssists.8470621` | number | 1 |
| `playerAssists.8471214` | number | 1 |
| `playerAssists.8473419` | number | 1 |
| `playerAssists.8474013` | number | 1 |
| `playerAssists.8474141` | number | 1 |
| `playerAssists.8474590` | number | 1 |
| `playerAssists.8474600` | number | 1 |
| `playerAssists.8475287` | number | 1 |
| `playerAssists.8475324` | number | 1 |
| `playerAssists.8475753` | number | 1 |
| `playerAssists.8476441` | number | 2 |
| `playerAssists.8476453` | number | 3 |
| `playerAssists.8476469` | number | 1 |
| `playerAssists.8476474` | number | 1 |
| `playerAssists.8476867` | number | 1 |
| `playerAssists.8476880` | number | 1 |
| `playerAssists.8476892` | number | 1 |
| `playerAssists.8477015` | number | 1 |
| `playerAssists.8477220` | number | 2 |
| `playerAssists.8477380` | number | 1 |
| `playerAssists.8477402` | number | 1 |
| `playerAssists.8477409` | number | 2 |
| `playerAssists.8477429` | number | 1 |
| `playerAssists.8477495` | number | 1 |
| `playerAssists.8477932` | number | 1 |
| `playerAssists.8477933` | number | 2 |
| `playerAssists.8478047` | number | 1 |
| `playerAssists.8478055` | number | 1 |
| `playerAssists.8478403` | number | 1 |
| `playerAssists.8478414` | number | 1 |
| `playerAssists.8478421` | number | 1 |
| `playerAssists.8478519` | number | 1 |
| `playerAssists.8478542` | number | 1 |
| `playerAssists.8478882` | number | 2 |
| `playerAssists.8479323` | number | 2 |
| `playerAssists.8479370` | number | 1 |
| `playerAssists.8479407` | number | 1 |
| `playerAssists.8479542` | number | 1 |
| `playerAssists.8480002` | number | 1 |
| `playerAssists.8481161` | number | 1 |
| `playerAssists.8481542` | number | 2 |
| `playerAssists.8481580` | number | 1 |
| `playerAssists.8481598` | number | 1 |
| `playerAssists.8481656` | number | 1 |
| `playerAssists.8482078` | number | 1 |
| `playerAssists.8482088` | number | 2 |
| `playerAssists.8482103` | number | 1 |
| `playerAssists.8482110` | number | 1 |
| `playerAssists.8482146` | number | 1 |
| `playerAssists.8482148` | number | 1 |
| `playerAssists.8482157` | number | 1 |
| `playerAssists.8482684` | number | 1 |
| `playerAssists.8482699` | number | 1 |
| `playerAssists.8482713` | number | 1 |
| `playerAssists.8482929` | number | 1 |
| `playerAssists.8483431` | number | 1 |
| `playerAssists.8483890` | number | 1 |
| `playerAssists.8484186` | number | 1 |
| `playerAssists.8484304` | number | 2 |
| `playerAssists.8484321` | number | 1 |
| `playerAssists.8484471` | number | 1 |
| `playerPoints` | map | {...} |
| `playerPoints.8470621` | number | 1 |
| `playerPoints.8471214` | number | 1 |
| `playerPoints.8473419` | number | 1 |
| `playerPoints.8474013` | number | 1 |
| `playerPoints.8474037` | number | 1 |
| `playerPoints.8474141` | number | 1 |
| `playerPoints.8474590` | number | 2 |
| `playerPoints.8474600` | number | 1 |
| `playerPoints.8475170` | number | 1 |
| `playerPoints.8475287` | number | 1 |
| `playerPoints.8475324` | number | 1 |
| `playerPoints.8475753` | number | 1 |
| `playerPoints.8476389` | number | 1 |
| `playerPoints.8476441` | number | 2 |
| `playerPoints.8476453` | number | 3 |
| `playerPoints.8476469` | number | 1 |
| `playerPoints.8476474` | number | 1 |
| `playerPoints.8476867` | number | 1 |
| `playerPoints.8476880` | number | 2 |
| `playerPoints.8476887` | number | 1 |
| `playerPoints.8476892` | number | 1 |
| `playerPoints.8477015` | number | 2 |
| `playerPoints.8477220` | number | 2 |
| `playerPoints.8477380` | number | 1 |
| `playerPoints.8477402` | number | 1 |
| `playerPoints.8477409` | number | 3 |
| `playerPoints.8477429` | number | 1 |
| `playerPoints.8477495` | number | 1 |
| `playerPoints.8477932` | number | 1 |
| `playerPoints.8477933` | number | 3 |
| `playerPoints.8477935` | number | 1 |
| `playerPoints.8477946` | number | 1 |
| `playerPoints.8477964` | number | 1 |
| `playerPoints.8477998` | number | 1 |
| `playerPoints.8478047` | number | 1 |
| `playerPoints.8478055` | number | 2 |
| `playerPoints.8478403` | number | 1 |
| `playerPoints.8478414` | number | 2 |
| `playerPoints.8478421` | number | 3 |
| `playerPoints.8478519` | number | 2 |
| `playerPoints.8478542` | number | 2 |
| `playerPoints.8478882` | number | 2 |
| `playerPoints.8479323` | number | 2 |
| `playerPoints.8479337` | number | 1 |
| `playerPoints.8479345` | number | 2 |
| `playerPoints.8479370` | number | 1 |
| `playerPoints.8479407` | number | 1 |
| `playerPoints.8479542` | number | 3 |
| `playerPoints.8479996` | number | 1 |
| `playerPoints.8480002` | number | 2 |
| `playerPoints.8480003` | number | 1 |
| `playerPoints.8480188` | number | 1 |
| `playerPoints.8480796` | number | 1 |
| `playerPoints.8481161` | number | 1 |
| `playerPoints.8481542` | number | 2 |
| `playerPoints.8481580` | number | 1 |
| `playerPoints.8481598` | number | 1 |
| `playerPoints.8481656` | number | 1 |
| `playerPoints.8481726` | number | 1 |
| `playerPoints.8482077` | number | 1 |
| `playerPoints.8482078` | number | 1 |
| `playerPoints.8482088` | number | 2 |
| `playerPoints.8482103` | number | 1 |
| `playerPoints.8482109` | number | 1 |
| `playerPoints.8482110` | number | 1 |
| `playerPoints.8482146` | number | 1 |
| `playerPoints.8482148` | number | 1 |
| `playerPoints.8482157` | number | 1 |
| `playerPoints.8482684` | number | 1 |
| `playerPoints.8482699` | number | 2 |
| `playerPoints.8482713` | number | 1 |
| `playerPoints.8482730` | number | 1 |
| `playerPoints.8482768` | number | 1 |
| `playerPoints.8482929` | number | 1 |
| `playerPoints.8483431` | number | 5 |
| `playerPoints.8483485` | number | 1 |
| `playerPoints.8483565` | number | 1 |
| `playerPoints.8483890` | number | 1 |
| `playerPoints.8484186` | number | 1 |
| `playerPoints.8484304` | number | 2 |
| `playerPoints.8484321` | number | 1 |
| `playerPoints.8484471` | number | 1 |
| `updatedAt` | timestamp | {"_seconds":1764064802,"_nanoseconds":222000000} |

### Documents exemples

<details>
<summary>defis/19fkOV3Bf5lwxJ8Tjx5j/live/stats</summary>

```json
{
  "playerGoals": {
    "8474037": 1,
    "8474590": 1,
    "8475170": 1,
    "8476389": 1,
    "8476880": 1,
    "8476887": 1,
    "8477015": 1,
    "8477409": 1,
    "8477933": 1,
    "8477935": 1,
    "8477946": 1,
    "8477964": 1,
    "8477998": 1,
    "8478055": 1,
    "8478414": 1,
    "8478421": 2,
    "8478519": 1,
    "8478542": 1,
    "8479337": 1,
    "8479345": 2,
    "8479542": 2,
    "8479996": 1,
    "8480002": 1,
    "8480003": 1,
    "8480188": 1,
    "8480796": 1,
    "8481726": 1,
    "8482077": 1,
    "8482109": 1,
    "8482699": 1,
    "8482730": 1,
    "8482768": 1,
    "8483431": 4,
    "8483485": 1,
    "8483565": 1
  },
  "playerAssists": {
    "8470621": 1,
    "8471214": 1,
    "8473419": 1,
    "8474013": 1,
    "8474141": 1,
    "8474590": 1,
    "8474600": 1,
    "8475287": 1,
    "8475324": 1,
    "8475753": 1,
    "8476441": 2,
    "8476453": 3,
    "8476469": 1,
    "8476474": 1,
    "8476867": 1,
    "8476880": 1,
    "8476892": 1,
    "8477015": 1,
    "8477220": 2,
    "8477380": 1,
    "8477402": 1,
    "8477409": 2,
    "8477429": 1,
    "8477495": 1,
    "8477932": 1,
    "8477933": 2,
    "8478047": 1,
    "8478055": 1,
    "8478403": 1,
    "8478414": 1,
    "8478421": 1,
    "8478519": 1,
    "8478542": 1,
    "8478882": 2,
    "8479323": 2,
    "8479370": 1,
    "8479407": 1,
    "8479542": 1,
    "8480002": 1,
    "8481161": 1,
    "8481542": 2,
    "8481580": 1,
    "8481598": 1,
    "8481656": 1,
    "8482078": 1,
    "8482088": 2,
    "8482103": 1,
    "8482110": 1,
    "8482146": 1,
    "8482148": 1,
    "8482157": 1,
    "8482684": 1,
    "8482699": 1,
    "8482713": 1,
    "8482929": 1,
    "8483431": 1,
    "8483890": 1,
    "8484186": 1,
    "8484304": 2,
    "8484321": 1,
    "8484471": 1
  },
  "playerPoints": {
    "8470621": 1,
    "8471214": 1,
    "8473419": 1,
    "8474013": 1,
    "8474037": 1,
    "8474141": 1,
    "8474590": 2,
    "8474600": 1,
    "8475170": 1,
    "8475287": 1,
    "8475324": 1,
    "8475753": 1,
    "8476389": 1,
    "8476441": 2,
    "8476453": 3,
    "8476469": 1,
    "8476474": 1,
    "8476867": 1,
    "8476880": 2,
    "8476887": 1,
    "8476892": 1,
    "8477015": 2,
    "8477220": 2,
    "8477380": 1,
    "8477402": 1,
    "8477409": 3,
    "8477429": 1,
    "8477495": 1,
    "8477932": 1,
    "8477933": 3,
    "8477935": 1,
    "8477946": 1,
    "8477964": 1,
    "8477998": 1,
    "8478047": 1,
    "8478055": 2,
    "8478403": 1,
    "8478414": 2,
    "8478421": 3,
    "8478519": 2,
    "8478542": 2,
    "8478882": 2,
    "8479323": 2,
    "8479337": 1,
    "8479345": 2,
    "8479370": 1,
    "8479407": 1,
    "8479542": 3,
    "8479996": 1,
    "8480002": 2,
    "8480003": 1,
    "8480188": 1,
    "8480796": 1,
    "8481161": 1,
    "8481542": 2,
    "8481580": 1,
    "8481598": 1,
    "8481656": 1,
    "8481726": 1,
    "8482077": 1,
    "8482078": 1,
    "8482088": 2,
    "8482103": 1,
    "8482109": 1,
    "8482110": 1,
    "8482146": 1,
    "8482148": 1,
    "8482157": 1,
    "8482684": 1,
    "8482699": 2,
    "8482713": 1,
    "8482730": 1,
    "8482768": 1,
    "8482929": 1,
    "8483431": 5,
    "8483485": 1,
    "8483565": 1,
    "8483890": 1,
    "8484186": 1,
    "8484304": 2,
    "8484321": 1,
    "8484471": 1
  },
  "updatedAt": {
    "_seconds": 1764064802,
    "_nanoseconds": 222000000
  }
}
```
</details>


### Collection: `defis/19fkOV3Bf5lwxJ8Tjx5j/participations`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `joinedAt` | timestamp | {"_seconds":1764020488,"_nanoseconds":702000000} / {"_seconds":1764020597,"_nanoseconds":164000000} |
| `paid` | boolean | true / true |
| `picks` | array | [{"teamAbbr":"VGK","fullName":"Jack Eichel","playerId":8478403},{"teamAbbr":"TBL","fullName":"Nikita / [{"teamAbbr":"DET","fullName":"Dylan Larkin","playerId":8477946},{"teamAbbr":"CBJ","fullName":"Kiril |
| `paidAt` | timestamp | {"_seconds":1764020488,"_nanoseconds":702000000} / {"_seconds":1764020597,"_nanoseconds":164000000} |
| `paidAmount` | number | 3 / 3 |
| `livePoints` | number | 5 / 1 |
| `liveUpdatedAt` | timestamp | {"_seconds":1764064802,"_nanoseconds":234000000} / {"_seconds":1764064802,"_nanoseconds":234000000} |
| `finalPoints` | number | 5 / 1 |
| `finalizedAt` | timestamp | {"_seconds":1764064804,"_nanoseconds":698000000} / {"_seconds":1764064804,"_nanoseconds":698000000} |
| `payout` | number | 6 / 0 |

### Documents exemples

<details>
<summary>defis/19fkOV3Bf5lwxJ8Tjx5j/participations/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "joinedAt": {
    "_seconds": 1764020488,
    "_nanoseconds": 702000000
  },
  "paid": true,
  "picks": [
    {
      "teamAbbr": "VGK",
      "fullName": "Jack Eichel",
      "playerId": 8478403
    },
    {
      "teamAbbr": "TBL",
      "fullName": "Nikita Kucherov",
      "playerId": 8476453
    },
    {
      "teamAbbr": "FLA",
      "fullName": "Brad Marchand",
      "playerId": 8473419
    }
  ],
  "paidAt": {
    "_seconds": 1764020488,
    "_nanoseconds": 702000000
  },
  "paidAmount": 3,
  "livePoints": 5,
  "liveUpdatedAt": {
    "_seconds": 1764064802,
    "_nanoseconds": 234000000
  },
  "finalPoints": 5,
  "finalizedAt": {
    "_seconds": 1764064804,
    "_nanoseconds": 698000000
  },
  "payout": 6
}
```
</details>

<details>
<summary>defis/19fkOV3Bf5lwxJ8Tjx5j/participations/fH0MVU6WAEa40nzJoyfMIKhZSdh1</summary>

```json
{
  "joinedAt": {
    "_seconds": 1764020597,
    "_nanoseconds": 164000000
  },
  "paid": true,
  "picks": [
    {
      "teamAbbr": "DET",
      "fullName": "Dylan Larkin",
      "playerId": 8477946
    },
    {
      "teamAbbr": "CBJ",
      "fullName": "Kirill Marchenko",
      "playerId": 8480893
    },
    {
      "teamAbbr": "VGK",
      "fullName": "Mitch Marner",
      "playerId": 8478483
    }
  ],
  "paidAt": {
    "_seconds": 1764020597,
    "_nanoseconds": 164000000
  },
  "paidAmount": 3,
  "livePoints": 1,
  "liveUpdatedAt": {
    "_seconds": 1764064802,
    "_nanoseconds": 234000000
  },
  "finalPoints": 1,
  "finalizedAt": {
    "_seconds": 1764064804,
    "_nanoseconds": 698000000
  },
  "payout": 0
}
```
</details>


### Collection: `defis/19fkOV3Bf5lwxJ8Tjx5j/reads`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `lastSeenAt` | timestamp | {"_seconds":1764033577,"_nanoseconds":603000000} / {"_seconds":1764067232,"_nanoseconds":142000000} |
| `lastOpenAt` | timestamp | {"_seconds":1764033577,"_nanoseconds":603000000} / {"_seconds":1764067232,"_nanoseconds":142000000} |

### Documents exemples

<details>
<summary>defis/19fkOV3Bf5lwxJ8Tjx5j/reads/7lwVnD9GPpe69u70PULIhDZLbGs2</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1764033577,
    "_nanoseconds": 603000000
  },
  "lastOpenAt": {
    "_seconds": 1764033577,
    "_nanoseconds": 603000000
  }
}
```
</details>

<details>
<summary>defis/19fkOV3Bf5lwxJ8Tjx5j/reads/fH0MVU6WAEa40nzJoyfMIKhZSdh1</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1764067232,
    "_nanoseconds": 142000000
  },
  "lastOpenAt": {
    "_seconds": 1764067232,
    "_nanoseconds": 142000000
  }
}
```
</details>

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx</summary>

```json
{
  "groupId": "ctzdscog11kfapoq",
  "title": "Défi 5x5",
  "type": 5,
  "gameDate": "2025-10-24",
  "createdBy": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "participationCost": 5,
  "firstGameUTC": {
    "_seconds": 1761346800,
    "_nanoseconds": 0
  },
  "signupDeadline": {
    "_seconds": 1761343200,
    "_nanoseconds": 0
  },
  "createdAt": {
    "_seconds": 1761341815,
    "_nanoseconds": 505000000
  },
  "participantsCount": 2,
  "pot": 10,
  "updatedAt": {
    "_seconds": 1761341953,
    "_nanoseconds": 634000000
  },
  "winners": [
    "45I3FZACt8OTLN39KeSKq7n545G3"
  ],
  "completedAt": {
    "_seconds": 1761382805,
    "_nanoseconds": 89000000
  },
  "winnerShares": {
    "45I3FZACt8OTLN39KeSKq7n545G3": 10
  },
  "status": "completed"
}
```
</details>


### Collection: `defis/1dVeK66kmYiaEaOWSJRx/live`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `playerGoals` | map | {...} |
| `playerGoals.8471214` | number | 1 |
| `playerGoals.8473604` | number | 1 |
| `playerGoals.8474150` | number | 1 |
| `playerGoals.8474590` | number | 1 |
| `playerGoals.8475172` | number | 1 |
| `playerGoals.8475784` | number | 1 |
| `playerGoals.8476399` | number | 1 |
| `playerGoals.8476462` | number | 2 |
| `playerGoals.8476480` | number | 1 |
| `playerGoals.8476880` | number | 1 |
| `playerGoals.8477015` | number | 1 |
| `playerGoals.8477939` | number | 1 |
| `playerGoals.8477949` | number | 1 |
| `playerGoals.8478057` | number | 1 |
| `playerGoals.8478398` | number | 1 |
| `playerGoals.8479318` | number | 1 |
| `playerGoals.8479420` | number | 1 |
| `playerGoals.8480014` | number | 1 |
| `playerGoals.8480113` | number | 1 |
| `playerGoals.8480807` | number | 2 |
| `playerGoals.8481580` | number | 1 |
| `playerGoals.8482088` | number | 1 |
| `playerGoals.8482667` | number | 1 |
| `playerGoals.8483468` | number | 1 |
| `playerGoals.8483485` | number | 1 |
| `playerPoints` | map | {...} |
| `playerPoints.8471214` | number | 2 |
| `playerPoints.8473604` | number | 1 |
| `playerPoints.8474150` | number | 2 |
| `playerPoints.8474590` | number | 2 |
| `playerPoints.8475166` | number | 1 |
| `playerPoints.8475171` | number | 2 |
| `playerPoints.8475172` | number | 1 |
| `playerPoints.8475784` | number | 1 |
| `playerPoints.8476331` | number | 1 |
| `playerPoints.8476399` | number | 2 |
| `playerPoints.8476460` | number | 2 |
| `playerPoints.8476462` | number | 3 |
| `playerPoints.8476480` | number | 1 |
| `playerPoints.8476880` | number | 1 |
| `playerPoints.8477015` | number | 1 |
| `playerPoints.8477497` | number | 1 |
| `playerPoints.8477504` | number | 3 |
| `playerPoints.8477939` | number | 1 |
| `playerPoints.8477949` | number | 2 |
| `playerPoints.8478057` | number | 1 |
| `playerPoints.8478398` | number | 1 |
| `playerPoints.8478440` | number | 1 |
| `playerPoints.8478443` | number | 1 |
| `playerPoints.8478462` | number | 1 |
| `playerPoints.8479318` | number | 1 |
| `playerPoints.8479378` | number | 1 |
| `playerPoints.8479420` | number | 2 |
| `playerPoints.8480002` | number | 3 |
| `playerPoints.8480014` | number | 2 |
| `playerPoints.8480028` | number | 1 |
| `playerPoints.8480113` | number | 1 |
| `playerPoints.8480313` | number | 1 |
| `playerPoints.8480802` | number | 1 |
| `playerPoints.8480807` | number | 2 |
| `playerPoints.8480839` | number | 1 |
| `playerPoints.8480860` | number | 1 |
| `playerPoints.8481522` | number | 1 |
| `playerPoints.8481524` | number | 1 |
| `playerPoints.8481559` | number | 1 |
| `playerPoints.8481580` | number | 2 |
| `playerPoints.8481656` | number | 1 |
| `playerPoints.8481716` | number | 1 |
| `playerPoints.8482088` | number | 1 |
| `playerPoints.8482110` | number | 1 |
| `playerPoints.8482148` | number | 1 |
| `playerPoints.8482667` | number | 1 |
| `playerPoints.8482671` | number | 1 |
| `playerPoints.8483468` | number | 2 |
| `playerPoints.8483485` | number | 1 |
| `playerPoints.8483573` | number | 1 |
| `playerPoints.8484145` | number | 1 |
| `playerPoints.8484158` | number | 1 |
| `playerPoints.8484180` | number | 1 |
| `playerPoints.8484186` | number | 1 |
| `playerPoints.8484768` | number | 1 |
| `playerPoints.8484801` | number | 1 |
| `updatedAt` | timestamp | {"_seconds":1761382802,"_nanoseconds":384000000} |

### Documents exemples

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx/live/stats</summary>

```json
{
  "playerGoals": {
    "8471214": 1,
    "8473604": 1,
    "8474150": 1,
    "8474590": 1,
    "8475172": 1,
    "8475784": 1,
    "8476399": 1,
    "8476462": 2,
    "8476480": 1,
    "8476880": 1,
    "8477015": 1,
    "8477939": 1,
    "8477949": 1,
    "8478057": 1,
    "8478398": 1,
    "8479318": 1,
    "8479420": 1,
    "8480014": 1,
    "8480113": 1,
    "8480807": 2,
    "8481580": 1,
    "8482088": 1,
    "8482667": 1,
    "8483468": 1,
    "8483485": 1
  },
  "playerPoints": {
    "8471214": 2,
    "8473604": 1,
    "8474150": 2,
    "8474590": 2,
    "8475166": 1,
    "8475171": 2,
    "8475172": 1,
    "8475784": 1,
    "8476331": 1,
    "8476399": 2,
    "8476460": 2,
    "8476462": 3,
    "8476480": 1,
    "8476880": 1,
    "8477015": 1,
    "8477497": 1,
    "8477504": 3,
    "8477939": 1,
    "8477949": 2,
    "8478057": 1,
    "8478398": 1,
    "8478440": 1,
    "8478443": 1,
    "8478462": 1,
    "8479318": 1,
    "8479378": 1,
    "8479420": 2,
    "8480002": 3,
    "8480014": 2,
    "8480028": 1,
    "8480113": 1,
    "8480313": 1,
    "8480802": 1,
    "8480807": 2,
    "8480839": 1,
    "8480860": 1,
    "8481522": 1,
    "8481524": 1,
    "8481559": 1,
    "8481580": 2,
    "8481656": 1,
    "8481716": 1,
    "8482088": 1,
    "8482110": 1,
    "8482148": 1,
    "8482667": 1,
    "8482671": 1,
    "8483468": 2,
    "8483485": 1,
    "8483573": 1,
    "8484145": 1,
    "8484158": 1,
    "8484180": 1,
    "8484186": 1,
    "8484768": 1,
    "8484801": 1
  },
  "updatedAt": {
    "_seconds": 1761382802,
    "_nanoseconds": 384000000
  }
}
```
</details>


### Collection: `defis/1dVeK66kmYiaEaOWSJRx/participations`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `joinedAt` | timestamp | {"_seconds":1761341953,"_nanoseconds":634000000} / {"_seconds":1761341879,"_nanoseconds":584000000} |
| `paid` | boolean | true / true |
| `picks` | array | [{"playerId":8476460,"fullName":"Mark Scheifele","teamAbbr":"WPG"},{"playerId":8477939,"fullName":"W / [{"playerId":8477939,"fullName":"William Nylander","teamAbbr":"TOR"},{"playerId":8476460,"fullName": |
| `paidAt` | timestamp | {"_seconds":1761341953,"_nanoseconds":634000000} / {"_seconds":1761341879,"_nanoseconds":584000000} |
| `paidAmount` | number | 5 / 5 |
| `livePoints` | number | 6 / 5 |
| `liveUpdatedAt` | timestamp | {"_seconds":1761382802,"_nanoseconds":384000000} / {"_seconds":1761382802,"_nanoseconds":384000000} |
| `finalPoints` | number | 6 / 5 |
| `finalizedAt` | timestamp | {"_seconds":1761382805,"_nanoseconds":89000000} / {"_seconds":1761382805,"_nanoseconds":89000000} |
| `payout` | number | 10 / 0 |

### Documents exemples

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx/participations/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "joinedAt": {
    "_seconds": 1761341953,
    "_nanoseconds": 634000000
  },
  "paid": true,
  "picks": [
    {
      "playerId": 8476460,
      "fullName": "Mark Scheifele",
      "teamAbbr": "WPG"
    },
    {
      "playerId": 8477939,
      "fullName": "William Nylander",
      "teamAbbr": "TOR"
    },
    {
      "playerId": 8475166,
      "fullName": "John Tavares",
      "teamAbbr": "TOR"
    },
    {
      "playerId": 8482110,
      "fullName": "Dawson Mercer",
      "teamAbbr": "NJD"
    },
    {
      "playerId": 8481716,
      "fullName": "Dmitri Voronkov",
      "teamAbbr": "CBJ"
    }
  ],
  "paidAt": {
    "_seconds": 1761341953,
    "_nanoseconds": 634000000
  },
  "paidAmount": 5,
  "livePoints": 6,
  "liveUpdatedAt": {
    "_seconds": 1761382802,
    "_nanoseconds": 384000000
  },
  "finalPoints": 6,
  "finalizedAt": {
    "_seconds": 1761382805,
    "_nanoseconds": 89000000
  },
  "payout": 10
}
```
</details>

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx/participations/Ez41QPvDwDNHhd0PziXdN9TK94I3</summary>

```json
{
  "joinedAt": {
    "_seconds": 1761341879,
    "_nanoseconds": 584000000
  },
  "paid": true,
  "picks": [
    {
      "playerId": 8477939,
      "fullName": "William Nylander",
      "teamAbbr": "TOR"
    },
    {
      "playerId": 8476460,
      "fullName": "Mark Scheifele",
      "teamAbbr": "WPG"
    },
    {
      "playerId": 8481656,
      "fullName": "Aliaksei Protas",
      "teamAbbr": "WSH"
    },
    {
      "playerId": 8481559,
      "fullName": "Jack Hughes",
      "teamAbbr": "NJD"
    },
    {
      "playerId": 8484227,
      "fullName": "Will Smith",
      "teamAbbr": "SJS"
    }
  ],
  "paidAt": {
    "_seconds": 1761341879,
    "_nanoseconds": 584000000
  },
  "paidAmount": 5,
  "livePoints": 5,
  "liveUpdatedAt": {
    "_seconds": 1761382802,
    "_nanoseconds": 384000000
  },
  "finalPoints": 5,
  "finalizedAt": {
    "_seconds": 1761382805,
    "_nanoseconds": 89000000
  },
  "payout": 0
}
```
</details>


### Collection: `defis/1dVeK66kmYiaEaOWSJRx/reads`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `lastSeenAt` | timestamp | {"_seconds":1762630940,"_nanoseconds":882000000} / {"_seconds":1761419970,"_nanoseconds":434000000} |
| `lastOpenAt` | timestamp | {"_seconds":1762630940,"_nanoseconds":882000000} / {"_seconds":1761419970,"_nanoseconds":434000000} |

### Documents exemples

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx/reads/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1762630940,
    "_nanoseconds": 882000000
  },
  "lastOpenAt": {
    "_seconds": 1762630940,
    "_nanoseconds": 882000000
  }
}
```
</details>

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx/reads/7lwVnD9GPpe69u70PULIhDZLbGs2</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1761419970,
    "_nanoseconds": 434000000
  },
  "lastOpenAt": {
    "_seconds": 1761419970,
    "_nanoseconds": 434000000
  }
}
```
</details>

<details>
<summary>defis/1dVeK66kmYiaEaOWSJRx/reads/Ez41QPvDwDNHhd0PziXdN9TK94I3</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1761423605,
    "_nanoseconds": 349000000
  },
  "lastOpenAt": {
    "_seconds": 1761423605,
    "_nanoseconds": 349000000
  }
}
```
</details>

<details>
<summary>defis/2025-12-27_5x5_zahmfz</summary>

```json
{
  "createdBy": "xHDk78srTFeR8KbYaZyj8aoCvIC2",
  "defiKey": "2025-12-27_5x5",
  "firstGameUTC": {
    "_seconds": 1766876400,
    "_nanoseconds": 0
  },
  "gameDate": "2025-12-27",
  "groupId": "tOW8mME2gV3JtS1pyHFj",
  "participationCost": 5,
  "signupDeadline": {
    "_seconds": 1766872800,
    "_nanoseconds": 0
  },
  "title": "Défi 5x5",
  "type": 5,
  "createdAt": {
    "_seconds": 1766842690,
    "_nanoseconds": 949000000
  },
  "poolGameDate": "2025-12-27",
  "poolSeasonId": "20252026",
  "poolCount": 150,
  "poolStatus": "ready",
  "poolFrozenAt": {
    "_seconds": 1766842695,
    "_nanoseconds": 643000000
  },
  "novaLockedAt": {
    "_seconds": 1766842742,
    "_nanoseconds": 72000000
  },
  "activatedAt": {
    "_seconds": 1766842784,
    "_nanoseconds": 746000000
  },
  "isActivated": true,
  "participantsCount": 3,
  "pot": 10,
  "winners": [
    "45I3FZACt8OTLN39KeSKq7n545G3"
  ],
  "completedAt": {
    "_seconds": 1766916008,
    "_nanoseconds": 467000000
  },
  "winnerShares": {
    "45I3FZACt8OTLN39KeSKq7n545G3": 10
  },
  "status": "completed",
  "payoutAppliedAt": {
    "_seconds": 1767002406,
    "_nanoseconds": 889000000
  },
  "payoutAppliedVersion": "v3_group_points_2025-12-28",
  "payoutAppliedTo": "group_memberships",
  "updatedAt": {
    "_seconds": 1767002406,
    "_nanoseconds": 889000000
  }
}
```
</details>


### Collection: `defis/2025-12-27_5x5_zahmfz/live`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `playerPoints` | map | {...} |
| `playerPoints.8470621` | number | 1 |
| `playerPoints.8471214` | number | 2 |
| `playerPoints.8471685` | number | 3 |
| `playerPoints.8471817` | number | 1 |
| `playerPoints.8473419` | number | 1 |
| `playerPoints.8473512` | number | 2 |
| `playerPoints.8473604` | number | 1 |
| `playerPoints.8474150` | number | 1 |
| `playerPoints.8474563` | number | 1 |
| `playerPoints.8474716` | number | 1 |
| `playerPoints.8475166` | number | 1 |
| `playerPoints.8475170` | number | 1 |
| `playerPoints.8475191` | number | 1 |
| `playerPoints.8475200` | number | 1 |
| `playerPoints.8475208` | number | 2 |
| `playerPoints.8475287` | number | 1 |
| `playerPoints.8475314` | number | 1 |
| `playerPoints.8475343` | number | 1 |
| `playerPoints.8475455` | number | 1 |
| `playerPoints.8475692` | number | 2 |
| `playerPoints.8475754` | number | 1 |
| `playerPoints.8475764` | number | 1 |
| `playerPoints.8475786` | number | 1 |
| `playerPoints.8475798` | number | 1 |
| `playerPoints.8475906` | number | 1 |
| `playerPoints.8476393` | number | 1 |
| `playerPoints.8476399` | number | 1 |
| `playerPoints.8476453` | number | 2 |
| `playerPoints.8476454` | number | 1 |
| `playerPoints.8476455` | number | 1 |
| `playerPoints.8476460` | number | 2 |
| `playerPoints.8476473` | number | 1 |
| `playerPoints.8476474` | number | 1 |
| `playerPoints.8476624` | number | 1 |
| `playerPoints.8476826` | number | 1 |
| `playerPoints.8476853` | number | 1 |
| `playerPoints.8476879` | number | 1 |
| `playerPoints.8476881` | number | 1 |
| `playerPoints.8476906` | number | 3 |
| `playerPoints.8476921` | number | 1 |
| `playerPoints.8476925` | number | 1 |
| `playerPoints.8476931` | number | 1 |
| `playerPoints.8477015` | number | 1 |
| `playerPoints.8477018` | number | 1 |
| `playerPoints.8477402` | number | 2 |
| `playerPoints.8477404` | number | 1 |
| `playerPoints.8477429` | number | 1 |
| `playerPoints.8477450` | number | 1 |
| `playerPoints.8477456` | number | 1 |
| `playerPoints.8477476` | number | 1 |
| `playerPoints.8477478` | number | 1 |
| `playerPoints.8477479` | number | 2 |
| `playerPoints.8477492` | number | 3 |
| `playerPoints.8477501` | number | 1 |
| `playerPoints.8477503` | number | 3 |
| `playerPoints.8477504` | number | 1 |
| `playerPoints.8477505` | number | 1 |
| `playerPoints.8477933` | number | 1 |
| `playerPoints.8477934` | number | 1 |
| `playerPoints.8477935` | number | 1 |
| `playerPoints.8477939` | number | 1 |
| `playerPoints.8477956` | number | 1 |
| `playerPoints.8477960` | number | 1 |
| `playerPoints.8477964` | number | 1 |
| `playerPoints.8478010` | number | 1 |
| `playerPoints.8478396` | number | 2 |
| `playerPoints.8478398` | number | 2 |
| `playerPoints.8478402` | number | 1 |
| `playerPoints.8478420` | number | 3 |
| `playerPoints.8478427` | number | 1 |
| `playerPoints.8478434` | number | 1 |
| `playerPoints.8478440` | number | 1 |
| `playerPoints.8478462` | number | 1 |
| `playerPoints.8478463` | number | 1 |
| `playerPoints.8478468` | number | 1 |
| `playerPoints.8478483` | number | 1 |
| `playerPoints.8478519` | number | 2 |
| `playerPoints.8478542` | number | 1 |
| `playerPoints.8478856` | number | 2 |
| `playerPoints.8478864` | number | 3 |
| `playerPoints.8478874` | number | 1 |
| `playerPoints.8478970` | number | 1 |
| `playerPoints.8479066` | number | 1 |
| `playerPoints.8479318` | number | 3 |
| `playerPoints.8479345` | number | 1 |
| `playerPoints.8479351` | number | 1 |
| `playerPoints.8479353` | number | 1 |
| `playerPoints.8479370` | number | 1 |
| `playerPoints.8479398` | number | 2 |
| `playerPoints.8479407` | number | 2 |
| `playerPoints.8479420` | number | 2 |
| `playerPoints.8479425` | number | 2 |
| `playerPoints.8479675` | number | 1 |
| `playerPoints.8479980` | number | 2 |
| `playerPoints.8479983` | number | 1 |
| `playerPoints.8479987` | number | 1 |
| `playerPoints.8479992` | number | 1 |
| `playerPoints.8479996` | number | 1 |
| `playerPoints.8480002` | number | 1 |
| `playerPoints.8480014` | number | 2 |
| `playerPoints.8480023` | number | 2 |
| `playerPoints.8480039` | number | 2 |
| `playerPoints.8480064` | number | 1 |
| `playerPoints.8480185` | number | 1 |
| `playerPoints.8480188` | number | 1 |
| `playerPoints.8480208` | number | 1 |
| `playerPoints.8480762` | number | 1 |
| `playerPoints.8480800` | number | 3 |
| `playerPoints.8480801` | number | 1 |
| `playerPoints.8480802` | number | 1 |
| `playerPoints.8480803` | number | 2 |
| `playerPoints.8480807` | number | 3 |
| `playerPoints.8480830` | number | 3 |
| `playerPoints.8480860` | number | 1 |
| `playerPoints.8480873` | number | 1 |
| `playerPoints.8480878` | number | 1 |
| `playerPoints.8480995` | number | 1 |
| `playerPoints.8481024` | number | 1 |
| `playerPoints.8481068` | number | 1 |
| `playerPoints.8481077` | number | 1 |
| `playerPoints.8481522` | number | 2 |
| `playerPoints.8481524` | number | 1 |
| `playerPoints.8481527` | number | 1 |
| `playerPoints.8481528` | number | 1 |
| `playerPoints.8481557` | number | 2 |
| `playerPoints.8481568` | number | 2 |
| `playerPoints.8481582` | number | 2 |
| `playerPoints.8481598` | number | 1 |
| `playerPoints.8481601` | number | 1 |
| `playerPoints.8481606` | number | 2 |
| `playerPoints.8481656` | number | 3 |
| `playerPoints.8481711` | number | 2 |
| `playerPoints.8481719` | number | 1 |
| `playerPoints.8482055` | number | 1 |
| `playerPoints.8482079` | number | 1 |
| `playerPoints.8482092` | number | 1 |
| `playerPoints.8482097` | number | 2 |
| `playerPoints.8482116` | number | 1 |
| `playerPoints.8482124` | number | 2 |
| `playerPoints.8482125` | number | 2 |
| `playerPoints.8482155` | number | 3 |
| `playerPoints.8482172` | number | 1 |
| `playerPoints.8482201` | number | 1 |
| `playerPoints.8482259` | number | 1 |
| `playerPoints.8482667` | number | 2 |
| `playerPoints.8482713` | number | 1 |
| `playerPoints.8482720` | number | 3 |
| `playerPoints.8482730` | number | 2 |
| `playerPoints.8482740` | number | 3 |
| `playerPoints.8482745` | number | 1 |
| `playerPoints.8482768` | number | 1 |
| `playerPoints.8482809` | number | 1 |
| `playerPoints.8482861` | number | 1 |
| `playerPoints.8483398` | number | 1 |
| `playerPoints.8483525` | number | 1 |
| `playerPoints.8483609` | number | 1 |
| `playerPoints.8483676` | number | 2 |
| `playerPoints.8483808` | number | 1 |
| `playerPoints.8484164` | number | 1 |
| `playerPoints.8484223` | number | 1 |
| `playerPoints.8484258` | number | 3 |
| `playerPoints.8484762` | number | 1 |
| `playerPoints.8484783` | number | 1 |
| `playerPoints.8484801` | number | 2 |
| `playerPoints.8484829` | number | 1 |
| `playerPoints.8484911` | number | 1 |
| `playerPoints.8484994` | number | 2 |
| `playerAssists` | map | {...} |
| `playerAssists.8470621` | number | 1 |
| `playerAssists.8471214` | number | 1 |
| `playerAssists.8471685` | number | 3 |
| `playerAssists.8473512` | number | 2 |
| `playerAssists.8473604` | number | 1 |
| `playerAssists.8474150` | number | 1 |
| `playerAssists.8474716` | number | 1 |
| `playerAssists.8475191` | number | 1 |
| `playerAssists.8475200` | number | 1 |
| `playerAssists.8475208` | number | 2 |
| `playerAssists.8475287` | number | 1 |
| `playerAssists.8475343` | number | 1 |
| `playerAssists.8475455` | number | 1 |
| `playerAssists.8475692` | number | 1 |
| `playerAssists.8475754` | number | 1 |
| `playerAssists.8475764` | number | 1 |
| `playerAssists.8475786` | number | 1 |
| `playerAssists.8475798` | number | 1 |
| `playerAssists.8476454` | number | 1 |
| `playerAssists.8476455` | number | 1 |
| `playerAssists.8476460` | number | 1 |
| `playerAssists.8476473` | number | 1 |
| `playerAssists.8476474` | number | 1 |
| `playerAssists.8476624` | number | 1 |
| `playerAssists.8476826` | number | 1 |
| `playerAssists.8476853` | number | 1 |
| `playerAssists.8476879` | number | 1 |
| `playerAssists.8476881` | number | 1 |
| `playerAssists.8476906` | number | 2 |
| `playerAssists.8476931` | number | 1 |
| `playerAssists.8477015` | number | 1 |
| `playerAssists.8477456` | number | 1 |
| `playerAssists.8477478` | number | 1 |
| `playerAssists.8477492` | number | 2 |
| `playerAssists.8477501` | number | 1 |
| `playerAssists.8477503` | number | 3 |
| `playerAssists.8477505` | number | 1 |
| `playerAssists.8477933` | number | 1 |
| `playerAssists.8477934` | number | 1 |
| `playerAssists.8477935` | number | 1 |
| `playerAssists.8477960` | number | 1 |
| `playerAssists.8478010` | number | 1 |
| `playerAssists.8478396` | number | 2 |
| `playerAssists.8478398` | number | 1 |
| `playerAssists.8478420` | number | 2 |
| `playerAssists.8478427` | number | 1 |
| `playerAssists.8478434` | number | 1 |
| `playerAssists.8478440` | number | 1 |
| `playerAssists.8478462` | number | 1 |
| `playerAssists.8478468` | number | 1 |
| `playerAssists.8478483` | number | 1 |
| `playerAssists.8478519` | number | 2 |
| `playerAssists.8478542` | number | 1 |
| `playerAssists.8478856` | number | 2 |
| `playerAssists.8478864` | number | 2 |
| `playerAssists.8478874` | number | 1 |
| `playerAssists.8478970` | number | 1 |
| `playerAssists.8479318` | number | 2 |
| `playerAssists.8479351` | number | 1 |
| `playerAssists.8479398` | number | 1 |
| `playerAssists.8479420` | number | 2 |
| `playerAssists.8479425` | number | 2 |
| `playerAssists.8479980` | number | 2 |
| `playerAssists.8479983` | number | 1 |
| `playerAssists.8479987` | number | 1 |
| `playerAssists.8480002` | number | 1 |
| `playerAssists.8480014` | number | 2 |
| `playerAssists.8480023` | number | 2 |
| `playerAssists.8480188` | number | 1 |
| `playerAssists.8480800` | number | 3 |
| `playerAssists.8480801` | number | 1 |
| `playerAssists.8480803` | number | 1 |
| `playerAssists.8480807` | number | 2 |
| `playerAssists.8480830` | number | 2 |
| `playerAssists.8480860` | number | 1 |
| `playerAssists.8480873` | number | 1 |
| `playerAssists.8481077` | number | 1 |
| `playerAssists.8481522` | number | 1 |
| `playerAssists.8481524` | number | 1 |
| `playerAssists.8481527` | number | 1 |
| `playerAssists.8481528` | number | 1 |
| `playerAssists.8481568` | number | 2 |
| `playerAssists.8481582` | number | 1 |
| `playerAssists.8481598` | number | 1 |
| `playerAssists.8481606` | number | 1 |
| `playerAssists.8481656` | number | 2 |
| `playerAssists.8481711` | number | 2 |
| `playerAssists.8481719` | number | 1 |
| `playerAssists.8482097` | number | 2 |
| `playerAssists.8482124` | number | 1 |
| `playerAssists.8482125` | number | 1 |
| `playerAssists.8482172` | number | 1 |
| `playerAssists.8482201` | number | 1 |
| `playerAssists.8482667` | number | 1 |
| `playerAssists.8482713` | number | 1 |
| `playerAssists.8482720` | number | 1 |
| `playerAssists.8482730` | number | 2 |
| `playerAssists.8482740` | number | 3 |
| `playerAssists.8482861` | number | 1 |
| `playerAssists.8483398` | number | 1 |
| `playerAssists.8483525` | number | 1 |
| `playerAssists.8483609` | number | 1 |
| `playerAssists.8483676` | number | 2 |
| `playerAssists.8483808` | number | 1 |
| `playerAssists.8484164` | number | 1 |
| `playerAssists.8484223` | number | 1 |
| `playerAssists.8484258` | number | 3 |
| `playerAssists.8484762` | number | 1 |
| `playerAssists.8484783` | number | 1 |
| `playerAssists.8484801` | number | 1 |
| `playerAssists.8484994` | number | 1 |
| `playerGoals` | map | {...} |
| `playerGoals.8471214` | number | 1 |
| `playerGoals.8471817` | number | 1 |
| `playerGoals.8473419` | number | 1 |
| `playerGoals.8474563` | number | 1 |
| `playerGoals.8475166` | number | 1 |
| `playerGoals.8475170` | number | 1 |
| `playerGoals.8475314` | number | 1 |
| `playerGoals.8475692` | number | 1 |
| `playerGoals.8475906` | number | 1 |
| `playerGoals.8476393` | number | 1 |
| `playerGoals.8476399` | number | 1 |
| `playerGoals.8476453` | number | 2 |
| `playerGoals.8476460` | number | 1 |
| `playerGoals.8476906` | number | 1 |
| `playerGoals.8476921` | number | 1 |
| `playerGoals.8476925` | number | 1 |
| `playerGoals.8477018` | number | 1 |
| `playerGoals.8477402` | number | 2 |
| `playerGoals.8477404` | number | 1 |
| `playerGoals.8477429` | number | 1 |
| `playerGoals.8477450` | number | 1 |
| `playerGoals.8477476` | number | 1 |
| `playerGoals.8477479` | number | 2 |
| `playerGoals.8477492` | number | 1 |
| `playerGoals.8477504` | number | 1 |
| `playerGoals.8477939` | number | 1 |
| `playerGoals.8477956` | number | 1 |
| `playerGoals.8477964` | number | 1 |
| `playerGoals.8478398` | number | 1 |
| `playerGoals.8478402` | number | 1 |
| `playerGoals.8478420` | number | 1 |
| `playerGoals.8478463` | number | 1 |
| `playerGoals.8478864` | number | 1 |
| `playerGoals.8479066` | number | 1 |
| `playerGoals.8479318` | number | 1 |
| `playerGoals.8479345` | number | 1 |
| `playerGoals.8479353` | number | 1 |
| `playerGoals.8479370` | number | 1 |
| `playerGoals.8479398` | number | 1 |
| `playerGoals.8479407` | number | 2 |
| `playerGoals.8479675` | number | 1 |
| `playerGoals.8479992` | number | 1 |
| `playerGoals.8479996` | number | 1 |
| `playerGoals.8480039` | number | 2 |
| `playerGoals.8480064` | number | 1 |
| `playerGoals.8480185` | number | 1 |
| `playerGoals.8480208` | number | 1 |
| `playerGoals.8480762` | number | 1 |
| `playerGoals.8480802` | number | 1 |
| `playerGoals.8480803` | number | 1 |
| `playerGoals.8480807` | number | 1 |
| `playerGoals.8480830` | number | 1 |
| `playerGoals.8480878` | number | 1 |
| `playerGoals.8480995` | number | 1 |
| `playerGoals.8481024` | number | 1 |
| `playerGoals.8481068` | number | 1 |
| `playerGoals.8481522` | number | 1 |
| `playerGoals.8481557` | number | 2 |
| `playerGoals.8481582` | number | 1 |
| `playerGoals.8481601` | number | 1 |
| `playerGoals.8481606` | number | 1 |
| `playerGoals.8481656` | number | 1 |
| `playerGoals.8482055` | number | 1 |
| `playerGoals.8482079` | number | 1 |
| `playerGoals.8482092` | number | 1 |
| `playerGoals.8482116` | number | 1 |
| `playerGoals.8482124` | number | 1 |
| `playerGoals.8482125` | number | 1 |
| `playerGoals.8482155` | number | 3 |
| `playerGoals.8482259` | number | 1 |
| `playerGoals.8482667` | number | 1 |
| `playerGoals.8482720` | number | 2 |
| `playerGoals.8482745` | number | 1 |
| `playerGoals.8482768` | number | 1 |
| `playerGoals.8482809` | number | 1 |
| `playerGoals.8484801` | number | 1 |
| `playerGoals.8484829` | number | 1 |
| `playerGoals.8484911` | number | 1 |
| `playerGoals.8484994` | number | 1 |
| `updatedAt` | timestamp | {"_seconds":1766916006,"_nanoseconds":80000000} |

### Documents exemples

<details>
<summary>defis/2025-12-27_5x5_zahmfz/live/stats</summary>

```json
{
  "playerPoints": {
    "8470621": 1,
    "8471214": 2,
    "8471685": 3,
    "8471817": 1,
    "8473419": 1,
    "8473512": 2,
    "8473604": 1,
    "8474150": 1,
    "8474563": 1,
    "8474716": 1,
    "8475166": 1,
    "8475170": 1,
    "8475191": 1,
    "8475200": 1,
    "8475208": 2,
    "8475287": 1,
    "8475314": 1,
    "8475343": 1,
    "8475455": 1,
    "8475692": 2,
    "8475754": 1,
    "8475764": 1,
    "8475786": 1,
    "8475798": 1,
    "8475906": 1,
    "8476393": 1,
    "8476399": 1,
    "8476453": 2,
    "8476454": 1,
    "8476455": 1,
    "8476460": 2,
    "8476473": 1,
    "8476474": 1,
    "8476624": 1,
    "8476826": 1,
    "8476853": 1,
    "8476879": 1,
    "8476881": 1,
    "8476906": 3,
    "8476921": 1,
    "8476925": 1,
    "8476931": 1,
    "8477015": 1,
    "8477018": 1,
    "8477402": 2,
    "8477404": 1,
    "8477429": 1,
    "8477450": 1,
    "8477456": 1,
    "8477476": 1,
    "8477478": 1,
    "8477479": 2,
    "8477492": 3,
    "8477501": 1,
    "8477503": 3,
    "8477504": 1,
    "8477505": 1,
    "8477933": 1,
    "8477934": 1,
    "8477935": 1,
    "8477939": 1,
    "8477956": 1,
    "8477960": 1,
    "8477964": 1,
    "8478010": 1,
    "8478396": 2,
    "8478398": 2,
    "8478402": 1,
    "8478420": 3,
    "8478427": 1,
    "8478434": 1,
    "8478440": 1,
    "8478462": 1,
    "8478463": 1,
    "8478468": 1,
    "8478483": 1,
    "8478519": 2,
    "8478542": 1,
    "8478856": 2,
    "8478864": 3,
    "8478874": 1,
    "8478970": 1,
    "8479066": 1,
    "8479318": 3,
    "8479345": 1,
    "8479351": 1,
    "8479353": 1,
    "8479370": 1,
    "8479398": 2,
    "8479407": 2,
    "8479420": 2,
    "8479425": 2,
    "8479675": 1,
    "8479980": 2,
    "8479983": 1,
    "8479987": 1,
    "8479992": 1,
    "8479996": 1,
    "8480002": 1,
    "8480014": 2,
    "8480023": 2,
    "8480039": 2,
    "8480064": 1,
    "8480185": 1,
    "8480188": 1,
    "8480208": 1,
    "8480762": 1,
    "8480800": 3,
    "8480801": 1,
    "8480802": 1,
    "8480803": 2,
    "8480807": 3,
    "8480830": 3,
    "8480860": 1,
    "8480873": 1,
    "8480878": 1,
    "8480995": 1,
    "8481024": 1,
    "8481068": 1,
    "8481077": 1,
    "8481522": 2,
    "8481524": 1,
    "8481527": 1,
    "8481528": 1,
    "8481557": 2,
    "8481568": 2,
    "8481582": 2,
    "8481598": 1,
    "8481601": 1,
    "8481606": 2,
    "8481656": 3,
    "8481711": 2,
    "8481719": 1,
    "8482055": 1,
    "8482079": 1,
    "8482092": 1,
    "8482097": 2,
    "8482116": 1,
    "8482124": 2,
    "8482125": 2,
    "8482155": 3,
    "8482172": 1,
    "8482201": 1,
    "8482259": 1,
    "8482667": 2,
    "8482713": 1,
    "8482720": 3,
    "8482730": 2,
    "8482740": 3,
    "8482745": 1,
    "8482768": 1,
    "8482809": 1,
    "8482861": 1,
    "8483398": 1,
    "8483525": 1,
    "8483609": 1,
    "8483676": 2,
    "8483808": 1,
    "8484164": 1,
    "8484223": 1,
    "8484258": 3,
    "8484762": 1,
    "8484783": 1,
    "8484801": 2,
    "8484829": 1,
    "8484911": 1,
    "8484994": 2
  },
  "playerAssists": {
    "8470621": 1,
    "8471214": 1,
    "8471685": 3,
    "8473512": 2,
    "8473604": 1,
    "8474150": 1,
    "8474716": 1,
    "8475191": 1,
    "8475200": 1,
    "8475208": 2,
    "8475287": 1,
    "8475343": 1,
    "8475455": 1,
    "8475692": 1,
    "8475754": 1,
    "8475764": 1,
    "8475786": 1,
    "8475798": 1,
    "8476454": 1,
    "8476455": 1,
    "8476460": 1,
    "8476473": 1,
    "8476474": 1,
    "8476624": 1,
    "8476826": 1,
    "8476853": 1,
    "8476879": 1,
    "8476881": 1,
    "8476906": 2,
    "8476931": 1,
    "8477015": 1,
    "8477456": 1,
    "8477478": 1,
    "8477492": 2,
    "8477501": 1,
    "8477503": 3,
    "8477505": 1,
    "8477933": 1,
    "8477934": 1,
    "8477935": 1,
    "8477960": 1,
    "8478010": 1,
    "8478396": 2,
    "8478398": 1,
    "8478420": 2,
    "8478427": 1,
    "8478434": 1,
    "8478440": 1,
    "8478462": 1,
    "8478468": 1,
    "8478483": 1,
    "8478519": 2,
    "8478542": 1,
    "8478856": 2,
    "8478864": 2,
    "8478874": 1,
    "8478970": 1,
    "8479318": 2,
    "8479351": 1,
    "8479398": 1,
    "8479420": 2,
    "8479425": 2,
    "8479980": 2,
    "8479983": 1,
    "8479987": 1,
    "8480002": 1,
    "8480014": 2,
    "8480023": 2,
    "8480188": 1,
    "8480800": 3,
    "8480801": 1,
    "8480803": 1,
    "8480807": 2,
    "8480830": 2,
    "8480860": 1,
    "8480873": 1,
    "8481077": 1,
    "8481522": 1,
    "8481524": 1,
    "8481527": 1,
    "8481528": 1,
    "8481568": 2,
    "8481582": 1,
    "8481598": 1,
    "8481606": 1,
    "8481656": 2,
    "8481711": 2,
    "8481719": 1,
    "8482097": 2,
    "8482124": 1,
    "8482125": 1,
    "8482172": 1,
    "8482201": 1,
    "8482667": 1,
    "8482713": 1,
    "8482720": 1,
    "8482730": 2,
    "8482740": 3,
    "8482861": 1,
    "8483398": 1,
    "8483525": 1,
    "8483609": 1,
    "8483676": 2,
    "8483808": 1,
    "8484164": 1,
    "8484223": 1,
    "8484258": 3,
    "8484762": 1,
    "8484783": 1,
    "8484801": 1,
    "8484994": 1
  },
  "playerGoals": {
    "8471214": 1,
    "8471817": 1,
    "8473419": 1,
    "8474563": 1,
    "8475166": 1,
    "8475170": 1,
    "8475314": 1,
    "8475692": 1,
    "8475906": 1,
    "8476393": 1,
    "8476399": 1,
    "8476453": 2,
    "8476460": 1,
    "8476906": 1,
    "8476921": 1,
    "8476925": 1,
    "8477018": 1,
    "8477402": 2,
    "8477404": 1,
    "8477429": 1,
    "8477450": 1,
    "8477476": 1,
    "8477479": 2,
    "8477492": 1,
    "8477504": 1,
    "8477939": 1,
    "8477956": 1,
    "8477964": 1,
    "8478398": 1,
    "8478402": 1,
    "8478420": 1,
    "8478463": 1,
    "8478864": 1,
    "8479066": 1,
    "8479318": 1,
    "8479345": 1,
    "8479353": 1,
    "8479370": 1,
    "8479398": 1,
    "8479407": 2,
    "8479675": 1,
    "8479992": 1,
    "8479996": 1,
    "8480039": 2,
    "8480064": 1,
    "8480185": 1,
    "8480208": 1,
    "8480762": 1,
    "8480802": 1,
    "8480803": 1,
    "8480807": 1,
    "8480830": 1,
    "8480878": 1,
    "8480995": 1,
    "8481024": 1,
    "8481068": 1,
    "8481522": 1,
    "8481557": 2,
    "8481582": 1,
    "8481601": 1,
    "8481606": 1,
    "8481656": 1,
    "8482055": 1,
    "8482079": 1,
    "8482092": 1,
    "8482116": 1,
    "8482124": 1,
    "8482125": 1,
    "8482155": 3,
    "8482259": 1,
    "8482667": 1,
    "8482720": 2,
    "8482745": 1,
    "8482768": 1,
    "8482809": 1,
    "8484801": 1,
    "8484829": 1,
    "8484911": 1,
    "8484994": 1
  },
  "updatedAt": {
    "_seconds": 1766916006,
    "_nanoseconds": 80000000
  }
}
```
</details>


### Collection: `defis/2025-12-27_5x5_zahmfz/participations`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `joinedAt` | timestamp | {"_seconds":1766842981,"_nanoseconds":49000000} / {"_seconds":1766842742,"_nanoseconds":72000000} |
| `paid` | boolean | true / false |
| `picks` | array | [{"teamAbbr":"EDM","playerId":"8477934","fullName":"Leon Draisaitl"},{"fullName":"Kirill Kaprizov"," / [{"pointsPerGame":1.76315,"fullName":"Connor McDavid","points":67,"coeff":0.92,"tier":"T1","rank":1, |
| `paidAt` | timestamp | {"_seconds":1766842981,"_nanoseconds":49000000} / {"_seconds":1766842783,"_nanoseconds":599000000} |
| `paidAmount` | number | 5 / 0 |
| `lastMutationId` | null | null / null |
| `updatedAt` | timestamp | {"_seconds":1766842981,"_nanoseconds":49000000} / {"_seconds":1766842742,"_nanoseconds":72000000} |
| `livePoints` | number | 8 / 4 |
| `liveUpdatedAt` | timestamp | {"_seconds":1766916006,"_nanoseconds":80000000} / {"_seconds":1766916006,"_nanoseconds":80000000} |
| `finalPoints` | number | 8 / 4 |
| `payout` | number | 10 / 0 |
| `finalizedAt` | timestamp | {"_seconds":1767002406,"_nanoseconds":889000000} / {"_seconds":1767002406,"_nanoseconds":889000000} |
| `type` | string | "ai" |
| `uid` | string | "ai" |

### Documents exemples

<details>
<summary>defis/2025-12-27_5x5_zahmfz/participations/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "joinedAt": {
    "_seconds": 1766842981,
    "_nanoseconds": 49000000
  },
  "paid": true,
  "picks": [
    {
      "teamAbbr": "EDM",
      "playerId": "8477934",
      "fullName": "Leon Draisaitl"
    },
    {
      "fullName": "Kirill Kaprizov",
      "teamAbbr": "MIN",
      "playerId": "8478864"
    },
    {
      "fullName": "Matt Boldy",
      "playerId": "8481557",
      "teamAbbr": "MIN"
    },
    {
      "teamAbbr": "OTT",
      "fullName": "Tim Stützle",
      "playerId": "8482116"
    },
    {
      "teamAbbr": "BOS",
      "fullName": "Morgan Geekie",
      "playerId": "8479987"
    }
  ],
  "paidAt": {
    "_seconds": 1766842981,
    "_nanoseconds": 49000000
  },
  "paidAmount": 5,
  "lastMutationId": null,
  "updatedAt": {
    "_seconds": 1766842981,
    "_nanoseconds": 49000000
  },
  "livePoints": 8,
  "liveUpdatedAt": {
    "_seconds": 1766916006,
    "_nanoseconds": 80000000
  },
  "finalPoints": 8,
  "payout": 10,
  "finalizedAt": {
    "_seconds": 1767002406,
    "_nanoseconds": 889000000
  }
}
```
</details>

<details>
<summary>defis/2025-12-27_5x5_zahmfz/participations/ai</summary>

```json
{
  "paid": false,
  "paidAmount": 0,
  "type": "ai",
  "uid": "ai",
  "picks": [
    {
      "pointsPerGame": 1.76315,
      "fullName": "Connor McDavid",
      "points": 67,
      "coeff": 0.92,
      "tier": "T1",
      "rank": 1,
      "playerId": "8478402",
      "scoreNovaBase": 1.622098,
      "injury": null,
      "reliability": 0,
      "teamAbbr": "EDM"
    },
    {
      "teamAbbr": "VGK",
      "pointsPerGame": 1.32258,
      "points": 41,
      "scoreNovaBase": 1.276554216,
      "playerId": "8478403",
      "reliability": 0,
      "coeff": 0.9652,
      "rank": 17,
      "injury": {
        "startDate": "2025-12-16",
        "source": "sportradar",
        "description": "Eichel did not play on Tuesday's (Dec. 23) game versus the Sharks.",
        "status": "DayToDay",
        "expectedReturn": null,
        "updatedDate": "2025-12-24",
        "updatedAt": {
          "_seconds": 1766757605,
          "_nanoseconds": 928000000
        },
        "short": "Illness"
      },
      "fullName": "Jack Eichel",
      "tier": "T2"
    },
    {
      "coeff": 0.9637,
      "teamAbbr": "WPG",
      "fullName": "Kyle Connor",
      "rank": 12,
      "injury": null,
      "scoreNovaBase": 1.183972909,
      "pointsPerGame": 1.22857,
      "points": 43,
      "tier": "T2",
      "reliability": 0,
      "playerId": "8478398"
    },
    {
      "points": 29,
      "fullName": "Mark Stone",
      "pointsPerGame": 1.52631,
      "injury": null,
      "teamAbbr": "VGK",
      "scoreNovaBase": 1.47288915,
      "rank": 55,
      "tier": "T3",
      "playerId": "8475913",
      "reliability": 0,
      "coeff": 0.965
    },
    {
      "points": 40,
      "injury": null,
      "coeff": 0.9621,
      "scoreNovaBase": 1.2026249999999998,
      "rank": 22,
      "playerId": "8477939",
      "tier": "T3",
      "pointsPerGame": 1.25,
      "fullName": "William Nylander",
      "reliability": 0,
      "teamAbbr": "TOR"
    }
  ],
  "joinedAt": {
    "_seconds": 1766842742,
    "_nanoseconds": 72000000
  },
  "updatedAt": {
    "_seconds": 1766842742,
    "_nanoseconds": 72000000
  },
  "livePoints": 4,
  "liveUpdatedAt": {
    "_seconds": 1766916006,
    "_nanoseconds": 80000000
  },
  "finalPoints": 4,
  "payout": 0,
  "finalizedAt": {
    "_seconds": 1767002406,
    "_nanoseconds": 889000000
  }
}
```
</details>

<details>
<summary>defis/2025-12-27_5x5_zahmfz/participations/xHDk78srTFeR8KbYaZyj8aoCvIC2</summary>

```json
{
  "joinedAt": {
    "_seconds": 1766842783,
    "_nanoseconds": 599000000
  },
  "paid": true,
  "picks": [
    {
      "playerId": "8478402",
      "fullName": "Connor McDavid",
      "teamAbbr": "EDM"
    },
    {
      "fullName": "Kyle Connor",
      "teamAbbr": "WPG",
      "playerId": "8478398"
    },
    {
      "teamAbbr": "DAL",
      "playerId": "8482740",
      "fullName": "Wyatt Johnston"
    },
    {
      "teamAbbr": "TOR",
      "playerId": "8477939",
      "fullName": "William Nylander"
    },
    {
      "teamAbbr": "NYR",
      "playerId": "8478550",
      "fullName": "Artemi Panarin"
    }
  ],
  "paidAt": {
    "_seconds": 1766842783,
    "_nanoseconds": 599000000
  },
  "paidAmount": 5,
  "lastMutationId": null,
  "updatedAt": {
    "_seconds": 1766842783,
    "_nanoseconds": 599000000
  },
  "livePoints": 7,
  "liveUpdatedAt": {
    "_seconds": 1766916006,
    "_nanoseconds": 80000000
  },
  "finalPoints": 7,
  "payout": 0,
  "finalizedAt": {
    "_seconds": 1767002406,
    "_nanoseconds": 889000000
  }
}
```
</details>


### Collection: `defis/2025-12-27_5x5_zahmfz/playerPool`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `defense` | null | null / null |
| `positionCode` | string | "D" / "L" |
| `gameDateYmd` | string | "2025-12-27" / "2025-12-27" |
| `teamAbbr` | string | "COL" / "WSH" |
| `shN` | null | null / null |
| `coeff_v` | string | "v2_df" / "v2_df" |
| `gamesPlayed` | number | 36 / 37 |
| `assists` | number | 14 / 17 |
| `scoreNovaBase` | number | 0.593266257 / 0.84118132 |
| `talent` | null | null / null |
| `tier` | string | "T3" / "T3" |
| `reliability` | number | 0 / 0 |
| `injury` | null | null / null |
| `goals` | number | 5 / 14 |
| `rank` | number | 133 / 40 |
| `playerId` | string | "8470613" / "8471214" |
| `seasonId` | string | "20252026" / "20252026" |
| `ppgN` | null | null / null |
| `fullName` | string | "Brent Burns" / "Alex Ovechkin" |
| `points` | number | 19 / 31 |
| `pointsPerGame` | number | 0.52777 / 0.83783 |
| `coeff` | number | 1.1241 / 1.004 |
| `createdAt` | timestamp | {"_seconds":1766842695,"_nanoseconds":643000000} / {"_seconds":1766842695,"_nanoseconds":643000000} |

### Documents exemples

<details>
<summary>defis/2025-12-27_5x5_zahmfz/playerPool/8470613</summary>

```json
{
  "defense": null,
  "positionCode": "D",
  "gameDateYmd": "2025-12-27",
  "teamAbbr": "COL",
  "shN": null,
  "coeff_v": "v2_df",
  "gamesPlayed": 36,
  "assists": 14,
  "scoreNovaBase": 0.593266257,
  "talent": null,
  "tier": "T3",
  "reliability": 0,
  "injury": null,
  "goals": 5,
  "rank": 133,
  "playerId": "8470613",
  "seasonId": "20252026",
  "ppgN": null,
  "fullName": "Brent Burns",
  "points": 19,
  "pointsPerGame": 0.52777,
  "coeff": 1.1241,
  "createdAt": {
    "_seconds": 1766842695,
    "_nanoseconds": 643000000
  }
}
```
</details>

<details>
<summary>defis/2025-12-27_5x5_zahmfz/playerPool/8471214</summary>

```json
{
  "gameDateYmd": "2025-12-27",
  "coeff": 1.004,
  "fullName": "Alex Ovechkin",
  "reliability": 0,
  "talent": null,
  "defense": null,
  "positionCode": "L",
  "teamAbbr": "WSH",
  "coeff_v": "v2_df",
  "ppgN": null,
  "rank": 40,
  "scoreNovaBase": 0.84118132,
  "assists": 17,
  "shN": null,
  "injury": null,
  "points": 31,
  "pointsPerGame": 0.83783,
  "playerId": "8471214",
  "goals": 14,
  "tier": "T3",
  "seasonId": "20252026",
  "gamesPlayed": 37,
  "createdAt": {
    "_seconds": 1766842695,
    "_nanoseconds": 643000000
  }
}
```
</details>

<details>
<summary>defis/2025-12-27_5x5_zahmfz/playerPool/8473419</summary>

```json
{
  "shN": null,
  "fullName": "Brad Marchand",
  "rank": 16,
  "goals": 20,
  "points": 41,
  "pointsPerGame": 1.17142,
  "teamAbbr": "FLA",
  "tier": "T2",
  "seasonId": "20252026",
  "coeff": 0.9592,
  "positionCode": "C",
  "gameDateYmd": "2025-12-27",
  "ppgN": null,
  "playerId": "8473419",
  "reliability": 0,
  "injury": null,
  "scoreNovaBase": 1.123626064,
  "coeff_v": "v2_df",
  "gamesPlayed": 35,
  "defense": null,
  "talent": null,
  "assists": 21,
  "createdAt": {
    "_seconds": 1766842695,
    "_nanoseconds": 643000000
  }
}
```
</details>


### Collection: `defis/2025-12-27_5x5_zahmfz/reads`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `lastSeenAt` | timestamp | {"_seconds":1766843025,"_nanoseconds":161000000} / {"_seconds":1766928671,"_nanoseconds":38000000} |
| `lastOpenAt` | timestamp | {"_seconds":1766843025,"_nanoseconds":161000000} / {"_seconds":1766928671,"_nanoseconds":38000000} |

### Documents exemples

<details>
<summary>defis/2025-12-27_5x5_zahmfz/reads/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1766843025,
    "_nanoseconds": 161000000
  },
  "lastOpenAt": {
    "_seconds": 1766843025,
    "_nanoseconds": 161000000
  }
}
```
</details>

<details>
<summary>defis/2025-12-27_5x5_zahmfz/reads/xHDk78srTFeR8KbYaZyj8aoCvIC2</summary>

```json
{
  "lastSeenAt": {
    "_seconds": 1766928671,
    "_nanoseconds": 38000000
  },
  "lastOpenAt": {
    "_seconds": 1766928671,
    "_nanoseconds": 38000000
  }
}
```
</details>


## Collection: `entitlements`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `source` | string | "revenuecat" / "mvp_default" |
| `tiers` | map | {...} / {...} |
| `tiers.pro` | map | {...} / {...} |
| `tiers.pro.active` | boolean | false / false |
| `tiers.vip` | map | {...} / {...} |
| `tiers.vip.expiresAtMs` | number | 1770380848175 / 1770315788625 |
| `tiers.vip.lastEventType` | string | "EXPIRATION" / "EXPIRATION" |
| `tiers.vip.updatedAtMs` | number | 1770380875188 / 1770315811995 |
| `tiers.vip.active` | boolean | false / false |
| `tiers.vip.lastEventId` | string | "F39ACD53-05F5-41F8-BAF5-8D900E782CC9" / "72C14DBD-9252-419E-B889-FE79652D1710" |
| `expiresAt` | null | null / null |
| `lastEventType` | string | "CANCELLATION" / "CANCELLATION" |
| `lastEventId` | string | "0AC107FE-0536-48C5-8768-9560BFE58DA4" / "8FFE4281-692F-423A-BC5B-8AA410102755" |
| `updatedAt` | timestamp | {"_seconds":1770380877,"_nanoseconds":136000000} / {"_seconds":1773584655,"_nanoseconds":443000000} |
| `tier` | string | "vip" / "vip" |
| `active` | boolean | true / true |
| `createdAt` | timestamp | {"_seconds":1773584655,"_nanoseconds":443000000} |
| `tiers.pro.expiresAtMs` | number | 1770079413921 |
| `tiers.pro.lastEventType` | string | "EXPIRATION" |
| `tiers.pro.updatedAtMs` | number | 1770079446031 |
| `tiers.pro.lastEventId` | string | "A55FEC19-6CBF-40B6-9CA4-7A00423FCB74" |

### Documents exemples

<details>
<summary>entitlements/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "source": "revenuecat",
  "tiers": {
    "pro": {
      "active": false
    },
    "vip": {
      "expiresAtMs": 1770380848175,
      "lastEventType": "EXPIRATION",
      "updatedAtMs": 1770380875188,
      "active": false,
      "lastEventId": "F39ACD53-05F5-41F8-BAF5-8D900E782CC9"
    }
  },
  "expiresAt": null,
  "lastEventType": "CANCELLATION",
  "lastEventId": "0AC107FE-0536-48C5-8768-9560BFE58DA4",
  "updatedAt": {
    "_seconds": 1770380877,
    "_nanoseconds": 136000000
  },
  "tier": "vip",
  "active": true
}
```
</details>

<details>
<summary>entitlements/EhlsoU4xnRWJTjIurwnYUN6y6xr1</summary>

```json
{
  "createdAt": {
    "_seconds": 1773584655,
    "_nanoseconds": 443000000
  },
  "tier": "vip",
  "active": true,
  "source": "mvp_default",
  "updatedAt": {
    "_seconds": 1773584655,
    "_nanoseconds": 443000000
  }
}
```
</details>

<details>
<summary>entitlements/Ez41QPvDwDNHhd0PziXdN9TK94I3</summary>

```json
{
  "uid": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "source": "revenuecat",
  "tiers": {
    "pro": {
      "expiresAtMs": 1770079413921,
      "lastEventType": "EXPIRATION",
      "updatedAtMs": 1770079446031,
      "active": false,
      "lastEventId": "A55FEC19-6CBF-40B6-9CA4-7A00423FCB74"
    },
    "vip": {
      "expiresAtMs": 1770315788625,
      "lastEventType": "EXPIRATION",
      "updatedAtMs": 1770315811995,
      "active": false,
      "lastEventId": "72C14DBD-9252-419E-B889-FE79652D1710"
    }
  },
  "expiresAt": null,
  "lastEventType": "CANCELLATION",
  "lastEventId": "8FFE4281-692F-423A-BC5B-8AA410102755",
  "updatedAt": {
    "_seconds": 1770315813,
    "_nanoseconds": 938000000
  },
  "tier": "vip",
  "active": true
}
```
</details>


## Collection: `first_goal_challenges`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `awayAbbr` | string | "NYI" / "OTT" |
| `createdBy` | string | "Ez41QPvDwDNHhd0PziXdN9TK94I3" / "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `expiresAt` | timestamp | {"_seconds":1772315930,"_nanoseconds":432000000} / {"_seconds":1772491282,"_nanoseconds":951000000} |
| `firstGoal` | map | {...} / {...} |
| `firstGoal.confirmedAt` | null, timestamp | null / {"_seconds":1772324765,"_nanoseconds":103000000} |
| `firstGoal.goalTime` | null, string | null / "02:52" |
| `firstGoal.playerId` | null, string | null / "8476853" |
| `firstGoal.playerName` | null, string | null / "Morgan Rielly" |
| `firstGoal.teamAbbr` | null, string | null / "TOR" |
| `gameId` | string | "2025020919" / "2025020939" |
| `gameStartTimeUTC` | timestamp | {"_seconds":1772150400,"_nanoseconds":0} / {"_seconds":1772323200,"_nanoseconds":0} |
| `gameYmd` | string | "2026-02-26" / "2026-02-28" |
| `groupId` | string | "65zw10b11xwq8rq4" / "elG2NVeHCtS4NTmFkcU0" |
| `homeAbbr` | string | "MTL" / "TOR" |
| `league` | string | "NHL" / "NHL" |
| `participantsCount` | number | 0 / 3 |
| `type` | string | "first_goal" / "first_goal" |
| `createdAt` | timestamp | {"_seconds":1772143130,"_nanoseconds":639000000} / {"_seconds":1772318483,"_nanoseconds":65000000} |
| `lockedAt` | timestamp | {"_seconds":1772150112,"_nanoseconds":261000000} / {"_seconds":1772322904,"_nanoseconds":856000000} |
| `status` | string | "locked" / "decided" |
| `updatedAt` | timestamp | {"_seconds":1772150112,"_nanoseconds":261000000} / {"_seconds":1772324765,"_nanoseconds":103000000} |
| `decidedAt` | timestamp | {"_seconds":1772324765,"_nanoseconds":103000000} / {"_seconds":1772164941,"_nanoseconds":764000000} |
| `resultMessage` | string | "Premier but confirmé. Résultats disponibles." / "Premier but confirmé. Résultats disponibles." |
| `winnersPreviewUids` | array | [] / [] |
| `winnersCount` | number | 0 / 0 |

### Documents exemples

<details>
<summary>first_goal_challenges/EtHZnRBKb5ZiimnOSBtQ</summary>

```json
{
  "awayAbbr": "NYI",
  "createdBy": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "expiresAt": {
    "_seconds": 1772315930,
    "_nanoseconds": 432000000
  },
  "firstGoal": {
    "confirmedAt": null,
    "goalTime": null,
    "playerId": null,
    "playerName": null,
    "teamAbbr": null
  },
  "gameId": "2025020919",
  "gameStartTimeUTC": {
    "_seconds": 1772150400,
    "_nanoseconds": 0
  },
  "gameYmd": "2026-02-26",
  "groupId": "65zw10b11xwq8rq4",
  "homeAbbr": "MTL",
  "league": "NHL",
  "participantsCount": 0,
  "type": "first_goal",
  "createdAt": {
    "_seconds": 1772143130,
    "_nanoseconds": 639000000
  },
  "lockedAt": {
    "_seconds": 1772150112,
    "_nanoseconds": 261000000
  },
  "status": "locked",
  "updatedAt": {
    "_seconds": 1772150112,
    "_nanoseconds": 261000000
  }
}
```
</details>

<details>
<summary>first_goal_challenges/JhPdfJ0lLbsuQ1S4w2bp</summary>

```json
{
  "awayAbbr": "OTT",
  "createdBy": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "expiresAt": {
    "_seconds": 1772491282,
    "_nanoseconds": 951000000
  },
  "gameId": "2025020939",
  "gameStartTimeUTC": {
    "_seconds": 1772323200,
    "_nanoseconds": 0
  },
  "gameYmd": "2026-02-28",
  "groupId": "elG2NVeHCtS4NTmFkcU0",
  "homeAbbr": "TOR",
  "league": "NHL",
  "type": "first_goal",
  "createdAt": {
    "_seconds": 1772318483,
    "_nanoseconds": 65000000
  },
  "participantsCount": 3,
  "lockedAt": {
    "_seconds": 1772322904,
    "_nanoseconds": 856000000
  },
  "firstGoal": {
    "playerName": "Morgan Rielly",
    "goalTime": "02:52",
    "teamAbbr": "TOR",
    "confirmedAt": {
      "_seconds": 1772324765,
      "_nanoseconds": 103000000
    },
    "playerId": "8476853"
  },
  "decidedAt": {
    "_seconds": 1772324765,
    "_nanoseconds": 103000000
  },
  "resultMessage": "Premier but confirmé. Résultats disponibles.",
  "winnersPreviewUids": [],
  "winnersCount": 0,
  "status": "decided",
  "updatedAt": {
    "_seconds": 1772324765,
    "_nanoseconds": 103000000
  }
}
```
</details>


### Collection: `first_goal_challenges/JhPdfJ0lLbsuQ1S4w2bp/entries`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `playerName` | string | "Tim Stützle" / "Jake Sanderson" |
| `avatarUrl` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA15.png / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png? |
| `displayName` | string | "Nathalie" / "Liam" |
| `headshotUrl` | string | "https://assets.nhle.com/mugs/nhl/20252026/OTT/8482116.png" / "https://assets.nhle.com/mugs/nhl/20252026/OTT/8482105.png" |
| `positionCode` | string | "C" / "D" |
| `teamAbbr` | string | "OTT" / "OTT" |
| `playerId` | string | "8482116" / "8482105" |
| `updatedAt` | timestamp | {"_seconds":1772318592,"_nanoseconds":677000000} / {"_seconds":1772318525,"_nanoseconds":704000000} |

### Documents exemples

<details>
<summary>first_goal_challenges/JhPdfJ0lLbsuQ1S4w2bp/entries/45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "playerName": "Tim Stützle",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA15.png?alt=media&token=86f4b01c-366f-466d-a637-bda9ccfe2fef",
  "displayName": "Nathalie",
  "headshotUrl": "https://assets.nhle.com/mugs/nhl/20252026/OTT/8482116.png",
  "positionCode": "C",
  "teamAbbr": "OTT",
  "playerId": "8482116",
  "updatedAt": {
    "_seconds": 1772318592,
    "_nanoseconds": 677000000
  }
}
```
</details>

<details>
<summary>first_goal_challenges/JhPdfJ0lLbsuQ1S4w2bp/entries/Ez41QPvDwDNHhd0PziXdN9TK94I3</summary>

```json
{
  "uid": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png?alt=media&token=9673946f-4bcc-4507-a7ee-6ff8f7fb56dd",
  "playerName": "Jake Sanderson",
  "displayName": "Liam",
  "headshotUrl": "https://assets.nhle.com/mugs/nhl/20252026/OTT/8482105.png",
  "positionCode": "D",
  "teamAbbr": "OTT",
  "playerId": "8482105",
  "updatedAt": {
    "_seconds": 1772318525,
    "_nanoseconds": 704000000
  }
}
```
</details>

<details>
<summary>first_goal_challenges/JhPdfJ0lLbsuQ1S4w2bp/entries/xHDk78srTFeR8KbYaZyj8aoCvIC2</summary>

```json
{
  "uid": "xHDk78srTFeR8KbYaZyj8aoCvIC2",
  "playerName": "Auston Matthews",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA5.png?alt=media&token=00eb6bbf-bdb0-492a-b7ae-9140939abb97",
  "displayName": "Gabriel",
  "headshotUrl": "https://assets.nhle.com/mugs/nhl/20252026/TOR/8479318.png",
  "positionCode": "C",
  "teamAbbr": "TOR",
  "playerId": "8479318",
  "updatedAt": {
    "_seconds": 1772318559,
    "_nanoseconds": 777000000
  }
}
```
</details>

<details>
<summary>first_goal_challenges/PHts0jjYbOi4uYy9L0N0</summary>

```json
{
  "awayAbbr": "EDM",
  "createdBy": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "expiresAt": {
    "_seconds": 1772330227,
    "_nanoseconds": 872000000
  },
  "gameId": "2025020929",
  "gameStartTimeUTC": {
    "_seconds": 1772163000,
    "_nanoseconds": 0
  },
  "gameYmd": "2026-02-26",
  "groupId": "ctzdscog11kfapoq",
  "homeAbbr": "LAK",
  "league": "NHL",
  "type": "first_goal",
  "createdAt": {
    "_seconds": 1772157428,
    "_nanoseconds": 54000000
  },
  "participantsCount": 1,
  "lockedAt": {
    "_seconds": 1772162704,
    "_nanoseconds": 956000000
  },
  "firstGoal": {
    "playerName": "Ty Emberson",
    "goalTime": "07:25",
    "teamAbbr": "EDM",
    "confirmedAt": {
      "_seconds": 1772164941,
      "_nanoseconds": 764000000
    },
    "playerId": "8480834"
  },
  "decidedAt": {
    "_seconds": 1772164941,
    "_nanoseconds": 764000000
  },
  "resultMessage": "Premier but confirmé. Résultats disponibles.",
  "winnersPreviewUids": [],
  "winnersCount": 0,
  "status": "decided",
  "updatedAt": {
    "_seconds": 1772164941,
    "_nanoseconds": 764000000
  }
}
```
</details>


### Collection: `first_goal_challenges/PHts0jjYbOi4uYy9L0N0/entries`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `createdAt` | timestamp | {"_seconds":1772157594,"_nanoseconds":364000000} |
| `playerName` | string | "Connor McDavid" |
| `headshotUrl` | string | "https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png" |
| `positionCode` | string | "C" |
| `teamAbbr` | string | "EDM" |
| `playerId` | string | "8478402" |
| `updatedAt` | timestamp | {"_seconds":1772158851,"_nanoseconds":560000000} |

### Documents exemples

<details>
<summary>first_goal_challenges/PHts0jjYbOi4uYy9L0N0/entries/Ez41QPvDwDNHhd0PziXdN9TK94I3</summary>

```json
{
  "uid": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "createdAt": {
    "_seconds": 1772157594,
    "_nanoseconds": 364000000
  },
  "playerName": "Connor McDavid",
  "headshotUrl": "https://assets.nhle.com/mugs/nhl/20252026/EDM/8478402.png",
  "positionCode": "C",
  "teamAbbr": "EDM",
  "playerId": "8478402",
  "updatedAt": {
    "_seconds": 1772158851,
    "_nanoseconds": 560000000
  }
}
```
</details>


## Collection: `group_memberships`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "UZDb8VPtjSgVFjV7Bwqp9CHMeeP2" |
| `role` | string | "member" / "member" |
| `avatarUrl` | string, null | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA15.png / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA1.png? |
| `displayName` | string | "Nathalie" / "Nme:1111111" |
| `joinedAt` | timestamp | {"_seconds":1771968460,"_nanoseconds":497000000} / {"_seconds":1771105776,"_nanoseconds":126000000} |
| `groupId` | string | "143CenG5Lsz2JEOaK1sJ" / "143CenG5Lsz2JEOaK1sJ" |
| `active` | boolean | true / true |
| `userId` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "UZDb8VPtjSgVFjV7Bwqp9CHMeeP2" |
| `status` | string | "active" / "active" |
| `updatedAt` | timestamp | {"_seconds":1771968460,"_nanoseconds":497000000} / {"_seconds":1773505063,"_nanoseconds":503000000} |
| `type` | string | "ai" |
| `personalityId` | string | "coach" |
| `createdBy` | string | "system" |
| `createdAt` | timestamp | {"_seconds":1771081869,"_nanoseconds":34000000} |

### Documents exemples

<details>
<summary>group_memberships/143CenG5Lsz2JEOaK1sJ_45I3FZACt8OTLN39KeSKq7n545G3</summary>

```json
{
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "role": "member",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA15.png?alt=media&token=86f4b01c-366f-466d-a637-bda9ccfe2fef",
  "displayName": "Nathalie",
  "joinedAt": {
    "_seconds": 1771968460,
    "_nanoseconds": 497000000
  },
  "groupId": "143CenG5Lsz2JEOaK1sJ",
  "active": true,
  "userId": "45I3FZACt8OTLN39KeSKq7n545G3",
  "status": "active",
  "updatedAt": {
    "_seconds": 1771968460,
    "_nanoseconds": 497000000
  }
}
```
</details>

<details>
<summary>group_memberships/143CenG5Lsz2JEOaK1sJ_UZDb8VPtjSgVFjV7Bwqp9CHMeeP2</summary>

```json
{
  "uid": "UZDb8VPtjSgVFjV7Bwqp9CHMeeP2",
  "role": "member",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA1.png?alt=media&token=425aadf5-c7e3-4842-ab27-35e4eb77a5ea",
  "displayName": "Nme:1111111",
  "joinedAt": {
    "_seconds": 1771105776,
    "_nanoseconds": 126000000
  },
  "groupId": "143CenG5Lsz2JEOaK1sJ",
  "active": true,
  "userId": "UZDb8VPtjSgVFjV7Bwqp9CHMeeP2",
  "status": "active",
  "updatedAt": {
    "_seconds": 1773505063,
    "_nanoseconds": 503000000
  }
}
```
</details>

<details>
<summary>group_memberships/143CenG5Lsz2JEOaK1sJ_ai</summary>

```json
{
  "groupId": "143CenG5Lsz2JEOaK1sJ",
  "uid": "ai",
  "type": "ai",
  "role": "member",
  "active": true,
  "status": "active",
  "personalityId": "coach",
  "displayName": "Prophetik AI",
  "avatarUrl": null,
  "createdBy": "system",
  "createdAt": {
    "_seconds": 1771081869,
    "_nanoseconds": 34000000
  },
  "updatedAt": {
    "_seconds": 1771081869,
    "_nanoseconds": 34000000
  }
}
```
</details>


## Collection: `groups`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `name` | string | "GR-4444444" / "Ascension-T1-V1" |
| `description` | string | "Les amis 4444444" / "" |
| `avatarUrl` | null | null / null |
| `codeInvitation` | string | "4P8QZ4NA" / "2ZCYWBWN" |
| `createdBy` | string | "dm7I6bBZlTVGw0GPExYpwbpNfBH2" / "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `ownerId` | string | "dm7I6bBZlTVGw0GPExYpwbpNfBH2" / "Ez41QPvDwDNHhd0PziXdN9TK94I3" |
| `ownerName` | string | "4444444" / "Liam" |
| `ownerAvatarUrl` | null, string | null / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png? |
| `isPrivate` | boolean | true / true |
| `status` | string | "active" / "archived" |
| `active` | boolean | true / false |
| `createdAt` | timestamp | {"_seconds":1771081864,"_nanoseconds":447000000} / {"_seconds":1768145095,"_nanoseconds":321000000} |
| `updatedAt` | timestamp | {"_seconds":1773505063,"_nanoseconds":590000000} / {"_seconds":1773188304,"_nanoseconds":592000000} |
| `fgcBonusLastReason` | string | "no_entries_matched" |
| `fgcBonus` | number | 1 |
| `fgcBonusUpdatedAt` | timestamp | {"_seconds":1773512119,"_nanoseconds":457000000} |
| `leaderboardSeasonDirty` | boolean | false |
| `leaderboardSeasonRebuiltAt` | timestamp | {"_seconds":1773188304,"_nanoseconds":592000000} |
| `deletedAt` | timestamp | {"_seconds":1767902114,"_nanoseconds":532000000} |
| `deletedBy` | string | "45I3FZACt8OTLN39KeSKq7n545G3" |

### Documents exemples

<details>
<summary>groups/143CenG5Lsz2JEOaK1sJ</summary>

```json
{
  "name": "GR-4444444",
  "description": "Les amis 4444444",
  "avatarUrl": null,
  "codeInvitation": "4P8QZ4NA",
  "createdBy": "dm7I6bBZlTVGw0GPExYpwbpNfBH2",
  "ownerId": "dm7I6bBZlTVGw0GPExYpwbpNfBH2",
  "ownerName": "4444444",
  "ownerAvatarUrl": null,
  "isPrivate": true,
  "status": "active",
  "active": true,
  "createdAt": {
    "_seconds": 1771081864,
    "_nanoseconds": 447000000
  },
  "updatedAt": {
    "_seconds": 1773505063,
    "_nanoseconds": 590000000
  },
  "fgcBonusLastReason": "no_entries_matched",
  "fgcBonus": 1,
  "fgcBonusUpdatedAt": {
    "_seconds": 1773512119,
    "_nanoseconds": 457000000
  }
}
```
</details>

<details>
<summary>groups/2ojOXTLI4v6Uuvbkc67y</summary>

```json
{
  "name": "Ascension-T1-V1",
  "description": "",
  "avatarUrl": null,
  "codeInvitation": "2ZCYWBWN",
  "createdBy": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "ownerId": "Ez41QPvDwDNHhd0PziXdN9TK94I3",
  "ownerName": "Liam",
  "ownerAvatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png?alt=media&token=9673946f-4bcc-4507-a7ee-6ff8f7fb56dd",
  "isPrivate": true,
  "createdAt": {
    "_seconds": 1768145095,
    "_nanoseconds": 321000000
  },
  "leaderboardSeasonDirty": false,
  "leaderboardSeasonRebuiltAt": {
    "_seconds": 1773188304,
    "_nanoseconds": 592000000
  },
  "updatedAt": {
    "_seconds": 1773188304,
    "_nanoseconds": 592000000
  },
  "active": false,
  "status": "archived"
}
```
</details>


### Collection: `groups/2ojOXTLI4v6Uuvbkc67y/leaderboards`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `membersCount` | number | 0 |
| `seasonId` | string | "20252026" |
| `defisCount` | number | 0 |
| `groupId` | string | "2ojOXTLI4v6Uuvbkc67y" |
| `toYmd` | string | "2026-06-15" |
| `fromYmd` | string | "2025-10-07" |
| `rebuiltAt` | timestamp | {"_seconds":1773188304,"_nanoseconds":386000000} |
| `updatedAt` | timestamp | {"_seconds":1773188304,"_nanoseconds":386000000} |

### Documents exemples

<details>
<summary>groups/2ojOXTLI4v6Uuvbkc67y/leaderboards/20252026</summary>

```json
{
  "membersCount": 0,
  "seasonId": "20252026",
  "defisCount": 0,
  "groupId": "2ojOXTLI4v6Uuvbkc67y",
  "toYmd": "2026-06-15",
  "fromYmd": "2025-10-07",
  "rebuiltAt": {
    "_seconds": 1773188304,
    "_nanoseconds": 386000000
  },
  "updatedAt": {
    "_seconds": 1773188304,
    "_nanoseconds": 386000000
  }
}
```
</details>

<details>
<summary>groups/5rxvsTSnhe5xJLGHwX0b</summary>

```json
{
  "name": "G2-V1",
  "description": "",
  "avatarUrl": null,
  "codeInvitation": "Q76G48GJ",
  "createdBy": "45I3FZACt8OTLN39KeSKq7n545G3",
  "ownerId": "45I3FZACt8OTLN39KeSKq7n545G3",
  "ownerName": "Nathalie ",
  "ownerAvatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA14.png?alt=media&token=454cc8bd-e8f9-4c14-abe7-702ffc66f93a",
  "isPrivate": true,
  "createdAt": {
    "_seconds": 1767889955,
    "_nanoseconds": 169000000
  },
  "deletedAt": {
    "_seconds": 1767902114,
    "_nanoseconds": 532000000
  },
  "active": false,
  "deletedBy": "45I3FZACt8OTLN39KeSKq7n545G3",
  "status": "archived",
  "updatedAt": {
    "_seconds": 1767902114,
    "_nanoseconds": 532000000
  }
}
```
</details>


## Collection: `mlb_player_stats_current`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `lastName` | string | "McCutchen" / "Santana" |
| `triples` | number | 0 / 0 |
| `hitByPitch` | number | 0 / 0 |
| `sacBunts` | number | 0 / 0 |
| `source` | string | "statsapi.mlb.com/api/v1/stats?group=hitting&stats=season" / "statsapi.mlb.com/api/v1/stats?group=hitting&stats=season" |
| `stolenBases` | number | 0 / 0 |
| `seasonId` | string | "2026" / "2026" |
| `sacFlies` | number | 0 / 0 |
| `playerId` | string | "457705" / "467793" |
| `caughtStealing` | number | 0 / 0 |
| `fullName` | string | "Andrew McCutchen" / "Carlos Santana" |
| `teamAbbr` | string | "" / "" |
| `homeRuns` | number | 1 / 0 |
| `doubles` | number | 2 / 1 |
| `rbi` | number | 4 / 0 |
| `hits` | number | 6 / 2 |
| `baseOnBalls` | number | 1 / 2 |
| `runs` | number | 3 / 1 |
| `plateAppearances` | number | 27 / 26 |
| `ops` | string | ".682" / ".279" |
| `gamesPlayed` | number | 11 / 8 |
| `sluggingPercentage` | string | ".423" / ".125" |
| `strikeOuts` | number | 11 / 8 |
| `battingAverage` | string | ".231" / ".083" |
| `atBats` | number | 26 / 24 |
| `onBasePercentage` | string | ".259" / ".154" |
| `updatedAt` | timestamp | {"_seconds":1776254433,"_nanoseconds":721000000} / {"_seconds":1776254433,"_nanoseconds":721000000} |

### Documents exemples

<details>
<summary>mlb_player_stats_current/2026_457705</summary>

```json
{
  "lastName": "McCutchen",
  "triples": 0,
  "hitByPitch": 0,
  "sacBunts": 0,
  "source": "statsapi.mlb.com/api/v1/stats?group=hitting&stats=season",
  "stolenBases": 0,
  "seasonId": "2026",
  "sacFlies": 0,
  "playerId": "457705",
  "caughtStealing": 0,
  "fullName": "Andrew McCutchen",
  "teamAbbr": "",
  "homeRuns": 1,
  "doubles": 2,
  "rbi": 4,
  "hits": 6,
  "baseOnBalls": 1,
  "runs": 3,
  "plateAppearances": 27,
  "ops": ".682",
  "gamesPlayed": 11,
  "sluggingPercentage": ".423",
  "strikeOuts": 11,
  "battingAverage": ".231",
  "atBats": 26,
  "onBasePercentage": ".259",
  "updatedAt": {
    "_seconds": 1776254433,
    "_nanoseconds": 721000000
  }
}
```
</details>

<details>
<summary>mlb_player_stats_current/2026_467793</summary>

```json
{
  "lastName": "Santana",
  "triples": 0,
  "homeRuns": 0,
  "hitByPitch": 0,
  "sacBunts": 0,
  "source": "statsapi.mlb.com/api/v1/stats?group=hitting&stats=season",
  "stolenBases": 0,
  "seasonId": "2026",
  "sacFlies": 0,
  "playerId": "467793",
  "caughtStealing": 0,
  "fullName": "Carlos Santana",
  "teamAbbr": "",
  "rbi": 0,
  "doubles": 1,
  "runs": 1,
  "baseOnBalls": 2,
  "strikeOuts": 8,
  "hits": 2,
  "plateAppearances": 26,
  "ops": ".279",
  "gamesPlayed": 8,
  "sluggingPercentage": ".125",
  "battingAverage": ".083",
  "atBats": 24,
  "onBasePercentage": ".154",
  "updatedAt": {
    "_seconds": 1776254433,
    "_nanoseconds": 721000000
  }
}
```
</details>

<details>
<summary>mlb_player_stats_current/2026_500743</summary>

```json
{
  "lastName": "Rojas",
  "triples": 0,
  "homeRuns": 0,
  "hitByPitch": 0,
  "sacBunts": 0,
  "source": "statsapi.mlb.com/api/v1/stats?group=hitting&stats=season",
  "stolenBases": 0,
  "seasonId": "2026",
  "playerId": "500743",
  "fullName": "Miguel Rojas",
  "teamAbbr": "",
  "rbi": 1,
  "sacFlies": 1,
  "hits": 10,
  "caughtStealing": 1,
  "doubles": 2,
  "sluggingPercentage": ".429",
  "strikeOuts": 6,
  "battingAverage": ".357",
  "atBats": 28,
  "plateAppearances": 32,
  "baseOnBalls": 3,
  "ops": ".835",
  "gamesPlayed": 12,
  "onBasePercentage": ".406",
  "runs": 3,
  "updatedAt": {
    "_seconds": 1776254433,
    "_nanoseconds": 721000000
  }
}
```
</details>


## Collection: `mlb_schedule_daily`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `ymd` | string | "2026-03-25" / "2026-03-26" |
| `gameCount` | number | 1 / 11 |
| `source` | string | "statsapi.mlb.com/api/v1/schedule" / "statsapi.mlb.com/api/v1/schedule" |
| `hasGames` | boolean | true / true |
| `sport` | string | "mlb" / "mlb" |
| `updatedAt` | timestamp | {"_seconds":1775027414,"_nanoseconds":859000000} / {"_seconds":1775113853,"_nanoseconds":934000000} |

### Documents exemples

<details>
<summary>mlb_schedule_daily/20260325</summary>

```json
{
  "ymd": "2026-03-25",
  "gameCount": 1,
  "source": "statsapi.mlb.com/api/v1/schedule",
  "hasGames": true,
  "sport": "mlb",
  "updatedAt": {
    "_seconds": 1775027414,
    "_nanoseconds": 859000000
  }
}
```
</details>


### Collection: `mlb_schedule_daily/20260325/games`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gamePk` | string | "823244" |
| `gameDateYmd` | string | "2026-03-25" |
| `venue` | map | {...} |
| `venue.name` | string | "Oracle Park" |
| `venue.id` | number | 2395 |
| `source` | string | "statsapi.mlb.com/api/v1/schedule" |
| `gameDateRaw` | string | "2026-03-26T00:05:00Z" |
| `homeTeam` | map | {...} |
| `homeTeam.isWinner` | boolean | false |
| `homeTeam.score` | number | 0 |
| `homeTeam.name` | string | "San Francisco Giants" |
| `homeTeam.logo` | string | "https://www.mlbstatic.com/team-logos/137.svg" |
| `homeTeam.id` | number | 137 |
| `homeTeam.abbreviation` | string | "SF" |
| `startTimeUTC` | timestamp | {"_seconds":1774483500,"_nanoseconds":0} |
| `currentInning` | number | 9 |
| `currentInningOrdinal` | string | "9th" |
| `awayTeam` | map | {...} |
| `awayTeam.name` | string | "New York Yankees" |
| `awayTeam.logo` | string | "https://www.mlbstatic.com/team-logos/147.svg" |
| `awayTeam.id` | number | 147 |
| `awayTeam.abbreviation` | string | "NYY" |
| `awayTeam.score` | number | 7 |
| `awayTeam.isWinner` | boolean | true |
| `inningState` | string | "Bottom" |
| `status` | map | {...} |
| `status.abstractGameCode` | string | "F" |
| `status.abstractGameState` | string | "Final" |
| `status.codedGameState` | string | "F" |
| `status.detailedState` | string | "Final" |
| `status.statusCode` | string | "F" |
| `updatedAt` | timestamp | {"_seconds":1775027414,"_nanoseconds":945000000} |

### Documents exemples

<details>
<summary>mlb_schedule_daily/20260325/games/823244</summary>

```json
{
  "gamePk": "823244",
  "gameDateYmd": "2026-03-25",
  "venue": {
    "name": "Oracle Park",
    "id": 2395
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-26T00:05:00Z",
  "homeTeam": {
    "isWinner": false,
    "score": 0,
    "name": "San Francisco Giants",
    "logo": "https://www.mlbstatic.com/team-logos/137.svg",
    "id": 137,
    "abbreviation": "SF"
  },
  "startTimeUTC": {
    "_seconds": 1774483500,
    "_nanoseconds": 0
  },
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "awayTeam": {
    "name": "New York Yankees",
    "logo": "https://www.mlbstatic.com/team-logos/147.svg",
    "id": 147,
    "abbreviation": "NYY",
    "score": 7,
    "isWinner": true
  },
  "inningState": "Bottom",
  "status": {
    "abstractGameCode": "F",
    "abstractGameState": "Final",
    "codedGameState": "F",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775027414,
    "_nanoseconds": 945000000
  }
}
```
</details>

<details>
<summary>mlb_schedule_daily/20260326</summary>

```json
{
  "ymd": "2026-03-26",
  "gameCount": 11,
  "source": "statsapi.mlb.com/api/v1/schedule",
  "hasGames": true,
  "sport": "mlb",
  "updatedAt": {
    "_seconds": 1775113853,
    "_nanoseconds": 934000000
  }
}
```
</details>


### Collection: `mlb_schedule_daily/20260326/games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gamePk` | string | "823081" / "823163" |
| `gameDateYmd` | string | "2026-03-26" / "2026-03-26" |
| `venue` | map | {...} / {...} |
| `venue.name` | string | "Busch Stadium" / "T-Mobile Park" |
| `venue.id` | number | 2889 / 680 |
| `source` | string | "statsapi.mlb.com/api/v1/schedule" / "statsapi.mlb.com/api/v1/schedule" |
| `gameDateRaw` | string | "2026-03-26T20:15:00Z" / "2026-03-27T02:10:00Z" |
| `startTimeUTC` | timestamp | {"_seconds":1774556100,"_nanoseconds":0} / {"_seconds":1774577400,"_nanoseconds":0} |
| `awayTeam` | map | {...} / {...} |
| `awayTeam.isWinner` | boolean | false / true |
| `awayTeam.name` | string | "Tampa Bay Rays" / "Cleveland Guardians" |
| `awayTeam.logo` | string | "https://www.mlbstatic.com/team-logos/139.svg" / "https://www.mlbstatic.com/team-logos/114.svg" |
| `awayTeam.id` | number | 139 / 114 |
| `awayTeam.abbreviation` | string | "TB" / "CLE" |
| `awayTeam.score` | number | 7 / 6 |
| `currentInning` | number | 9 / 9 |
| `currentInningOrdinal` | string | "9th" / "9th" |
| `homeTeam` | map | {...} / {...} |
| `homeTeam.name` | string | "St. Louis Cardinals" / "Seattle Mariners" |
| `homeTeam.logo` | string | "https://www.mlbstatic.com/team-logos/138.svg" / "https://www.mlbstatic.com/team-logos/136.svg" |
| `homeTeam.id` | number | 138 / 136 |
| `homeTeam.abbreviation` | string | "STL" / "SEA" |
| `homeTeam.score` | number | 9 / 4 |
| `homeTeam.isWinner` | boolean | true / false |
| `inningState` | string | "Top" / "Bottom" |
| `status` | map | {...} / {...} |
| `status.abstractGameCode` | string | "F" / "F" |
| `status.abstractGameState` | string | "Final" / "Final" |
| `status.codedGameState` | string | "F" / "F" |
| `status.detailedState` | string | "Final" / "Final" |
| `status.statusCode` | string | "F" / "F" |
| `updatedAt` | timestamp | {"_seconds":1775113854,"_nanoseconds":21000000} / {"_seconds":1775113854,"_nanoseconds":21000000} |

### Documents exemples

<details>
<summary>mlb_schedule_daily/20260326/games/823081</summary>

```json
{
  "gamePk": "823081",
  "gameDateYmd": "2026-03-26",
  "venue": {
    "name": "Busch Stadium",
    "id": 2889
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-26T20:15:00Z",
  "startTimeUTC": {
    "_seconds": 1774556100,
    "_nanoseconds": 0
  },
  "awayTeam": {
    "isWinner": false,
    "name": "Tampa Bay Rays",
    "logo": "https://www.mlbstatic.com/team-logos/139.svg",
    "id": 139,
    "abbreviation": "TB",
    "score": 7
  },
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "homeTeam": {
    "name": "St. Louis Cardinals",
    "logo": "https://www.mlbstatic.com/team-logos/138.svg",
    "id": 138,
    "abbreviation": "STL",
    "score": 9,
    "isWinner": true
  },
  "inningState": "Top",
  "status": {
    "abstractGameCode": "F",
    "abstractGameState": "Final",
    "codedGameState": "F",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775113854,
    "_nanoseconds": 21000000
  }
}
```
</details>

<details>
<summary>mlb_schedule_daily/20260326/games/823163</summary>

```json
{
  "gamePk": "823163",
  "gameDateYmd": "2026-03-26",
  "venue": {
    "name": "T-Mobile Park",
    "id": 680
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-27T02:10:00Z",
  "startTimeUTC": {
    "_seconds": 1774577400,
    "_nanoseconds": 0
  },
  "homeTeam": {
    "isWinner": false,
    "name": "Seattle Mariners",
    "logo": "https://www.mlbstatic.com/team-logos/136.svg",
    "id": 136,
    "abbreviation": "SEA",
    "score": 4
  },
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "awayTeam": {
    "name": "Cleveland Guardians",
    "logo": "https://www.mlbstatic.com/team-logos/114.svg",
    "id": 114,
    "abbreviation": "CLE",
    "isWinner": true,
    "score": 6
  },
  "inningState": "Bottom",
  "status": {
    "abstractGameCode": "F",
    "abstractGameState": "Final",
    "codedGameState": "F",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775113854,
    "_nanoseconds": 21000000
  }
}
```
</details>

<details>
<summary>mlb_schedule_daily/20260326/games/823325</summary>

```json
{
  "gamePk": "823325",
  "gameDateYmd": "2026-03-26",
  "venue": {
    "name": "Petco Park",
    "id": 2680
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-26T20:10:00Z",
  "startTimeUTC": {
    "_seconds": 1774555800,
    "_nanoseconds": 0
  },
  "homeTeam": {
    "isWinner": false,
    "name": "San Diego Padres",
    "logo": "https://www.mlbstatic.com/team-logos/135.svg",
    "id": 135,
    "abbreviation": "SD",
    "score": 2
  },
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "awayTeam": {
    "name": "Detroit Tigers",
    "logo": "https://www.mlbstatic.com/team-logos/116.svg",
    "id": 116,
    "abbreviation": "DET",
    "score": 8,
    "isWinner": true
  },
  "inningState": "Bottom",
  "status": {
    "abstractGameCode": "F",
    "abstractGameState": "Final",
    "codedGameState": "F",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775113854,
    "_nanoseconds": 21000000
  }
}
```
</details>

<details>
<summary>mlb_schedule_daily/20260327</summary>

```json
{
  "ymd": "2026-03-27",
  "gameCount": 8,
  "source": "statsapi.mlb.com/api/v1/schedule",
  "hasGames": true,
  "sport": "mlb",
  "updatedAt": {
    "_seconds": 1775200210,
    "_nanoseconds": 890000000
  }
}
```
</details>


### Collection: `mlb_schedule_daily/20260327/games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gamePk` | string | "822839" / "823162" |
| `gameDateYmd` | string | "2026-03-27" / "2026-03-27" |
| `venue` | map | {...} / {...} |
| `venue.name` | string | "Rogers Centre" / "T-Mobile Park" |
| `venue.id` | number | 14 / 680 |
| `source` | string | "statsapi.mlb.com/api/v1/schedule" / "statsapi.mlb.com/api/v1/schedule" |
| `gameDateRaw` | string | "2026-03-27T23:07:00Z" / "2026-03-28T01:45:00Z" |
| `startTimeUTC` | timestamp | {"_seconds":1774652820,"_nanoseconds":0} / {"_seconds":1774662300,"_nanoseconds":0} |
| `awayTeam` | map | {...} / {...} |
| `awayTeam.isWinner` | boolean | false / false |
| `awayTeam.name` | string | "Athletics" / "Cleveland Guardians" |
| `awayTeam.logo` | string | "https://www.mlbstatic.com/team-logos/133.svg" / "https://www.mlbstatic.com/team-logos/114.svg" |
| `awayTeam.id` | number | 133 / 114 |
| `awayTeam.abbreviation` | string | "ATH" / "CLE" |
| `awayTeam.score` | number | 2 / 1 |
| `currentInning` | number | 9 / 9 |
| `currentInningOrdinal` | string | "9th" / "9th" |
| `homeTeam` | map | {...} / {...} |
| `homeTeam.name` | string | "Toronto Blue Jays" / "Seattle Mariners" |
| `homeTeam.logo` | string | "https://www.mlbstatic.com/team-logos/141.svg" / "https://www.mlbstatic.com/team-logos/136.svg" |
| `homeTeam.id` | number | 141 / 136 |
| `homeTeam.abbreviation` | string | "TOR" / "SEA" |
| `homeTeam.isWinner` | boolean | true / true |
| `homeTeam.score` | number | 3 / 5 |
| `inningState` | string | "Bottom" / "Top" |
| `status` | map | {...} / {...} |
| `status.abstractGameCode` | string | "F" / "F" |
| `status.abstractGameState` | string | "Final" / "Final" |
| `status.codedGameState` | string | "F" / "F" |
| `status.detailedState` | string | "Final" / "Final" |
| `status.statusCode` | string | "F" / "F" |
| `updatedAt` | timestamp | {"_seconds":1775200210,"_nanoseconds":975000000} / {"_seconds":1775200210,"_nanoseconds":975000000} |

### Documents exemples

<details>
<summary>mlb_schedule_daily/20260327/games/822839</summary>

```json
{
  "gamePk": "822839",
  "gameDateYmd": "2026-03-27",
  "venue": {
    "name": "Rogers Centre",
    "id": 14
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-27T23:07:00Z",
  "startTimeUTC": {
    "_seconds": 1774652820,
    "_nanoseconds": 0
  },
  "awayTeam": {
    "isWinner": false,
    "name": "Athletics",
    "logo": "https://www.mlbstatic.com/team-logos/133.svg",
    "id": 133,
    "abbreviation": "ATH",
    "score": 2
  },
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "homeTeam": {
    "name": "Toronto Blue Jays",
    "logo": "https://www.mlbstatic.com/team-logos/141.svg",
    "id": 141,
    "abbreviation": "TOR",
    "isWinner": true,
    "score": 3
  },
  "inningState": "Bottom",
  "status": {
    "abstractGameCode": "F",
    "abstractGameState": "Final",
    "codedGameState": "F",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775200210,
    "_nanoseconds": 975000000
  }
}
```
</details>

<details>
<summary>mlb_schedule_daily/20260327/games/823162</summary>

```json
{
  "gamePk": "823162",
  "gameDateYmd": "2026-03-27",
  "venue": {
    "name": "T-Mobile Park",
    "id": 680
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-28T01:45:00Z",
  "startTimeUTC": {
    "_seconds": 1774662300,
    "_nanoseconds": 0
  },
  "awayTeam": {
    "isWinner": false,
    "name": "Cleveland Guardians",
    "logo": "https://www.mlbstatic.com/team-logos/114.svg",
    "id": 114,
    "abbreviation": "CLE",
    "score": 1
  },
  "inningState": "Top",
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "homeTeam": {
    "name": "Seattle Mariners",
    "logo": "https://www.mlbstatic.com/team-logos/136.svg",
    "id": 136,
    "abbreviation": "SEA",
    "score": 5,
    "isWinner": true
  },
  "status": {
    "abstractGameCode": "F",
    "abstractGameState": "Final",
    "codedGameState": "F",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775200210,
    "_nanoseconds": 975000000
  }
}
```
</details>

<details>
<summary>mlb_schedule_daily/20260327/games/823243</summary>

```json
{
  "gamePk": "823243",
  "gameDateYmd": "2026-03-27",
  "venue": {
    "name": "Oracle Park",
    "id": 2395
  },
  "source": "statsapi.mlb.com/api/v1/schedule",
  "gameDateRaw": "2026-03-27T20:35:00Z",
  "homeTeam": {
    "isWinner": false,
    "score": 0,
    "name": "San Francisco Giants",
    "logo": "https://www.mlbstatic.com/team-logos/137.svg",
    "id": 137,
    "abbreviation": "SF"
  },
  "startTimeUTC": {
    "_seconds": 1774643700,
    "_nanoseconds": 0
  },
  "inningState": "Bottom",
  "currentInning": 9,
  "currentInningOrdinal": "9th",
  "awayTeam": {
    "name": "New York Yankees",
    "logo": "https://www.mlbstatic.com/team-logos/147.svg",
    "id": 147,
    "abbreviation": "NYY",
    "score": 3,
    "isWinner": true
  },
  "status": {
    "abstractGameCode": "F",
    "codedGameState": "F",
    "abstractGameState": "Final",
    "detailedState": "Final",
    "statusCode": "F"
  },
  "updatedAt": {
    "_seconds": 1775200210,
    "_nanoseconds": 975000000
  }
}
```
</details>


## Collection: `mlb_standings`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | null | null / null |
| `season` | string | "2025" / "2026" |
| `source` | string | "statsapi.mlb.com/api/v1/standings" / "statsapi.mlb.com/api/v1/standings" |
| `leagueIds` | array | ["103","104"] / ["103","104"] |
| `sport` | string | "mlb" / "mlb" |
| `standingsTypes` | string | "regularSeason" / "regularSeason" |
| `updatedAt` | timestamp | {"_seconds":1776240911,"_nanoseconds":11000000} / {"_seconds":1781693283,"_nanoseconds":860000000} |

### Documents exemples

<details>
<summary>mlb_standings/2025</summary>

```json
{
  "date": null,
  "season": "2025",
  "source": "statsapi.mlb.com/api/v1/standings",
  "leagueIds": [
    "103",
    "104"
  ],
  "sport": "mlb",
  "standingsTypes": "regularSeason",
  "updatedAt": {
    "_seconds": 1776240911,
    "_nanoseconds": 11000000
  }
}
```
</details>


### Collection: `mlb_standings/2025/leagues`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | null | null / null |
| `league` | map | {...} / {...} |
| `league.link` | string | "/api/v1/league/103" / "/api/v1/league/104" |
| `league.name` | string | "" / "" |
| `league.id` | number | 103 / 104 |
| `season` | string | "2025" / "2025" |
| `source` | string | "statsapi.mlb.com/api/v1/standings" / "statsapi.mlb.com/api/v1/standings" |
| `standingsTypes` | string | "regularSeason" / "regularSeason" |
| `divisions` | array | [{"key":"2025_regularSeason_201","division":{"id":201,"name":"AL East","nameShort":"","abbreviation" / [{"key":"2025_regularSeason_204","division":{"id":204,"name":"NL East","nameShort":"","abbreviation" |
| `wildcard` | array | [{"team":{"id":147,"name":"Yankees","abbreviation":"","link":"/api/v1/teams/147","logo":"https://www / [{"team":{"id":112,"name":"Cubs","abbreviation":"","link":"/api/v1/teams/112","logo":"https://www.ml |
| `updatedAt` | timestamp | {"_seconds":1776240911,"_nanoseconds":125000000} / {"_seconds":1776240911,"_nanoseconds":274000000} |

### Documents exemples

<details>
<summary>mlb_standings/2025/leagues/103</summary>

```json
{
  "date": null,
  "league": {
    "link": "/api/v1/league/103",
    "name": "",
    "id": 103
  },
  "season": "2025",
  "source": "statsapi.mlb.com/api/v1/standings",
  "standingsTypes": "regularSeason",
  "divisions": [
    {
      "key": "2025_regularSeason_201",
      "division": {
        "id": 201,
        "name": "AL East",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/201"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 141,
            "name": "Blue Jays",
            "abbreviation": "",
            "link": "/api/v1/teams/141",
            "logo": "https://www.mlbstatic.com/team-logos/141.svg"
          },
          "gamesPlayed": 162,
          "wins": 94,
          "losses": 68,
          "winningPercentage": ".580",
          "runsScored": 798,
          "runsAllowed": 721,
          "runDifferential": 77,
          "sportRank": "3",
          "leagueRank": "1",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "-",
          "sportGamesBack": "3.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 4,
            "streakCode": "W4"
          },
          "leagueRecord": {
            "wins": 94,
            "losses": 68,
            "pct": ".580"
          },
          "home": {
            "wins": 54,
            "losses": 27,
            "pct": ".667"
          },
          "away": {
            "wins": 40,
            "losses": 41,
            "pct": ".494"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 147,
            "name": "Yankees",
            "abbreviation": "",
            "link": "/api/v1/teams/147",
            "logo": "https://www.mlbstatic.com/team-logos/147.svg"
          },
          "gamesPlayed": 162,
          "wins": 94,
          "losses": 68,
          "winningPercentage": ".580",
          "runsScored": 849,
          "runsAllowed": 685,
          "runDifferential": 164,
          "sportRank": "4",
          "leagueRank": "2",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "1",
          "wildCardGamesBack": "+7.0",
          "divisionGamesBack": "-",
          "leagueGamesBack": "-",
          "sportGamesBack": "3.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 8,
            "streakCode": "W8"
          },
          "leagueRecord": {
            "wins": 94,
            "losses": 68,
            "pct": ".580"
          },
          "home": {
            "wins": 50,
            "losses": 31,
            "pct": ".617"
          },
          "away": {
            "wins": 44,
            "losses": 37,
            "pct": ".543"
          },
          "lastTen": {
            "wins": 9,
            "losses": 1,
            "pct": ".900"
          }
        },
        {
          "team": {
            "id": 111,
            "name": "Red Sox",
            "abbreviation": "",
            "link": "/api/v1/teams/111",
            "logo": "https://www.mlbstatic.com/team-logos/111.svg"
          },
          "gamesPlayed": 162,
          "wins": 89,
          "losses": 73,
          "winningPercentage": ".549",
          "runsScored": 786,
          "runsAllowed": 676,
          "runDifferential": 110,
          "sportRank": "9",
          "leagueRank": "4",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "2",
          "wildCardGamesBack": "+2.0",
          "divisionGamesBack": "5.0",
          "leagueGamesBack": "5.0",
          "sportGamesBack": "8.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 89,
            "losses": 73,
            "pct": ".549"
          },
          "home": {
            "wins": 48,
            "losses": 33,
            "pct": ".593"
          },
          "away": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        },
        {
          "team": {
            "id": 139,
            "name": "Rays",
            "abbreviation": "",
            "link": "/api/v1/teams/139",
            "logo": "https://www.mlbstatic.com/team-logos/139.svg"
          },
          "gamesPlayed": 162,
          "wins": 77,
          "losses": 85,
          "winningPercentage": ".475",
          "runsScored": 714,
          "runsAllowed": 683,
          "runDifferential": 31,
          "sportRank": "21",
          "leagueRank": "10",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "7",
          "wildCardGamesBack": "10.0",
          "divisionGamesBack": "17.0",
          "leagueGamesBack": "17.0",
          "sportGamesBack": "20.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 4,
            "streakCode": "L4"
          },
          "leagueRecord": {
            "wins": 77,
            "losses": 85,
            "pct": ".475"
          },
          "home": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "away": {
            "wins": 36,
            "losses": 45,
            "pct": ".444"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        },
        {
          "team": {
            "id": 110,
            "name": "Orioles",
            "abbreviation": "",
            "link": "/api/v1/teams/110",
            "logo": "https://www.mlbstatic.com/team-logos/110.svg"
          },
          "gamesPlayed": 162,
          "wins": 75,
          "losses": 87,
          "winningPercentage": ".463",
          "runsScored": 677,
          "runsAllowed": 788,
          "runDifferential": -111,
          "sportRank": "24",
          "leagueRank": "12",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "9",
          "wildCardGamesBack": "12.0",
          "divisionGamesBack": "19.0",
          "leagueGamesBack": "19.0",
          "sportGamesBack": "22.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 3,
            "streakCode": "L3"
          },
          "leagueRecord": {
            "wins": 75,
            "losses": 87,
            "pct": ".463"
          },
          "home": {
            "wins": 39,
            "losses": 42,
            "pct": ".481"
          },
          "away": {
            "wins": 36,
            "losses": 45,
            "pct": ".444"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        }
      ]
    },
    {
      "key": "2025_regularSeason_202",
      "division": {
        "id": 202,
        "name": "AL Central",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/202"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 114,
            "name": "Guardians",
            "abbreviation": "",
            "link": "/api/v1/teams/114",
            "logo": "https://www.mlbstatic.com/team-logos/114.svg"
          },
          "gamesPlayed": 162,
          "wins": 88,
          "losses": 74,
          "winningPercentage": ".543",
          "runsScored": 643,
          "runsAllowed": 649,
          "runDifferential": -6,
          "sportRank": "10",
          "leagueRank": "5",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "6.0",
          "sportGamesBack": "9.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 88,
            "losses": 74,
            "pct": ".543"
          },
          "home": {
            "wins": 45,
            "losses": 36,
            "pct": ".556"
          },
          "away": {
            "wins": 43,
            "losses": 38,
            "pct": ".531"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 116,
            "name": "Tigers",
            "abbreviation": "",
            "link": "/api/v1/teams/116",
            "logo": "https://www.mlbstatic.com/team-logos/116.svg"
          },
          "gamesPlayed": 162,
          "wins": 87,
          "losses": 75,
          "winningPercentage": ".537",
          "runsScored": 758,
          "runsAllowed": 691,
          "runDifferential": 67,
          "sportRank": "12",
          "leagueRank": "7",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "3",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "1.0",
          "leagueGamesBack": "7.0",
          "sportGamesBack": "10.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 87,
            "losses": 75,
            "pct": ".537"
          },
          "home": {
            "wins": 46,
            "losses": 35,
            "pct": ".568"
          },
          "away": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "lastTen": {
            "wins": 2,
            "losses": 8,
            "pct": ".200"
          }
        },
        {
          "team": {
            "id": 118,
            "name": "Royals",
            "abbreviation": "",
            "link": "/api/v1/teams/118",
            "logo": "https://www.mlbstatic.com/team-logos/118.svg"
          },
          "gamesPlayed": 162,
          "wins": 82,
          "losses": 80,
          "winningPercentage": ".506",
          "runsScored": 651,
          "runsAllowed": 637,
          "runDifferential": 14,
          "sportRank": "15",
          "leagueRank": "8",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "5",
          "wildCardGamesBack": "5.0",
          "divisionGamesBack": "6.0",
          "leagueGamesBack": "12.0",
          "sportGamesBack": "15.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 82,
            "losses": 80,
            "pct": ".506"
          },
          "home": {
            "wins": 43,
            "losses": 38,
            "pct": ".531"
          },
          "away": {
            "wins": 39,
            "losses": 42,
            "pct": ".481"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        },
        {
          "team": {
            "id": 142,
            "name": "Twins",
            "abbreviation": "",
            "link": "/api/v1/teams/142",
            "logo": "https://www.mlbstatic.com/team-logos/142.svg"
          },
          "gamesPlayed": 162,
          "wins": 70,
          "losses": 92,
          "winningPercentage": ".432",
          "runsScored": 678,
          "runsAllowed": 773,
          "runDifferential": -95,
          "sportRank": "27",
          "leagueRank": "14",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "11",
          "wildCardGamesBack": "17.0",
          "divisionGamesBack": "18.0",
          "leagueGamesBack": "24.0",
          "sportGamesBack": "27.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 70,
            "losses": 92,
            "pct": ".432"
          },
          "home": {
            "wins": 38,
            "losses": 43,
            "pct": ".469"
          },
          "away": {
            "wins": 32,
            "losses": 49,
            "pct": ".395"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 145,
            "name": "White Sox",
            "abbreviation": "",
            "link": "/api/v1/teams/145",
            "logo": "https://www.mlbstatic.com/team-logos/145.svg"
          },
          "gamesPlayed": 162,
          "wins": 60,
          "losses": 102,
          "winningPercentage": ".370",
          "runsScored": 647,
          "runsAllowed": 742,
          "runDifferential": -95,
          "sportRank": "29",
          "leagueRank": "15",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "12",
          "wildCardGamesBack": "27.0",
          "divisionGamesBack": "28.0",
          "leagueGamesBack": "34.0",
          "sportGamesBack": "37.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 60,
            "losses": 102,
            "pct": ".370"
          },
          "home": {
            "wins": 33,
            "losses": 48,
            "pct": ".407"
          },
          "away": {
            "wins": 27,
            "losses": 54,
            "pct": ".333"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        }
      ]
    },
    {
      "key": "2025_regularSeason_200",
      "division": {
        "id": 200,
        "name": "AL West",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/200"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 136,
            "name": "Mariners",
            "abbreviation": "",
            "link": "/api/v1/teams/136",
            "logo": "https://www.mlbstatic.com/team-logos/136.svg"
          },
          "gamesPlayed": 162,
          "wins": 90,
          "losses": 72,
          "winningPercentage": ".556",
          "runsScored": 766,
          "runsAllowed": 694,
          "runDifferential": 72,
          "sportRank": "7",
          "leagueRank": "3",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "4.0",
          "sportGamesBack": "7.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 3,
            "streakCode": "L3"
          },
          "leagueRecord": {
            "wins": 90,
            "losses": 72,
            "pct": ".556"
          },
          "home": {
            "wins": 51,
            "losses": 30,
            "pct": ".630"
          },
          "away": {
            "wins": 39,
            "losses": 42,
            "pct": ".481"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 117,
            "name": "Astros",
            "abbreviation": "",
            "link": "/api/v1/teams/117",
            "logo": "https://www.mlbstatic.com/team-logos/117.svg"
          },
          "gamesPlayed": 162,
          "wins": 87,
          "losses": 75,
          "winningPercentage": ".537",
          "runsScored": 686,
          "runsAllowed": 665,
          "runDifferential": 21,
          "sportRank": "11",
          "leagueRank": "6",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "4",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "3.0",
          "leagueGamesBack": "7.0",
          "sportGamesBack": "10.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 87,
            "losses": 75,
            "pct": ".537"
          },
          "home": {
            "wins": 46,
            "losses": 35,
            "pct": ".568"
          },
          "away": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 140,
            "name": "Rangers",
            "abbreviation": "",
            "link": "/api/v1/teams/140",
            "logo": "https://www.mlbstatic.com/team-logos/140.svg"
          },
          "gamesPlayed": 162,
          "wins": 81,
          "losses": 81,
          "winningPercentage": ".500",
          "runsScored": 684,
          "runsAllowed": 605,
          "runDifferential": 79,
          "sportRank": "17",
          "leagueRank": "9",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "6",
          "wildCardGamesBack": "6.0",
          "divisionGamesBack": "9.0",
          "leagueGamesBack": "13.0",
          "sportGamesBack": "16.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 81,
            "losses": 81,
            "pct": ".500"
          },
          "home": {
            "wins": 48,
            "losses": 33,
            "pct": ".593"
          },
          "away": {
            "wins": 33,
            "losses": 48,
            "pct": ".407"
          },
          "lastTen": {
            "wins": 2,
            "losses": 8,
            "pct": ".200"
          }
        },
        {
          "team": {
            "id": 133,
            "name": "Athletics",
            "abbreviation": "",
            "link": "/api/v1/teams/133",
            "logo": "https://www.mlbstatic.com/team-logos/133.svg"
          },
          "gamesPlayed": 162,
          "wins": 76,
          "losses": 86,
          "winningPercentage": ".469",
          "runsScored": 733,
          "runsAllowed": 817,
          "runDifferential": -84,
          "sportRank": "22",
          "leagueRank": "11",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "8",
          "wildCardGamesBack": "11.0",
          "divisionGamesBack": "14.0",
          "leagueGamesBack": "18.0",
          "sportGamesBack": "21.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 76,
            "losses": 86,
            "pct": ".469"
          },
          "home": {
            "wins": 36,
            "losses": 45,
            "pct": ".444"
          },
          "away": {
            "wins": 40,
            "losses": 41,
            "pct": ".494"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 108,
            "name": "Angels",
            "abbreviation": "",
            "link": "/api/v1/teams/108",
            "logo": "https://www.mlbstatic.com/team-logos/108.svg"
          },
          "gamesPlayed": 162,
          "wins": 72,
          "losses": 90,
          "winningPercentage": ".444",
          "runsScored": 673,
          "runsAllowed": 837,
          "runDifferential": -164,
          "sportRank": "25",
          "leagueRank": "13",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "10",
          "wildCardGamesBack": "15.0",
          "divisionGamesBack": "18.0",
          "leagueGamesBack": "22.0",
          "sportGamesBack": "25.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 72,
            "losses": 90,
            "pct": ".444"
          },
          "home": {
            "wins": 39,
            "losses": 42,
            "pct": ".481"
          },
          "away": {
            "wins": 33,
            "losses": 48,
            "pct": ".407"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        }
      ]
    }
  ],
  "wildcard": [
    {
      "team": {
        "id": 147,
        "name": "Yankees",
        "abbreviation": "",
        "link": "/api/v1/teams/147",
        "logo": "https://www.mlbstatic.com/team-logos/147.svg"
      },
      "gamesPlayed": 162,
      "wins": 94,
      "losses": 68,
      "winningPercentage": ".580",
      "runsScored": 849,
      "runsAllowed": 685,
      "runDifferential": 164,
      "sportRank": "4",
      "leagueRank": "2",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "1",
      "wildCardGamesBack": "+7.0",
      "divisionGamesBack": "-",
      "leagueGamesBack": "-",
      "sportGamesBack": "3.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 8,
        "streakCode": "W8"
      },
      "leagueRecord": {
        "wins": 94,
        "losses": 68,
        "pct": ".580"
      },
      "home": {
        "wins": 50,
        "losses": 31,
        "pct": ".617"
      },
      "away": {
        "wins": 44,
        "losses": 37,
        "pct": ".543"
      },
      "lastTen": {
        "wins": 9,
        "losses": 1,
        "pct": ".900"
      }
    },
    {
      "team": {
        "id": 111,
        "name": "Red Sox",
        "abbreviation": "",
        "link": "/api/v1/teams/111",
        "logo": "https://www.mlbstatic.com/team-logos/111.svg"
      },
      "gamesPlayed": 162,
      "wins": 89,
      "losses": 73,
      "winningPercentage": ".549",
      "runsScored": 786,
      "runsAllowed": 676,
      "runDifferential": 110,
      "sportRank": "9",
      "leagueRank": "4",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "2",
      "wildCardGamesBack": "+2.0",
      "divisionGamesBack": "5.0",
      "leagueGamesBack": "5.0",
      "sportGamesBack": "8.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 89,
        "losses": 73,
        "pct": ".549"
      },
      "home": {
        "wins": 48,
        "losses": 33,
        "pct": ".593"
      },
      "away": {
        "wins": 41,
        "losses": 40,
        "pct": ".506"
      },
      "lastTen": {
        "wins": 6,
        "losses": 4,
        "pct": ".600"
      }
    },
    {
      "team": {
        "id": 116,
        "name": "Tigers",
        "abbreviation": "",
        "link": "/api/v1/teams/116",
        "logo": "https://www.mlbstatic.com/team-logos/116.svg"
      },
      "gamesPlayed": 162,
      "wins": 87,
      "losses": 75,
      "winningPercentage": ".537",
      "runsScored": 758,
      "runsAllowed": 691,
      "runDifferential": 67,
      "sportRank": "12",
      "leagueRank": "7",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "3",
      "wildCardGamesBack": "-",
      "divisionGamesBack": "1.0",
      "leagueGamesBack": "7.0",
      "sportGamesBack": "10.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 87,
        "losses": 75,
        "pct": ".537"
      },
      "home": {
        "wins": 46,
        "losses": 35,
        "pct": ".568"
      },
      "away": {
        "wins": 41,
        "losses": 40,
        "pct": ".506"
      },
      "lastTen": {
        "wins": 2,
        "losses": 8,
        "pct": ".200"
      }
    },
    {
      "team": {
        "id": 117,
        "name": "Astros",
        "abbreviation": "",
        "link": "/api/v1/teams/117",
        "logo": "https://www.mlbstatic.com/team-logos/117.svg"
      },
      "gamesPlayed": 162,
      "wins": 87,
      "losses": 75,
      "winningPercentage": ".537",
      "runsScored": 686,
      "runsAllowed": 665,
      "runDifferential": 21,
      "sportRank": "11",
      "leagueRank": "6",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "4",
      "wildCardGamesBack": "-",
      "divisionGamesBack": "3.0",
      "leagueGamesBack": "7.0",
      "sportGamesBack": "10.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 2,
        "streakCode": "W2"
      },
      "leagueRecord": {
        "wins": 87,
        "losses": 75,
        "pct": ".537"
      },
      "home": {
        "wins": 46,
        "losses": 35,
        "pct": ".568"
      },
      "away": {
        "wins": 41,
        "losses": 40,
        "pct": ".506"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 118,
        "name": "Royals",
        "abbreviation": "",
        "link": "/api/v1/teams/118",
        "logo": "https://www.mlbstatic.com/team-logos/118.svg"
      },
      "gamesPlayed": 162,
      "wins": 82,
      "losses": 80,
      "winningPercentage": ".506",
      "runsScored": 651,
      "runsAllowed": 637,
      "runDifferential": 14,
      "sportRank": "15",
      "leagueRank": "8",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "5",
      "wildCardGamesBack": "5.0",
      "divisionGamesBack": "6.0",
      "leagueGamesBack": "12.0",
      "sportGamesBack": "15.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 2,
        "streakCode": "W2"
      },
      "leagueRecord": {
        "wins": 82,
        "losses": 80,
        "pct": ".506"
      },
      "home": {
        "wins": 43,
        "losses": 38,
        "pct": ".531"
      },
      "away": {
        "wins": 39,
        "losses": 42,
        "pct": ".481"
      },
      "lastTen": {
        "wins": 6,
        "losses": 4,
        "pct": ".600"
      }
    },
    {
      "team": {
        "id": 140,
        "name": "Rangers",
        "abbreviation": "",
        "link": "/api/v1/teams/140",
        "logo": "https://www.mlbstatic.com/team-logos/140.svg"
      },
      "gamesPlayed": 162,
      "wins": 81,
      "losses": 81,
      "winningPercentage": ".500",
      "runsScored": 684,
      "runsAllowed": 605,
      "runDifferential": 79,
      "sportRank": "17",
      "leagueRank": "9",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "6",
      "wildCardGamesBack": "6.0",
      "divisionGamesBack": "9.0",
      "leagueGamesBack": "13.0",
      "sportGamesBack": "16.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 81,
        "losses": 81,
        "pct": ".500"
      },
      "home": {
        "wins": 48,
        "losses": 33,
        "pct": ".593"
      },
      "away": {
        "wins": 33,
        "losses": 48,
        "pct": ".407"
      },
      "lastTen": {
        "wins": 2,
        "losses": 8,
        "pct": ".200"
      }
    },
    {
      "team": {
        "id": 139,
        "name": "Rays",
        "abbreviation": "",
        "link": "/api/v1/teams/139",
        "logo": "https://www.mlbstatic.com/team-logos/139.svg"
      },
      "gamesPlayed": 162,
      "wins": 77,
      "losses": 85,
      "winningPercentage": ".475",
      "runsScored": 714,
      "runsAllowed": 683,
      "runDifferential": 31,
      "sportRank": "21",
      "leagueRank": "10",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "7",
      "wildCardGamesBack": "10.0",
      "divisionGamesBack": "17.0",
      "leagueGamesBack": "17.0",
      "sportGamesBack": "20.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 4,
        "streakCode": "L4"
      },
      "leagueRecord": {
        "wins": 77,
        "losses": 85,
        "pct": ".475"
      },
      "home": {
        "wins": 41,
        "losses": 40,
        "pct": ".506"
      },
      "away": {
        "wins": 36,
        "losses": 45,
        "pct": ".444"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 133,
        "name": "Athletics",
        "abbreviation": "",
        "link": "/api/v1/teams/133",
        "logo": "https://www.mlbstatic.com/team-logos/133.svg"
      },
      "gamesPlayed": 162,
      "wins": 76,
      "losses": 86,
      "winningPercentage": ".469",
      "runsScored": 733,
      "runsAllowed": 817,
      "runDifferential": -84,
      "sportRank": "22",
      "leagueRank": "11",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "8",
      "wildCardGamesBack": "11.0",
      "divisionGamesBack": "14.0",
      "leagueGamesBack": "18.0",
      "sportGamesBack": "21.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 76,
        "losses": 86,
        "pct": ".469"
      },
      "home": {
        "wins": 36,
        "losses": 45,
        "pct": ".444"
      },
      "away": {
        "wins": 40,
        "losses": 41,
        "pct": ".494"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 110,
        "name": "Orioles",
        "abbreviation": "",
        "link": "/api/v1/teams/110",
        "logo": "https://www.mlbstatic.com/team-logos/110.svg"
      },
      "gamesPlayed": 162,
      "wins": 75,
      "losses": 87,
      "winningPercentage": ".463",
      "runsScored": 677,
      "runsAllowed": 788,
      "runDifferential": -111,
      "sportRank": "24",
      "leagueRank": "12",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "9",
      "wildCardGamesBack": "12.0",
      "divisionGamesBack": "19.0",
      "leagueGamesBack": "19.0",
      "sportGamesBack": "22.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 3,
        "streakCode": "L3"
      },
      "leagueRecord": {
        "wins": 75,
        "losses": 87,
        "pct": ".463"
      },
      "home": {
        "wins": 39,
        "losses": 42,
        "pct": ".481"
      },
      "away": {
        "wins": 36,
        "losses": 45,
        "pct": ".444"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 108,
        "name": "Angels",
        "abbreviation": "",
        "link": "/api/v1/teams/108",
        "logo": "https://www.mlbstatic.com/team-logos/108.svg"
      },
      "gamesPlayed": 162,
      "wins": 72,
      "losses": 90,
      "winningPercentage": ".444",
      "runsScored": 673,
      "runsAllowed": 837,
      "runDifferential": -164,
      "sportRank": "25",
      "leagueRank": "13",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "10",
      "wildCardGamesBack": "15.0",
      "divisionGamesBack": "18.0",
      "leagueGamesBack": "22.0",
      "sportGamesBack": "25.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 72,
        "losses": 90,
        "pct": ".444"
      },
      "home": {
        "wins": 39,
        "losses": 42,
        "pct": ".481"
      },
      "away": {
        "wins": 33,
        "losses": 48,
        "pct": ".407"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 142,
        "name": "Twins",
        "abbreviation": "",
        "link": "/api/v1/teams/142",
        "logo": "https://www.mlbstatic.com/team-logos/142.svg"
      },
      "gamesPlayed": 162,
      "wins": 70,
      "losses": 92,
      "winningPercentage": ".432",
      "runsScored": 678,
      "runsAllowed": 773,
      "runDifferential": -95,
      "sportRank": "27",
      "leagueRank": "14",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "11",
      "wildCardGamesBack": "17.0",
      "divisionGamesBack": "18.0",
      "leagueGamesBack": "24.0",
      "sportGamesBack": "27.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 70,
        "losses": 92,
        "pct": ".432"
      },
      "home": {
        "wins": 38,
        "losses": 43,
        "pct": ".469"
      },
      "away": {
        "wins": 32,
        "losses": 49,
        "pct": ".395"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 145,
        "name": "White Sox",
        "abbreviation": "",
        "link": "/api/v1/teams/145",
        "logo": "https://www.mlbstatic.com/team-logos/145.svg"
      },
      "gamesPlayed": 162,
      "wins": 60,
      "losses": 102,
      "winningPercentage": ".370",
      "runsScored": 647,
      "runsAllowed": 742,
      "runDifferential": -95,
      "sportRank": "29",
      "leagueRank": "15",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "12",
      "wildCardGamesBack": "27.0",
      "divisionGamesBack": "28.0",
      "leagueGamesBack": "34.0",
      "sportGamesBack": "37.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 60,
        "losses": 102,
        "pct": ".370"
      },
      "home": {
        "wins": 33,
        "losses": 48,
        "pct": ".407"
      },
      "away": {
        "wins": 27,
        "losses": 54,
        "pct": ".333"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    }
  ],
  "updatedAt": {
    "_seconds": 1776240911,
    "_nanoseconds": 125000000
  }
}
```
</details>

<details>
<summary>mlb_standings/2025/leagues/104</summary>

```json
{
  "date": null,
  "league": {
    "link": "/api/v1/league/104",
    "name": "",
    "id": 104
  },
  "season": "2025",
  "source": "statsapi.mlb.com/api/v1/standings",
  "standingsTypes": "regularSeason",
  "divisions": [
    {
      "key": "2025_regularSeason_204",
      "division": {
        "id": 204,
        "name": "NL East",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/204"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 143,
            "name": "Phillies",
            "abbreviation": "",
            "link": "/api/v1/teams/143",
            "logo": "https://www.mlbstatic.com/team-logos/143.svg"
          },
          "gamesPlayed": 162,
          "wins": 96,
          "losses": 66,
          "winningPercentage": ".593",
          "runsScored": 778,
          "runsAllowed": 648,
          "runDifferential": 130,
          "sportRank": "2",
          "leagueRank": "2",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "1.0",
          "sportGamesBack": "1.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 96,
            "losses": 66,
            "pct": ".593"
          },
          "home": {
            "wins": 55,
            "losses": 26,
            "pct": ".679"
          },
          "away": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 121,
            "name": "Mets",
            "abbreviation": "",
            "link": "/api/v1/teams/121",
            "logo": "https://www.mlbstatic.com/team-logos/121.svg"
          },
          "gamesPlayed": 162,
          "wins": 83,
          "losses": 79,
          "winningPercentage": ".512",
          "runsScored": 766,
          "runsAllowed": 715,
          "runDifferential": 51,
          "sportRank": "13",
          "leagueRank": "6",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "4",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "13.0",
          "leagueGamesBack": "14.0",
          "sportGamesBack": "14.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 83,
            "losses": 79,
            "pct": ".512"
          },
          "home": {
            "wins": 49,
            "losses": 32,
            "pct": ".605"
          },
          "away": {
            "wins": 34,
            "losses": 47,
            "pct": ".420"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 146,
            "name": "Marlins",
            "abbreviation": "",
            "link": "/api/v1/teams/146",
            "logo": "https://www.mlbstatic.com/team-logos/146.svg"
          },
          "gamesPlayed": 162,
          "wins": 79,
          "losses": 83,
          "winningPercentage": ".488",
          "runsScored": 709,
          "runsAllowed": 798,
          "runDifferential": -89,
          "sportRank": "19",
          "leagueRank": "10",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "7",
          "wildCardGamesBack": "4.0",
          "divisionGamesBack": "17.0",
          "leagueGamesBack": "18.0",
          "sportGamesBack": "18.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 79,
            "losses": 83,
            "pct": ".488"
          },
          "home": {
            "wins": 38,
            "losses": 43,
            "pct": ".469"
          },
          "away": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 144,
            "name": "Braves",
            "abbreviation": "",
            "link": "/api/v1/teams/144",
            "logo": "https://www.mlbstatic.com/team-logos/144.svg"
          },
          "gamesPlayed": 162,
          "wins": 76,
          "losses": 86,
          "winningPercentage": ".469",
          "runsScored": 724,
          "runsAllowed": 734,
          "runDifferential": -10,
          "sportRank": "23",
          "leagueRank": "12",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "9",
          "wildCardGamesBack": "7.0",
          "divisionGamesBack": "20.0",
          "leagueGamesBack": "21.0",
          "sportGamesBack": "21.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 76,
            "losses": 86,
            "pct": ".469"
          },
          "home": {
            "wins": 39,
            "losses": 42,
            "pct": ".481"
          },
          "away": {
            "wins": 37,
            "losses": 44,
            "pct": ".457"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 120,
            "name": "Nationals",
            "abbreviation": "",
            "link": "/api/v1/teams/120",
            "logo": "https://www.mlbstatic.com/team-logos/120.svg"
          },
          "gamesPlayed": 162,
          "wins": 66,
          "losses": 96,
          "winningPercentage": ".407",
          "runsScored": 687,
          "runsAllowed": 899,
          "runDifferential": -212,
          "sportRank": "28",
          "leagueRank": "14",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "11",
          "wildCardGamesBack": "17.0",
          "divisionGamesBack": "30.0",
          "leagueGamesBack": "31.0",
          "sportGamesBack": "31.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 66,
            "losses": 96,
            "pct": ".407"
          },
          "home": {
            "wins": 32,
            "losses": 49,
            "pct": ".395"
          },
          "away": {
            "wins": 34,
            "losses": 47,
            "pct": ".420"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        }
      ]
    },
    {
      "key": "2025_regularSeason_205",
      "division": {
        "id": 205,
        "name": "NL Central",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/205"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 158,
            "name": "Brewers",
            "abbreviation": "",
            "link": "/api/v1/teams/158",
            "logo": "https://www.mlbstatic.com/team-logos/158.svg"
          },
          "gamesPlayed": 162,
          "wins": 97,
          "losses": 65,
          "winningPercentage": ".599",
          "runsScored": 806,
          "runsAllowed": 634,
          "runDifferential": 172,
          "sportRank": "1",
          "leagueRank": "1",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "-",
          "sportGamesBack": "-",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 97,
            "losses": 65,
            "pct": ".599"
          },
          "home": {
            "wins": 52,
            "losses": 29,
            "pct": ".642"
          },
          "away": {
            "wins": 45,
            "losses": 36,
            "pct": ".556"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 112,
            "name": "Cubs",
            "abbreviation": "",
            "link": "/api/v1/teams/112",
            "logo": "https://www.mlbstatic.com/team-logos/112.svg"
          },
          "gamesPlayed": 162,
          "wins": 92,
          "losses": 70,
          "winningPercentage": ".568",
          "runsScored": 793,
          "runsAllowed": 649,
          "runDifferential": 144,
          "sportRank": "6",
          "leagueRank": "4",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "1",
          "wildCardGamesBack": "+9.0",
          "divisionGamesBack": "5.0",
          "leagueGamesBack": "5.0",
          "sportGamesBack": "5.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 3,
            "streakCode": "W3"
          },
          "leagueRecord": {
            "wins": 92,
            "losses": 70,
            "pct": ".568"
          },
          "home": {
            "wins": 50,
            "losses": 31,
            "pct": ".617"
          },
          "away": {
            "wins": 42,
            "losses": 39,
            "pct": ".519"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 113,
            "name": "Reds",
            "abbreviation": "",
            "link": "/api/v1/teams/113",
            "logo": "https://www.mlbstatic.com/team-logos/113.svg"
          },
          "gamesPlayed": 162,
          "wins": 83,
          "losses": 79,
          "winningPercentage": ".512",
          "runsScored": 716,
          "runsAllowed": 681,
          "runDifferential": 35,
          "sportRank": "14",
          "leagueRank": "7",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "3",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "14.0",
          "leagueGamesBack": "14.0",
          "sportGamesBack": "14.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 83,
            "losses": 79,
            "pct": ".512"
          },
          "home": {
            "wins": 45,
            "losses": 36,
            "pct": ".556"
          },
          "away": {
            "wins": 38,
            "losses": 43,
            "pct": ".469"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 138,
            "name": "Cardinals",
            "abbreviation": "",
            "link": "/api/v1/teams/138",
            "logo": "https://www.mlbstatic.com/team-logos/138.svg"
          },
          "gamesPlayed": 162,
          "wins": 78,
          "losses": 84,
          "winningPercentage": ".481",
          "runsScored": 689,
          "runsAllowed": 754,
          "runDifferential": -65,
          "sportRank": "20",
          "leagueRank": "11",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "8",
          "wildCardGamesBack": "5.0",
          "divisionGamesBack": "19.0",
          "leagueGamesBack": "19.0",
          "sportGamesBack": "19.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 4,
            "streakCode": "L4"
          },
          "leagueRecord": {
            "wins": 78,
            "losses": 84,
            "pct": ".481"
          },
          "home": {
            "wins": 44,
            "losses": 37,
            "pct": ".543"
          },
          "away": {
            "wins": 34,
            "losses": 47,
            "pct": ".420"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 134,
            "name": "Pirates",
            "abbreviation": "",
            "link": "/api/v1/teams/134",
            "logo": "https://www.mlbstatic.com/team-logos/134.svg"
          },
          "gamesPlayed": 162,
          "wins": 71,
          "losses": 91,
          "winningPercentage": ".438",
          "runsScored": 583,
          "runsAllowed": 645,
          "runDifferential": -62,
          "sportRank": "26",
          "leagueRank": "13",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "10",
          "wildCardGamesBack": "12.0",
          "divisionGamesBack": "26.0",
          "leagueGamesBack": "26.0",
          "sportGamesBack": "26.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 71,
            "losses": 91,
            "pct": ".438"
          },
          "home": {
            "wins": 44,
            "losses": 37,
            "pct": ".543"
          },
          "away": {
            "wins": 27,
            "losses": 54,
            "pct": ".333"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        }
      ]
    },
    {
      "key": "2025_regularSeason_203",
      "division": {
        "id": 203,
        "name": "NL West",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/203"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 119,
            "name": "Dodgers",
            "abbreviation": "",
            "link": "/api/v1/teams/119",
            "logo": "https://www.mlbstatic.com/team-logos/119.svg"
          },
          "gamesPlayed": 162,
          "wins": 93,
          "losses": 69,
          "winningPercentage": ".574",
          "runsScored": 825,
          "runsAllowed": 683,
          "runDifferential": 142,
          "sportRank": "5",
          "leagueRank": "3",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "4.0",
          "sportGamesBack": "4.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 5,
            "streakCode": "W5"
          },
          "leagueRecord": {
            "wins": 93,
            "losses": 69,
            "pct": ".574"
          },
          "home": {
            "wins": 52,
            "losses": 29,
            "pct": ".642"
          },
          "away": {
            "wins": 41,
            "losses": 40,
            "pct": ".506"
          },
          "lastTen": {
            "wins": 8,
            "losses": 2,
            "pct": ".800"
          }
        },
        {
          "team": {
            "id": 135,
            "name": "Padres",
            "abbreviation": "",
            "link": "/api/v1/teams/135",
            "logo": "https://www.mlbstatic.com/team-logos/135.svg"
          },
          "gamesPlayed": 162,
          "wins": 90,
          "losses": 72,
          "winningPercentage": ".556",
          "runsScored": 702,
          "runsAllowed": 621,
          "runDifferential": 81,
          "sportRank": "8",
          "leagueRank": "5",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "2",
          "wildCardGamesBack": "+7.0",
          "divisionGamesBack": "3.0",
          "leagueGamesBack": "7.0",
          "sportGamesBack": "7.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 3,
            "streakCode": "W3"
          },
          "leagueRecord": {
            "wins": 90,
            "losses": 72,
            "pct": ".556"
          },
          "home": {
            "wins": 52,
            "losses": 29,
            "pct": ".642"
          },
          "away": {
            "wins": 38,
            "losses": 43,
            "pct": ".469"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 137,
            "name": "Giants",
            "abbreviation": "",
            "link": "/api/v1/teams/137",
            "logo": "https://www.mlbstatic.com/team-logos/137.svg"
          },
          "gamesPlayed": 162,
          "wins": 81,
          "losses": 81,
          "winningPercentage": ".500",
          "runsScored": 705,
          "runsAllowed": 684,
          "runDifferential": 21,
          "sportRank": "16",
          "leagueRank": "8",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "5",
          "wildCardGamesBack": "2.0",
          "divisionGamesBack": "12.0",
          "leagueGamesBack": "16.0",
          "sportGamesBack": "16.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 4,
            "streakCode": "W4"
          },
          "leagueRecord": {
            "wins": 81,
            "losses": 81,
            "pct": ".500"
          },
          "home": {
            "wins": 42,
            "losses": 39,
            "pct": ".519"
          },
          "away": {
            "wins": 39,
            "losses": 42,
            "pct": ".481"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 109,
            "name": "D-backs",
            "abbreviation": "",
            "link": "/api/v1/teams/109",
            "logo": "https://www.mlbstatic.com/team-logos/109.svg"
          },
          "gamesPlayed": 162,
          "wins": 80,
          "losses": 82,
          "winningPercentage": ".494",
          "runsScored": 791,
          "runsAllowed": 785,
          "runDifferential": 6,
          "sportRank": "18",
          "leagueRank": "9",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "6",
          "wildCardGamesBack": "3.0",
          "divisionGamesBack": "13.0",
          "leagueGamesBack": "17.0",
          "sportGamesBack": "17.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 5,
            "streakCode": "L5"
          },
          "leagueRecord": {
            "wins": 80,
            "losses": 82,
            "pct": ".494"
          },
          "home": {
            "wins": 43,
            "losses": 38,
            "pct": ".531"
          },
          "away": {
            "wins": 37,
            "losses": 44,
            "pct": ".457"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        },
        {
          "team": {
            "id": 115,
            "name": "Rockies",
            "abbreviation": "",
            "link": "/api/v1/teams/115",
            "logo": "https://www.mlbstatic.com/team-logos/115.svg"
          },
          "gamesPlayed": 162,
          "wins": 43,
          "losses": 119,
          "winningPercentage": ".265",
          "runsScored": 597,
          "runsAllowed": 1021,
          "runDifferential": -424,
          "sportRank": "30",
          "leagueRank": "15",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "12",
          "wildCardGamesBack": "40.0",
          "divisionGamesBack": "50.0",
          "leagueGamesBack": "54.0",
          "sportGamesBack": "54.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 6,
            "streakCode": "L6"
          },
          "leagueRecord": {
            "wins": 43,
            "losses": 119,
            "pct": ".265"
          },
          "home": {
            "wins": 25,
            "losses": 56,
            "pct": ".309"
          },
          "away": {
            "wins": 18,
            "losses": 63,
            "pct": ".222"
          },
          "lastTen": {
            "wins": 2,
            "losses": 8,
            "pct": ".200"
          }
        }
      ]
    }
  ],
  "wildcard": [
    {
      "team": {
        "id": 112,
        "name": "Cubs",
        "abbreviation": "",
        "link": "/api/v1/teams/112",
        "logo": "https://www.mlbstatic.com/team-logos/112.svg"
      },
      "gamesPlayed": 162,
      "wins": 92,
      "losses": 70,
      "winningPercentage": ".568",
      "runsScored": 793,
      "runsAllowed": 649,
      "runDifferential": 144,
      "sportRank": "6",
      "leagueRank": "4",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "1",
      "wildCardGamesBack": "+9.0",
      "divisionGamesBack": "5.0",
      "leagueGamesBack": "5.0",
      "sportGamesBack": "5.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 3,
        "streakCode": "W3"
      },
      "leagueRecord": {
        "wins": 92,
        "losses": 70,
        "pct": ".568"
      },
      "home": {
        "wins": 50,
        "losses": 31,
        "pct": ".617"
      },
      "away": {
        "wins": 42,
        "losses": 39,
        "pct": ".519"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 135,
        "name": "Padres",
        "abbreviation": "",
        "link": "/api/v1/teams/135",
        "logo": "https://www.mlbstatic.com/team-logos/135.svg"
      },
      "gamesPlayed": 162,
      "wins": 90,
      "losses": 72,
      "winningPercentage": ".556",
      "runsScored": 702,
      "runsAllowed": 621,
      "runDifferential": 81,
      "sportRank": "8",
      "leagueRank": "5",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "2",
      "wildCardGamesBack": "+7.0",
      "divisionGamesBack": "3.0",
      "leagueGamesBack": "7.0",
      "sportGamesBack": "7.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 3,
        "streakCode": "W3"
      },
      "leagueRecord": {
        "wins": 90,
        "losses": 72,
        "pct": ".556"
      },
      "home": {
        "wins": 52,
        "losses": 29,
        "pct": ".642"
      },
      "away": {
        "wins": 38,
        "losses": 43,
        "pct": ".469"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 113,
        "name": "Reds",
        "abbreviation": "",
        "link": "/api/v1/teams/113",
        "logo": "https://www.mlbstatic.com/team-logos/113.svg"
      },
      "gamesPlayed": 162,
      "wins": 83,
      "losses": 79,
      "winningPercentage": ".512",
      "runsScored": 716,
      "runsAllowed": 681,
      "runDifferential": 35,
      "sportRank": "14",
      "leagueRank": "7",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "3",
      "wildCardGamesBack": "-",
      "divisionGamesBack": "14.0",
      "leagueGamesBack": "14.0",
      "sportGamesBack": "14.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 83,
        "losses": 79,
        "pct": ".512"
      },
      "home": {
        "wins": 45,
        "losses": 36,
        "pct": ".556"
      },
      "away": {
        "wins": 38,
        "losses": 43,
        "pct": ".469"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 121,
        "name": "Mets",
        "abbreviation": "",
        "link": "/api/v1/teams/121",
        "logo": "https://www.mlbstatic.com/team-logos/121.svg"
      },
      "gamesPlayed": 162,
      "wins": 83,
      "losses": 79,
      "winningPercentage": ".512",
      "runsScored": 766,
      "runsAllowed": 715,
      "runDifferential": 51,
      "sportRank": "13",
      "leagueRank": "6",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "4",
      "wildCardGamesBack": "-",
      "divisionGamesBack": "13.0",
      "leagueGamesBack": "14.0",
      "sportGamesBack": "14.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 83,
        "losses": 79,
        "pct": ".512"
      },
      "home": {
        "wins": 49,
        "losses": 32,
        "pct": ".605"
      },
      "away": {
        "wins": 34,
        "losses": 47,
        "pct": ".420"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 137,
        "name": "Giants",
        "abbreviation": "",
        "link": "/api/v1/teams/137",
        "logo": "https://www.mlbstatic.com/team-logos/137.svg"
      },
      "gamesPlayed": 162,
      "wins": 81,
      "losses": 81,
      "winningPercentage": ".500",
      "runsScored": 705,
      "runsAllowed": 684,
      "runDifferential": 21,
      "sportRank": "16",
      "leagueRank": "8",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "5",
      "wildCardGamesBack": "2.0",
      "divisionGamesBack": "12.0",
      "leagueGamesBack": "16.0",
      "sportGamesBack": "16.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 4,
        "streakCode": "W4"
      },
      "leagueRecord": {
        "wins": 81,
        "losses": 81,
        "pct": ".500"
      },
      "home": {
        "wins": 42,
        "losses": 39,
        "pct": ".519"
      },
      "away": {
        "wins": 39,
        "losses": 42,
        "pct": ".481"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 109,
        "name": "D-backs",
        "abbreviation": "",
        "link": "/api/v1/teams/109",
        "logo": "https://www.mlbstatic.com/team-logos/109.svg"
      },
      "gamesPlayed": 162,
      "wins": 80,
      "losses": 82,
      "winningPercentage": ".494",
      "runsScored": 791,
      "runsAllowed": 785,
      "runDifferential": 6,
      "sportRank": "18",
      "leagueRank": "9",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "6",
      "wildCardGamesBack": "3.0",
      "divisionGamesBack": "13.0",
      "leagueGamesBack": "17.0",
      "sportGamesBack": "17.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 5,
        "streakCode": "L5"
      },
      "leagueRecord": {
        "wins": 80,
        "losses": 82,
        "pct": ".494"
      },
      "home": {
        "wins": 43,
        "losses": 38,
        "pct": ".531"
      },
      "away": {
        "wins": 37,
        "losses": 44,
        "pct": ".457"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 146,
        "name": "Marlins",
        "abbreviation": "",
        "link": "/api/v1/teams/146",
        "logo": "https://www.mlbstatic.com/team-logos/146.svg"
      },
      "gamesPlayed": 162,
      "wins": 79,
      "losses": 83,
      "winningPercentage": ".488",
      "runsScored": 709,
      "runsAllowed": 798,
      "runDifferential": -89,
      "sportRank": "19",
      "leagueRank": "10",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "7",
      "wildCardGamesBack": "4.0",
      "divisionGamesBack": "17.0",
      "leagueGamesBack": "18.0",
      "sportGamesBack": "18.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 79,
        "losses": 83,
        "pct": ".488"
      },
      "home": {
        "wins": 38,
        "losses": 43,
        "pct": ".469"
      },
      "away": {
        "wins": 41,
        "losses": 40,
        "pct": ".506"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 138,
        "name": "Cardinals",
        "abbreviation": "",
        "link": "/api/v1/teams/138",
        "logo": "https://www.mlbstatic.com/team-logos/138.svg"
      },
      "gamesPlayed": 162,
      "wins": 78,
      "losses": 84,
      "winningPercentage": ".481",
      "runsScored": 689,
      "runsAllowed": 754,
      "runDifferential": -65,
      "sportRank": "20",
      "leagueRank": "11",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "8",
      "wildCardGamesBack": "5.0",
      "divisionGamesBack": "19.0",
      "leagueGamesBack": "19.0",
      "sportGamesBack": "19.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 4,
        "streakCode": "L4"
      },
      "leagueRecord": {
        "wins": 78,
        "losses": 84,
        "pct": ".481"
      },
      "home": {
        "wins": 44,
        "losses": 37,
        "pct": ".543"
      },
      "away": {
        "wins": 34,
        "losses": 47,
        "pct": ".420"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 144,
        "name": "Braves",
        "abbreviation": "",
        "link": "/api/v1/teams/144",
        "logo": "https://www.mlbstatic.com/team-logos/144.svg"
      },
      "gamesPlayed": 162,
      "wins": 76,
      "losses": 86,
      "winningPercentage": ".469",
      "runsScored": 724,
      "runsAllowed": 734,
      "runDifferential": -10,
      "sportRank": "23",
      "leagueRank": "12",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "9",
      "wildCardGamesBack": "7.0",
      "divisionGamesBack": "20.0",
      "leagueGamesBack": "21.0",
      "sportGamesBack": "21.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 76,
        "losses": 86,
        "pct": ".469"
      },
      "home": {
        "wins": 39,
        "losses": 42,
        "pct": ".481"
      },
      "away": {
        "wins": 37,
        "losses": 44,
        "pct": ".457"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 134,
        "name": "Pirates",
        "abbreviation": "",
        "link": "/api/v1/teams/134",
        "logo": "https://www.mlbstatic.com/team-logos/134.svg"
      },
      "gamesPlayed": 162,
      "wins": 71,
      "losses": 91,
      "winningPercentage": ".438",
      "runsScored": 583,
      "runsAllowed": 645,
      "runDifferential": -62,
      "sportRank": "26",
      "leagueRank": "13",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "10",
      "wildCardGamesBack": "12.0",
      "divisionGamesBack": "26.0",
      "leagueGamesBack": "26.0",
      "sportGamesBack": "26.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 71,
        "losses": 91,
        "pct": ".438"
      },
      "home": {
        "wins": 44,
        "losses": 37,
        "pct": ".543"
      },
      "away": {
        "wins": 27,
        "losses": 54,
        "pct": ".333"
      },
      "lastTen": {
        "wins": 6,
        "losses": 4,
        "pct": ".600"
      }
    },
    {
      "team": {
        "id": 120,
        "name": "Nationals",
        "abbreviation": "",
        "link": "/api/v1/teams/120",
        "logo": "https://www.mlbstatic.com/team-logos/120.svg"
      },
      "gamesPlayed": 162,
      "wins": 66,
      "losses": 96,
      "winningPercentage": ".407",
      "runsScored": 687,
      "runsAllowed": 899,
      "runDifferential": -212,
      "sportRank": "28",
      "leagueRank": "14",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "11",
      "wildCardGamesBack": "17.0",
      "divisionGamesBack": "30.0",
      "leagueGamesBack": "31.0",
      "sportGamesBack": "31.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 66,
        "losses": 96,
        "pct": ".407"
      },
      "home": {
        "wins": 32,
        "losses": 49,
        "pct": ".395"
      },
      "away": {
        "wins": 34,
        "losses": 47,
        "pct": ".420"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 115,
        "name": "Rockies",
        "abbreviation": "",
        "link": "/api/v1/teams/115",
        "logo": "https://www.mlbstatic.com/team-logos/115.svg"
      },
      "gamesPlayed": 162,
      "wins": 43,
      "losses": 119,
      "winningPercentage": ".265",
      "runsScored": 597,
      "runsAllowed": 1021,
      "runDifferential": -424,
      "sportRank": "30",
      "leagueRank": "15",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "12",
      "wildCardGamesBack": "40.0",
      "divisionGamesBack": "50.0",
      "leagueGamesBack": "54.0",
      "sportGamesBack": "54.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 6,
        "streakCode": "L6"
      },
      "leagueRecord": {
        "wins": 43,
        "losses": 119,
        "pct": ".265"
      },
      "home": {
        "wins": 25,
        "losses": 56,
        "pct": ".309"
      },
      "away": {
        "wins": 18,
        "losses": 63,
        "pct": ".222"
      },
      "lastTen": {
        "wins": 2,
        "losses": 8,
        "pct": ".200"
      }
    }
  ],
  "updatedAt": {
    "_seconds": 1776240911,
    "_nanoseconds": 274000000
  }
}
```
</details>

<details>
<summary>mlb_standings/2026</summary>

```json
{
  "date": null,
  "season": "2026",
  "source": "statsapi.mlb.com/api/v1/standings",
  "leagueIds": [
    "103",
    "104"
  ],
  "sport": "mlb",
  "standingsTypes": "regularSeason",
  "updatedAt": {
    "_seconds": 1781693283,
    "_nanoseconds": 860000000
  }
}
```
</details>


### Collection: `mlb_standings/2026/leagues`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | null | null / null |
| `league` | map | {...} / {...} |
| `league.link` | string | "/api/v1/league/103" / "/api/v1/league/104" |
| `league.name` | string | "" / "" |
| `league.id` | number | 103 / 104 |
| `season` | string | "2026" / "2026" |
| `source` | string | "statsapi.mlb.com/api/v1/standings" / "statsapi.mlb.com/api/v1/standings" |
| `standingsTypes` | string | "regularSeason" / "regularSeason" |
| `divisions` | array | [{"key":"2026_regularSeason_201","division":{"id":201,"name":"AL East","nameShort":"","abbreviation" / [{"key":"2026_regularSeason_204","division":{"id":204,"name":"NL East","nameShort":"","abbreviation" |
| `wildcard` | array | [{"team":{"id":139,"name":"Rays","abbreviation":"","link":"/api/v1/teams/139","logo":"https://www.ml / [{"team":{"id":138,"name":"Cardinals","abbreviation":"","link":"/api/v1/teams/138","logo":"https://w |
| `updatedAt` | timestamp | {"_seconds":1781693283,"_nanoseconds":973000000} / {"_seconds":1781693284,"_nanoseconds":161000000} |

### Documents exemples

<details>
<summary>mlb_standings/2026/leagues/103</summary>

```json
{
  "date": null,
  "league": {
    "link": "/api/v1/league/103",
    "name": "",
    "id": 103
  },
  "season": "2026",
  "source": "statsapi.mlb.com/api/v1/standings",
  "standingsTypes": "regularSeason",
  "divisions": [
    {
      "key": "2026_regularSeason_201",
      "division": {
        "id": 201,
        "name": "AL East",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/201"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 147,
            "name": "Yankees",
            "abbreviation": "",
            "link": "/api/v1/teams/147",
            "logo": "https://www.mlbstatic.com/team-logos/147.svg"
          },
          "gamesPlayed": 71,
          "wins": 44,
          "losses": 27,
          "winningPercentage": ".620",
          "runsScored": 370,
          "runsAllowed": 253,
          "runDifferential": 117,
          "sportRank": "4",
          "leagueRank": "1",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "-",
          "sportGamesBack": "2.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 3,
            "streakCode": "W3"
          },
          "leagueRecord": {
            "wins": 44,
            "losses": 27,
            "pct": ".620"
          },
          "home": {
            "wins": 20,
            "losses": 12,
            "pct": ".625"
          },
          "away": {
            "wins": 24,
            "losses": 15,
            "pct": ".615"
          },
          "lastTen": {
            "wins": 8,
            "losses": 2,
            "pct": ".800"
          }
        },
        {
          "team": {
            "id": 139,
            "name": "Rays",
            "abbreviation": "",
            "link": "/api/v1/teams/139",
            "logo": "https://www.mlbstatic.com/team-logos/139.svg"
          },
          "gamesPlayed": 70,
          "wins": 41,
          "losses": 29,
          "winningPercentage": ".586",
          "runsScored": 311,
          "runsAllowed": 305,
          "runDifferential": 6,
          "sportRank": "5",
          "leagueRank": "2",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "1",
          "wildCardGamesBack": "+6.5",
          "divisionGamesBack": "2.5",
          "leagueGamesBack": "2.5",
          "sportGamesBack": "4.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 41,
            "losses": 29,
            "pct": ".586"
          },
          "home": {
            "wins": 24,
            "losses": 9,
            "pct": ".727"
          },
          "away": {
            "wins": 17,
            "losses": 20,
            "pct": ".459"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 141,
            "name": "Blue Jays",
            "abbreviation": "",
            "link": "/api/v1/teams/141",
            "logo": "https://www.mlbstatic.com/team-logos/141.svg"
          },
          "gamesPlayed": 73,
          "wins": 35,
          "losses": 38,
          "winningPercentage": ".479",
          "runsScored": 299,
          "runsAllowed": 316,
          "runDifferential": -17,
          "sportRank": "19",
          "leagueRank": "7",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "4",
          "wildCardGamesBack": "1.0",
          "divisionGamesBack": "10.0",
          "leagueGamesBack": "10.0",
          "sportGamesBack": "12.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 35,
            "losses": 38,
            "pct": ".479"
          },
          "home": {
            "wins": 21,
            "losses": 18,
            "pct": ".538"
          },
          "away": {
            "wins": 14,
            "losses": 20,
            "pct": ".412"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 110,
            "name": "Orioles",
            "abbreviation": "",
            "link": "/api/v1/teams/110",
            "logo": "https://www.mlbstatic.com/team-logos/110.svg"
          },
          "gamesPlayed": 74,
          "wins": 34,
          "losses": 40,
          "winningPercentage": ".459",
          "runsScored": 344,
          "runsAllowed": 379,
          "runDifferential": -35,
          "sportRank": "22",
          "leagueRank": "10",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "7",
          "wildCardGamesBack": "2.5",
          "divisionGamesBack": "11.5",
          "leagueGamesBack": "11.5",
          "sportGamesBack": "13.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 3,
            "streakCode": "L3"
          },
          "leagueRecord": {
            "wins": 34,
            "losses": 40,
            "pct": ".459"
          },
          "home": {
            "wins": 22,
            "losses": 19,
            "pct": ".537"
          },
          "away": {
            "wins": 12,
            "losses": 21,
            "pct": ".364"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        },
        {
          "team": {
            "id": 111,
            "name": "Red Sox",
            "abbreviation": "",
            "link": "/api/v1/teams/111",
            "logo": "https://www.mlbstatic.com/team-logos/111.svg"
          },
          "gamesPlayed": 70,
          "wins": 29,
          "losses": 41,
          "winningPercentage": ".414",
          "runsScored": 279,
          "runsAllowed": 288,
          "runDifferential": -9,
          "sportRank": "25",
          "leagueRank": "12",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "9",
          "wildCardGamesBack": "5.5",
          "divisionGamesBack": "14.5",
          "leagueGamesBack": "14.5",
          "sportGamesBack": "16.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 29,
            "losses": 41,
            "pct": ".414"
          },
          "home": {
            "wins": 12,
            "losses": 23,
            "pct": ".343"
          },
          "away": {
            "wins": 17,
            "losses": 18,
            "pct": ".486"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        }
      ]
    },
    {
      "key": "2026_regularSeason_202",
      "division": {
        "id": 202,
        "name": "AL Central",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/202"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 145,
            "name": "White Sox",
            "abbreviation": "",
            "link": "/api/v1/teams/145",
            "logo": "https://www.mlbstatic.com/team-logos/145.svg"
          },
          "gamesPlayed": 71,
          "wins": 38,
          "losses": 33,
          "winningPercentage": ".535",
          "runsScored": 335,
          "runsAllowed": 333,
          "runDifferential": 2,
          "sportRank": "8",
          "leagueRank": "3",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "6.0",
          "sportGamesBack": "8.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 38,
            "losses": 33,
            "pct": ".535"
          },
          "home": {
            "wins": 24,
            "losses": 12,
            "pct": ".667"
          },
          "away": {
            "wins": 14,
            "losses": 21,
            "pct": ".400"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        },
        {
          "team": {
            "id": 114,
            "name": "Guardians",
            "abbreviation": "",
            "link": "/api/v1/teams/114",
            "logo": "https://www.mlbstatic.com/team-logos/114.svg"
          },
          "gamesPlayed": 73,
          "wins": 39,
          "losses": 34,
          "winningPercentage": ".534",
          "runsScored": 290,
          "runsAllowed": 294,
          "runDifferential": -4,
          "sportRank": "9",
          "leagueRank": "4",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "2",
          "wildCardGamesBack": "+3.0",
          "divisionGamesBack": "-",
          "leagueGamesBack": "6.0",
          "sportGamesBack": "8.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 39,
            "losses": 34,
            "pct": ".534"
          },
          "home": {
            "wins": 19,
            "losses": 17,
            "pct": ".528"
          },
          "away": {
            "wins": 20,
            "losses": 17,
            "pct": ".541"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        },
        {
          "team": {
            "id": 142,
            "name": "Twins",
            "abbreviation": "",
            "link": "/api/v1/teams/142",
            "logo": "https://www.mlbstatic.com/team-logos/142.svg"
          },
          "gamesPlayed": 75,
          "wins": 35,
          "losses": 40,
          "winningPercentage": ".467",
          "runsScored": 354,
          "runsAllowed": 384,
          "runDifferential": -30,
          "sportRank": "21",
          "leagueRank": "9",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "6",
          "wildCardGamesBack": "2.0",
          "divisionGamesBack": "5.0",
          "leagueGamesBack": "11.0",
          "sportGamesBack": "13.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 3,
            "streakCode": "W3"
          },
          "leagueRecord": {
            "wins": 35,
            "losses": 40,
            "pct": ".467"
          },
          "home": {
            "wins": 20,
            "losses": 19,
            "pct": ".513"
          },
          "away": {
            "wins": 15,
            "losses": 21,
            "pct": ".417"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 116,
            "name": "Tigers",
            "abbreviation": "",
            "link": "/api/v1/teams/116",
            "logo": "https://www.mlbstatic.com/team-logos/116.svg"
          },
          "gamesPlayed": 73,
          "wins": 30,
          "losses": 43,
          "winningPercentage": ".411",
          "runsScored": 299,
          "runsAllowed": 307,
          "runDifferential": -8,
          "sportRank": "26",
          "leagueRank": "13",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "10",
          "wildCardGamesBack": "6.0",
          "divisionGamesBack": "9.0",
          "leagueGamesBack": "15.0",
          "sportGamesBack": "17.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 30,
            "losses": 43,
            "pct": ".411"
          },
          "home": {
            "wins": 18,
            "losses": 16,
            "pct": ".529"
          },
          "away": {
            "wins": 12,
            "losses": 27,
            "pct": ".308"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 118,
            "name": "Royals",
            "abbreviation": "",
            "link": "/api/v1/teams/118",
            "logo": "https://www.mlbstatic.com/team-logos/118.svg"
          },
          "gamesPlayed": 74,
          "wins": 29,
          "losses": 45,
          "winningPercentage": ".392",
          "runsScored": 295,
          "runsAllowed": 350,
          "runDifferential": -55,
          "sportRank": "29",
          "leagueRank": "15",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "12",
          "wildCardGamesBack": "7.5",
          "divisionGamesBack": "10.5",
          "leagueGamesBack": "16.5",
          "sportGamesBack": "18.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 29,
            "losses": 45,
            "pct": ".392"
          },
          "home": {
            "wins": 17,
            "losses": 21,
            "pct": ".447"
          },
          "away": {
            "wins": 12,
            "losses": 24,
            "pct": ".333"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        }
      ]
    },
    {
      "key": "2026_regularSeason_200",
      "division": {
        "id": 200,
        "name": "AL West",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/200"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 136,
            "name": "Mariners",
            "abbreviation": "",
            "link": "/api/v1/teams/136",
            "logo": "https://www.mlbstatic.com/team-logos/136.svg"
          },
          "gamesPlayed": 74,
          "wins": 38,
          "losses": 36,
          "winningPercentage": ".514",
          "runsScored": 314,
          "runsAllowed": 292,
          "runDifferential": 22,
          "sportRank": "12",
          "leagueRank": "5",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "7.5",
          "sportGamesBack": "9.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 38,
            "losses": 36,
            "pct": ".514"
          },
          "home": {
            "wins": 20,
            "losses": 16,
            "pct": ".556"
          },
          "away": {
            "wins": 18,
            "losses": 20,
            "pct": ".474"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 133,
            "name": "Athletics",
            "abbreviation": "",
            "link": "/api/v1/teams/133",
            "logo": "https://www.mlbstatic.com/team-logos/133.svg"
          },
          "gamesPlayed": 73,
          "wins": 36,
          "losses": 37,
          "winningPercentage": ".493",
          "runsScored": 336,
          "runsAllowed": 379,
          "runDifferential": -43,
          "sportRank": "16",
          "leagueRank": "6",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "3",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "1.5",
          "leagueGamesBack": "9.0",
          "sportGamesBack": "11.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 36,
            "losses": 37,
            "pct": ".493"
          },
          "home": {
            "wins": 16,
            "losses": 20,
            "pct": ".444"
          },
          "away": {
            "wins": 20,
            "losses": 17,
            "pct": ".541"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        },
        {
          "team": {
            "id": 140,
            "name": "Rangers",
            "abbreviation": "",
            "link": "/api/v1/teams/140",
            "logo": "https://www.mlbstatic.com/team-logos/140.svg"
          },
          "gamesPlayed": 73,
          "wins": 35,
          "losses": 38,
          "winningPercentage": ".479",
          "runsScored": 289,
          "runsAllowed": 295,
          "runDifferential": -6,
          "sportRank": "20",
          "leagueRank": "8",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "5",
          "wildCardGamesBack": "1.0",
          "divisionGamesBack": "2.5",
          "leagueGamesBack": "10.0",
          "sportGamesBack": "12.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 35,
            "losses": 38,
            "pct": ".479"
          },
          "home": {
            "wins": 17,
            "losses": 16,
            "pct": ".515"
          },
          "away": {
            "wins": 18,
            "losses": 22,
            "pct": ".450"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 117,
            "name": "Astros",
            "abbreviation": "",
            "link": "/api/v1/teams/117",
            "logo": "https://www.mlbstatic.com/team-logos/117.svg"
          },
          "gamesPlayed": 75,
          "wins": 34,
          "losses": 41,
          "winningPercentage": ".453",
          "runsScored": 340,
          "runsAllowed": 383,
          "runDifferential": -43,
          "sportRank": "23",
          "leagueRank": "11",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "8",
          "wildCardGamesBack": "3.0",
          "divisionGamesBack": "4.5",
          "leagueGamesBack": "12.0",
          "sportGamesBack": "14.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 34,
            "losses": 41,
            "pct": ".453"
          },
          "home": {
            "wins": 17,
            "losses": 20,
            "pct": ".459"
          },
          "away": {
            "wins": 17,
            "losses": 21,
            "pct": ".447"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 108,
            "name": "Angels",
            "abbreviation": "",
            "link": "/api/v1/teams/108",
            "logo": "https://www.mlbstatic.com/team-logos/108.svg"
          },
          "gamesPlayed": 74,
          "wins": 30,
          "losses": 44,
          "winningPercentage": ".405",
          "runsScored": 333,
          "runsAllowed": 365,
          "runDifferential": -32,
          "sportRank": "27",
          "leagueRank": "14",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "11",
          "wildCardGamesBack": "6.5",
          "divisionGamesBack": "8.0",
          "leagueGamesBack": "15.5",
          "sportGamesBack": "17.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 30,
            "losses": 44,
            "pct": ".405"
          },
          "home": {
            "wins": 17,
            "losses": 20,
            "pct": ".459"
          },
          "away": {
            "wins": 13,
            "losses": 24,
            "pct": ".351"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        }
      ]
    }
  ],
  "wildcard": [
    {
      "team": {
        "id": 139,
        "name": "Rays",
        "abbreviation": "",
        "link": "/api/v1/teams/139",
        "logo": "https://www.mlbstatic.com/team-logos/139.svg"
      },
      "gamesPlayed": 70,
      "wins": 41,
      "losses": 29,
      "winningPercentage": ".586",
      "runsScored": 311,
      "runsAllowed": 305,
      "runDifferential": 6,
      "sportRank": "5",
      "leagueRank": "2",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "1",
      "wildCardGamesBack": "+6.5",
      "divisionGamesBack": "2.5",
      "leagueGamesBack": "2.5",
      "sportGamesBack": "4.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 41,
        "losses": 29,
        "pct": ".586"
      },
      "home": {
        "wins": 24,
        "losses": 9,
        "pct": ".727"
      },
      "away": {
        "wins": 17,
        "losses": 20,
        "pct": ".459"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 114,
        "name": "Guardians",
        "abbreviation": "",
        "link": "/api/v1/teams/114",
        "logo": "https://www.mlbstatic.com/team-logos/114.svg"
      },
      "gamesPlayed": 73,
      "wins": 39,
      "losses": 34,
      "winningPercentage": ".534",
      "runsScored": 290,
      "runsAllowed": 294,
      "runDifferential": -4,
      "sportRank": "9",
      "leagueRank": "4",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "2",
      "wildCardGamesBack": "+3.0",
      "divisionGamesBack": "-",
      "leagueGamesBack": "6.0",
      "sportGamesBack": "8.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 39,
        "losses": 34,
        "pct": ".534"
      },
      "home": {
        "wins": 19,
        "losses": 17,
        "pct": ".528"
      },
      "away": {
        "wins": 20,
        "losses": 17,
        "pct": ".541"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 133,
        "name": "Athletics",
        "abbreviation": "",
        "link": "/api/v1/teams/133",
        "logo": "https://www.mlbstatic.com/team-logos/133.svg"
      },
      "gamesPlayed": 73,
      "wins": 36,
      "losses": 37,
      "winningPercentage": ".493",
      "runsScored": 336,
      "runsAllowed": 379,
      "runDifferential": -43,
      "sportRank": "16",
      "leagueRank": "6",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "3",
      "wildCardGamesBack": "-",
      "divisionGamesBack": "1.5",
      "leagueGamesBack": "9.0",
      "sportGamesBack": "11.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 36,
        "losses": 37,
        "pct": ".493"
      },
      "home": {
        "wins": 16,
        "losses": 20,
        "pct": ".444"
      },
      "away": {
        "wins": 20,
        "losses": 17,
        "pct": ".541"
      },
      "lastTen": {
        "wins": 6,
        "losses": 4,
        "pct": ".600"
      }
    },
    {
      "team": {
        "id": 141,
        "name": "Blue Jays",
        "abbreviation": "",
        "link": "/api/v1/teams/141",
        "logo": "https://www.mlbstatic.com/team-logos/141.svg"
      },
      "gamesPlayed": 73,
      "wins": 35,
      "losses": 38,
      "winningPercentage": ".479",
      "runsScored": 299,
      "runsAllowed": 316,
      "runDifferential": -17,
      "sportRank": "19",
      "leagueRank": "7",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "4",
      "wildCardGamesBack": "1.0",
      "divisionGamesBack": "10.0",
      "leagueGamesBack": "10.0",
      "sportGamesBack": "12.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 35,
        "losses": 38,
        "pct": ".479"
      },
      "home": {
        "wins": 21,
        "losses": 18,
        "pct": ".538"
      },
      "away": {
        "wins": 14,
        "losses": 20,
        "pct": ".412"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 140,
        "name": "Rangers",
        "abbreviation": "",
        "link": "/api/v1/teams/140",
        "logo": "https://www.mlbstatic.com/team-logos/140.svg"
      },
      "gamesPlayed": 73,
      "wins": 35,
      "losses": 38,
      "winningPercentage": ".479",
      "runsScored": 289,
      "runsAllowed": 295,
      "runDifferential": -6,
      "sportRank": "20",
      "leagueRank": "8",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "5",
      "wildCardGamesBack": "1.0",
      "divisionGamesBack": "2.5",
      "leagueGamesBack": "10.0",
      "sportGamesBack": "12.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 35,
        "losses": 38,
        "pct": ".479"
      },
      "home": {
        "wins": 17,
        "losses": 16,
        "pct": ".515"
      },
      "away": {
        "wins": 18,
        "losses": 22,
        "pct": ".450"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 142,
        "name": "Twins",
        "abbreviation": "",
        "link": "/api/v1/teams/142",
        "logo": "https://www.mlbstatic.com/team-logos/142.svg"
      },
      "gamesPlayed": 75,
      "wins": 35,
      "losses": 40,
      "winningPercentage": ".467",
      "runsScored": 354,
      "runsAllowed": 384,
      "runDifferential": -30,
      "sportRank": "21",
      "leagueRank": "9",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "6",
      "wildCardGamesBack": "2.0",
      "divisionGamesBack": "5.0",
      "leagueGamesBack": "11.0",
      "sportGamesBack": "13.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 3,
        "streakCode": "W3"
      },
      "leagueRecord": {
        "wins": 35,
        "losses": 40,
        "pct": ".467"
      },
      "home": {
        "wins": 20,
        "losses": 19,
        "pct": ".513"
      },
      "away": {
        "wins": 15,
        "losses": 21,
        "pct": ".417"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 110,
        "name": "Orioles",
        "abbreviation": "",
        "link": "/api/v1/teams/110",
        "logo": "https://www.mlbstatic.com/team-logos/110.svg"
      },
      "gamesPlayed": 74,
      "wins": 34,
      "losses": 40,
      "winningPercentage": ".459",
      "runsScored": 344,
      "runsAllowed": 379,
      "runDifferential": -35,
      "sportRank": "22",
      "leagueRank": "10",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "7",
      "wildCardGamesBack": "2.5",
      "divisionGamesBack": "11.5",
      "leagueGamesBack": "11.5",
      "sportGamesBack": "13.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 3,
        "streakCode": "L3"
      },
      "leagueRecord": {
        "wins": 34,
        "losses": 40,
        "pct": ".459"
      },
      "home": {
        "wins": 22,
        "losses": 19,
        "pct": ".537"
      },
      "away": {
        "wins": 12,
        "losses": 21,
        "pct": ".364"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 117,
        "name": "Astros",
        "abbreviation": "",
        "link": "/api/v1/teams/117",
        "logo": "https://www.mlbstatic.com/team-logos/117.svg"
      },
      "gamesPlayed": 75,
      "wins": 34,
      "losses": 41,
      "winningPercentage": ".453",
      "runsScored": 340,
      "runsAllowed": 383,
      "runDifferential": -43,
      "sportRank": "23",
      "leagueRank": "11",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "8",
      "wildCardGamesBack": "3.0",
      "divisionGamesBack": "4.5",
      "leagueGamesBack": "12.0",
      "sportGamesBack": "14.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 34,
        "losses": 41,
        "pct": ".453"
      },
      "home": {
        "wins": 17,
        "losses": 20,
        "pct": ".459"
      },
      "away": {
        "wins": 17,
        "losses": 21,
        "pct": ".447"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 111,
        "name": "Red Sox",
        "abbreviation": "",
        "link": "/api/v1/teams/111",
        "logo": "https://www.mlbstatic.com/team-logos/111.svg"
      },
      "gamesPlayed": 70,
      "wins": 29,
      "losses": 41,
      "winningPercentage": ".414",
      "runsScored": 279,
      "runsAllowed": 288,
      "runDifferential": -9,
      "sportRank": "25",
      "leagueRank": "12",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "9",
      "wildCardGamesBack": "5.5",
      "divisionGamesBack": "14.5",
      "leagueGamesBack": "14.5",
      "sportGamesBack": "16.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 29,
        "losses": 41,
        "pct": ".414"
      },
      "home": {
        "wins": 12,
        "losses": 23,
        "pct": ".343"
      },
      "away": {
        "wins": 17,
        "losses": 18,
        "pct": ".486"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 116,
        "name": "Tigers",
        "abbreviation": "",
        "link": "/api/v1/teams/116",
        "logo": "https://www.mlbstatic.com/team-logos/116.svg"
      },
      "gamesPlayed": 73,
      "wins": 30,
      "losses": 43,
      "winningPercentage": ".411",
      "runsScored": 299,
      "runsAllowed": 307,
      "runDifferential": -8,
      "sportRank": "26",
      "leagueRank": "13",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "10",
      "wildCardGamesBack": "6.0",
      "divisionGamesBack": "9.0",
      "leagueGamesBack": "15.0",
      "sportGamesBack": "17.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 30,
        "losses": 43,
        "pct": ".411"
      },
      "home": {
        "wins": 18,
        "losses": 16,
        "pct": ".529"
      },
      "away": {
        "wins": 12,
        "losses": 27,
        "pct": ".308"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 108,
        "name": "Angels",
        "abbreviation": "",
        "link": "/api/v1/teams/108",
        "logo": "https://www.mlbstatic.com/team-logos/108.svg"
      },
      "gamesPlayed": 74,
      "wins": 30,
      "losses": 44,
      "winningPercentage": ".405",
      "runsScored": 333,
      "runsAllowed": 365,
      "runDifferential": -32,
      "sportRank": "27",
      "leagueRank": "14",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "11",
      "wildCardGamesBack": "6.5",
      "divisionGamesBack": "8.0",
      "leagueGamesBack": "15.5",
      "sportGamesBack": "17.5",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 30,
        "losses": 44,
        "pct": ".405"
      },
      "home": {
        "wins": 17,
        "losses": 20,
        "pct": ".459"
      },
      "away": {
        "wins": 13,
        "losses": 24,
        "pct": ".351"
      },
      "lastTen": {
        "wins": 6,
        "losses": 4,
        "pct": ".600"
      }
    },
    {
      "team": {
        "id": 118,
        "name": "Royals",
        "abbreviation": "",
        "link": "/api/v1/teams/118",
        "logo": "https://www.mlbstatic.com/team-logos/118.svg"
      },
      "gamesPlayed": 74,
      "wins": 29,
      "losses": 45,
      "winningPercentage": ".392",
      "runsScored": 295,
      "runsAllowed": 350,
      "runDifferential": -55,
      "sportRank": "29",
      "leagueRank": "15",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "12",
      "wildCardGamesBack": "7.5",
      "divisionGamesBack": "10.5",
      "leagueGamesBack": "16.5",
      "sportGamesBack": "18.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 29,
        "losses": 45,
        "pct": ".392"
      },
      "home": {
        "wins": 17,
        "losses": 21,
        "pct": ".447"
      },
      "away": {
        "wins": 12,
        "losses": 24,
        "pct": ".333"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    }
  ],
  "updatedAt": {
    "_seconds": 1781693283,
    "_nanoseconds": 973000000
  }
}
```
</details>

<details>
<summary>mlb_standings/2026/leagues/104</summary>

```json
{
  "date": null,
  "league": {
    "link": "/api/v1/league/104",
    "name": "",
    "id": 104
  },
  "season": "2026",
  "source": "statsapi.mlb.com/api/v1/standings",
  "standingsTypes": "regularSeason",
  "divisions": [
    {
      "key": "2026_regularSeason_204",
      "division": {
        "id": 204,
        "name": "NL East",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/204"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 144,
            "name": "Braves",
            "abbreviation": "",
            "link": "/api/v1/teams/144",
            "logo": "https://www.mlbstatic.com/team-logos/144.svg"
          },
          "gamesPlayed": 71,
          "wins": 46,
          "losses": 25,
          "winningPercentage": ".648",
          "runsScored": 359,
          "runsAllowed": 252,
          "runDifferential": 107,
          "sportRank": "1",
          "leagueRank": "1",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "-",
          "sportGamesBack": "-",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 46,
            "losses": 25,
            "pct": ".648"
          },
          "home": {
            "wins": 22,
            "losses": 11,
            "pct": ".667"
          },
          "away": {
            "wins": 24,
            "losses": 14,
            "pct": ".632"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 143,
            "name": "Phillies",
            "abbreviation": "",
            "link": "/api/v1/teams/143",
            "logo": "https://www.mlbstatic.com/team-logos/143.svg"
          },
          "gamesPlayed": 73,
          "wins": 40,
          "losses": 33,
          "winningPercentage": ".548",
          "runsScored": 300,
          "runsAllowed": 310,
          "runDifferential": -10,
          "sportRank": "7",
          "leagueRank": "5",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "2",
          "wildCardGamesBack": "+1.5",
          "divisionGamesBack": "7.0",
          "leagueGamesBack": "7.0",
          "sportGamesBack": "7.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 40,
            "losses": 33,
            "pct": ".548"
          },
          "home": {
            "wins": 21,
            "losses": 17,
            "pct": ".553"
          },
          "away": {
            "wins": 19,
            "losses": 16,
            "pct": ".543"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        },
        {
          "team": {
            "id": 120,
            "name": "Nationals",
            "abbreviation": "",
            "link": "/api/v1/teams/120",
            "logo": "https://www.mlbstatic.com/team-logos/120.svg"
          },
          "gamesPlayed": 74,
          "wins": 39,
          "losses": 35,
          "winningPercentage": ".527",
          "runsScored": 405,
          "runsAllowed": 386,
          "runDifferential": 19,
          "sportRank": "10",
          "leagueRank": "6",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "3",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "8.5",
          "leagueGamesBack": "8.5",
          "sportGamesBack": "8.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 4,
            "streakCode": "W4"
          },
          "leagueRecord": {
            "wins": 39,
            "losses": 35,
            "pct": ".527"
          },
          "home": {
            "wins": 16,
            "losses": 21,
            "pct": ".432"
          },
          "away": {
            "wins": 23,
            "losses": 14,
            "pct": ".622"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 146,
            "name": "Marlins",
            "abbreviation": "",
            "link": "/api/v1/teams/146",
            "logo": "https://www.mlbstatic.com/team-logos/146.svg"
          },
          "gamesPlayed": 74,
          "wins": 36,
          "losses": 38,
          "winningPercentage": ".486",
          "runsScored": 312,
          "runsAllowed": 325,
          "runDifferential": -13,
          "sportRank": "17",
          "leagueRank": "11",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "8",
          "wildCardGamesBack": "3.0",
          "divisionGamesBack": "11.5",
          "leagueGamesBack": "11.5",
          "sportGamesBack": "11.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 36,
            "losses": 38,
            "pct": ".486"
          },
          "home": {
            "wins": 23,
            "losses": 16,
            "pct": ".590"
          },
          "away": {
            "wins": 13,
            "losses": 22,
            "pct": ".371"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 121,
            "name": "Mets",
            "abbreviation": "",
            "link": "/api/v1/teams/121",
            "logo": "https://www.mlbstatic.com/team-logos/121.svg"
          },
          "gamesPlayed": 73,
          "wins": 32,
          "losses": 41,
          "winningPercentage": ".438",
          "runsScored": 291,
          "runsAllowed": 316,
          "runDifferential": -25,
          "sportRank": "24",
          "leagueRank": "13",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "10",
          "wildCardGamesBack": "6.5",
          "divisionGamesBack": "15.0",
          "leagueGamesBack": "15.0",
          "sportGamesBack": "15.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 32,
            "losses": 41,
            "pct": ".438"
          },
          "home": {
            "wins": 18,
            "losses": 18,
            "pct": ".500"
          },
          "away": {
            "wins": 14,
            "losses": 23,
            "pct": ".378"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        }
      ]
    },
    {
      "key": "2026_regularSeason_205",
      "division": {
        "id": 205,
        "name": "NL Central",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/205"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 158,
            "name": "Brewers",
            "abbreviation": "",
            "link": "/api/v1/teams/158",
            "logo": "https://www.mlbstatic.com/team-logos/158.svg"
          },
          "gamesPlayed": 70,
          "wins": 44,
          "losses": 26,
          "winningPercentage": ".629",
          "runsScored": 372,
          "runsAllowed": 259,
          "runDifferential": 113,
          "sportRank": "3",
          "leagueRank": "3",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "1.5",
          "sportGamesBack": "1.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 44,
            "losses": 26,
            "pct": ".629"
          },
          "home": {
            "wins": 24,
            "losses": 14,
            "pct": ".632"
          },
          "away": {
            "wins": 20,
            "losses": 12,
            "pct": ".625"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 138,
            "name": "Cardinals",
            "abbreviation": "",
            "link": "/api/v1/teams/138",
            "logo": "https://www.mlbstatic.com/team-logos/138.svg"
          },
          "gamesPlayed": 71,
          "wins": 40,
          "losses": 31,
          "winningPercentage": ".563",
          "runsScored": 325,
          "runsAllowed": 309,
          "runDifferential": 16,
          "sportRank": "6",
          "leagueRank": "4",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "1",
          "wildCardGamesBack": "+2.5",
          "divisionGamesBack": "4.5",
          "leagueGamesBack": "6.0",
          "sportGamesBack": "6.0",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 40,
            "losses": 31,
            "pct": ".563"
          },
          "home": {
            "wins": 21,
            "losses": 16,
            "pct": ".568"
          },
          "away": {
            "wins": 19,
            "losses": 15,
            "pct": ".559"
          },
          "lastTen": {
            "wins": 7,
            "losses": 3,
            "pct": ".700"
          }
        },
        {
          "team": {
            "id": 112,
            "name": "Cubs",
            "abbreviation": "",
            "link": "/api/v1/teams/112",
            "logo": "https://www.mlbstatic.com/team-logos/112.svg"
          },
          "gamesPlayed": 74,
          "wins": 38,
          "losses": 36,
          "winningPercentage": ".514",
          "runsScored": 336,
          "runsAllowed": 329,
          "runDifferential": 7,
          "sportRank": "13",
          "leagueRank": "8",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "5",
          "wildCardGamesBack": "1.0",
          "divisionGamesBack": "8.0",
          "leagueGamesBack": "9.5",
          "sportGamesBack": "9.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 38,
            "losses": 36,
            "pct": ".514"
          },
          "home": {
            "wins": 21,
            "losses": 16,
            "pct": ".568"
          },
          "away": {
            "wins": 17,
            "losses": 20,
            "pct": ".459"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 134,
            "name": "Pirates",
            "abbreviation": "",
            "link": "/api/v1/teams/134",
            "logo": "https://www.mlbstatic.com/team-logos/134.svg"
          },
          "gamesPlayed": 74,
          "wins": 37,
          "losses": 37,
          "winningPercentage": ".500",
          "runsScored": 367,
          "runsAllowed": 361,
          "runDifferential": 6,
          "sportRank": "15",
          "leagueRank": "10",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "7",
          "wildCardGamesBack": "2.0",
          "divisionGamesBack": "9.0",
          "leagueGamesBack": "10.5",
          "sportGamesBack": "10.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 37,
            "losses": 37,
            "pct": ".500"
          },
          "home": {
            "wins": 20,
            "losses": 19,
            "pct": ".513"
          },
          "away": {
            "wins": 17,
            "losses": 18,
            "pct": ".486"
          },
          "lastTen": {
            "wins": 3,
            "losses": 7,
            "pct": ".300"
          }
        },
        {
          "team": {
            "id": 113,
            "name": "Reds",
            "abbreviation": "",
            "link": "/api/v1/teams/113",
            "logo": "https://www.mlbstatic.com/team-logos/113.svg"
          },
          "gamesPlayed": 72,
          "wins": 35,
          "losses": 37,
          "winningPercentage": ".486",
          "runsScored": 310,
          "runsAllowed": 354,
          "runDifferential": -44,
          "sportRank": "18",
          "leagueRank": "12",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "9",
          "wildCardGamesBack": "3.0",
          "divisionGamesBack": "10.0",
          "leagueGamesBack": "11.5",
          "sportGamesBack": "11.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 35,
            "losses": 37,
            "pct": ".486"
          },
          "home": {
            "wins": 19,
            "losses": 18,
            "pct": ".514"
          },
          "away": {
            "wins": 16,
            "losses": 19,
            "pct": ".457"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        }
      ]
    },
    {
      "key": "2026_regularSeason_203",
      "division": {
        "id": 203,
        "name": "NL West",
        "nameShort": "",
        "abbreviation": "",
        "link": "/api/v1/divisions/203"
      },
      "conference": {
        "id": null,
        "name": "",
        "link": ""
      },
      "sport": {
        "id": 1,
        "link": "/api/v1/sports/1"
      },
      "teamRecords": [
        {
          "team": {
            "id": 119,
            "name": "Dodgers",
            "abbreviation": "",
            "link": "/api/v1/teams/119",
            "logo": "https://www.mlbstatic.com/team-logos/119.svg"
          },
          "gamesPlayed": 74,
          "wins": 47,
          "losses": 27,
          "winningPercentage": ".635",
          "runsScored": 391,
          "runsAllowed": 248,
          "runDifferential": 143,
          "sportRank": "2",
          "leagueRank": "2",
          "divisionRank": "1",
          "conferenceRank": "",
          "wildCardRank": "",
          "wildCardGamesBack": "-",
          "divisionGamesBack": "-",
          "leagueGamesBack": "0.5",
          "sportGamesBack": "0.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 2,
            "streakCode": "W2"
          },
          "leagueRecord": {
            "wins": 47,
            "losses": 27,
            "pct": ".635"
          },
          "home": {
            "wins": 24,
            "losses": 12,
            "pct": ".667"
          },
          "away": {
            "wins": 23,
            "losses": 15,
            "pct": ".605"
          },
          "lastTen": {
            "wins": 6,
            "losses": 4,
            "pct": ".600"
          }
        },
        {
          "team": {
            "id": 135,
            "name": "Padres",
            "abbreviation": "",
            "link": "/api/v1/teams/135",
            "logo": "https://www.mlbstatic.com/team-logos/135.svg"
          },
          "gamesPlayed": 72,
          "wins": 37,
          "losses": 35,
          "winningPercentage": ".514",
          "runsScored": 274,
          "runsAllowed": 288,
          "runDifferential": -14,
          "sportRank": "11",
          "leagueRank": "7",
          "divisionRank": "2",
          "conferenceRank": "",
          "wildCardRank": "4",
          "wildCardGamesBack": "1.0",
          "divisionGamesBack": "9.0",
          "leagueGamesBack": "9.5",
          "sportGamesBack": "9.5",
          "streak": {
            "streakType": "losses",
            "streakNumber": 2,
            "streakCode": "L2"
          },
          "leagueRecord": {
            "wins": 37,
            "losses": 35,
            "pct": ".514"
          },
          "home": {
            "wins": 19,
            "losses": 19,
            "pct": ".500"
          },
          "away": {
            "wins": 18,
            "losses": 16,
            "pct": ".529"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 109,
            "name": "D-backs",
            "abbreviation": "",
            "link": "/api/v1/teams/109",
            "logo": "https://www.mlbstatic.com/team-logos/109.svg"
          },
          "gamesPlayed": 73,
          "wins": 37,
          "losses": 36,
          "winningPercentage": ".507",
          "runsScored": 304,
          "runsAllowed": 330,
          "runDifferential": -26,
          "sportRank": "14",
          "leagueRank": "9",
          "divisionRank": "3",
          "conferenceRank": "",
          "wildCardRank": "6",
          "wildCardGamesBack": "1.5",
          "divisionGamesBack": "9.5",
          "leagueGamesBack": "10.0",
          "sportGamesBack": "10.0",
          "streak": {
            "streakType": "losses",
            "streakNumber": 1,
            "streakCode": "L1"
          },
          "leagueRecord": {
            "wins": 37,
            "losses": 36,
            "pct": ".507"
          },
          "home": {
            "wins": 22,
            "losses": 15,
            "pct": ".595"
          },
          "away": {
            "wins": 15,
            "losses": 21,
            "pct": ".417"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        },
        {
          "team": {
            "id": 137,
            "name": "Giants",
            "abbreviation": "",
            "link": "/api/v1/teams/137",
            "logo": "https://www.mlbstatic.com/team-logos/137.svg"
          },
          "gamesPlayed": 72,
          "wins": 29,
          "losses": 43,
          "winningPercentage": ".403",
          "runsScored": 296,
          "runsAllowed": 352,
          "runDifferential": -56,
          "sportRank": "28",
          "leagueRank": "14",
          "divisionRank": "4",
          "conferenceRank": "",
          "wildCardRank": "11",
          "wildCardGamesBack": "9.0",
          "divisionGamesBack": "17.0",
          "leagueGamesBack": "17.5",
          "sportGamesBack": "17.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 29,
            "losses": 43,
            "pct": ".403"
          },
          "home": {
            "wins": 14,
            "losses": 20,
            "pct": ".412"
          },
          "away": {
            "wins": 15,
            "losses": 23,
            "pct": ".395"
          },
          "lastTen": {
            "wins": 5,
            "losses": 5,
            "pct": ".500"
          }
        },
        {
          "team": {
            "id": 115,
            "name": "Rockies",
            "abbreviation": "",
            "link": "/api/v1/teams/115",
            "logo": "https://www.mlbstatic.com/team-logos/115.svg"
          },
          "gamesPlayed": 74,
          "wins": 28,
          "losses": 46,
          "winningPercentage": ".378",
          "runsScored": 338,
          "runsAllowed": 426,
          "runDifferential": -88,
          "sportRank": "30",
          "leagueRank": "15",
          "divisionRank": "5",
          "conferenceRank": "",
          "wildCardRank": "12",
          "wildCardGamesBack": "11.0",
          "divisionGamesBack": "19.0",
          "leagueGamesBack": "19.5",
          "sportGamesBack": "19.5",
          "streak": {
            "streakType": "wins",
            "streakNumber": 1,
            "streakCode": "W1"
          },
          "leagueRecord": {
            "wins": 28,
            "losses": 46,
            "pct": ".378"
          },
          "home": {
            "wins": 14,
            "losses": 20,
            "pct": ".412"
          },
          "away": {
            "wins": 14,
            "losses": 26,
            "pct": ".350"
          },
          "lastTen": {
            "wins": 4,
            "losses": 6,
            "pct": ".400"
          }
        }
      ]
    }
  ],
  "wildcard": [
    {
      "team": {
        "id": 138,
        "name": "Cardinals",
        "abbreviation": "",
        "link": "/api/v1/teams/138",
        "logo": "https://www.mlbstatic.com/team-logos/138.svg"
      },
      "gamesPlayed": 71,
      "wins": 40,
      "losses": 31,
      "winningPercentage": ".563",
      "runsScored": 325,
      "runsAllowed": 309,
      "runDifferential": 16,
      "sportRank": "6",
      "leagueRank": "4",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "1",
      "wildCardGamesBack": "+2.5",
      "divisionGamesBack": "4.5",
      "leagueGamesBack": "6.0",
      "sportGamesBack": "6.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 2,
        "streakCode": "W2"
      },
      "leagueRecord": {
        "wins": 40,
        "losses": 31,
        "pct": ".563"
      },
      "home": {
        "wins": 21,
        "losses": 16,
        "pct": ".568"
      },
      "away": {
        "wins": 19,
        "losses": 15,
        "pct": ".559"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 143,
        "name": "Phillies",
        "abbreviation": "",
        "link": "/api/v1/teams/143",
        "logo": "https://www.mlbstatic.com/team-logos/143.svg"
      },
      "gamesPlayed": 73,
      "wins": 40,
      "losses": 33,
      "winningPercentage": ".548",
      "runsScored": 300,
      "runsAllowed": 310,
      "runDifferential": -10,
      "sportRank": "7",
      "leagueRank": "5",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "2",
      "wildCardGamesBack": "+1.5",
      "divisionGamesBack": "7.0",
      "leagueGamesBack": "7.0",
      "sportGamesBack": "7.0",
      "streak": {
        "streakType": "wins",
        "streakNumber": 2,
        "streakCode": "W2"
      },
      "leagueRecord": {
        "wins": 40,
        "losses": 33,
        "pct": ".548"
      },
      "home": {
        "wins": 21,
        "losses": 17,
        "pct": ".553"
      },
      "away": {
        "wins": 19,
        "losses": 16,
        "pct": ".543"
      },
      "lastTen": {
        "wins": 6,
        "losses": 4,
        "pct": ".600"
      }
    },
    {
      "team": {
        "id": 120,
        "name": "Nationals",
        "abbreviation": "",
        "link": "/api/v1/teams/120",
        "logo": "https://www.mlbstatic.com/team-logos/120.svg"
      },
      "gamesPlayed": 74,
      "wins": 39,
      "losses": 35,
      "winningPercentage": ".527",
      "runsScored": 405,
      "runsAllowed": 386,
      "runDifferential": 19,
      "sportRank": "10",
      "leagueRank": "6",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "3",
      "wildCardGamesBack": "-",
      "divisionGamesBack": "8.5",
      "leagueGamesBack": "8.5",
      "sportGamesBack": "8.5",
      "streak": {
        "streakType": "wins",
        "streakNumber": 4,
        "streakCode": "W4"
      },
      "leagueRecord": {
        "wins": 39,
        "losses": 35,
        "pct": ".527"
      },
      "home": {
        "wins": 16,
        "losses": 21,
        "pct": ".432"
      },
      "away": {
        "wins": 23,
        "losses": 14,
        "pct": ".622"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 135,
        "name": "Padres",
        "abbreviation": "",
        "link": "/api/v1/teams/135",
        "logo": "https://www.mlbstatic.com/team-logos/135.svg"
      },
      "gamesPlayed": 72,
      "wins": 37,
      "losses": 35,
      "winningPercentage": ".514",
      "runsScored": 274,
      "runsAllowed": 288,
      "runDifferential": -14,
      "sportRank": "11",
      "leagueRank": "7",
      "divisionRank": "2",
      "conferenceRank": "",
      "wildCardRank": "4",
      "wildCardGamesBack": "1.0",
      "divisionGamesBack": "9.0",
      "leagueGamesBack": "9.5",
      "sportGamesBack": "9.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 37,
        "losses": 35,
        "pct": ".514"
      },
      "home": {
        "wins": 19,
        "losses": 19,
        "pct": ".500"
      },
      "away": {
        "wins": 18,
        "losses": 16,
        "pct": ".529"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 112,
        "name": "Cubs",
        "abbreviation": "",
        "link": "/api/v1/teams/112",
        "logo": "https://www.mlbstatic.com/team-logos/112.svg"
      },
      "gamesPlayed": 74,
      "wins": 38,
      "losses": 36,
      "winningPercentage": ".514",
      "runsScored": 336,
      "runsAllowed": 329,
      "runDifferential": 7,
      "sportRank": "13",
      "leagueRank": "8",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "5",
      "wildCardGamesBack": "1.0",
      "divisionGamesBack": "8.0",
      "leagueGamesBack": "9.5",
      "sportGamesBack": "9.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 38,
        "losses": 36,
        "pct": ".514"
      },
      "home": {
        "wins": 21,
        "losses": 16,
        "pct": ".568"
      },
      "away": {
        "wins": 17,
        "losses": 20,
        "pct": ".459"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 109,
        "name": "D-backs",
        "abbreviation": "",
        "link": "/api/v1/teams/109",
        "logo": "https://www.mlbstatic.com/team-logos/109.svg"
      },
      "gamesPlayed": 73,
      "wins": 37,
      "losses": 36,
      "winningPercentage": ".507",
      "runsScored": 304,
      "runsAllowed": 330,
      "runDifferential": -26,
      "sportRank": "14",
      "leagueRank": "9",
      "divisionRank": "3",
      "conferenceRank": "",
      "wildCardRank": "6",
      "wildCardGamesBack": "1.5",
      "divisionGamesBack": "9.5",
      "leagueGamesBack": "10.0",
      "sportGamesBack": "10.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 1,
        "streakCode": "L1"
      },
      "leagueRecord": {
        "wins": 37,
        "losses": 36,
        "pct": ".507"
      },
      "home": {
        "wins": 22,
        "losses": 15,
        "pct": ".595"
      },
      "away": {
        "wins": 15,
        "losses": 21,
        "pct": ".417"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 134,
        "name": "Pirates",
        "abbreviation": "",
        "link": "/api/v1/teams/134",
        "logo": "https://www.mlbstatic.com/team-logos/134.svg"
      },
      "gamesPlayed": 74,
      "wins": 37,
      "losses": 37,
      "winningPercentage": ".500",
      "runsScored": 367,
      "runsAllowed": 361,
      "runDifferential": 6,
      "sportRank": "15",
      "leagueRank": "10",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "7",
      "wildCardGamesBack": "2.0",
      "divisionGamesBack": "9.0",
      "leagueGamesBack": "10.5",
      "sportGamesBack": "10.5",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 37,
        "losses": 37,
        "pct": ".500"
      },
      "home": {
        "wins": 20,
        "losses": 19,
        "pct": ".513"
      },
      "away": {
        "wins": 17,
        "losses": 18,
        "pct": ".486"
      },
      "lastTen": {
        "wins": 3,
        "losses": 7,
        "pct": ".300"
      }
    },
    {
      "team": {
        "id": 146,
        "name": "Marlins",
        "abbreviation": "",
        "link": "/api/v1/teams/146",
        "logo": "https://www.mlbstatic.com/team-logos/146.svg"
      },
      "gamesPlayed": 74,
      "wins": 36,
      "losses": 38,
      "winningPercentage": ".486",
      "runsScored": 312,
      "runsAllowed": 325,
      "runDifferential": -13,
      "sportRank": "17",
      "leagueRank": "11",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "8",
      "wildCardGamesBack": "3.0",
      "divisionGamesBack": "11.5",
      "leagueGamesBack": "11.5",
      "sportGamesBack": "11.5",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 36,
        "losses": 38,
        "pct": ".486"
      },
      "home": {
        "wins": 23,
        "losses": 16,
        "pct": ".590"
      },
      "away": {
        "wins": 13,
        "losses": 22,
        "pct": ".371"
      },
      "lastTen": {
        "wins": 7,
        "losses": 3,
        "pct": ".700"
      }
    },
    {
      "team": {
        "id": 113,
        "name": "Reds",
        "abbreviation": "",
        "link": "/api/v1/teams/113",
        "logo": "https://www.mlbstatic.com/team-logos/113.svg"
      },
      "gamesPlayed": 72,
      "wins": 35,
      "losses": 37,
      "winningPercentage": ".486",
      "runsScored": 310,
      "runsAllowed": 354,
      "runDifferential": -44,
      "sportRank": "18",
      "leagueRank": "12",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "9",
      "wildCardGamesBack": "3.0",
      "divisionGamesBack": "10.0",
      "leagueGamesBack": "11.5",
      "sportGamesBack": "11.5",
      "streak": {
        "streakType": "wins",
        "streakNumber": 2,
        "streakCode": "W2"
      },
      "leagueRecord": {
        "wins": 35,
        "losses": 37,
        "pct": ".486"
      },
      "home": {
        "wins": 19,
        "losses": 18,
        "pct": ".514"
      },
      "away": {
        "wins": 16,
        "losses": 19,
        "pct": ".457"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 121,
        "name": "Mets",
        "abbreviation": "",
        "link": "/api/v1/teams/121",
        "logo": "https://www.mlbstatic.com/team-logos/121.svg"
      },
      "gamesPlayed": 73,
      "wins": 32,
      "losses": 41,
      "winningPercentage": ".438",
      "runsScored": 291,
      "runsAllowed": 316,
      "runDifferential": -25,
      "sportRank": "24",
      "leagueRank": "13",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "10",
      "wildCardGamesBack": "6.5",
      "divisionGamesBack": "15.0",
      "leagueGamesBack": "15.0",
      "sportGamesBack": "15.0",
      "streak": {
        "streakType": "losses",
        "streakNumber": 2,
        "streakCode": "L2"
      },
      "leagueRecord": {
        "wins": 32,
        "losses": 41,
        "pct": ".438"
      },
      "home": {
        "wins": 18,
        "losses": 18,
        "pct": ".500"
      },
      "away": {
        "wins": 14,
        "losses": 23,
        "pct": ".378"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    },
    {
      "team": {
        "id": 137,
        "name": "Giants",
        "abbreviation": "",
        "link": "/api/v1/teams/137",
        "logo": "https://www.mlbstatic.com/team-logos/137.svg"
      },
      "gamesPlayed": 72,
      "wins": 29,
      "losses": 43,
      "winningPercentage": ".403",
      "runsScored": 296,
      "runsAllowed": 352,
      "runDifferential": -56,
      "sportRank": "28",
      "leagueRank": "14",
      "divisionRank": "4",
      "conferenceRank": "",
      "wildCardRank": "11",
      "wildCardGamesBack": "9.0",
      "divisionGamesBack": "17.0",
      "leagueGamesBack": "17.5",
      "sportGamesBack": "17.5",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 29,
        "losses": 43,
        "pct": ".403"
      },
      "home": {
        "wins": 14,
        "losses": 20,
        "pct": ".412"
      },
      "away": {
        "wins": 15,
        "losses": 23,
        "pct": ".395"
      },
      "lastTen": {
        "wins": 5,
        "losses": 5,
        "pct": ".500"
      }
    },
    {
      "team": {
        "id": 115,
        "name": "Rockies",
        "abbreviation": "",
        "link": "/api/v1/teams/115",
        "logo": "https://www.mlbstatic.com/team-logos/115.svg"
      },
      "gamesPlayed": 74,
      "wins": 28,
      "losses": 46,
      "winningPercentage": ".378",
      "runsScored": 338,
      "runsAllowed": 426,
      "runDifferential": -88,
      "sportRank": "30",
      "leagueRank": "15",
      "divisionRank": "5",
      "conferenceRank": "",
      "wildCardRank": "12",
      "wildCardGamesBack": "11.0",
      "divisionGamesBack": "19.0",
      "leagueGamesBack": "19.5",
      "sportGamesBack": "19.5",
      "streak": {
        "streakType": "wins",
        "streakNumber": 1,
        "streakCode": "W1"
      },
      "leagueRecord": {
        "wins": 28,
        "losses": 46,
        "pct": ".378"
      },
      "home": {
        "wins": 14,
        "losses": 20,
        "pct": ".412"
      },
      "away": {
        "wins": 14,
        "losses": 26,
        "pct": ".350"
      },
      "lastTen": {
        "wins": 4,
        "losses": 6,
        "pct": ".400"
      }
    }
  ],
  "updatedAt": {
    "_seconds": 1781693284,
    "_nanoseconds": 161000000
  }
}
```
</details>

<details>
<summary>mlb_standings/current</summary>

```json
{
  "date": null,
  "season": "2026",
  "source": "statsapi.mlb.com/api/v1/standings",
  "leagueIds": [
    "103",
    "104"
  ],
  "sport": "mlb",
  "standingsTypes": "regularSeason",
  "updatedAt": {
    "_seconds": 1781693284,
    "_nanoseconds": 278000000
  }
}
```
</details>


## Collection: `nhl_first_goal_games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gameId` | string | "2025020828" / "2025020910" |
| `result` | map | {...} / {...} |
| `result.period` | number | 1 / 2 |
| `result.goalId` | string | "137" / "696" |
| `result.playerName` | string | "Scott Laughton" / "Tage Thompson" |
| `result.teamAbbr` | string | "LAK" / "BUF" |
| `result.playerId` | string | "8476872" / "8479420" |
| `result.timeInPeriod` | string | "06:46" / "08:10" |
| `message` | string | "Premier but confirmé. Résultats disponibles." / "Premier but confirmé. Résultats disponibles." |
| `confirmedAt` | timestamp | {"_seconds":1773088025,"_nanoseconds":440000000} / {"_seconds":1772069706,"_nanoseconds":140000000} |
| `status` | string | "confirmed" / "confirmed" |
| `updatedAt` | timestamp | {"_seconds":1773088025,"_nanoseconds":440000000} / {"_seconds":1772069706,"_nanoseconds":140000000} |

### Documents exemples

<details>
<summary>nhl_first_goal_games/2025020828</summary>

```json
{
  "gameId": "2025020828",
  "result": {
    "period": 1,
    "goalId": "137",
    "playerName": "Scott Laughton",
    "teamAbbr": "LAK",
    "playerId": "8476872",
    "timeInPeriod": "06:46"
  },
  "message": "Premier but confirmé. Résultats disponibles.",
  "confirmedAt": {
    "_seconds": 1773088025,
    "_nanoseconds": 440000000
  },
  "status": "confirmed",
  "updatedAt": {
    "_seconds": 1773088025,
    "_nanoseconds": 440000000
  }
}
```
</details>

<details>
<summary>nhl_first_goal_games/2025020910</summary>

```json
{
  "gameId": "2025020910",
  "result": {
    "period": 2,
    "goalId": "696",
    "playerName": "Tage Thompson",
    "teamAbbr": "BUF",
    "playerId": "8479420",
    "timeInPeriod": "08:10"
  },
  "message": "Premier but confirmé. Résultats disponibles.",
  "confirmedAt": {
    "_seconds": 1772069706,
    "_nanoseconds": 140000000
  },
  "status": "confirmed",
  "updatedAt": {
    "_seconds": 1772069706,
    "_nanoseconds": 140000000
  }
}
```
</details>

<details>
<summary>nhl_first_goal_games/2025020911</summary>

```json
{
  "gameId": "2025020911",
  "result": {
    "period": 2,
    "goalId": "681",
    "playerName": "Rasmus Sandin",
    "teamAbbr": "WSH",
    "playerId": "8480873",
    "timeInPeriod": "13:52"
  },
  "message": "Premier but confirmé. Résultats disponibles.",
  "confirmedAt": {
    "_seconds": 1772069418,
    "_nanoseconds": 40000000
  },
  "status": "confirmed",
  "updatedAt": {
    "_seconds": 1772069418,
    "_nanoseconds": 40000000
  }
}
```
</details>


## Collection: `nhl_live_games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | string | "2025-11-19" / "2025-11-19" |
| `venue` | string | "Capital One Arena" / "KeyBank Center" |
| `clock` | null | null / null |
| `homeAbbr` | string | "WSH" / "BUF" |
| `periodType` | string | "REG" / "REG" |
| `awayAbbr` | string | "EDM" / "CGY" |
| `startTimeUTC` | string | "2025-11-20T00:00:00Z" / "2025-11-20T00:30:00Z" |
| `period` | number | 3 / 3 |
| `awayScore` | number | 4 / 6 |
| `homeScore` | number | 7 / 2 |
| `isLive` | boolean | false / false |
| `isFinal` | boolean | true / true |
| `state` | string | "OFF" / "OFF" |
| `updatedAt` | timestamp | {"_seconds":1763614741,"_nanoseconds":318000000} / {"_seconds":1763614742,"_nanoseconds":895000000} |

### Documents exemples

<details>
<summary>nhl_live_games/2025020315</summary>

```json
{
  "date": "2025-11-19",
  "venue": "Capital One Arena",
  "clock": null,
  "homeAbbr": "WSH",
  "periodType": "REG",
  "awayAbbr": "EDM",
  "startTimeUTC": "2025-11-20T00:00:00Z",
  "period": 3,
  "awayScore": 4,
  "homeScore": 7,
  "isLive": false,
  "isFinal": true,
  "state": "OFF",
  "updatedAt": {
    "_seconds": 1763614741,
    "_nanoseconds": 318000000
  }
}
```
</details>


### Collection: `nhl_live_games/2025020315/goals`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | string | "2025-11-19" / "2025-11-19" |
| `gameId` | string | "2025020315" / "2025020315" |
| `eventId` | string | "131" / "148" |
| `period` | number | 1 / 1 |
| `strength` | null | null / null |
| `teamAbbr` | null | null / null |
| `periodType` | string | "REG" / "REG" |
| `scoringPlayerId` | string | "8471214" / "8477498" |
| `assist2PlayerName` | string | "Matt Roy" / "Leon Draisaitl" |
| `assist2PlayerId` | string | "8478911" / "8477934" |
| `scoringPlayerName` | string | "Alex Ovechkin" / "Darnell Nurse" |
| `assist1PlayerId` | string | "8479345" / "8478402" |
| `assist1PlayerName` | string | "Jakob Chychrun" / "Connor McDavid" |
| `timeInPeriod` | string | "06:04" / "07:05" |
| `scoringPlayerTotal` | number | 7 / 4 |
| `updatedAt` | timestamp | {"_seconds":1763614741,"_nanoseconds":764000000} / {"_seconds":1763614741,"_nanoseconds":949000000} |

### Documents exemples

<details>
<summary>nhl_live_games/2025020315/goals/131</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020315",
  "eventId": "131",
  "period": 1,
  "strength": null,
  "teamAbbr": null,
  "periodType": "REG",
  "scoringPlayerId": "8471214",
  "assist2PlayerName": "Matt Roy",
  "assist2PlayerId": "8478911",
  "scoringPlayerName": "Alex Ovechkin",
  "assist1PlayerId": "8479345",
  "assist1PlayerName": "Jakob Chychrun",
  "timeInPeriod": "06:04",
  "scoringPlayerTotal": 7,
  "updatedAt": {
    "_seconds": 1763614741,
    "_nanoseconds": 764000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020315/goals/148</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020315",
  "eventId": "148",
  "period": 1,
  "strength": null,
  "teamAbbr": null,
  "periodType": "REG",
  "scoringPlayerId": "8477498",
  "assist2PlayerName": "Leon Draisaitl",
  "assist2PlayerId": "8477934",
  "scoringPlayerName": "Darnell Nurse",
  "assist1PlayerId": "8478402",
  "assist1PlayerName": "Connor McDavid",
  "timeInPeriod": "07:05",
  "scoringPlayerTotal": 4,
  "updatedAt": {
    "_seconds": 1763614741,
    "_nanoseconds": 949000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020315/goals/234</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020315",
  "eventId": "234",
  "period": 1,
  "strength": null,
  "teamAbbr": null,
  "periodType": "REG",
  "scoringPlayerId": "8484186",
  "assist2PlayerName": "John Carlson",
  "assist2PlayerId": "8474590",
  "scoringPlayerName": "Ryan Leonard",
  "assist1PlayerId": "8481580",
  "assist1PlayerName": "Connor McMichael",
  "timeInPeriod": "10:34",
  "scoringPlayerTotal": 4,
  "updatedAt": {
    "_seconds": 1763614742,
    "_nanoseconds": 90000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020316</summary>

```json
{
  "date": "2025-11-19",
  "venue": "KeyBank Center",
  "clock": null,
  "homeAbbr": "BUF",
  "periodType": "REG",
  "awayAbbr": "CGY",
  "startTimeUTC": "2025-11-20T00:30:00Z",
  "homeScore": 2,
  "period": 3,
  "awayScore": 6,
  "isLive": false,
  "isFinal": true,
  "state": "OFF",
  "updatedAt": {
    "_seconds": 1763614742,
    "_nanoseconds": 895000000
  }
}
```
</details>


### Collection: `nhl_live_games/2025020316/goals`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | string | "2025-11-19" / "2025-11-19" |
| `gameId` | string | "2025020316" / "2025020316" |
| `eventId` | string | "1050" / "125" |
| `period` | number | 3 / 1 |
| `strength` | null | null / null |
| `scoringPlayerId` | string | "8482679" / "8478397" |
| `scoringPlayerName` | string | "Matt Coronato" / "Rasmus Andersson" |
| `teamAbbr` | null | null / null |
| `timeInPeriod` | string | "17:49" / "05:58" |
| `periodType` | string | "REG" / "REG" |
| `scoringPlayerTotal` | number | 7 / 5 |
| `assist2PlayerName` | string | "Morgan Frost" / "Kevin Bahl" |
| `assist2PlayerId` | string | "8480028" / "8480860" |
| `assist1PlayerId` | string | "8476456" / "8481068" |
| `assist1PlayerName` | string | "Jonathan Huberdeau" / "Yegor Sharangovich" |
| `updatedAt` | timestamp | {"_seconds":1763614743,"_nanoseconds":923000000} / {"_seconds":1763614743,"_nanoseconds":123000000} |

### Documents exemples

<details>
<summary>nhl_live_games/2025020316/goals/1050</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020316",
  "eventId": "1050",
  "period": 3,
  "strength": null,
  "scoringPlayerId": "8482679",
  "scoringPlayerName": "Matt Coronato",
  "teamAbbr": null,
  "timeInPeriod": "17:49",
  "periodType": "REG",
  "scoringPlayerTotal": 7,
  "assist2PlayerName": "Morgan Frost",
  "assist2PlayerId": "8480028",
  "assist1PlayerId": "8476456",
  "assist1PlayerName": "Jonathan Huberdeau",
  "updatedAt": {
    "_seconds": 1763614743,
    "_nanoseconds": 923000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020316/goals/125</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020316",
  "eventId": "125",
  "period": 1,
  "strength": null,
  "teamAbbr": null,
  "periodType": "REG",
  "scoringPlayerId": "8478397",
  "assist2PlayerName": "Kevin Bahl",
  "assist2PlayerId": "8480860",
  "scoringPlayerName": "Rasmus Andersson",
  "assist1PlayerId": "8481068",
  "assist1PlayerName": "Yegor Sharangovich",
  "timeInPeriod": "05:58",
  "scoringPlayerTotal": 5,
  "updatedAt": {
    "_seconds": 1763614743,
    "_nanoseconds": 123000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020316/goals/302</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020316",
  "eventId": "302",
  "period": 1,
  "strength": null,
  "teamAbbr": null,
  "periodType": "REG",
  "scoringPlayerId": "8480797",
  "assist2PlayerName": "Yegor Sharangovich",
  "assist2PlayerId": "8481068",
  "scoringPlayerName": "Joel Farabee",
  "assist1PlayerId": "8475172",
  "assist1PlayerName": "Nazem Kadri",
  "timeInPeriod": "12:04",
  "scoringPlayerTotal": 3,
  "updatedAt": {
    "_seconds": 1763614743,
    "_nanoseconds": 268000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020317</summary>

```json
{
  "date": "2025-11-19",
  "venue": "Grand Casino Arena",
  "clock": null,
  "homeAbbr": "MIN",
  "periodType": "REG",
  "awayAbbr": "CAR",
  "isFinal": false,
  "startTimeUTC": "2025-11-20T02:30:00Z",
  "isLive": true,
  "state": "LIVE",
  "period": 3,
  "homeScore": 3,
  "awayScore": 2,
  "updatedAt": {
    "_seconds": 1763614743,
    "_nanoseconds": 984000000
  }
}
```
</details>


### Collection: `nhl_live_games/2025020317/goals`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `date` | string | "2025-11-19" / "2025-11-19" |
| `gameId` | string | "2025020317" / "2025020317" |
| `eventId` | string | "298" / "693" |
| `period` | number | 1 / 2 |
| `strength` | null | null / null |
| `scoringPlayerId` | string | "8481557" / "8482809" |
| `scoringPlayerName` | string | "Matt Boldy" / "Jackson Blake" |
| `teamAbbr` | null | null / null |
| `timeInPeriod` | string | "11:46" / "14:03" |
| `periodType` | string | "REG" / "REG" |
| `assist2PlayerName` | null, string | null / "Logan Stankoven" |
| `assist2PlayerId` | null, string | null / "8482702" |
| `scoringPlayerTotal` | number | 11 / 5 |
| `assist1PlayerId` | null, string | null / "8480336" |
| `assist1PlayerName` | null, string | null / "Sean Walker" |
| `updatedAt` | timestamp | {"_seconds":1763614744,"_nanoseconds":324000000} / {"_seconds":1763614744,"_nanoseconds":509000000} |

### Documents exemples

<details>
<summary>nhl_live_games/2025020317/goals/298</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020317",
  "eventId": "298",
  "period": 1,
  "strength": null,
  "scoringPlayerId": "8481557",
  "scoringPlayerName": "Matt Boldy",
  "teamAbbr": null,
  "timeInPeriod": "11:46",
  "periodType": "REG",
  "assist2PlayerName": null,
  "assist2PlayerId": null,
  "scoringPlayerTotal": 11,
  "assist1PlayerId": null,
  "assist1PlayerName": null,
  "updatedAt": {
    "_seconds": 1763614744,
    "_nanoseconds": 324000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020317/goals/693</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020317",
  "eventId": "693",
  "period": 2,
  "strength": null,
  "scoringPlayerId": "8482809",
  "scoringPlayerName": "Jackson Blake",
  "teamAbbr": null,
  "periodType": "REG",
  "assist2PlayerName": "Logan Stankoven",
  "assist2PlayerId": "8482702",
  "scoringPlayerTotal": 5,
  "assist1PlayerId": "8480336",
  "assist1PlayerName": "Sean Walker",
  "timeInPeriod": "14:03",
  "updatedAt": {
    "_seconds": 1763614744,
    "_nanoseconds": 509000000
  }
}
```
</details>

<details>
<summary>nhl_live_games/2025020317/goals/76</summary>

```json
{
  "date": "2025-11-19",
  "gameId": "2025020317",
  "eventId": "76",
  "period": 1,
  "strength": null,
  "scoringPlayerId": "8482122",
  "scoringPlayerName": "Brock Faber",
  "teamAbbr": null,
  "timeInPeriod": "01:54",
  "periodType": "REG",
  "scoringPlayerTotal": 4,
  "assist2PlayerName": "Danila Yurov",
  "assist2PlayerId": "8483525",
  "assist1PlayerId": "8475692",
  "assist1PlayerName": "Mats Zuccarello",
  "updatedAt": {
    "_seconds": 1763614744,
    "_nanoseconds": 220000000
  }
}
```
</details>


## Collection: `nhl_matchups_daily`

- Documents analysés: 0
- Limite appliquée: 3

_Aucun document trouvé._


## Collection: `nhl_player_stats_current`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `assists` | number | 13 / 23 |
| `seasonId` | string | "20242025" / "20242025" |
| `fullName` | string | "" / "" |
| `source` | string | "nhl-api/rest skater/summary" / "nhl-api/rest skater/summary" |
| `teamAbbr` | string | "" / "" |
| `goals` | number | 2 / 6 |
| `playerId` | string | "8470600" / "8470613" |
| `points` | number | 15 / 29 |
| `updatedAt` | timestamp | {"_seconds":1759794450,"_nanoseconds":375000000} / {"_seconds":1759794450,"_nanoseconds":375000000} |

### Documents exemples

<details>
<summary>nhl_player_stats_current/20242025_8470600</summary>

```json
{
  "assists": 13,
  "seasonId": "20242025",
  "fullName": "",
  "source": "nhl-api/rest skater/summary",
  "teamAbbr": "",
  "goals": 2,
  "playerId": "8470600",
  "points": 15,
  "updatedAt": {
    "_seconds": 1759794450,
    "_nanoseconds": 375000000
  }
}
```
</details>

<details>
<summary>nhl_player_stats_current/20242025_8470613</summary>

```json
{
  "assists": 23,
  "seasonId": "20242025",
  "fullName": "",
  "source": "nhl-api/rest skater/summary",
  "teamAbbr": "",
  "goals": 6,
  "playerId": "8470613",
  "points": 29,
  "updatedAt": {
    "_seconds": 1759794450,
    "_nanoseconds": 375000000
  }
}
```
</details>

<details>
<summary>nhl_player_stats_current/20242025_8470621</summary>

```json
{
  "assists": 11,
  "seasonId": "20242025",
  "fullName": "",
  "source": "nhl-api/rest skater/summary",
  "teamAbbr": "",
  "goals": 19,
  "playerId": "8470621",
  "points": 30,
  "updatedAt": {
    "_seconds": 1759794450,
    "_nanoseconds": 375000000
  }
}
```
</details>


## Collection: `nhl_players`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `injury` | map | {...} / {...} |
| `injury.expectedReturn` | null | null / null |
| `injury.description` | null | null / null |
| `injury.short` | null | null / null |
| `injury.source` | string | "sportsdataio" / "sportsdataio" |
| `injury.startDate` | string | "2025-11-29T00:00:00" / "2025-12-07T00:00:00" |
| `injury.status` | string | "Unknown" / "Unknown" |
| `injury.updatedAt` | timestamp | {"_seconds":1766603342,"_nanoseconds":483000000} / {"_seconds":1766603342,"_nanoseconds":483000000} |

### Documents exemples

<details>
<summary>nhl_players/8249457</summary>

```json
{
  "injury": {
    "expectedReturn": null,
    "description": null,
    "short": null,
    "source": "sportsdataio",
    "startDate": "2025-11-29T00:00:00",
    "status": "Unknown",
    "updatedAt": {
      "_seconds": 1766603342,
      "_nanoseconds": 483000000
    }
  }
}
```
</details>

<details>
<summary>nhl_players/8249650</summary>

```json
{
  "injury": {
    "expectedReturn": null,
    "description": null,
    "short": null,
    "source": "sportsdataio",
    "startDate": "2025-12-07T00:00:00",
    "status": "Unknown",
    "updatedAt": {
      "_seconds": 1766603342,
      "_nanoseconds": 483000000
    }
  }
}
```
</details>

<details>
<summary>nhl_players/8249993</summary>

```json
{
  "injury": {
    "expectedReturn": null,
    "description": null,
    "short": null,
    "source": "sportsdataio",
    "startDate": "2025-12-23T00:00:00",
    "status": "Unknown",
    "updatedAt": {
      "_seconds": 1766603342,
      "_nanoseconds": 483000000
    }
  }
}
```
</details>


## Collection: `nhl_schedule_daily`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `hasGames` | boolean | true / true |
| `updatedAt` | timestamp | {"_seconds":1773269103,"_nanoseconds":250000000} / {"_seconds":1773269103,"_nanoseconds":327000000} |

### Documents exemples

<details>
<summary>nhl_schedule_daily/20251001</summary>

```json
{
  "hasGames": true,
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 250000000
  }
}
```
</details>


### Collection: `nhl_schedule_daily/20251001/games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gameId` | string | "2025010073" / "2025010074" |
| `gameType` | number | 1 / 1 |
| `period` | number | 3 / 3 |
| `homeScore` | number | 2 / 2 |
| `away` | map | {...} / {...} |
| `away.darkLogo` | string | "https://assets.nhle.com/logos/nhl/svg/ANA_dark.svg" / "https://assets.nhle.com/logos/nhl/svg/COL_dark.svg" |
| `away.name` | string | "Anaheim" / "Colorado" |
| `away.logo` | string | "https://assets.nhle.com/logos/nhl/svg/ANA_light.svg" / "https://assets.nhle.com/logos/nhl/svg/COL_light.svg" |
| `away.id` | number | 24 / 21 |
| `away.abbr` | string | "ANA" / "COL" |
| `periodMax` | number | 3 / 3 |
| `gameScheduleState` | string | "OK" / "OK" |
| `clock` | null | null / null |
| `home` | map | {...} / {...} |
| `home.darkLogo` | string | "https://assets.nhle.com/logos/nhl/svg/SJS_dark.svg" / "https://assets.nhle.com/logos/nhl/svg/VGK_dark.svg" |
| `home.name` | string | "San Jose" / "Vegas" |
| `home.logo` | string | "https://assets.nhle.com/logos/nhl/svg/SJS_light.svg" / "https://assets.nhle.com/logos/nhl/svg/VGK_light.svg" |
| `home.id` | number | 28 / 54 |
| `home.abbr` | string | "SJS" / "VGK" |
| `periodType` | string | "REG" / "REG" |
| `awayScore` | number | 5 / 1 |
| `gameOutcome` | map | {...} / {...} |
| `gameOutcome.lastPeriodType` | string | "REG" / "REG" |
| `season` | number | 20252026 / 20252026 |
| `gameState` | string | "FINAL" / "FINAL" |
| `startTimeUTC` | string | "2025-10-02T02:00:00Z" / "2025-10-02T01:00:00Z" |
| `updatedAt` | timestamp | {"_seconds":1773269103,"_nanoseconds":250000000} / {"_seconds":1773269103,"_nanoseconds":250000000} |

### Documents exemples

<details>
<summary>nhl_schedule_daily/20251001/games/2025010073</summary>

```json
{
  "gameId": "2025010073",
  "gameType": 1,
  "period": 3,
  "homeScore": 2,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/ANA_dark.svg",
    "name": "Anaheim",
    "logo": "https://assets.nhle.com/logos/nhl/svg/ANA_light.svg",
    "id": 24,
    "abbr": "ANA"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/SJS_dark.svg",
    "name": "San Jose",
    "logo": "https://assets.nhle.com/logos/nhl/svg/SJS_light.svg",
    "id": 28,
    "abbr": "SJS"
  },
  "periodType": "REG",
  "awayScore": 5,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-02T02:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 250000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251001/games/2025010074</summary>

```json
{
  "gameId": "2025010074",
  "gameType": 1,
  "period": 3,
  "homeScore": 2,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/COL_dark.svg",
    "name": "Colorado",
    "logo": "https://assets.nhle.com/logos/nhl/svg/COL_light.svg",
    "id": 21,
    "abbr": "COL"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/VGK_dark.svg",
    "name": "Vegas",
    "logo": "https://assets.nhle.com/logos/nhl/svg/VGK_light.svg",
    "id": 54,
    "abbr": "VGK"
  },
  "periodType": "REG",
  "awayScore": 1,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-02T01:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 250000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251001/games/2025010075</summary>

```json
{
  "gameId": "2025010075",
  "gameType": 1,
  "period": 3,
  "homeScore": 4,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/EDM_dark.svg",
    "name": "Edmonton",
    "logo": "https://assets.nhle.com/logos/nhl/svg/EDM_light.svg",
    "id": 22,
    "abbr": "EDM"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/SEA_dark.svg",
    "name": "Seattle",
    "logo": "https://assets.nhle.com/logos/nhl/svg/SEA_light.svg",
    "id": 55,
    "abbr": "SEA"
  },
  "periodType": "REG",
  "awayScore": 2,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-02T02:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 250000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251002</summary>

```json
{
  "hasGames": true,
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 327000000
  }
}
```
</details>


### Collection: `nhl_schedule_daily/20251002/games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gameId` | string | "2025010078" / "2025010079" |
| `gameType` | number | 1 / 1 |
| `period` | number | 3 / 3 |
| `homeScore` | number | 1 / 1 |
| `away` | map | {...} / {...} |
| `away.darkLogo` | string | "https://assets.nhle.com/logos/nhl/svg/BOS_dark.svg?season=20252026" / "https://assets.nhle.com/logos/nhl/svg/DET_dark.svg?season=20252026" |
| `away.name` | string | "Boston" / "Detroit" |
| `away.logo` | string | "https://assets.nhle.com/logos/nhl/svg/BOS_light.svg?season=20252026" / "https://assets.nhle.com/logos/nhl/svg/DET_light.svg?season=20252026" |
| `away.id` | number | 6 / 17 |
| `away.abbr` | string | "BOS" / "DET" |
| `periodMax` | number | 3 / 3 |
| `gameScheduleState` | string | "OK" / "OK" |
| `clock` | null | null / null |
| `home` | map | {...} / {...} |
| `home.darkLogo` | string | "https://assets.nhle.com/logos/nhl/svg/WSH_secondary_dark.svg" / "https://assets.nhle.com/logos/nhl/svg/TOR_dark.svg" |
| `home.name` | string | "Washington" / "Toronto" |
| `home.logo` | string | "https://assets.nhle.com/logos/nhl/svg/WSH_secondary_light.svg" / "https://assets.nhle.com/logos/nhl/svg/TOR_light.svg" |
| `home.id` | number | 15 / 10 |
| `home.abbr` | string | "WSH" / "TOR" |
| `periodType` | string | "REG" / "REG" |
| `awayScore` | number | 3 / 3 |
| `gameOutcome` | map | {...} / {...} |
| `gameOutcome.lastPeriodType` | string | "REG" / "REG" |
| `season` | number | 20252026 / 20252026 |
| `gameState` | string | "FINAL" / "FINAL" |
| `startTimeUTC` | string | "2025-10-02T23:00:00Z" / "2025-10-02T23:00:00Z" |
| `updatedAt` | timestamp | {"_seconds":1773269103,"_nanoseconds":327000000} / {"_seconds":1773269103,"_nanoseconds":327000000} |

### Documents exemples

<details>
<summary>nhl_schedule_daily/20251002/games/2025010078</summary>

```json
{
  "gameId": "2025010078",
  "gameType": 1,
  "period": 3,
  "homeScore": 1,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/BOS_dark.svg?season=20252026",
    "name": "Boston",
    "logo": "https://assets.nhle.com/logos/nhl/svg/BOS_light.svg?season=20252026",
    "id": 6,
    "abbr": "BOS"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/WSH_secondary_dark.svg",
    "name": "Washington",
    "logo": "https://assets.nhle.com/logos/nhl/svg/WSH_secondary_light.svg",
    "id": 15,
    "abbr": "WSH"
  },
  "periodType": "REG",
  "awayScore": 3,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-02T23:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 327000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251002/games/2025010079</summary>

```json
{
  "gameId": "2025010079",
  "gameType": 1,
  "period": 3,
  "homeScore": 1,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/DET_dark.svg?season=20252026",
    "name": "Detroit",
    "logo": "https://assets.nhle.com/logos/nhl/svg/DET_light.svg?season=20252026",
    "id": 17,
    "abbr": "DET"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/TOR_dark.svg",
    "name": "Toronto",
    "logo": "https://assets.nhle.com/logos/nhl/svg/TOR_light.svg",
    "id": 10,
    "abbr": "TOR"
  },
  "periodType": "REG",
  "awayScore": 3,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-02T23:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 327000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251002/games/2025010080</summary>

```json
{
  "gameId": "2025010080",
  "gameType": 1,
  "period": 3,
  "homeScore": 5,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/FLA_dark.svg",
    "name": "Florida",
    "logo": "https://assets.nhle.com/logos/nhl/svg/FLA_light.svg",
    "id": 13,
    "abbr": "FLA"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/TBL_dark.svg",
    "name": "Tampa Bay",
    "logo": "https://assets.nhle.com/logos/nhl/svg/TBL_light.svg",
    "id": 14,
    "abbr": "TBL"
  },
  "periodType": "REG",
  "awayScore": 2,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-02T23:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 327000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251003</summary>

```json
{
  "hasGames": true,
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 470000000
  }
}
```
</details>


### Collection: `nhl_schedule_daily/20251003/games`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `gameId` | string | "2025010085" / "2025010086" |
| `gameType` | number | 1 / 1 |
| `period` | number | 4 / 3 |
| `homeScore` | number | 5 / 2 |
| `away` | map | {...} / {...} |
| `away.darkLogo` | string | "https://assets.nhle.com/logos/nhl/svg/BUF_dark.svg" / "https://assets.nhle.com/logos/nhl/svg/MIN_dark.svg" |
| `away.name` | string | "Buffalo" / "Minnesota" |
| `away.logo` | string | "https://assets.nhle.com/logos/nhl/svg/BUF_light.svg" / "https://assets.nhle.com/logos/nhl/svg/MIN_light.svg" |
| `away.id` | number | 7 / 30 |
| `away.abbr` | string | "BUF" / "MIN" |
| `periodMax` | number | 3 / 3 |
| `gameScheduleState` | string | "OK" / "OK" |
| `clock` | null | null / null |
| `home` | map | {...} / {...} |
| `home.darkLogo` | string | "https://assets.nhle.com/logos/nhl/svg/PIT_dark.svg" / "https://assets.nhle.com/logos/nhl/svg/CHI_dark.svg?season=20252026" |
| `home.name` | string | "Pittsburgh" / "Chicago" |
| `home.logo` | string | "https://assets.nhle.com/logos/nhl/svg/PIT_light.svg" / "https://assets.nhle.com/logos/nhl/svg/CHI_light.svg?season=20252026" |
| `home.id` | number | 5 / 16 |
| `home.abbr` | string | "PIT" / "CHI" |
| `periodType` | string | "OT" / "REG" |
| `awayScore` | number | 4 / 3 |
| `gameOutcome` | map | {...} / {...} |
| `gameOutcome.lastPeriodType` | string | "OT" / "REG" |
| `season` | number | 20252026 / 20252026 |
| `gameState` | string | "FINAL" / "FINAL" |
| `startTimeUTC` | string | "2025-10-03T23:00:00Z" / "2025-10-04T00:00:00Z" |
| `updatedAt` | timestamp | {"_seconds":1773269103,"_nanoseconds":470000000} / {"_seconds":1773269103,"_nanoseconds":470000000} |

### Documents exemples

<details>
<summary>nhl_schedule_daily/20251003/games/2025010085</summary>

```json
{
  "gameId": "2025010085",
  "gameType": 1,
  "period": 4,
  "homeScore": 5,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/BUF_dark.svg",
    "name": "Buffalo",
    "logo": "https://assets.nhle.com/logos/nhl/svg/BUF_light.svg",
    "id": 7,
    "abbr": "BUF"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/PIT_dark.svg",
    "name": "Pittsburgh",
    "logo": "https://assets.nhle.com/logos/nhl/svg/PIT_light.svg",
    "id": 5,
    "abbr": "PIT"
  },
  "periodType": "OT",
  "awayScore": 4,
  "gameOutcome": {
    "lastPeriodType": "OT"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-03T23:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 470000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251003/games/2025010086</summary>

```json
{
  "gameId": "2025010086",
  "gameType": 1,
  "period": 3,
  "homeScore": 2,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/MIN_dark.svg",
    "name": "Minnesota",
    "logo": "https://assets.nhle.com/logos/nhl/svg/MIN_light.svg",
    "id": 30,
    "abbr": "MIN"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/CHI_dark.svg?season=20252026",
    "name": "Chicago",
    "logo": "https://assets.nhle.com/logos/nhl/svg/CHI_light.svg?season=20252026",
    "id": 16,
    "abbr": "CHI"
  },
  "periodType": "REG",
  "awayScore": 3,
  "gameOutcome": {
    "lastPeriodType": "REG"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-04T00:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 470000000
  }
}
```
</details>

<details>
<summary>nhl_schedule_daily/20251003/games/2025010087</summary>

```json
{
  "gameId": "2025010087",
  "gameType": 1,
  "period": 4,
  "homeScore": 3,
  "away": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/EDM_dark.svg",
    "name": "Edmonton",
    "logo": "https://assets.nhle.com/logos/nhl/svg/EDM_light.svg",
    "id": 22,
    "abbr": "EDM"
  },
  "periodMax": 3,
  "gameScheduleState": "OK",
  "clock": null,
  "home": {
    "darkLogo": "https://assets.nhle.com/logos/nhl/svg/VAN_dark.svg",
    "name": "Vancouver",
    "logo": "https://assets.nhle.com/logos/nhl/svg/VAN_light.svg",
    "id": 23,
    "abbr": "VAN"
  },
  "periodType": "OT",
  "awayScore": 2,
  "gameOutcome": {
    "lastPeriodType": "OT"
  },
  "season": 20252026,
  "gameState": "FINAL",
  "startTimeUTC": "2025-10-04T02:00:00Z",
  "updatedAt": {
    "_seconds": 1773269103,
    "_nanoseconds": 470000000
  }
}
```
</details>


## Collection: `nhl_standings`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `source` | string | "api-web.nhle.com/v1/standings" |
| `standings` | array | [{"clinchIndicator":"p","conferenceAbbrev":"W","conferenceHomeSequence":1,"conferenceL10Sequence":2, |
| `updatedAt` | timestamp | {"_seconds":1781693287,"_nanoseconds":813000000} |

### Documents exemples

<details>
<summary>nhl_standings/current</summary>

```json
{
  "source": "api-web.nhle.com/v1/standings",
  "standings": [
    {
      "clinchIndicator": "p",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 1,
      "conferenceL10Sequence": 2,
      "conferenceName": "Western",
      "conferenceRoadSequence": 1,
      "conferenceSequence": 1,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 1,
      "divisionL10Sequence": 1,
      "divisionName": "Central",
      "divisionRoadSequence": 1,
      "divisionSequence": 1,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 99,
      "goalDifferentialPctg": 1.207317,
      "goalAgainst": 203,
      "goalFor": 302,
      "goalsForPctg": 3.682927,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 49,
      "homeGoalsAgainst": 108,
      "homeGoalsFor": 157,
      "homeLosses": 9,
      "homeOtLosses": 6,
      "homePoints": 58,
      "homeRegulationPlusOtWins": 25,
      "homeRegulationWins": 25,
      "homeTies": 0,
      "homeWins": 26,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 14,
      "l10GoalsAgainst": 20,
      "l10GoalsFor": 34,
      "l10Losses": 2,
      "l10OtLosses": 1,
      "l10Points": 15,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 7,
      "leagueHomeSequence": 3,
      "leagueL10Sequence": 4,
      "leagueRoadSequence": 1,
      "leagueSequence": 1,
      "losses": 16,
      "otLosses": 11,
      "placeName": {
        "default": "Colorado"
      },
      "pointPctg": 0.737805,
      "points": 121,
      "regulationPlusOtWinPctg": 0.621951,
      "regulationPlusOtWins": 51,
      "regulationWinPctg": 0.585366,
      "regulationWins": 48,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 50,
      "roadGoalsAgainst": 95,
      "roadGoalsFor": 145,
      "roadLosses": 7,
      "roadOtLosses": 5,
      "roadPoints": 63,
      "roadRegulationPlusOtWins": 26,
      "roadRegulationWins": 23,
      "roadTies": 0,
      "roadWins": 29,
      "seasonId": 20252026,
      "shootoutLosses": 6,
      "shootoutWins": 4,
      "streakCode": "W",
      "streakCount": 3,
      "teamName": {
        "default": "Colorado Avalanche",
        "fr": "Avalanche du Colorado"
      },
      "teamCommonName": {
        "default": "Avalanche"
      },
      "teamAbbrev": {
        "default": "COL"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/COL_light.svg",
      "ties": 0,
      "waiversSequence": 32,
      "wildcardSequence": 0,
      "winPctg": 0.670732,
      "wins": 55
    },
    {
      "clinchIndicator": "z",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 1,
      "conferenceL10Sequence": 2,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 3,
      "conferenceSequence": 1,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 1,
      "divisionL10Sequence": 2,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 1,
      "divisionSequence": 1,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 56,
      "goalDifferentialPctg": 0.682927,
      "goalAgainst": 240,
      "goalFor": 296,
      "goalsForPctg": 3.609756,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 35,
      "homeGoalsAgainst": 126,
      "homeGoalsFor": 161,
      "homeLosses": 10,
      "homeOtLosses": 2,
      "homePoints": 60,
      "homeRegulationPlusOtWins": 27,
      "homeRegulationWins": 20,
      "homeTies": 0,
      "homeWins": 29,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 12,
      "l10GoalsAgainst": 27,
      "l10GoalsFor": 39,
      "l10Losses": 2,
      "l10OtLosses": 1,
      "l10Points": 15,
      "l10RegulationPlusOtWins": 7,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 7,
      "leagueHomeSequence": 1,
      "leagueL10Sequence": 3,
      "leagueRoadSequence": 5,
      "leagueSequence": 2,
      "losses": 22,
      "otLosses": 7,
      "placeName": {
        "default": "Carolina",
        "fr": "Caroline"
      },
      "pointPctg": 0.689024,
      "points": 113,
      "regulationPlusOtWinPctg": 0.585366,
      "regulationPlusOtWins": 48,
      "regulationWinPctg": 0.47561,
      "regulationWins": 39,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 21,
      "roadGoalsAgainst": 114,
      "roadGoalsFor": 135,
      "roadLosses": 12,
      "roadOtLosses": 5,
      "roadPoints": 53,
      "roadRegulationPlusOtWins": 21,
      "roadRegulationWins": 19,
      "roadTies": 0,
      "roadWins": 24,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 5,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Carolina Hurricanes",
        "fr": "Hurricanes de la Caroline"
      },
      "teamCommonName": {
        "default": "Hurricanes"
      },
      "teamAbbrev": {
        "default": "CAR"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/CAR_light.svg",
      "ties": 0,
      "waiversSequence": 31,
      "wildcardSequence": 0,
      "winPctg": 0.646341,
      "wins": 53
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 2,
      "conferenceL10Sequence": 3,
      "conferenceName": "Western",
      "conferenceRoadSequence": 2,
      "conferenceSequence": 2,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 2,
      "divisionL10Sequence": 2,
      "divisionName": "Central",
      "divisionRoadSequence": 2,
      "divisionSequence": 2,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 53,
      "goalDifferentialPctg": 0.646341,
      "goalAgainst": 226,
      "goalFor": 279,
      "goalsForPctg": 3.402439,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 23,
      "homeGoalsAgainst": 112,
      "homeGoalsFor": 135,
      "homeLosses": 11,
      "homeOtLosses": 4,
      "homePoints": 56,
      "homeRegulationPlusOtWins": 24,
      "homeRegulationWins": 19,
      "homeTies": 0,
      "homeWins": 26,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 6,
      "l10GoalsAgainst": 28,
      "l10GoalsFor": 34,
      "l10Losses": 2,
      "l10OtLosses": 1,
      "l10Points": 15,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 7,
      "leagueHomeSequence": 5,
      "leagueL10Sequence": 5,
      "leagueRoadSequence": 2,
      "leagueSequence": 3,
      "losses": 20,
      "otLosses": 12,
      "placeName": {
        "default": "Dallas"
      },
      "pointPctg": 0.682927,
      "points": 112,
      "regulationPlusOtWinPctg": 0.536585,
      "regulationPlusOtWins": 44,
      "regulationWinPctg": 0.463415,
      "regulationWins": 38,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 30,
      "roadGoalsAgainst": 114,
      "roadGoalsFor": 144,
      "roadLosses": 9,
      "roadOtLosses": 8,
      "roadPoints": 56,
      "roadRegulationPlusOtWins": 20,
      "roadRegulationWins": 19,
      "roadTies": 0,
      "roadWins": 24,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 6,
      "streakCode": "W",
      "streakCount": 5,
      "teamName": {
        "default": "Dallas Stars",
        "fr": "Stars de Dallas"
      },
      "teamCommonName": {
        "default": "Stars"
      },
      "teamAbbrev": {
        "default": "DAL"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/DAL_light.svg",
      "ties": 0,
      "waiversSequence": 30,
      "wildcardSequence": 0,
      "winPctg": 0.609756,
      "wins": 50
    },
    {
      "clinchIndicator": "y",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 3,
      "conferenceL10Sequence": 6,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 4,
      "conferenceSequence": 2,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 2,
      "divisionL10Sequence": 3,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 3,
      "divisionSequence": 1,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 47,
      "goalDifferentialPctg": 0.573171,
      "goalAgainst": 241,
      "goalFor": 288,
      "goalsForPctg": 3.512195,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 30,
      "homeGoalsAgainst": 119,
      "homeGoalsFor": 149,
      "homeLosses": 10,
      "homeOtLosses": 5,
      "homePoints": 57,
      "homeRegulationPlusOtWins": 22,
      "homeRegulationWins": 22,
      "homeTies": 0,
      "homeWins": 26,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 4,
      "l10GoalsAgainst": 30,
      "l10GoalsFor": 34,
      "l10Losses": 3,
      "l10OtLosses": 1,
      "l10Points": 13,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 4,
      "leagueL10Sequence": 12,
      "leagueRoadSequence": 6,
      "leagueSequence": 4,
      "losses": 23,
      "otLosses": 9,
      "placeName": {
        "default": "Buffalo"
      },
      "pointPctg": 0.664634,
      "points": 109,
      "regulationPlusOtWinPctg": 0.54878,
      "regulationPlusOtWins": 45,
      "regulationWinPctg": 0.512195,
      "regulationWins": 42,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 17,
      "roadGoalsAgainst": 122,
      "roadGoalsFor": 139,
      "roadLosses": 13,
      "roadOtLosses": 4,
      "roadPoints": 52,
      "roadRegulationPlusOtWins": 23,
      "roadRegulationWins": 20,
      "roadTies": 0,
      "roadWins": 24,
      "seasonId": 20252026,
      "shootoutLosses": 1,
      "shootoutWins": 5,
      "streakCode": "OT",
      "streakCount": 1,
      "teamName": {
        "default": "Buffalo Sabres",
        "fr": "Sabres de Buffalo"
      },
      "teamCommonName": {
        "default": "Sabres"
      },
      "teamAbbrev": {
        "default": "BUF"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/BUF_light.svg",
      "ties": 0,
      "waiversSequence": 29,
      "wildcardSequence": 0,
      "winPctg": 0.609756,
      "wins": 50
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 5,
      "conferenceL10Sequence": 12,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 2,
      "conferenceSequence": 3,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 3,
      "divisionL10Sequence": 6,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 2,
      "divisionSequence": 2,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 59,
      "goalDifferentialPctg": 0.719512,
      "goalAgainst": 231,
      "goalFor": 290,
      "goalsForPctg": 3.536585,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 22,
      "homeGoalsAgainst": 115,
      "homeGoalsFor": 137,
      "homeLosses": 14,
      "homeOtLosses": 1,
      "homePoints": 53,
      "homeRegulationPlusOtWins": 24,
      "homeRegulationWins": 19,
      "homeTies": 0,
      "homeWins": 26,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -4,
      "l10GoalsAgainst": 30,
      "l10GoalsFor": 26,
      "l10Losses": 5,
      "l10OtLosses": 0,
      "l10Points": 10,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 4,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 8,
      "leagueL10Sequence": 21,
      "leagueRoadSequence": 4,
      "leagueSequence": 5,
      "losses": 26,
      "otLosses": 6,
      "placeName": {
        "default": "Tampa Bay"
      },
      "pointPctg": 0.646341,
      "points": 106,
      "regulationPlusOtWinPctg": 0.560976,
      "regulationPlusOtWins": 46,
      "regulationWinPctg": 0.487805,
      "regulationWins": 40,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 37,
      "roadGoalsAgainst": 116,
      "roadGoalsFor": 153,
      "roadLosses": 12,
      "roadOtLosses": 5,
      "roadPoints": 53,
      "roadRegulationPlusOtWins": 22,
      "roadRegulationWins": 21,
      "roadTies": 0,
      "roadWins": 24,
      "seasonId": 20252026,
      "shootoutLosses": 2,
      "shootoutWins": 4,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "Tampa Bay Lightning",
        "fr": "Lightning de Tampa Bay"
      },
      "teamCommonName": {
        "default": "Lightning"
      },
      "teamAbbrev": {
        "default": "TBL"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/TBL_light.svg",
      "ties": 0,
      "waiversSequence": 28,
      "wildcardSequence": 0,
      "winPctg": 0.609756,
      "wins": 50
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 7,
      "conferenceL10Sequence": 3,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 1,
      "conferenceSequence": 4,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 5,
      "divisionL10Sequence": 1,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 1,
      "divisionSequence": 3,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 27,
      "goalDifferentialPctg": 0.329268,
      "goalAgainst": 256,
      "goalFor": 283,
      "goalsForPctg": 3.45122,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 10,
      "homeGoalsAgainst": 127,
      "homeGoalsFor": 137,
      "homeLosses": 15,
      "homeOtLosses": 2,
      "homePoints": 50,
      "homeRegulationPlusOtWins": 22,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 24,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 4,
      "l10GoalsAgainst": 24,
      "l10GoalsFor": 28,
      "l10Losses": 3,
      "l10OtLosses": 0,
      "l10Points": 14,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 7,
      "leagueHomeSequence": 12,
      "leagueL10Sequence": 7,
      "leagueRoadSequence": 3,
      "leagueSequence": 6,
      "losses": 24,
      "otLosses": 10,
      "placeName": {
        "default": "Montréal"
      },
      "pointPctg": 0.646341,
      "points": 106,
      "regulationPlusOtWinPctg": 0.536585,
      "regulationPlusOtWins": 44,
      "regulationWinPctg": 0.414634,
      "regulationWins": 34,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 17,
      "roadGoalsAgainst": 129,
      "roadGoalsFor": 146,
      "roadLosses": 9,
      "roadOtLosses": 8,
      "roadPoints": 56,
      "roadRegulationPlusOtWins": 22,
      "roadRegulationWins": 17,
      "roadTies": 0,
      "roadWins": 24,
      "seasonId": 20252026,
      "shootoutLosses": 5,
      "shootoutWins": 4,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "Montréal Canadiens",
        "fr": "Canadiens de Montréal"
      },
      "teamCommonName": {
        "default": "Canadiens"
      },
      "teamAbbrev": {
        "default": "MTL"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/MTL_light.svg",
      "ties": 0,
      "waiversSequence": 27,
      "wildcardSequence": 0,
      "winPctg": 0.585366,
      "wins": 48
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 3,
      "conferenceL10Sequence": 7,
      "conferenceName": "Western",
      "conferenceRoadSequence": 4,
      "conferenceSequence": 3,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 3,
      "divisionL10Sequence": 4,
      "divisionName": "Central",
      "divisionRoadSequence": 3,
      "divisionSequence": 3,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 32,
      "goalDifferentialPctg": 0.390244,
      "goalAgainst": 240,
      "goalFor": 272,
      "goalsForPctg": 3.317073,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 15,
      "homeGoalsAgainst": 115,
      "homeGoalsFor": 130,
      "homeLosses": 10,
      "homeOtLosses": 8,
      "homePoints": 54,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 14,
      "homeTies": 0,
      "homeWins": 23,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 4,
      "l10GoalsAgainst": 32,
      "l10GoalsFor": 36,
      "l10Losses": 4,
      "l10OtLosses": 0,
      "l10Points": 12,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 7,
      "leagueL10Sequence": 14,
      "leagueRoadSequence": 9,
      "leagueSequence": 7,
      "losses": 24,
      "otLosses": 12,
      "placeName": {
        "default": "Minnesota"
      },
      "pointPctg": 0.634146,
      "points": 104,
      "regulationPlusOtWinPctg": 0.512195,
      "regulationPlusOtWins": 42,
      "regulationWinPctg": 0.378049,
      "regulationWins": 31,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 17,
      "roadGoalsAgainst": 125,
      "roadGoalsFor": 142,
      "roadLosses": 14,
      "roadOtLosses": 4,
      "roadPoints": 50,
      "roadRegulationPlusOtWins": 23,
      "roadRegulationWins": 17,
      "roadTies": 0,
      "roadWins": 23,
      "seasonId": 20252026,
      "shootoutLosses": 5,
      "shootoutWins": 4,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Minnesota Wild",
        "fr": "Wild du Minnesota"
      },
      "teamCommonName": {
        "default": "Wild"
      },
      "teamAbbrev": {
        "default": "MIN"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/MIN_light.svg",
      "ties": 0,
      "waiversSequence": 26,
      "wildcardSequence": 0,
      "winPctg": 0.560976,
      "wins": 46
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 2,
      "conferenceL10Sequence": 8,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 13,
      "conferenceSequence": 5,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 1,
      "divisionL10Sequence": 4,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 6,
      "divisionSequence": 4,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 22,
      "goalDifferentialPctg": 0.268293,
      "goalAgainst": 250,
      "goalFor": 272,
      "goalsForPctg": 3.317073,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 40,
      "homeGoalsAgainst": 105,
      "homeGoalsFor": 145,
      "homeLosses": 11,
      "homeOtLosses": 1,
      "homePoints": 59,
      "homeRegulationPlusOtWins": 28,
      "homeRegulationWins": 23,
      "homeTies": 0,
      "homeWins": 29,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 6,
      "l10GoalsAgainst": 26,
      "l10GoalsFor": 32,
      "l10Losses": 3,
      "l10OtLosses": 2,
      "l10Points": 12,
      "l10RegulationPlusOtWins": 4,
      "l10RegulationWins": 4,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 2,
      "leagueL10Sequence": 16,
      "leagueRoadSequence": 21,
      "leagueSequence": 8,
      "losses": 27,
      "otLosses": 10,
      "placeName": {
        "default": "Boston"
      },
      "pointPctg": 0.609756,
      "points": 100,
      "regulationPlusOtWinPctg": 0.5,
      "regulationPlusOtWins": 41,
      "regulationWinPctg": 0.402439,
      "regulationWins": 33,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -18,
      "roadGoalsAgainst": 145,
      "roadGoalsFor": 127,
      "roadLosses": 16,
      "roadOtLosses": 9,
      "roadPoints": 41,
      "roadRegulationPlusOtWins": 13,
      "roadRegulationWins": 10,
      "roadTies": 0,
      "roadWins": 16,
      "seasonId": 20252026,
      "shootoutLosses": 3,
      "shootoutWins": 4,
      "streakCode": "W",
      "streakCount": 2,
      "teamName": {
        "default": "Boston Bruins",
        "fr": "Bruins de Boston"
      },
      "teamCommonName": {
        "default": "Bruins"
      },
      "teamAbbrev": {
        "default": "BOS"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/BOS_light.svg?season=20252026",
      "ties": 0,
      "waiversSequence": 25,
      "wildcardSequence": 1,
      "winPctg": 0.54878,
      "wins": 45
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 6,
      "conferenceL10Sequence": 5,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 7,
      "conferenceSequence": 6,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 4,
      "divisionL10Sequence": 2,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 4,
      "divisionSequence": 5,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 32,
      "goalDifferentialPctg": 0.390244,
      "goalAgainst": 246,
      "goalFor": 278,
      "goalsForPctg": 3.390244,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 31,
      "homeGoalsAgainst": 108,
      "homeGoalsFor": 139,
      "homeLosses": 12,
      "homeOtLosses": 6,
      "homePoints": 52,
      "homeRegulationPlusOtWins": 21,
      "homeRegulationWins": 21,
      "homeTies": 0,
      "homeWins": 23,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 10,
      "l10GoalsAgainst": 26,
      "l10GoalsFor": 36,
      "l10Losses": 3,
      "l10OtLosses": 1,
      "l10Points": 13,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 9,
      "leagueL10Sequence": 10,
      "leagueRoadSequence": 11,
      "leagueSequence": 9,
      "losses": 27,
      "otLosses": 11,
      "placeName": {
        "default": "Ottawa"
      },
      "pointPctg": 0.603659,
      "points": 99,
      "regulationPlusOtWinPctg": 0.5,
      "regulationPlusOtWins": 41,
      "regulationWinPctg": 0.463415,
      "regulationWins": 38,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 1,
      "roadGoalsAgainst": 138,
      "roadGoalsFor": 139,
      "roadLosses": 15,
      "roadOtLosses": 5,
      "roadPoints": 47,
      "roadRegulationPlusOtWins": 20,
      "roadRegulationWins": 17,
      "roadTies": 0,
      "roadWins": 21,
      "seasonId": 20252026,
      "shootoutLosses": 1,
      "shootoutWins": 3,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Ottawa Senators",
        "fr": "Sénateurs d'Ottawa"
      },
      "teamCommonName": {
        "default": "Senators",
        "fr": "Sénateurs"
      },
      "teamAbbrev": {
        "default": "OTT"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/OTT_light.svg",
      "ties": 0,
      "waiversSequence": 24,
      "wildcardSequence": 2,
      "winPctg": 0.536585,
      "wins": 44
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 10,
      "conferenceL10Sequence": 11,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 5,
      "conferenceSequence": 7,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 4,
      "divisionL10Sequence": 6,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 2,
      "divisionSequence": 2,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 25,
      "goalDifferentialPctg": 0.304878,
      "goalAgainst": 268,
      "goalFor": 293,
      "goalsForPctg": 3.573171,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 7,
      "homeGoalsAgainst": 143,
      "homeGoalsFor": 150,
      "homeLosses": 13,
      "homeOtLosses": 8,
      "homePoints": 48,
      "homeRegulationPlusOtWins": 18,
      "homeRegulationWins": 16,
      "homeTies": 0,
      "homeWins": 20,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 6,
      "l10GoalsAgainst": 40,
      "l10GoalsFor": 46,
      "l10Losses": 5,
      "l10OtLosses": 0,
      "l10Points": 10,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 17,
      "leagueL10Sequence": 20,
      "leagueRoadSequence": 8,
      "leagueSequence": 10,
      "losses": 25,
      "otLosses": 16,
      "placeName": {
        "default": "Pittsburgh"
      },
      "pointPctg": 0.597561,
      "points": 98,
      "regulationPlusOtWinPctg": 0.463415,
      "regulationPlusOtWins": 38,
      "regulationWinPctg": 0.414634,
      "regulationWins": 34,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 18,
      "roadGoalsAgainst": 125,
      "roadGoalsFor": 143,
      "roadLosses": 12,
      "roadOtLosses": 8,
      "roadPoints": 50,
      "roadRegulationPlusOtWins": 20,
      "roadRegulationWins": 18,
      "roadTies": 0,
      "roadWins": 21,
      "seasonId": 20252026,
      "shootoutLosses": 10,
      "shootoutWins": 3,
      "streakCode": "L",
      "streakCount": 3,
      "teamName": {
        "default": "Pittsburgh Penguins",
        "fr": "Penguins de Pittsburgh"
      },
      "teamCommonName": {
        "default": "Penguins"
      },
      "teamAbbrev": {
        "default": "PIT"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/PIT_light.svg",
      "ties": 0,
      "waiversSequence": 23,
      "wildcardSequence": 0,
      "winPctg": 0.5,
      "wins": 41
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 11,
      "conferenceL10Sequence": 4,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 6,
      "conferenceSequence": 8,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 5,
      "divisionL10Sequence": 3,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 3,
      "divisionSequence": 3,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 7,
      "goalDifferentialPctg": 0.085366,
      "goalAgainst": 243,
      "goalFor": 250,
      "goalsForPctg": 3.04878,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -2,
      "homeGoalsAgainst": 113,
      "homeGoalsFor": 111,
      "homeLosses": 13,
      "homeOtLosses": 8,
      "homePoints": 48,
      "homeRegulationPlusOtWins": 17,
      "homeRegulationWins": 13,
      "homeTies": 0,
      "homeWins": 20,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 11,
      "l10GoalsAgainst": 25,
      "l10GoalsFor": 36,
      "l10Losses": 3,
      "l10OtLosses": 0,
      "l10Points": 14,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 4,
      "l10Ties": 0,
      "l10Wins": 7,
      "leagueHomeSequence": 19,
      "leagueL10Sequence": 8,
      "leagueRoadSequence": 10,
      "leagueSequence": 11,
      "losses": 27,
      "otLosses": 12,
      "placeName": {
        "default": "Philadelphia",
        "fr": "Philadelphie"
      },
      "pointPctg": 0.597561,
      "points": 98,
      "regulationPlusOtWinPctg": 0.402439,
      "regulationPlusOtWins": 33,
      "regulationWinPctg": 0.329268,
      "regulationWins": 27,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 9,
      "roadGoalsAgainst": 130,
      "roadGoalsFor": 139,
      "roadLosses": 14,
      "roadOtLosses": 4,
      "roadPoints": 50,
      "roadRegulationPlusOtWins": 16,
      "roadRegulationWins": 14,
      "roadTies": 0,
      "roadWins": 23,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 10,
      "streakCode": "W",
      "streakCount": 3,
      "teamName": {
        "default": "Philadelphia Flyers",
        "fr": "Flyers de Philadelphie"
      },
      "teamCommonName": {
        "default": "Flyers"
      },
      "teamAbbrev": {
        "default": "PHI"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/PHI_light.svg",
      "ties": 0,
      "waiversSequence": 22,
      "wildcardSequence": 0,
      "winPctg": 0.52439,
      "wins": 43
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 4,
      "conferenceL10Sequence": 1,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 14,
      "conferenceSequence": 9,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 2,
      "divisionL10Sequence": 1,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 8,
      "divisionSequence": 4,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 19,
      "goalDifferentialPctg": 0.231707,
      "goalAgainst": 244,
      "goalFor": 263,
      "goalsForPctg": 3.207317,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 30,
      "homeGoalsAgainst": 109,
      "homeGoalsFor": 139,
      "homeLosses": 11,
      "homeOtLosses": 5,
      "homePoints": 55,
      "homeRegulationPlusOtWins": 25,
      "homeRegulationWins": 22,
      "homeTies": 0,
      "homeWins": 25,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 10,
      "l10GoalsAgainst": 33,
      "l10GoalsFor": 43,
      "l10Losses": 2,
      "l10OtLosses": 0,
      "l10Points": 16,
      "l10RegulationPlusOtWins": 7,
      "l10RegulationWins": 7,
      "l10Ties": 0,
      "l10Wins": 8,
      "leagueHomeSequence": 6,
      "leagueL10Sequence": 2,
      "leagueRoadSequence": 22,
      "leagueSequence": 12,
      "losses": 30,
      "otLosses": 9,
      "placeName": {
        "default": "Washington"
      },
      "pointPctg": 0.579268,
      "points": 95,
      "regulationPlusOtWinPctg": 0.5,
      "regulationPlusOtWins": 41,
      "regulationWinPctg": 0.45122,
      "regulationWins": 37,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -11,
      "roadGoalsAgainst": 135,
      "roadGoalsFor": 124,
      "roadLosses": 19,
      "roadOtLosses": 4,
      "roadPoints": 40,
      "roadRegulationPlusOtWins": 16,
      "roadRegulationWins": 15,
      "roadTies": 0,
      "roadWins": 18,
      "seasonId": 20252026,
      "shootoutLosses": 6,
      "shootoutWins": 2,
      "streakCode": "W",
      "streakCount": 4,
      "teamName": {
        "default": "Washington Capitals",
        "fr": "Capitals de Washington"
      },
      "teamCommonName": {
        "default": "Capitals"
      },
      "teamAbbrev": {
        "default": "WSH"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/WSH_secondary_light.svg",
      "ties": 0,
      "waiversSequence": 21,
      "wildcardSequence": 3,
      "winPctg": 0.52439,
      "wins": 43
    },
    {
      "clinchIndicator": "y",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 6,
      "conferenceL10Sequence": 1,
      "conferenceName": "Western",
      "conferenceRoadSequence": 5,
      "conferenceSequence": 4,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 3,
      "divisionL10Sequence": 1,
      "divisionName": "Pacific",
      "divisionRoadSequence": 2,
      "divisionSequence": 1,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 15,
      "goalDifferentialPctg": 0.182927,
      "goalAgainst": 250,
      "goalFor": 265,
      "goalsForPctg": 3.231707,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 19,
      "homeGoalsAgainst": 127,
      "homeGoalsFor": 146,
      "homeLosses": 12,
      "homeOtLosses": 9,
      "homePoints": 49,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 18,
      "homeTies": 0,
      "homeWins": 20,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 15,
      "l10GoalsAgainst": 25,
      "l10GoalsFor": 40,
      "l10Losses": 0,
      "l10OtLosses": 3,
      "l10Points": 17,
      "l10RegulationPlusOtWins": 7,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 7,
      "leagueHomeSequence": 13,
      "leagueL10Sequence": 1,
      "leagueRoadSequence": 13,
      "leagueSequence": 13,
      "losses": 26,
      "otLosses": 17,
      "placeName": {
        "default": "Vegas"
      },
      "pointPctg": 0.579268,
      "points": 95,
      "regulationPlusOtWinPctg": 0.463415,
      "regulationPlusOtWins": 38,
      "regulationWinPctg": 0.365854,
      "regulationWins": 30,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -4,
      "roadGoalsAgainst": 123,
      "roadGoalsFor": 119,
      "roadLosses": 14,
      "roadOtLosses": 8,
      "roadPoints": 46,
      "roadRegulationPlusOtWins": 19,
      "roadRegulationWins": 12,
      "roadTies": 0,
      "roadWins": 19,
      "seasonId": 20252026,
      "shootoutLosses": 8,
      "shootoutWins": 1,
      "streakCode": "W",
      "streakCount": 3,
      "teamName": {
        "default": "Vegas Golden Knights",
        "fr": "Golden Knights de Vegas"
      },
      "teamCommonName": {
        "default": "Golden Knights"
      },
      "teamAbbrev": {
        "default": "VGK"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/VGK_light.svg",
      "ties": 0,
      "waiversSequence": 20,
      "wildcardSequence": 0,
      "winPctg": 0.47561,
      "wins": 39
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 7,
      "conferenceL10Sequence": 4,
      "conferenceName": "Western",
      "conferenceRoadSequence": 7,
      "conferenceSequence": 5,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 4,
      "divisionL10Sequence": 2,
      "divisionName": "Pacific",
      "divisionRoadSequence": 3,
      "divisionSequence": 2,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 13,
      "goalDifferentialPctg": 0.158537,
      "goalAgainst": 269,
      "goalFor": 282,
      "goalsForPctg": 3.439024,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 3,
      "homeGoalsAgainst": 140,
      "homeGoalsFor": 143,
      "homeLosses": 14,
      "homeOtLosses": 5,
      "homePoints": 49,
      "homeRegulationPlusOtWins": 22,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 22,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 9,
      "l10GoalsAgainst": 23,
      "l10GoalsFor": 32,
      "l10Losses": 2,
      "l10OtLosses": 2,
      "l10Points": 14,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 14,
      "leagueL10Sequence": 6,
      "leagueRoadSequence": 16,
      "leagueSequence": 14,
      "losses": 30,
      "otLosses": 11,
      "placeName": {
        "default": "Edmonton"
      },
      "pointPctg": 0.567073,
      "points": 93,
      "regulationPlusOtWinPctg": 0.5,
      "regulationPlusOtWins": 41,
      "regulationWinPctg": 0.390244,
      "regulationWins": 32,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 10,
      "roadGoalsAgainst": 129,
      "roadGoalsFor": 139,
      "roadLosses": 16,
      "roadOtLosses": 6,
      "roadPoints": 44,
      "roadRegulationPlusOtWins": 19,
      "roadRegulationWins": 15,
      "roadTies": 0,
      "roadWins": 19,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 0,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Edmonton Oilers",
        "fr": "Oilers d'Edmonton"
      },
      "teamCommonName": {
        "default": "Oilers"
      },
      "teamAbbrev": {
        "default": "EDM"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/EDM_light.svg",
      "ties": 0,
      "waiversSequence": 19,
      "wildcardSequence": 0,
      "winPctg": 0.5,
      "wins": 41
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 9,
      "conferenceL10Sequence": 8,
      "conferenceName": "Western",
      "conferenceRoadSequence": 6,
      "conferenceSequence": 6,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 4,
      "divisionL10Sequence": 5,
      "divisionName": "Central",
      "divisionRoadSequence": 4,
      "divisionSequence": 4,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 28,
      "goalDifferentialPctg": 0.341463,
      "goalAgainst": 240,
      "goalFor": 268,
      "goalsForPctg": 3.268293,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 13,
      "homeGoalsAgainst": 124,
      "homeGoalsFor": 137,
      "homeLosses": 16,
      "homeOtLosses": 3,
      "homePoints": 47,
      "homeRegulationPlusOtWins": 22,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 22,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 6,
      "l10GoalsAgainst": 37,
      "l10GoalsFor": 43,
      "l10Losses": 4,
      "l10OtLosses": 0,
      "l10Points": 12,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 20,
      "leagueL10Sequence": 15,
      "leagueRoadSequence": 14,
      "leagueSequence": 15,
      "losses": 33,
      "otLosses": 6,
      "placeName": {
        "default": "Utah"
      },
      "pointPctg": 0.560976,
      "points": 92,
      "regulationPlusOtWinPctg": 0.52439,
      "regulationPlusOtWins": 43,
      "regulationWinPctg": 0.402439,
      "regulationWins": 33,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 15,
      "roadGoalsAgainst": 116,
      "roadGoalsFor": 131,
      "roadLosses": 17,
      "roadOtLosses": 3,
      "roadPoints": 45,
      "roadRegulationPlusOtWins": 21,
      "roadRegulationWins": 16,
      "roadTies": 0,
      "roadWins": 21,
      "seasonId": 20252026,
      "shootoutLosses": 0,
      "shootoutWins": 0,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "Utah Mammoth",
        "fr": "Mammoth de l'Utah"
      },
      "teamCommonName": {
        "default": "Mammoth"
      },
      "teamAbbrev": {
        "default": "UTA"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/UTA_light.svg?season=20252026",
      "ties": 0,
      "waiversSequence": 18,
      "wildcardSequence": 1,
      "winPctg": 0.52439,
      "wins": 43
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 13,
      "conferenceL10Sequence": 14,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 8,
      "conferenceSequence": 10,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 7,
      "divisionL10Sequence": 7,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 5,
      "divisionSequence": 6,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -17,
      "goalDifferentialPctg": -0.207317,
      "goalAgainst": 258,
      "goalFor": 241,
      "goalsForPctg": 2.939024,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -10,
      "homeGoalsAgainst": 137,
      "homeGoalsFor": 127,
      "homeLosses": 16,
      "homeOtLosses": 4,
      "homePoints": 46,
      "homeRegulationPlusOtWins": 21,
      "homeRegulationWins": 14,
      "homeTies": 0,
      "homeWins": 21,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -16,
      "l10GoalsAgainst": 45,
      "l10GoalsFor": 29,
      "l10Losses": 6,
      "l10OtLosses": 2,
      "l10Points": 6,
      "l10RegulationPlusOtWins": 2,
      "l10RegulationWins": 2,
      "l10Ties": 0,
      "l10Wins": 2,
      "leagueHomeSequence": 23,
      "leagueL10Sequence": 28,
      "leagueRoadSequence": 12,
      "leagueSequence": 16,
      "losses": 31,
      "otLosses": 10,
      "placeName": {
        "default": "Detroit"
      },
      "pointPctg": 0.560976,
      "points": 92,
      "regulationPlusOtWinPctg": 0.47561,
      "regulationPlusOtWins": 39,
      "regulationWinPctg": 0.365854,
      "regulationWins": 30,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -7,
      "roadGoalsAgainst": 121,
      "roadGoalsFor": 114,
      "roadLosses": 15,
      "roadOtLosses": 6,
      "roadPoints": 46,
      "roadRegulationPlusOtWins": 18,
      "roadRegulationWins": 16,
      "roadTies": 0,
      "roadWins": 20,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 2,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "Detroit Red Wings",
        "fr": "Red Wings de Detroit"
      },
      "teamCommonName": {
        "default": "Red Wings"
      },
      "teamAbbrev": {
        "default": "DET"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/DET_light.svg?season=20252026",
      "ties": 0,
      "waiversSequence": 17,
      "wildcardSequence": 4,
      "winPctg": 0.5,
      "wins": 41
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 9,
      "conferenceL10Sequence": 16,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 10,
      "conferenceSequence": 11,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 3,
      "divisionL10Sequence": 8,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 5,
      "divisionSequence": 5,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": 0,
      "goalDifferentialPctg": 0,
      "goalAgainst": 253,
      "goalFor": 253,
      "goalsForPctg": 3.085366,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 9,
      "homeGoalsAgainst": 126,
      "homeGoalsFor": 135,
      "homeLosses": 13,
      "homeOtLosses": 8,
      "homePoints": 48,
      "homeRegulationPlusOtWins": 18,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 20,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -13,
      "l10GoalsAgainst": 34,
      "l10GoalsFor": 21,
      "l10Losses": 7,
      "l10OtLosses": 1,
      "l10Points": 5,
      "l10RegulationPlusOtWins": 1,
      "l10RegulationWins": 1,
      "l10Ties": 0,
      "l10Wins": 2,
      "leagueHomeSequence": 16,
      "leagueL10Sequence": 31,
      "leagueRoadSequence": 17,
      "leagueSequence": 17,
      "losses": 30,
      "otLosses": 12,
      "placeName": {
        "default": "Columbus"
      },
      "pointPctg": 0.560976,
      "points": 92,
      "regulationPlusOtWinPctg": 0.402439,
      "regulationPlusOtWins": 33,
      "regulationWinPctg": 0.341463,
      "regulationWins": 28,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -9,
      "roadGoalsAgainst": 127,
      "roadGoalsFor": 118,
      "roadLosses": 17,
      "roadOtLosses": 4,
      "roadPoints": 44,
      "roadRegulationPlusOtWins": 15,
      "roadRegulationWins": 11,
      "roadTies": 0,
      "roadWins": 20,
      "seasonId": 20252026,
      "shootoutLosses": 2,
      "shootoutWins": 7,
      "streakCode": "L",
      "streakCount": 2,
      "teamName": {
        "default": "Columbus Blue Jackets",
        "fr": "Blue Jackets de Columbus"
      },
      "teamCommonName": {
        "default": "Blue Jackets"
      },
      "teamAbbrev": {
        "default": "CBJ"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg",
      "ties": 0,
      "waiversSequence": 16,
      "wildcardSequence": 5,
      "winPctg": 0.487805,
      "wins": 40
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 4,
      "conferenceL10Sequence": 14,
      "conferenceName": "Western",
      "conferenceRoadSequence": 9,
      "conferenceSequence": 7,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 1,
      "divisionL10Sequence": 7,
      "divisionName": "Pacific",
      "divisionRoadSequence": 4,
      "divisionSequence": 3,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -15,
      "goalDifferentialPctg": -0.182927,
      "goalAgainst": 288,
      "goalFor": 273,
      "goalsForPctg": 3.329268,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 2,
      "homeGoalsAgainst": 143,
      "homeGoalsFor": 145,
      "homeLosses": 13,
      "homeOtLosses": 4,
      "homePoints": 52,
      "homeRegulationPlusOtWins": 20,
      "homeRegulationWins": 15,
      "homeTies": 0,
      "homeWins": 24,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -11,
      "l10GoalsAgainst": 41,
      "l10GoalsFor": 30,
      "l10Losses": 6,
      "l10OtLosses": 2,
      "l10Points": 6,
      "l10RegulationPlusOtWins": 2,
      "l10RegulationWins": 2,
      "l10Ties": 0,
      "l10Wins": 2,
      "leagueHomeSequence": 10,
      "leagueL10Sequence": 27,
      "leagueRoadSequence": 23,
      "leagueSequence": 18,
      "losses": 33,
      "otLosses": 6,
      "placeName": {
        "default": "Anaheim"
      },
      "pointPctg": 0.560976,
      "points": 92,
      "regulationPlusOtWinPctg": 0.426829,
      "regulationPlusOtWins": 35,
      "regulationWinPctg": 0.317073,
      "regulationWins": 26,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -17,
      "roadGoalsAgainst": 145,
      "roadGoalsFor": 128,
      "roadLosses": 20,
      "roadOtLosses": 2,
      "roadPoints": 40,
      "roadRegulationPlusOtWins": 15,
      "roadRegulationWins": 11,
      "roadTies": 0,
      "roadWins": 19,
      "seasonId": 20252026,
      "shootoutLosses": 0,
      "shootoutWins": 8,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Anaheim Ducks",
        "fr": "Ducks d'Anaheim"
      },
      "teamCommonName": {
        "default": "Ducks"
      },
      "teamAbbrev": {
        "default": "ANA"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/ANA_light.svg",
      "ties": 0,
      "waiversSequence": 15,
      "wildcardSequence": 0,
      "winPctg": 0.52439,
      "wins": 43
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 12,
      "conferenceL10Sequence": 13,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 9,
      "conferenceSequence": 12,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 6,
      "divisionL10Sequence": 7,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 4,
      "divisionSequence": 6,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -8,
      "goalDifferentialPctg": -0.097561,
      "goalAgainst": 241,
      "goalFor": 233,
      "goalsForPctg": 2.841463,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -2,
      "homeGoalsAgainst": 122,
      "homeGoalsFor": 120,
      "homeLosses": 17,
      "homeOtLosses": 2,
      "homePoints": 46,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 22,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -11,
      "l10GoalsAgainst": 35,
      "l10GoalsFor": 24,
      "l10Losses": 7,
      "l10OtLosses": 0,
      "l10Points": 6,
      "l10RegulationPlusOtWins": 3,
      "l10RegulationWins": 3,
      "l10Ties": 0,
      "l10Wins": 3,
      "leagueHomeSequence": 22,
      "leagueL10Sequence": 26,
      "leagueRoadSequence": 15,
      "leagueSequence": 19,
      "losses": 34,
      "otLosses": 5,
      "placeName": {
        "default": "NY Islanders"
      },
      "pointPctg": 0.554878,
      "points": 91,
      "regulationPlusOtWinPctg": 0.47561,
      "regulationPlusOtWins": 39,
      "regulationWinPctg": 0.353659,
      "regulationWins": 29,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -6,
      "roadGoalsAgainst": 119,
      "roadGoalsFor": 113,
      "roadLosses": 17,
      "roadOtLosses": 3,
      "roadPoints": 45,
      "roadRegulationPlusOtWins": 20,
      "roadRegulationWins": 12,
      "roadTies": 0,
      "roadWins": 21,
      "seasonId": 20252026,
      "shootoutLosses": 5,
      "shootoutWins": 4,
      "streakCode": "L",
      "streakCount": 3,
      "teamName": {
        "default": "New York Islanders",
        "fr": "Islanders de New York"
      },
      "teamCommonName": {
        "default": "Islanders"
      },
      "teamAbbrev": {
        "default": "NYI"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/NYI_light.svg",
      "ties": 0,
      "waiversSequence": 14,
      "wildcardSequence": 6,
      "winPctg": 0.52439,
      "wins": 43
    },
    {
      "clinchIndicator": "x",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 14,
      "conferenceL10Sequence": 5,
      "conferenceName": "Western",
      "conferenceRoadSequence": 3,
      "conferenceSequence": 8,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 7,
      "divisionL10Sequence": 3,
      "divisionName": "Pacific",
      "divisionRoadSequence": 1,
      "divisionSequence": 4,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -22,
      "goalDifferentialPctg": -0.268293,
      "goalAgainst": 247,
      "goalFor": 225,
      "goalsForPctg": 2.743902,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -20,
      "homeGoalsAgainst": 128,
      "homeGoalsFor": 108,
      "homeLosses": 17,
      "homeOtLosses": 9,
      "homePoints": 39,
      "homeRegulationPlusOtWins": 13,
      "homeRegulationWins": 10,
      "homeTies": 0,
      "homeWins": 15,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 1,
      "l10GoalsAgainst": 31,
      "l10GoalsFor": 32,
      "l10Losses": 2,
      "l10OtLosses": 2,
      "l10Points": 14,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 3,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 29,
      "leagueL10Sequence": 9,
      "leagueRoadSequence": 7,
      "leagueSequence": 20,
      "losses": 27,
      "otLosses": 20,
      "placeName": {
        "default": "Los Angeles"
      },
      "pointPctg": 0.54878,
      "points": 90,
      "regulationPlusOtWinPctg": 0.365854,
      "regulationPlusOtWins": 30,
      "regulationWinPctg": 0.268293,
      "regulationWins": 22,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -2,
      "roadGoalsAgainst": 119,
      "roadGoalsFor": 117,
      "roadLosses": 10,
      "roadOtLosses": 11,
      "roadPoints": 51,
      "roadRegulationPlusOtWins": 17,
      "roadRegulationWins": 12,
      "roadTies": 0,
      "roadWins": 20,
      "seasonId": 20252026,
      "shootoutLosses": 9,
      "shootoutWins": 5,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "Los Angeles Kings",
        "fr": "Kings de Los Angeles"
      },
      "teamCommonName": {
        "default": "Kings"
      },
      "teamAbbrev": {
        "default": "LAK"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/LAK_light.svg",
      "ties": 0,
      "waiversSequence": 13,
      "wildcardSequence": 2,
      "winPctg": 0.426829,
      "wins": 35
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 14,
      "conferenceL10Sequence": 10,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 11,
      "conferenceSequence": 13,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 7,
      "divisionL10Sequence": 5,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 6,
      "divisionSequence": 7,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -24,
      "goalDifferentialPctg": -0.292683,
      "goalAgainst": 254,
      "goalFor": 230,
      "goalsForPctg": 2.804878,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -3,
      "homeGoalsAgainst": 124,
      "homeGoalsFor": 121,
      "homeLosses": 17,
      "homeOtLosses": 3,
      "homePoints": 45,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 12,
      "homeTies": 0,
      "homeWins": 21,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -3,
      "l10GoalsAgainst": 34,
      "l10GoalsFor": 31,
      "l10Losses": 4,
      "l10OtLosses": 1,
      "l10Points": 11,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 4,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 25,
      "leagueL10Sequence": 19,
      "leagueRoadSequence": 18,
      "leagueSequence": 21,
      "losses": 37,
      "otLosses": 3,
      "placeName": {
        "default": "New Jersey"
      },
      "pointPctg": 0.530488,
      "points": 87,
      "regulationPlusOtWinPctg": 0.463415,
      "regulationPlusOtWins": 38,
      "regulationWinPctg": 0.353659,
      "regulationWins": 29,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -21,
      "roadGoalsAgainst": 130,
      "roadGoalsFor": 109,
      "roadLosses": 20,
      "roadOtLosses": 0,
      "roadPoints": 42,
      "roadRegulationPlusOtWins": 19,
      "roadRegulationWins": 17,
      "roadTies": 0,
      "roadWins": 21,
      "seasonId": 20252026,
      "shootoutLosses": 1,
      "shootoutWins": 4,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "New Jersey Devils",
        "fr": "Devils du New Jersey"
      },
      "teamCommonName": {
        "default": "Devils"
      },
      "teamAbbrev": {
        "default": "NJD"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/NJD_light.svg",
      "ties": 0,
      "waiversSequence": 12,
      "wildcardSequence": 7,
      "winPctg": 0.512195,
      "wins": 42
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 10,
      "conferenceL10Sequence": 6,
      "conferenceName": "Western",
      "conferenceRoadSequence": 10,
      "conferenceSequence": 9,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 5,
      "divisionL10Sequence": 3,
      "divisionName": "Central",
      "divisionRoadSequence": 6,
      "divisionSequence": 5,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -27,
      "goalDifferentialPctg": -0.329268,
      "goalAgainst": 258,
      "goalFor": 231,
      "goalsForPctg": 2.817073,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -10,
      "homeGoalsAgainst": 126,
      "homeGoalsFor": 116,
      "homeLosses": 14,
      "homeOtLosses": 7,
      "homePoints": 47,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 20,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 9,
      "l10GoalsAgainst": 31,
      "l10GoalsFor": 40,
      "l10Losses": 3,
      "l10OtLosses": 1,
      "l10Points": 13,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 21,
      "leagueL10Sequence": 11,
      "leagueRoadSequence": 24,
      "leagueSequence": 22,
      "losses": 33,
      "otLosses": 12,
      "placeName": {
        "default": "St. Louis"
      },
      "pointPctg": 0.52439,
      "points": 86,
      "regulationPlusOtWinPctg": 0.439024,
      "regulationPlusOtWins": 36,
      "regulationWinPctg": 0.402439,
      "regulationWins": 33,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -17,
      "roadGoalsAgainst": 132,
      "roadGoalsFor": 115,
      "roadLosses": 19,
      "roadOtLosses": 5,
      "roadPoints": 39,
      "roadRegulationPlusOtWins": 17,
      "roadRegulationWins": 16,
      "roadTies": 0,
      "roadWins": 17,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 1,
      "streakCode": "W",
      "streakCount": 4,
      "teamName": {
        "default": "St. Louis Blues",
        "fr": "Blues de St. Louis"
      },
      "teamCommonName": {
        "default": "Blues"
      },
      "teamAbbrev": {
        "default": "STL"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/STL_light.svg?season=20252026",
      "ties": 0,
      "waiversSequence": 11,
      "wildcardSequence": 3,
      "winPctg": 0.45122,
      "wins": 37
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 11,
      "conferenceL10Sequence": 12,
      "conferenceName": "Western",
      "conferenceRoadSequence": 8,
      "conferenceSequence": 10,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 6,
      "divisionL10Sequence": 7,
      "divisionName": "Central",
      "divisionRoadSequence": 5,
      "divisionSequence": 6,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -22,
      "goalDifferentialPctg": -0.268293,
      "goalAgainst": 269,
      "goalFor": 247,
      "goalsForPctg": 3.012195,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -5,
      "homeGoalsAgainst": 132,
      "homeGoalsFor": 127,
      "homeLosses": 17,
      "homeOtLosses": 3,
      "homePoints": 45,
      "homeRegulationPlusOtWins": 18,
      "homeRegulationWins": 16,
      "homeTies": 0,
      "homeWins": 21,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 0,
      "l10GoalsAgainst": 30,
      "l10GoalsFor": 30,
      "l10Losses": 5,
      "l10OtLosses": 1,
      "l10Points": 9,
      "l10RegulationPlusOtWins": 3,
      "l10RegulationWins": 3,
      "l10Ties": 0,
      "l10Wins": 4,
      "leagueHomeSequence": 24,
      "leagueL10Sequence": 24,
      "leagueRoadSequence": 20,
      "leagueSequence": 23,
      "losses": 34,
      "otLosses": 10,
      "placeName": {
        "default": "Nashville"
      },
      "pointPctg": 0.52439,
      "points": 86,
      "regulationPlusOtWinPctg": 0.402439,
      "regulationPlusOtWins": 33,
      "regulationWinPctg": 0.341463,
      "regulationWins": 28,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -17,
      "roadGoalsAgainst": 137,
      "roadGoalsFor": 120,
      "roadLosses": 17,
      "roadOtLosses": 7,
      "roadPoints": 41,
      "roadRegulationPlusOtWins": 15,
      "roadRegulationWins": 12,
      "roadTies": 0,
      "roadWins": 17,
      "seasonId": 20252026,
      "shootoutLosses": 2,
      "shootoutWins": 5,
      "streakCode": "L",
      "streakCount": 2,
      "teamName": {
        "default": "Nashville Predators",
        "fr": "Predators de Nashville"
      },
      "teamCommonName": {
        "default": "Predators"
      },
      "teamAbbrev": {
        "default": "NSH"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/NSH_light.svg",
      "ties": 0,
      "waiversSequence": 10,
      "wildcardSequence": 4,
      "winPctg": 0.463415,
      "wins": 38
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 8,
      "conferenceL10Sequence": 9,
      "conferenceName": "Western",
      "conferenceRoadSequence": 11,
      "conferenceSequence": 11,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 5,
      "divisionL10Sequence": 4,
      "divisionName": "Pacific",
      "divisionRoadSequence": 5,
      "divisionSequence": 5,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -41,
      "goalDifferentialPctg": -0.5,
      "goalAgainst": 292,
      "goalFor": 251,
      "goalsForPctg": 3.060976,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -16,
      "homeGoalsAgainst": 142,
      "homeGoalsFor": 126,
      "homeLosses": 14,
      "homeOtLosses": 6,
      "homePoints": 48,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 15,
      "homeTies": 0,
      "homeWins": 21,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -4,
      "l10GoalsAgainst": 35,
      "l10GoalsFor": 31,
      "l10Losses": 4,
      "l10OtLosses": 1,
      "l10Points": 11,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 18,
      "leagueL10Sequence": 18,
      "leagueRoadSequence": 25,
      "leagueSequence": 24,
      "losses": 35,
      "otLosses": 8,
      "placeName": {
        "default": "San Jose"
      },
      "pointPctg": 0.52439,
      "points": 86,
      "regulationPlusOtWinPctg": 0.45122,
      "regulationPlusOtWins": 37,
      "regulationWinPctg": 0.329268,
      "regulationWins": 27,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -25,
      "roadGoalsAgainst": 150,
      "roadGoalsFor": 125,
      "roadLosses": 21,
      "roadOtLosses": 2,
      "roadPoints": 38,
      "roadRegulationPlusOtWins": 18,
      "roadRegulationWins": 12,
      "roadTies": 0,
      "roadWins": 18,
      "seasonId": 20252026,
      "shootoutLosses": 2,
      "shootoutWins": 2,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "San Jose Sharks",
        "fr": "Sharks de San Jose"
      },
      "teamCommonName": {
        "default": "Sharks"
      },
      "teamAbbrev": {
        "default": "SJS"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/SJS_light.svg",
      "ties": 0,
      "waiversSequence": 9,
      "wildcardSequence": 5,
      "winPctg": 0.47561,
      "wins": 39
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 8,
      "conferenceL10Sequence": 9,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 15,
      "conferenceSequence": 14,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 6,
      "divisionL10Sequence": 5,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 7,
      "divisionSequence": 7,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -25,
      "goalDifferentialPctg": -0.304878,
      "goalAgainst": 276,
      "goalFor": 251,
      "goalsForPctg": 3.060976,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 10,
      "homeGoalsAgainst": 123,
      "homeGoalsFor": 133,
      "homeLosses": 15,
      "homeOtLosses": 3,
      "homePoints": 49,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 23,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 1,
      "l10GoalsAgainst": 35,
      "l10GoalsFor": 36,
      "l10Losses": 4,
      "l10OtLosses": 1,
      "l10Points": 11,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 5,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 15,
      "leagueL10Sequence": 17,
      "leagueRoadSequence": 29,
      "leagueSequence": 25,
      "losses": 38,
      "otLosses": 4,
      "placeName": {
        "default": "Florida",
        "fr": "Floride"
      },
      "pointPctg": 0.512195,
      "points": 84,
      "regulationPlusOtWinPctg": 0.426829,
      "regulationPlusOtWins": 35,
      "regulationWinPctg": 0.390244,
      "regulationWins": 32,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -35,
      "roadGoalsAgainst": 153,
      "roadGoalsFor": 118,
      "roadLosses": 23,
      "roadOtLosses": 1,
      "roadPoints": 35,
      "roadRegulationPlusOtWins": 16,
      "roadRegulationWins": 15,
      "roadTies": 0,
      "roadWins": 17,
      "seasonId": 20252026,
      "shootoutLosses": 2,
      "shootoutWins": 5,
      "streakCode": "W",
      "streakCount": 3,
      "teamName": {
        "default": "Florida Panthers",
        "fr": "Panthers de la Floride"
      },
      "teamCommonName": {
        "default": "Panthers"
      },
      "teamAbbrev": {
        "default": "FLA"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/FLA_light.svg",
      "ties": 0,
      "waiversSequence": 8,
      "wildcardSequence": 8,
      "winPctg": 0.487805,
      "wins": 40
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 12,
      "conferenceL10Sequence": 10,
      "conferenceName": "Western",
      "conferenceRoadSequence": 12,
      "conferenceSequence": 12,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 7,
      "divisionL10Sequence": 6,
      "divisionName": "Central",
      "divisionRoadSequence": 7,
      "divisionSequence": 7,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -29,
      "goalDifferentialPctg": -0.353659,
      "goalAgainst": 260,
      "goalFor": 231,
      "goalsForPctg": 2.817073,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -3,
      "homeGoalsAgainst": 127,
      "homeGoalsFor": 124,
      "homeLosses": 16,
      "homeOtLosses": 6,
      "homePoints": 44,
      "homeRegulationPlusOtWins": 19,
      "homeRegulationWins": 17,
      "homeTies": 0,
      "homeWins": 19,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -11,
      "l10GoalsAgainst": 37,
      "l10GoalsFor": 26,
      "l10Losses": 5,
      "l10OtLosses": 0,
      "l10Points": 10,
      "l10RegulationPlusOtWins": 5,
      "l10RegulationWins": 4,
      "l10Ties": 0,
      "l10Wins": 5,
      "leagueHomeSequence": 26,
      "leagueL10Sequence": 22,
      "leagueRoadSequence": 26,
      "leagueSequence": 26,
      "losses": 35,
      "otLosses": 12,
      "placeName": {
        "default": "Winnipeg"
      },
      "pointPctg": 0.5,
      "points": 82,
      "regulationPlusOtWinPctg": 0.402439,
      "regulationPlusOtWins": 33,
      "regulationWinPctg": 0.341463,
      "regulationWins": 28,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -26,
      "roadGoalsAgainst": 133,
      "roadGoalsFor": 107,
      "roadLosses": 19,
      "roadOtLosses": 6,
      "roadPoints": 38,
      "roadRegulationPlusOtWins": 14,
      "roadRegulationWins": 11,
      "roadTies": 0,
      "roadWins": 16,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 2,
      "streakCode": "L",
      "streakCount": 4,
      "teamName": {
        "default": "Winnipeg Jets",
        "fr": "Jets de Winnipeg"
      },
      "teamCommonName": {
        "default": "Jets"
      },
      "teamAbbrev": {
        "default": "WPG"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/WPG_light.svg",
      "ties": 0,
      "waiversSequence": 7,
      "wildcardSequence": 6,
      "winPctg": 0.426829,
      "wins": 35
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 13,
      "conferenceL10Sequence": 16,
      "conferenceName": "Western",
      "conferenceRoadSequence": 14,
      "conferenceSequence": 13,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 6,
      "divisionL10Sequence": 8,
      "divisionName": "Pacific",
      "divisionRoadSequence": 6,
      "divisionSequence": 6,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -37,
      "goalDifferentialPctg": -0.45122,
      "goalAgainst": 263,
      "goalFor": 226,
      "goalsForPctg": 2.756098,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -4,
      "homeGoalsAgainst": 125,
      "homeGoalsFor": 121,
      "homeLosses": 17,
      "homeOtLosses": 5,
      "homePoints": 43,
      "homeRegulationPlusOtWins": 18,
      "homeRegulationWins": 16,
      "homeTies": 0,
      "homeWins": 19,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -19,
      "l10GoalsAgainst": 39,
      "l10GoalsFor": 20,
      "l10Losses": 8,
      "l10OtLosses": 0,
      "l10Points": 4,
      "l10RegulationPlusOtWins": 1,
      "l10RegulationWins": 1,
      "l10Ties": 0,
      "l10Wins": 2,
      "leagueHomeSequence": 28,
      "leagueL10Sequence": 32,
      "leagueRoadSequence": 28,
      "leagueSequence": 27,
      "losses": 37,
      "otLosses": 11,
      "placeName": {
        "default": "Seattle"
      },
      "pointPctg": 0.481707,
      "points": 79,
      "regulationPlusOtWinPctg": 0.390244,
      "regulationPlusOtWins": 32,
      "regulationWinPctg": 0.317073,
      "regulationWins": 26,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -33,
      "roadGoalsAgainst": 138,
      "roadGoalsFor": 105,
      "roadLosses": 20,
      "roadOtLosses": 6,
      "roadPoints": 36,
      "roadRegulationPlusOtWins": 14,
      "roadRegulationWins": 10,
      "roadTies": 0,
      "roadWins": 15,
      "seasonId": 20252026,
      "shootoutLosses": 6,
      "shootoutWins": 2,
      "streakCode": "L",
      "streakCount": 3,
      "teamName": {
        "default": "Seattle Kraken",
        "fr": "Kraken de Seattle"
      },
      "teamCommonName": {
        "default": "Kraken"
      },
      "teamAbbrev": {
        "default": "SEA"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/SEA_light.svg",
      "ties": 0,
      "waiversSequence": 6,
      "wildcardSequence": 7,
      "winPctg": 0.414634,
      "wins": 34
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 15,
      "conferenceL10Sequence": 15,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 16,
      "conferenceSequence": 15,
      "date": "2026-04-17",
      "divisionAbbrev": "A",
      "divisionHomeSequence": 8,
      "divisionL10Sequence": 8,
      "divisionName": "Atlantic",
      "divisionRoadSequence": 8,
      "divisionSequence": 8,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -46,
      "goalDifferentialPctg": -0.560976,
      "goalAgainst": 299,
      "goalFor": 253,
      "goalsForPctg": 3.085366,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -10,
      "homeGoalsAgainst": 145,
      "homeGoalsFor": 135,
      "homeLosses": 15,
      "homeOtLosses": 8,
      "homePoints": 44,
      "homeRegulationPlusOtWins": 18,
      "homeRegulationWins": 15,
      "homeTies": 0,
      "homeWins": 18,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -19,
      "l10GoalsAgainst": 47,
      "l10GoalsFor": 28,
      "l10Losses": 7,
      "l10OtLosses": 1,
      "l10Points": 5,
      "l10RegulationPlusOtWins": 2,
      "l10RegulationWins": 1,
      "l10Ties": 0,
      "l10Wins": 2,
      "leagueHomeSequence": 27,
      "leagueL10Sequence": 30,
      "leagueRoadSequence": 31,
      "leagueSequence": 28,
      "losses": 36,
      "otLosses": 14,
      "placeName": {
        "default": "Toronto"
      },
      "pointPctg": 0.47561,
      "points": 78,
      "regulationPlusOtWinPctg": 0.378049,
      "regulationPlusOtWins": 31,
      "regulationWinPctg": 0.280488,
      "regulationWins": 23,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -36,
      "roadGoalsAgainst": 154,
      "roadGoalsFor": 118,
      "roadLosses": 21,
      "roadOtLosses": 6,
      "roadPoints": 34,
      "roadRegulationPlusOtWins": 13,
      "roadRegulationWins": 8,
      "roadTies": 0,
      "roadWins": 14,
      "seasonId": 20252026,
      "shootoutLosses": 4,
      "shootoutWins": 1,
      "streakCode": "L",
      "streakCount": 5,
      "teamName": {
        "default": "Toronto Maple Leafs",
        "fr": "Maple Leafs de Toronto"
      },
      "teamCommonName": {
        "default": "Maple Leafs"
      },
      "teamAbbrev": {
        "default": "TOR"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/TOR_light.svg",
      "ties": 0,
      "waiversSequence": 5,
      "wildcardSequence": 9,
      "winPctg": 0.390244,
      "wins": 32
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 5,
      "conferenceL10Sequence": 11,
      "conferenceName": "Western",
      "conferenceRoadSequence": 16,
      "conferenceSequence": 14,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 2,
      "divisionL10Sequence": 5,
      "divisionName": "Pacific",
      "divisionRoadSequence": 8,
      "divisionSequence": 7,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -47,
      "goalDifferentialPctg": -0.573171,
      "goalAgainst": 259,
      "goalFor": 212,
      "goalsForPctg": 2.585366,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": 13,
      "homeGoalsAgainst": 107,
      "homeGoalsFor": 120,
      "homeLosses": 13,
      "homeOtLosses": 5,
      "homePoints": 51,
      "homeRegulationPlusOtWins": 20,
      "homeRegulationWins": 18,
      "homeTies": 0,
      "homeWins": 23,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -7,
      "l10GoalsAgainst": 37,
      "l10GoalsFor": 30,
      "l10Losses": 5,
      "l10OtLosses": 1,
      "l10Points": 9,
      "l10RegulationPlusOtWins": 4,
      "l10RegulationWins": 4,
      "l10Ties": 0,
      "l10Wins": 4,
      "leagueHomeSequence": 11,
      "leagueL10Sequence": 23,
      "leagueRoadSequence": 32,
      "leagueSequence": 29,
      "losses": 39,
      "otLosses": 9,
      "placeName": {
        "default": "Calgary"
      },
      "pointPctg": 0.469512,
      "points": 77,
      "regulationPlusOtWinPctg": 0.365854,
      "regulationPlusOtWins": 30,
      "regulationWinPctg": 0.329268,
      "regulationWins": 27,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -60,
      "roadGoalsAgainst": 152,
      "roadGoalsFor": 92,
      "roadLosses": 26,
      "roadOtLosses": 4,
      "roadPoints": 26,
      "roadRegulationPlusOtWins": 10,
      "roadRegulationWins": 9,
      "roadTies": 0,
      "roadWins": 11,
      "seasonId": 20252026,
      "shootoutLosses": 3,
      "shootoutWins": 4,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Calgary Flames",
        "fr": "Flames de Calgary"
      },
      "teamCommonName": {
        "default": "Flames"
      },
      "teamAbbrev": {
        "default": "CGY"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/CGY_light.svg",
      "ties": 0,
      "waiversSequence": 4,
      "wildcardSequence": 8,
      "winPctg": 0.414634,
      "wins": 34
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "E",
      "conferenceHomeSequence": 16,
      "conferenceL10Sequence": 7,
      "conferenceName": "Eastern",
      "conferenceRoadSequence": 12,
      "conferenceSequence": 16,
      "date": "2026-04-17",
      "divisionAbbrev": "M",
      "divisionHomeSequence": 8,
      "divisionL10Sequence": 4,
      "divisionName": "Metropolitan",
      "divisionRoadSequence": 7,
      "divisionSequence": 8,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -12,
      "goalDifferentialPctg": -0.146341,
      "goalAgainst": 250,
      "goalFor": 238,
      "goalsForPctg": 2.902439,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -18,
      "homeGoalsAgainst": 124,
      "homeGoalsFor": 106,
      "homeLosses": 20,
      "homeOtLosses": 7,
      "homePoints": 35,
      "homeRegulationPlusOtWins": 12,
      "homeRegulationWins": 9,
      "homeTies": 0,
      "homeWins": 14,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": 16,
      "l10GoalsAgainst": 20,
      "l10GoalsFor": 36,
      "l10Losses": 4,
      "l10OtLosses": 0,
      "l10Points": 12,
      "l10RegulationPlusOtWins": 6,
      "l10RegulationWins": 6,
      "l10Ties": 0,
      "l10Wins": 6,
      "leagueHomeSequence": 31,
      "leagueL10Sequence": 13,
      "leagueRoadSequence": 19,
      "leagueSequence": 30,
      "losses": 39,
      "otLosses": 9,
      "placeName": {
        "default": "NY Rangers"
      },
      "pointPctg": 0.469512,
      "points": 77,
      "regulationPlusOtWinPctg": 0.378049,
      "regulationPlusOtWins": 31,
      "regulationWinPctg": 0.304878,
      "regulationWins": 25,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": 6,
      "roadGoalsAgainst": 126,
      "roadGoalsFor": 132,
      "roadLosses": 19,
      "roadOtLosses": 2,
      "roadPoints": 42,
      "roadRegulationPlusOtWins": 19,
      "roadRegulationWins": 16,
      "roadTies": 0,
      "roadWins": 20,
      "seasonId": 20252026,
      "shootoutLosses": 1,
      "shootoutWins": 3,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "New York Rangers",
        "fr": "Rangers de New York"
      },
      "teamCommonName": {
        "default": "Rangers"
      },
      "teamAbbrev": {
        "default": "NYR"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/NYR_light.svg",
      "ties": 0,
      "waiversSequence": 3,
      "wildcardSequence": 10,
      "winPctg": 0.414634,
      "wins": 34
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 15,
      "conferenceL10Sequence": 15,
      "conferenceName": "Western",
      "conferenceRoadSequence": 13,
      "conferenceSequence": 15,
      "date": "2026-04-17",
      "divisionAbbrev": "C",
      "divisionHomeSequence": 8,
      "divisionL10Sequence": 8,
      "divisionName": "Central",
      "divisionRoadSequence": 8,
      "divisionSequence": 8,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -62,
      "goalDifferentialPctg": -0.756098,
      "goalAgainst": 275,
      "goalFor": 213,
      "goalsForPctg": 2.597561,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -28,
      "homeGoalsAgainst": 135,
      "homeGoalsFor": 107,
      "homeLosses": 19,
      "homeOtLosses": 8,
      "homePoints": 36,
      "homeRegulationPlusOtWins": 14,
      "homeRegulationWins": 11,
      "homeTies": 0,
      "homeWins": 14,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -17,
      "l10GoalsAgainst": 42,
      "l10GoalsFor": 25,
      "l10Losses": 7,
      "l10OtLosses": 1,
      "l10Points": 5,
      "l10RegulationPlusOtWins": 2,
      "l10RegulationWins": 2,
      "l10Ties": 0,
      "l10Wins": 2,
      "leagueHomeSequence": 30,
      "leagueL10Sequence": 29,
      "leagueRoadSequence": 27,
      "leagueSequence": 31,
      "losses": 39,
      "otLosses": 14,
      "placeName": {
        "default": "Chicago"
      },
      "pointPctg": 0.439024,
      "points": 72,
      "regulationPlusOtWinPctg": 0.317073,
      "regulationPlusOtWins": 26,
      "regulationWinPctg": 0.268293,
      "regulationWins": 22,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -34,
      "roadGoalsAgainst": 140,
      "roadGoalsFor": 106,
      "roadLosses": 20,
      "roadOtLosses": 6,
      "roadPoints": 36,
      "roadRegulationPlusOtWins": 12,
      "roadRegulationWins": 11,
      "roadTies": 0,
      "roadWins": 15,
      "seasonId": 20252026,
      "shootoutLosses": 5,
      "shootoutWins": 3,
      "streakCode": "W",
      "streakCount": 1,
      "teamName": {
        "default": "Chicago Blackhawks",
        "fr": "Blackhawks de Chicago"
      },
      "teamCommonName": {
        "default": "Blackhawks"
      },
      "teamAbbrev": {
        "default": "CHI"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/CHI_light.svg?season=20252026",
      "ties": 0,
      "waiversSequence": 2,
      "wildcardSequence": 9,
      "winPctg": 0.353659,
      "wins": 29
    },
    {
      "clinchIndicator": "e",
      "conferenceAbbrev": "W",
      "conferenceHomeSequence": 16,
      "conferenceL10Sequence": 13,
      "conferenceName": "Western",
      "conferenceRoadSequence": 15,
      "conferenceSequence": 16,
      "date": "2026-04-17",
      "divisionAbbrev": "P",
      "divisionHomeSequence": 8,
      "divisionL10Sequence": 6,
      "divisionName": "Pacific",
      "divisionRoadSequence": 7,
      "divisionSequence": 8,
      "gameTypeId": 2,
      "gamesPlayed": 82,
      "goalDifferential": -100,
      "goalDifferentialPctg": -1.219512,
      "goalAgainst": 316,
      "goalFor": 216,
      "goalsForPctg": 2.634146,
      "homeGamesPlayed": 41,
      "homeGoalDifferential": -59,
      "homeGoalsAgainst": 160,
      "homeGoalsFor": 101,
      "homeLosses": 27,
      "homeOtLosses": 5,
      "homePoints": 23,
      "homeRegulationPlusOtWins": 8,
      "homeRegulationWins": 6,
      "homeTies": 0,
      "homeWins": 9,
      "l10GamesPlayed": 10,
      "l10GoalDifferential": -12,
      "l10GoalsAgainst": 43,
      "l10GoalsFor": 31,
      "l10Losses": 6,
      "l10OtLosses": 0,
      "l10Points": 8,
      "l10RegulationPlusOtWins": 3,
      "l10RegulationWins": 1,
      "l10Ties": 0,
      "l10Wins": 4,
      "leagueHomeSequence": 32,
      "leagueL10Sequence": 25,
      "leagueRoadSequence": 30,
      "leagueSequence": 32,
      "losses": 49,
      "otLosses": 8,
      "placeName": {
        "default": "Vancouver"
      },
      "pointPctg": 0.353659,
      "points": 58,
      "regulationPlusOtWinPctg": 0.231707,
      "regulationPlusOtWins": 19,
      "regulationWinPctg": 0.182927,
      "regulationWins": 15,
      "roadGamesPlayed": 41,
      "roadGoalDifferential": -41,
      "roadGoalsAgainst": 156,
      "roadGoalsFor": 115,
      "roadLosses": 22,
      "roadOtLosses": 3,
      "roadPoints": 35,
      "roadRegulationPlusOtWins": 11,
      "roadRegulationWins": 9,
      "roadTies": 0,
      "roadWins": 16,
      "seasonId": 20252026,
      "shootoutLosses": 2,
      "shootoutWins": 6,
      "streakCode": "L",
      "streakCount": 1,
      "teamName": {
        "default": "Vancouver Canucks",
        "fr": "Canucks de Vancouver"
      },
      "teamCommonName": {
        "default": "Canucks"
      },
      "teamAbbrev": {
        "default": "VAN"
      },
      "teamLogo": "https://assets.nhle.com/logos/nhl/svg/VAN_light.svg",
      "ties": 0,
      "waiversSequence": 1,
      "wildcardSequence": 10,
      "winPctg": 0.304878,
      "wins": 25
    }
  ],
  "updatedAt": {
    "_seconds": 1781693287,
    "_nanoseconds": 813000000
  }
}
```
</details>


## Collection: `nhl_team_daily`

- Documents analysés: 0
- Limite appliquée: 3

_Aucun document trouvé._


## Collection: `participants`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `system` | map | {...} / {...} |
| `system.signupBonusAmount` | number | 25 / 5 |
| `system.signupBonusAt` | timestamp | {"_seconds":1766587442,"_nanoseconds":637000000} / {"_seconds":1770864079,"_nanoseconds":569000000} |
| `system.signupBonusGranted` | boolean | true / true |
| `credits` | map | {...} / {...} |
| `credits.balance` | number | 50 / 17 |
| `credits.updatedAt` | timestamp | {"_seconds":1766587442,"_nanoseconds":637000000} / {"_seconds":1762877447,"_nanoseconds":760000000} |
| `updatedAt` | timestamp | {"_seconds":1766587442,"_nanoseconds":637000000} / {"_seconds":1762877465,"_nanoseconds":55000000} |
| `createdAt` | timestamp | {"_seconds":1762657790,"_nanoseconds":125000000} |
| `phoneNumber` | string | "+15148950918" / "+13403333333" |
| `displayName` | string, null | "Maxou" / null |
| `email` | null | null / null |
| `onboarding` | map | {...} / {...} |
| `onboarding.welcomeSeen` | boolean | false / false |
| `photoURL` | string, null | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png? / null |
| `avatarPurchasedAt` | timestamp | {"_seconds":1762702133,"_nanoseconds":235000000} |
| `stats.currentStreakDays` | number | 1 |
| `stats.lastParticipationDay` | string | "2025-11-11" |
| `stats.maxStreakDays` | number | 1 |
| `stats.totalParticipations` | number | 1 |
| `favoriteGroupAt` | timestamp | {"_seconds":1762877465,"_nanoseconds":55000000} |
| `favoriteGroupId` | string | "ctzdscog11kfapoq" |
| `avatarUrl` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png? |

### Documents exemples

<details>
<summary>participants/$RCAnonymousID:0f75ffa0dd204b3fabae39d43abdeda5</summary>

```json
{
  "system": {
    "signupBonusAmount": 25,
    "signupBonusAt": {
      "_seconds": 1766587442,
      "_nanoseconds": 637000000
    },
    "signupBonusGranted": true
  },
  "credits": {
    "balance": 50,
    "updatedAt": {
      "_seconds": 1766587442,
      "_nanoseconds": 637000000
    }
  },
  "updatedAt": {
    "_seconds": 1766587442,
    "_nanoseconds": 637000000
  }
}
```
</details>


### Collection: `participants/$RCAnonymousID:0f75ffa0dd204b3fabae39d43abdeda5/credit_logs`

- Documents analysés: 2
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `meta` | map | {...} |
| `meta.bonus` | number | 0 |
| `meta.packKey` | string | "credits_25" |
| `meta.credits` | number | 25 |
| `meta.rcType` | string | "NON_RENEWING_PURCHASE" |
| `type` | string | "CREDIT_PURCHASE_PACK" / "signup_bonus" |
| `fromBalance` | number | 0 / 25 |
| `amount` | number | 25 / 25 |
| `toBalance` | number | 25 / 50 |
| `createdAt` | timestamp | {"_seconds":1766587438,"_nanoseconds":254000000} / {"_seconds":1766587442,"_nanoseconds":637000000} |
| `reason` | string | "NEW_PARTICIPANT_WELCOME" |

### Documents exemples

<details>
<summary>participants/$RCAnonymousID:0f75ffa0dd204b3fabae39d43abdeda5/credit_logs/CREDIT_PURCHASE_PACK_rc_4995EFBA-C026-4E11-B71F-121FA9D8D49A</summary>

```json
{
  "meta": {
    "bonus": 0,
    "packKey": "credits_25",
    "credits": 25,
    "rcType": "NON_RENEWING_PURCHASE"
  },
  "type": "CREDIT_PURCHASE_PACK",
  "fromBalance": 0,
  "amount": 25,
  "toBalance": 25,
  "createdAt": {
    "_seconds": 1766587438,
    "_nanoseconds": 254000000
  }
}
```
</details>

<details>
<summary>participants/$RCAnonymousID:0f75ffa0dd204b3fabae39d43abdeda5/credit_logs/dlKHlgpnmgGmTFYl68fN</summary>

```json
{
  "toBalance": 50,
  "fromBalance": 25,
  "reason": "NEW_PARTICIPANT_WELCOME",
  "amount": 25,
  "type": "signup_bonus",
  "createdAt": {
    "_seconds": 1766587442,
    "_nanoseconds": 637000000
  }
}
```
</details>

<details>
<summary>participants/0lVeCeAA5aVkxXcabjnJJNBjnos1</summary>

```json
{
  "createdAt": {
    "_seconds": 1762657790,
    "_nanoseconds": 125000000
  },
  "phoneNumber": "+15148950918",
  "displayName": "Maxou",
  "email": null,
  "onboarding": {
    "welcomeSeen": false
  },
  "photoURL": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png?alt=media&token=809116c7-42a8-43a7-a72b-db3812f1a98a",
  "avatarPurchasedAt": {
    "_seconds": 1762702133,
    "_nanoseconds": 235000000
  },
  "credits": {
    "balance": 17,
    "updatedAt": {
      "_seconds": 1762877447,
      "_nanoseconds": 760000000
    }
  },
  "stats.currentStreakDays": 1,
  "stats.lastParticipationDay": "2025-11-11",
  "stats.maxStreakDays": 1,
  "stats.totalParticipations": 1,
  "favoriteGroupAt": {
    "_seconds": 1762877465,
    "_nanoseconds": 55000000
  },
  "favoriteGroupId": "ctzdscog11kfapoq",
  "updatedAt": {
    "_seconds": 1762877465,
    "_nanoseconds": 55000000
  }
}
```
</details>


### Collection: `participants/0lVeCeAA5aVkxXcabjnJJNBjnos1/credit_logs`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `type` | string | "topup_free" / "defi_entry" |
| `amount` | number | 25 / -3 |
| `fromBalance` | number | 0 / 20 |
| `toBalance` | number | 25 / 17 |
| `createdAt` | timestamp | {"_seconds":1762702117,"_nanoseconds":446000000} / {"_seconds":1762877447,"_nanoseconds":760000000} |
| `defiId` | string | "PAjMAlNMLyI5QzUacfXF" |
| `avatarId` | string | "21qopPwKvOJv7wpKhm4y" |
| `avatarUrl` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png? |
| `before` | number | 25 |
| `after` | number | 20 |

### Documents exemples

<details>
<summary>participants/0lVeCeAA5aVkxXcabjnJJNBjnos1/credit_logs/3cIylYQHWL9qRGGLjUrY</summary>

```json
{
  "type": "topup_free",
  "amount": 25,
  "fromBalance": 0,
  "toBalance": 25,
  "createdAt": {
    "_seconds": 1762702117,
    "_nanoseconds": 446000000
  }
}
```
</details>

<details>
<summary>participants/0lVeCeAA5aVkxXcabjnJJNBjnos1/credit_logs/Q3EjUGAnAgrV6jmehzfy</summary>

```json
{
  "type": "defi_entry",
  "amount": -3,
  "fromBalance": 20,
  "toBalance": 17,
  "defiId": "PAjMAlNMLyI5QzUacfXF",
  "createdAt": {
    "_seconds": 1762877447,
    "_nanoseconds": 760000000
  }
}
```
</details>

<details>
<summary>participants/0lVeCeAA5aVkxXcabjnJJNBjnos1/credit_logs/pIt8FUiwf4tp1iUMaPYJ</summary>

```json
{
  "type": "purchase_avatar",
  "avatarId": "21qopPwKvOJv7wpKhm4y",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png?alt=media&token=809116c7-42a8-43a7-a72b-db3812f1a98a",
  "amount": -5,
  "before": 25,
  "after": 20,
  "createdAt": {
    "_seconds": 1762702133,
    "_nanoseconds": 235000000
  }
}
```
</details>


### Collection: `participants/0lVeCeAA5aVkxXcabjnJJNBjnos1/system`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `lastDay` | string | "2025-11-09" |
| `updatedAt` | timestamp | {"_seconds":1762702117,"_nanoseconds":446000000} |

### Documents exemples

<details>
<summary>participants/0lVeCeAA5aVkxXcabjnJJNBjnos1/system/daily_bonus</summary>

```json
{
  "lastDay": "2025-11-09",
  "updatedAt": {
    "_seconds": 1762702117,
    "_nanoseconds": 446000000
  }
}
```
</details>

<details>
<summary>participants/1qCGP6waYZeVbGjBFOn2K1MrSHj2</summary>

```json
{
  "phoneNumber": "+13403333333",
  "email": null,
  "credits": {
    "balance": 5,
    "updatedAt": {
      "_seconds": 1770864079,
      "_nanoseconds": 569000000
    }
  },
  "system": {
    "signupBonusAmount": 5,
    "signupBonusAt": {
      "_seconds": 1770864079,
      "_nanoseconds": 569000000
    },
    "signupBonusGranted": true
  },
  "onboarding": {
    "welcomeSeen": false
  },
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png?alt=media&token=9673946f-4bcc-4507-a7ee-6ff8f7fb56dd",
  "photoURL": null,
  "displayName": null,
  "updatedAt": {
    "_seconds": 1770897031,
    "_nanoseconds": 428000000
  }
}
```
</details>


### Collection: `participants/1qCGP6waYZeVbGjBFOn2K1MrSHj2/credit_logs`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `type` | string | "signup_bonus" |
| `amount` | number | 5 |
| `fromBalance` | number | 0 |
| `toBalance` | number | 5 |
| `meta` | map | {...} |
| `meta.reason` | string | "NEW_PARTICIPANT_WELCOME" |
| `createdAt` | timestamp | {"_seconds":1770864079,"_nanoseconds":569000000} |

### Documents exemples

<details>
<summary>participants/1qCGP6waYZeVbGjBFOn2K1MrSHj2/credit_logs/signup_bonus_signup_1qCGP6waYZeVbGjBFOn2K1MrSHj2</summary>

```json
{
  "type": "signup_bonus",
  "amount": 5,
  "fromBalance": 0,
  "toBalance": 5,
  "meta": {
    "reason": "NEW_PARTICIPANT_WELCOME"
  },
  "createdAt": {
    "_seconds": 1770864079,
    "_nanoseconds": 569000000
  }
}
```
</details>


## Collection: `profiles_public`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `visibility` | string | "public" / "public" |
| `displayName` | string | "Invité" / "Maxou" |
| `updatedAt` | timestamp | {"_seconds":1766587442,"_nanoseconds":901000000} / {"_seconds":1762877465,"_nanoseconds":743000000} |
| `avatarUrl` | string | "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FAI-1.pn / "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png? |
| `avatarId` | string | "21qopPwKvOJv7wpKhm4y" / "IzUVeOk8XvtKHmZ5s4GY" |

### Documents exemples

<details>
<summary>profiles_public/$RCAnonymousID:0f75ffa0dd204b3fabae39d43abdeda5</summary>

```json
{
  "visibility": "public",
  "displayName": "Invité",
  "updatedAt": {
    "_seconds": 1766587442,
    "_nanoseconds": 901000000
  },
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FAI-1.png?alt=media&token=dadcff4c-335e-4eb5-ac23-9f4c26cbd380"
}
```
</details>

<details>
<summary>profiles_public/0lVeCeAA5aVkxXcabjnJJNBjnos1</summary>

```json
{
  "visibility": "public",
  "displayName": "Maxou",
  "avatarId": "21qopPwKvOJv7wpKhm4y",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA3.png?alt=media&token=809116c7-42a8-43a7-a72b-db3812f1a98a",
  "updatedAt": {
    "_seconds": 1762877465,
    "_nanoseconds": 743000000
  }
}
```
</details>

<details>
<summary>profiles_public/1qCGP6waYZeVbGjBFOn2K1MrSHj2</summary>

```json
{
  "visibility": "public",
  "avatarId": "IzUVeOk8XvtKHmZ5s4GY",
  "avatarUrl": "https://firebasestorage.googleapis.com/v0/b/capitaine.firebasestorage.app/o/avatars-store%2FA4.png?alt=media&token=9673946f-4bcc-4507-a7ee-6ff8f7fb56dd",
  "displayName": "Invité",
  "updatedAt": {
    "_seconds": 1770897032,
    "_nanoseconds": 316000000
  }
}
```
</details>


## Collection: `revenuecat_events`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `type` | string | "INITIAL_PURCHASE" / "INITIAL_PURCHASE" |
| `appUserId` | string | "xHDk78srTFeR8KbYaZyj8aoCvIC2" / "gdAfBTQtvJR8K4a0oT6L6hiSShN2" |
| `applied` | boolean | true / true |
| `tier` | string | "pro" / "vip" |
| `active` | boolean | true / true |
| `expiresAt` | timestamp | {"_seconds":1769728350,"_nanoseconds":246000000} / {"_seconds":1769739974,"_nanoseconds":169000000} |
| `createdAt` | timestamp | {"_seconds":1769728050,"_nanoseconds":890000000} / {"_seconds":1769739679,"_nanoseconds":88000000} |

### Documents exemples

<details>
<summary>revenuecat_events/008ED086-C91A-4D56-9F5F-269B224D0EFD</summary>

```json
{
  "type": "INITIAL_PURCHASE",
  "appUserId": "xHDk78srTFeR8KbYaZyj8aoCvIC2",
  "applied": true,
  "tier": "pro",
  "active": true,
  "expiresAt": {
    "_seconds": 1769728350,
    "_nanoseconds": 246000000
  },
  "createdAt": {
    "_seconds": 1769728050,
    "_nanoseconds": 890000000
  }
}
```
</details>

<details>
<summary>revenuecat_events/01028354-E52F-40A0-9D4C-FEEB925B3022</summary>

```json
{
  "type": "INITIAL_PURCHASE",
  "appUserId": "gdAfBTQtvJR8K4a0oT6L6hiSShN2",
  "applied": true,
  "tier": "vip",
  "active": true,
  "expiresAt": {
    "_seconds": 1769739974,
    "_nanoseconds": 169000000
  },
  "createdAt": {
    "_seconds": 1769739679,
    "_nanoseconds": 88000000
  }
}
```
</details>

<details>
<summary>revenuecat_events/02109C70-F62A-4A74-A672-4DDE5CE5F765</summary>

```json
{
  "type": "INITIAL_PURCHASE",
  "appUserId": "$RCAnonymousID:30e9e50f9a7b4db3bb7c0c70cc312446",
  "applied": true,
  "tier": "pro",
  "active": true,
  "expiresAt": {
    "_seconds": 1769725941,
    "_nanoseconds": 693000000
  },
  "createdAt": {
    "_seconds": 1769725642,
    "_nanoseconds": 285000000
  }
}
```
</details>


## Collection: `team_prediction_challenges`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `groupId` | string | "T5N9rS1GgVfToR6qnG2n" / "T5N9rS1GgVfToR6qnG2n" |
| `lockedAt` | timestamp | {"_seconds":1775256900,"_nanoseconds":0} / {"_seconds":1775343300,"_nanoseconds":0} |
| `stakePoints` | number | 2 / 2 |
| `homeAbbr` | string | "NYI" / "NJD" |
| `type` | string | "team_prediction" / "team_prediction" |
| `gameStartTimeUTC` | timestamp | {"_seconds":1775257200,"_nanoseconds":0} / {"_seconds":1775343600,"_nanoseconds":0} |
| `jackpotBumpAppliedAt` | null | null / null |
| `jackpotBumpReason` | null | null / null |
| `winnersCount` | number | 0 / 0 |
| `createdAt` | timestamp | {"_seconds":1775223275,"_nanoseconds":624000000} / {"_seconds":1775316990,"_nanoseconds":907000000} |
| `awayAbbr` | string | "PHI" / "MTL" |
| `bonusUsed` | number | 0 / 0 |
| `winnersPreviewUids` | array | [] / [] |
| `gameId` | string | "2025021205" / "2025021212" |
| `payoutTotal` | number | 0 / 0 |
| `payoutAppliedAt` | null, timestamp | null / {"_seconds":1775402873,"_nanoseconds":305000000} |
| `payoutApplied` | boolean | false / false |
| `league` | string | "NHL" / "NHL" |
| `gameYmd` | string | "20260403" / "20260404" |
| `jackpotBumpApplied` | boolean | false / false |
| `resultMessage` | null, string | null / "Test" |
| `winnerShares` | map | {...} / {...} |
| `expiresAt` | timestamp | {"_seconds":1775396075,"_nanoseconds":334000000} / {"_seconds":1775489790,"_nanoseconds":641000000} |
| `payoutAppliedReason` | null, string | null / "no-winners" |
| `jackpotCarryIn` | number | 0 / 0 |
| `createdBy` | string | "fH0MVU6WAEa40nzJoyfMIKhZSdh1" / "fH0MVU6WAEa40nzJoyfMIKhZSdh1" |
| `participantsCount` | number | 1 / 1 |
| `decidedAt` | timestamp | {"_seconds":1775401923,"_nanoseconds":391000000} / {"_seconds":1775401923,"_nanoseconds":564000000} |
| `officialResult` | map | {...} / {...} |
| `officialResult.winnerAbbr` | string | "PHI" / "MTL" |
| `officialResult.homeScore` | number | 1 / 3 |
| `officialResult.awayScore` | number | 4 / 4 |
| `officialResult.confirmedAt` | timestamp | {"_seconds":1775401923,"_nanoseconds":391000000} / {"_seconds":1775401923,"_nanoseconds":564000000} |
| `officialResult.outcome` | string | "REG" / "TB" |
| `status` | string | "decided" / "decided" |
| `updatedAt` | timestamp | {"_seconds":1775401923,"_nanoseconds":391000000} / {"_seconds":1775402873,"_nanoseconds":305000000} |

### Documents exemples

<details>
<summary>team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021205</summary>

```json
{
  "groupId": "T5N9rS1GgVfToR6qnG2n",
  "lockedAt": {
    "_seconds": 1775256900,
    "_nanoseconds": 0
  },
  "stakePoints": 2,
  "homeAbbr": "NYI",
  "type": "team_prediction",
  "gameStartTimeUTC": {
    "_seconds": 1775257200,
    "_nanoseconds": 0
  },
  "jackpotBumpAppliedAt": null,
  "jackpotBumpReason": null,
  "winnersCount": 0,
  "createdAt": {
    "_seconds": 1775223275,
    "_nanoseconds": 624000000
  },
  "awayAbbr": "PHI",
  "bonusUsed": 0,
  "winnersPreviewUids": [],
  "gameId": "2025021205",
  "payoutTotal": 0,
  "payoutAppliedAt": null,
  "payoutApplied": false,
  "league": "NHL",
  "gameYmd": "20260403",
  "jackpotBumpApplied": false,
  "resultMessage": null,
  "winnerShares": {},
  "expiresAt": {
    "_seconds": 1775396075,
    "_nanoseconds": 334000000
  },
  "payoutAppliedReason": null,
  "jackpotCarryIn": 0,
  "createdBy": "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  "participantsCount": 1,
  "decidedAt": {
    "_seconds": 1775401923,
    "_nanoseconds": 391000000
  },
  "officialResult": {
    "winnerAbbr": "PHI",
    "homeScore": 1,
    "awayScore": 4,
    "confirmedAt": {
      "_seconds": 1775401923,
      "_nanoseconds": 391000000
    },
    "outcome": "REG"
  },
  "status": "decided",
  "updatedAt": {
    "_seconds": 1775401923,
    "_nanoseconds": 391000000
  }
}
```
</details>


### Collection: `team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021205/entries`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "fH0MVU6WAEa40nzJoyfMIKhZSdh1" |
| `createdAt` | timestamp | {"_seconds":1775227237,"_nanoseconds":398000000} |
| `challengeId` | string | "tp_T5N9rS1GgVfToR6qnG2n_2025021205" |
| `predictedHomeScore` | number | 3 |
| `winnerAbbr` | string | "PHI" |
| `predictedAwayScore` | number | 4 |
| `groupId` | string | "T5N9rS1GgVfToR6qnG2n" |
| `predictedOutcome` | string | "TB" |
| `updatedAt` | timestamp | {"_seconds":1775230597,"_nanoseconds":501000000} |

### Documents exemples

<details>
<summary>team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021205/entries/fH0MVU6WAEa40nzJoyfMIKhZSdh1</summary>

```json
{
  "uid": "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  "createdAt": {
    "_seconds": 1775227237,
    "_nanoseconds": 398000000
  },
  "challengeId": "tp_T5N9rS1GgVfToR6qnG2n_2025021205",
  "predictedHomeScore": 3,
  "winnerAbbr": "PHI",
  "predictedAwayScore": 4,
  "groupId": "T5N9rS1GgVfToR6qnG2n",
  "predictedOutcome": "TB",
  "updatedAt": {
    "_seconds": 1775230597,
    "_nanoseconds": 501000000
  }
}
```
</details>

<details>
<summary>team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021212</summary>

```json
{
  "groupId": "T5N9rS1GgVfToR6qnG2n",
  "lockedAt": {
    "_seconds": 1775343300,
    "_nanoseconds": 0
  },
  "stakePoints": 2,
  "homeAbbr": "NJD",
  "type": "team_prediction",
  "gameStartTimeUTC": {
    "_seconds": 1775343600,
    "_nanoseconds": 0
  },
  "jackpotBumpAppliedAt": null,
  "jackpotBumpReason": null,
  "winnersCount": 0,
  "createdAt": {
    "_seconds": 1775316990,
    "_nanoseconds": 907000000
  },
  "awayAbbr": "MTL",
  "bonusUsed": 0,
  "winnersPreviewUids": [],
  "gameId": "2025021212",
  "payoutTotal": 0,
  "payoutApplied": false,
  "league": "NHL",
  "gameYmd": "20260404",
  "jackpotBumpApplied": false,
  "winnerShares": {},
  "expiresAt": {
    "_seconds": 1775489790,
    "_nanoseconds": 641000000
  },
  "jackpotCarryIn": 0,
  "createdBy": "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  "participantsCount": 1,
  "decidedAt": {
    "_seconds": 1775401923,
    "_nanoseconds": 564000000
  },
  "officialResult": {
    "winnerAbbr": "MTL",
    "homeScore": 3,
    "awayScore": 4,
    "confirmedAt": {
      "_seconds": 1775401923,
      "_nanoseconds": 564000000
    },
    "outcome": "TB"
  },
  "status": "decided",
  "resultMessage": "Test",
  "payoutAppliedReason": "no-winners",
  "payoutAppliedAt": {
    "_seconds": 1775402873,
    "_nanoseconds": 305000000
  },
  "updatedAt": {
    "_seconds": 1775402873,
    "_nanoseconds": 305000000
  }
}
```
</details>


### Collection: `team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021212/entries`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "fH0MVU6WAEa40nzJoyfMIKhZSdh1" |
| `createdAt` | timestamp | {"_seconds":1775317234,"_nanoseconds":424000000} |
| `challengeId` | string | "tp_T5N9rS1GgVfToR6qnG2n_2025021212" |
| `predictedHomeScore` | number | 2 |
| `winnerAbbr` | string | "MTL" |
| `predictedAwayScore` | number | 5 |
| `groupId` | string | "T5N9rS1GgVfToR6qnG2n" |
| `predictedOutcome` | string | "REG" |
| `finalizedAt` | timestamp | {"_seconds":1775402873,"_nanoseconds":305000000} |
| `won` | boolean | false |
| `payout` | number | 0 |
| `isPerfectPick` | boolean | false |
| `updatedAt` | timestamp | {"_seconds":1775402873,"_nanoseconds":305000000} |
| `displayName` | string | "Marcel" |
| `avatarUrl` | string | "https://storage.googleapis.com/capitaine.firebasestorage.app/jerseys/generated/fH0MVU6WAEa40nzJoyfM |

### Documents exemples

<details>
<summary>team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021212/entries/fH0MVU6WAEa40nzJoyfMIKhZSdh1</summary>

```json
{
  "uid": "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  "createdAt": {
    "_seconds": 1775317234,
    "_nanoseconds": 424000000
  },
  "challengeId": "tp_T5N9rS1GgVfToR6qnG2n_2025021212",
  "predictedHomeScore": 2,
  "winnerAbbr": "MTL",
  "predictedAwayScore": 5,
  "groupId": "T5N9rS1GgVfToR6qnG2n",
  "predictedOutcome": "REG",
  "finalizedAt": {
    "_seconds": 1775402873,
    "_nanoseconds": 305000000
  },
  "won": false,
  "payout": 0,
  "isPerfectPick": false,
  "updatedAt": {
    "_seconds": 1775402873,
    "_nanoseconds": 305000000
  },
  "displayName": "Marcel",
  "avatarUrl": "https://storage.googleapis.com/capitaine.firebasestorage.app/jerseys/generated/fH0MVU6WAEa40nzJoyfMIKhZSdh1/1774916011571/front.png?GoogleAccessId=502697214487-compute%40developer.gserviceaccount.com&Expires=4102444800&Signature=gLnn6REhdjUvfErPU3pj2U4akPONaYegGQTjhAPKE7YFfThUEt0hTU%2F05gBYuAsuKBPUUoeNMz9W9cER4308EKTNUYf32v4jmOki%2FiOM9Bd9e9gCOd6sDVzMkaVX0T%2BTJ7UujcC17z%2B3wxkYJ63p%2BjTGTIn0thopoMFVJSq7BxTNT1d520PskoBsNTnZ3%2FEWPUo5Mu5XMLKIa9iZi2D8pgHuFMNVAIRObWZMgKdrLa594VbbK8ksV5BDZ00UbVuW5MeSsSMrW6v74dgR6K3JKcb1H83Q5IyNQ9yumK1KcL32kywDfe4oZEWwndvbGTqzS07dr2P5mkg2ALRHVuH3kQ%3D%3D"
}
```
</details>

<details>
<summary>team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021226</summary>

```json
{
  "groupId": "T5N9rS1GgVfToR6qnG2n",
  "lockedAt": {
    "_seconds": 1775429700,
    "_nanoseconds": 0
  },
  "stakePoints": 2,
  "homeAbbr": "MTL",
  "type": "team_prediction",
  "gameStartTimeUTC": {
    "_seconds": 1775430000,
    "_nanoseconds": 0
  },
  "jackpotBumpAppliedAt": null,
  "jackpotBumpReason": null,
  "winnersCount": 0,
  "createdAt": {
    "_seconds": 1775396196,
    "_nanoseconds": 604000000
  },
  "awayAbbr": "NJD",
  "winnersPreviewUids": [],
  "gameId": "2025021226",
  "payoutTotal": 0,
  "payoutApplied": false,
  "league": "NHL",
  "gameYmd": "20260405",
  "jackpotBumpApplied": false,
  "resultMessage": null,
  "winnerShares": {},
  "expiresAt": {
    "_seconds": 1775568996,
    "_nanoseconds": 320000000
  },
  "jackpotCarryIn": 0,
  "createdBy": "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  "participantsCount": 1,
  "decidedAt": {
    "_seconds": 1775439722,
    "_nanoseconds": 14000000
  },
  "officialResult": {
    "winnerAbbr": "NJD",
    "homeScore": 0,
    "awayScore": 3,
    "confirmedAt": {
      "_seconds": 1775439722,
      "_nanoseconds": 14000000
    },
    "outcome": "REG"
  },
  "status": "decided",
  "payoutAppliedReason": "no-winners",
  "payoutAppliedAt": {
    "_seconds": 1775439726,
    "_nanoseconds": 580000000
  },
  "bonusUsed": 2,
  "updatedAt": {
    "_seconds": 1775439726,
    "_nanoseconds": 580000000
  }
}
```
</details>


### Collection: `team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021226/entries`

- Documents analysés: 1
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "fH0MVU6WAEa40nzJoyfMIKhZSdh1" |
| `createdAt` | timestamp | {"_seconds":1775400965,"_nanoseconds":827000000} |
| `challengeId` | string | "tp_T5N9rS1GgVfToR6qnG2n_2025021226" |
| `predictedHomeScore` | number | 5 |
| `winnerAbbr` | string | "MTL" |
| `predictedAwayScore` | number | 2 |
| `groupId` | string | "T5N9rS1GgVfToR6qnG2n" |
| `predictedOutcome` | string | "REG" |
| `displayName` | string | "Marcel" |
| `avatarUrl` | string | "https://storage.googleapis.com/capitaine.firebasestorage.app/jerseys/generated/fH0MVU6WAEa40nzJoyfM |
| `finalizedAt` | timestamp | {"_seconds":1775439726,"_nanoseconds":580000000} |
| `won` | boolean | false |
| `payout` | number | 0 |
| `isPerfectPick` | boolean | false |
| `updatedAt` | timestamp | {"_seconds":1775439726,"_nanoseconds":580000000} |

### Documents exemples

<details>
<summary>team_prediction_challenges/tp_T5N9rS1GgVfToR6qnG2n_2025021226/entries/fH0MVU6WAEa40nzJoyfMIKhZSdh1</summary>

```json
{
  "uid": "fH0MVU6WAEa40nzJoyfMIKhZSdh1",
  "createdAt": {
    "_seconds": 1775400965,
    "_nanoseconds": 827000000
  },
  "challengeId": "tp_T5N9rS1GgVfToR6qnG2n_2025021226",
  "predictedHomeScore": 5,
  "winnerAbbr": "MTL",
  "predictedAwayScore": 2,
  "groupId": "T5N9rS1GgVfToR6qnG2n",
  "predictedOutcome": "REG",
  "displayName": "Marcel",
  "avatarUrl": "https://storage.googleapis.com/capitaine.firebasestorage.app/jerseys/generated/fH0MVU6WAEa40nzJoyfMIKhZSdh1/1774916011571/front.png?GoogleAccessId=502697214487-compute%40developer.gserviceaccount.com&Expires=4102444800&Signature=gLnn6REhdjUvfErPU3pj2U4akPONaYegGQTjhAPKE7YFfThUEt0hTU%2F05gBYuAsuKBPUUoeNMz9W9cER4308EKTNUYf32v4jmOki%2FiOM9Bd9e9gCOd6sDVzMkaVX0T%2BTJ7UujcC17z%2B3wxkYJ63p%2BjTGTIn0thopoMFVJSq7BxTNT1d520PskoBsNTnZ3%2FEWPUo5Mu5XMLKIa9iZi2D8pgHuFMNVAIRObWZMgKdrLa594VbbK8ksV5BDZ00UbVuW5MeSsSMrW6v74dgR6K3JKcb1H83Q5IyNQ9yumK1KcL32kywDfe4oZEWwndvbGTqzS07dr2P5mkg2ALRHVuH3kQ%3D%3D",
  "finalizedAt": {
    "_seconds": 1775439726,
    "_nanoseconds": 580000000
  },
  "won": false,
  "payout": 0,
  "isPerfectPick": false,
  "updatedAt": {
    "_seconds": 1775439726,
    "_nanoseconds": 580000000
  }
}
```
</details>


## Collection: `usage_weekly`

- Documents analysés: 3
- Limite appliquée: 3

### Champs détectés

| Champ | Type(s) | Exemple |
|---|---|---|
| `uid` | string | "45I3FZACt8OTLN39KeSKq7n545G3" / "45I3FZACt8OTLN39KeSKq7n545G3" |
| `weekKey` | string | "2026-W01" / "2026-W02" |
| `createdCount` | number | 8 / 11 |
| `joinedCount` | number | 6 / 4 |
| `updatedAt` | timestamp | {"_seconds":1767545853,"_nanoseconds":505000000} / {"_seconds":1767999577,"_nanoseconds":588000000} |

### Documents exemples

<details>
<summary>usage_weekly/45I3FZACt8OTLN39KeSKq7n545G3_2026-W01</summary>

```json
{
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "weekKey": "2026-W01",
  "createdCount": 8,
  "joinedCount": 6,
  "updatedAt": {
    "_seconds": 1767545853,
    "_nanoseconds": 505000000
  }
}
```
</details>

<details>
<summary>usage_weekly/45I3FZACt8OTLN39KeSKq7n545G3_2026-W02</summary>

```json
{
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "weekKey": "2026-W02",
  "joinedCount": 4,
  "createdCount": 11,
  "updatedAt": {
    "_seconds": 1767999577,
    "_nanoseconds": 588000000
  }
}
```
</details>

<details>
<summary>usage_weekly/45I3FZACt8OTLN39KeSKq7n545G3_2026-W03</summary>

```json
{
  "uid": "45I3FZACt8OTLN39KeSKq7n545G3",
  "weekKey": "2026-W03",
  "createdCount": 1,
  "joinedCount": 8,
  "updatedAt": {
    "_seconds": 1768746647,
    "_nanoseconds": 568000000
  }
}
```
</details>

