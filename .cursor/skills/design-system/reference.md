# Référence composants — Prophetik Daily UI

## Écran Aujourd'hui

| Fichier | Rôle |
|---------|------|
| `app/(drawer)/(tabs)/AccueilScreen.js` | Orchestration accueil |
| `src/home/components/ProfileHeaderCard.js` | Avatar, groupe, CTAs création |
| `src/home/components/GroupsToggleRow.js` | Sélecteur de groupe |
| `src/achievements/components/StreakHeroCard.js` | Rang, streak, saison |
| `src/home/components/DefiListSection.js` | Liste défis du jour |
| `src/home/components/DefiListItem.js` | Carte défi individuelle |
| `src/home/components/DefiSectionIntroBand.js` | Bandeau rouge section (à atténuer) |
| `src/home/components/DefiTypeLeading.js` | Glyphe sport |
| `src/home/components/DailyDefisProgress.js` | Progression défis |
| `src/home/components/HomeDefisToggle.js` | Toggle défis complets / restants |
| `src/firstGoal/FirstGoalHomeSection.js` | Section premier but |
| `src/defis/TeamPredictionHomeSection.js` | Section prédictions équipe |
| `src/ascensions/components/AscensionHomeCard.js` | Carte ascension |

## Tokens & styles partagés

| Fichier | Exports utiles |
|---------|----------------|
| `src/theme/ThemeProvider.js` | `useTheme()`, palette light/dark |
| `src/theme/colors.js` | Export legacy (préférer ThemeProvider) |
| `src/achievements/components/prophetikCardStyles.js` | `PROPHETIK_RED`, `prophetikSectionCardStyle`, `ProphetikProgressBar` |
| `src/defis/participant/participantCtaStyles.js` | `PARTICIPANT_PRIMARY_CTA`, `PARTICIPANT_MODIFY_CTA` |
| `src/defis/participant/ParticipantTaskStatusChip.js` | État tâche (couleur + label) |

## Couleurs en usage (à unifier progressivement)

- Rouge marque : `#b91c1c` (`PROPHETIK_RED`) — CTA, accents
- Rouge vif : `#ef4444` (`colors.primary`) — parfois mélangé avec le rouge marque
- Vert succès : `#22c55e` — `CompareBar`, `LeaderboardMemberModal`
- Bleu info : `#3b82f6` — `PointsCard`
- Bandeau défi : `#fee2e2` / `#3a1c1c` — `DefiSectionIntroBand`

## Nova (violet uniquement)

- `src/ui/NovaGuide.js`
- `src/ui/NovaBubble.js`
- `src/nova/NovaCoachPlayerModal.js`

## Grille d'espacement cible

Multiples de **4** : 4, 8, 12, 16, 20, 24.

Valeurs legacy fréquentes à migrer : 10 → 8 ou 12 ; 14 → 12 ou 16.

## Rule Cursor associée

`.cursor/rules/design-system.mdc` — appliquée automatiquement sur `app/**` et `src/**`.
