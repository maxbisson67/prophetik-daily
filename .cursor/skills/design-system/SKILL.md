---
name: design-system
description: Auditer et refactorer l'UI Prophetik Daily (React Native) selon le design system — écran Aujourd'hui, cartes défis, accessibilité. Utiliser avant toute modification UI sur AccueilScreen ou composants home/.
---

# Design system — audit & refactor UI

## Quand utiliser ce skill

- Refonte ou amélioration de l'écran **Aujourd'hui** (`app/(drawer)/(tabs)/AccueilScreen.js`)
- Nouvelle carte défi, bandeau, ou section accueil
- Revue UI demandée par l'utilisateur (« est-ce cohérent avec le DS ? »)

## Workflow obligatoire

1. **Lire** les fichiers concernés (écran + composants `@src/home/`, `@src/achievements/components/`)
2. **Analyser** selon les critères ci-dessous — **sans modifier le code** à cette étape
3. **Présenter** un rapport structuré : constats → priorités → proposition concrète par composant
4. **Implémenter** seulement après validation implicite ou demande explicite de l'utilisateur

## North star — écran Aujourd'hui

En moins de 5 secondes, un utilisateur doit comprendre :

* dans quel groupe il se trouve;
* où il en est dans la saison;
* quels défis restent à compléter;
* quelle est la prochaine action à effectuer.

Avant de modifier le code, analyse l'écran Aujourd'hui selon les critères suivants :

* hiérarchie visuelle;
* densité de l'information;
* palette de couleurs;
* contraste;
* alignements;
* espacements;
* cohérence des composants;
* accessibilité;
* réutilisation des composants existants.

## Palette de couleurs

Réduire le nombre de couleurs simultanément visibles.

Utiliser les accents selon une logique claire :

* rouge : actions prioritaires;
* vert : progression ou succès;
* bleu : information;
* jaune : récompenses;
* violet : Nova uniquement.

## Carte des défis

Réduire l'importance du grand bandeau rouge.

Le contenu sportif doit devenir le point focal.

Le titre du défi, le match et le bouton d'action doivent être les plus visibles.

## Bordures

Réduire le nombre de contours visibles.

Créer la séparation principalement avec :

* les espacements;
* les surfaces;
* les contrastes.

## Espacements

Uniformiser tous les espacements selon une grille unique.

Éviter les valeurs arbitraires.

## Typographie

Clarifier la hiérarchie entre :

* titres;
* statistiques;
* descriptions;
* informations secondaires.

Les chiffres doivent toujours être plus importants que leurs libellés.

## Accessibilité

Vérifier :

* contrastes;
* tailles tactiles;
* lisibilité;
* cohérence des états.

Les couleurs ne doivent jamais être le seul moyen de communiquer un état.

## Format du rapport d'audit

```markdown
## Synthèse (5 s test)
- Groupe : ✅/⚠️/❌ — ...
- Saison : ...
- Défis restants : ...
- Prochaine action : ...

## Constats par critère
(hiérarchie, densité, couleurs, …)

## Priorités (P1 → P3)
1. ...

## Changements proposés (par fichier)
- `DefiListItem.js` : ...
```

## Fichiers clés

Voir [reference.md](reference.md) pour l'inventaire des composants et chemins.
