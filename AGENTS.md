# Prophetik Daily — guide Agent

Stack : **React Native** (Expo), Firebase, `@src/` alias.

## Design system

Avant toute modification UI (surtout l'écran **Aujourd'hui** / `AccueilScreen`) :

1. Appliquer la rule **design-system** (`.cursor/rules/design-system.mdc`)
2. Suivre le skill **design-system** (`.cursor/skills/design-system/SKILL.md`) — **analyser d'abord, coder ensuite**

North star accueil : en 5 s l'utilisateur voit son groupe, sa progression saison, les défis restants et la prochaine action.

## Conventions code

- Thème : `useTheme()` — pas de couleurs arbitraires hors palette sémantique
- Composants cartes : `prophetikCardStyles.js`, `participantCtaStyles.js`
- i18n : `i18n.t(...)` via `@src/i18n/i18n`
- Pas de commit sauf demande explicite
