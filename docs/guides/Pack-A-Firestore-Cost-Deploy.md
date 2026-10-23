# Pack A Firestore — deploy (dimanche AM)

## Scope livré

- **#2** `CRON_IDLE_GATE` — crons 1 min FGC lock + MLB first RBI (detect/confirm)
- **#3** `FINALIZE_CATCHUP_DAYS` (défaut **7**)
- **#4** `FINALIZE_RANK_SNAPSHOT` (rank seulement si payout plausible)
- **#1** `AUTOPILOT_INACTIVITY_USE_DENORM` + `groups.lastHumanParticipationYmd`
- **#6** rapports admin déjà cache (`internal_reports/…`)
- **#5 ombre** `LIVE_INDEX_SHADOW_WRITE` — écrit `internal/live_index/days/{ymd}/entries/*` (autopilot créations). **`LIVE_USE_INDEX=0`** (pas de lecture index)

## Variables (`functions/.env` ou Firebase params)

```bash
CRON_IDLE_GATE=1
FINALIZE_CATCHUP_DAYS=7
FINALIZE_RANK_SNAPSHOT=1
AUTOPILOT_INACTIVITY_USE_DENORM=1
LIVE_INDEX_SHADOW_WRITE=1
LIVE_USE_INDEX=0
```

Rollback rapide : `CRON_IDLE_GATE=0`, `FINALIZE_CATCHUP_DAYS=14`, `AUTOPILOT_INACTIVITY_USE_DENORM=0`, `LIVE_INDEX_SHADOW_WRITE=0` puis redeploy functions.

## Deploy

```bash
cd functions
firebase deploy --only functions:finalizeDefiWinners,functions:lockFirstGoalChallenges,functions:detectMlbFirstRbiCandidates_mutualized,functions:confirmPendingMlbFirstRbiGames_mutualized,functions:createDailyFgcAutopilot,functions:disableInactiveAutopilotCron
```

(Ajuster la liste si d’autres bundles partagent le même code — un deploy `functions` complet dimanche AM est OK.)

## Validation dimanche (avant / après deploy)

1. Logs **`skipped_idle`** entre 4h–11h Toronto un jour sans match.
2. Lundi 5h : log finalize `catchupDays=7`.
3. Autopilot 2h30 : `participationSource: denorm` quand `lastHumanParticipationYmd` = veille.
4. Après autopilot 6h30 : docs sous `internal/live_index/days/{ymd}/entries/`.
5. Aucune régression points TS (comparer 1 groupe test après finalize).

## Semaine suivante (flip #5)

Quand index ombre = legacy sur 2 soirées → `LIVE_USE_INDEX=1` + fallback legacy dans ingest/live (PR séparée).
