# Abonnements Prophetik — Participation v2.1

**Statut :** Validé — prêt pour implantation  
**Dernière mise à jour :** 2026-07-16

Document de référence pour le refactor des limites d’abonnement. Découple administration, participation active et monétisation Nova/Autopilot.

---

## 1. Décisions produit

### 1.1 Limite visible unique : participation active

| Tier | Groupes en participation **active** |
|------|--------------------------------------|
| Free | 1 |
| Pro | 5 |
| Vip | 20 |

- Source de vérité : `group_memberships` (`status == active` AND `participation == active`).
- **Pas** de `activeGroupsCount` persisté en MVP.

### 1.2 Création et administration

- **Aucune limite visible** sur le nombre de groupes créés.
- Créer ou administrer un groupe **ne consomme pas** un slot de participation.
- Anti-abus **serveur uniquement** (invisible UI / forfaits) : rate limiting, plafond quotidien, détection anormale.

### 1.3 Rôles et participation

Deux axes sur `group_memberships/{groupId}_{uid}` :

**`status` (appartenance)**  
`active` | `left` | `archived` — `left` = départ volontaire uniquement.

**`participation` (mode jeu)**  

| Valeur | Rôle | Comportement |
|--------|------|--------------|
| `active` | any | Défis, picks, points, Nova **dans ce groupe** |
| `inactive` | member | Consultation, historique |
| `admin_only` | owner / admin | Gestion, Autopilot ; pas de jeu |

- Admin indépendant de l’abonnement.
- Owner peut être `admin_only` sans transfert ; transfert requis seulement pour quitter (`left`).
- À la création : owner `active` si slot libre, sinon `admin_only`.

### 1.4 Downgrade

L’utilisateur choisit les groupes où il **continue à jouer** (jusqu’à la limite du tier) :

| Non sélectionné | Rôle | → `participation` |
|-----------------|------|-------------------|
| Sélectionné | any | `active` |
| Non sélectionné | owner / admin | `admin_only` |
| Non sélectionné | member | `inactive` |

- Historique et points passés **conservés**.
- Nouveaux picks, points et Nova **groupe** bloqués si `participation != active`.
- Résolution **Autopilot** reste une modale / callable **séparée** (`resolveAutopilotGroups`).

### 1.5 Nova Advise — inchangé par tier

Les quotas mensuels **Nova Coach / Advise** restent tels que définis dans `functions/subscriptions/planLimits.js` :

| Tier | Nova Advice / mois | Nova Explain LLM / mois |
|------|-------------------|-------------------------|
| Free | 30 | 30 |
| Pro | 100 | 60 |
| Vip | 250 | 120 |

- Compteur : `nova_quotas/{uid}_{YYYY-MM}` via `QuotaManager`.
- **Nouveau (v2.1)** : en plus du quota mensuel, Nova liée à un **groupe** exige `participation == active` dans ce groupe.
- KB explain (`source: knowledge_base`) : comportement actuel conservé.

### 1.6 Autopilot — inchangé (axe séparé)

- Limite Autopilot par tier (owned + autopilot) **conservée côté serveur** pour l’instant.
- Retirée de l’UI « groupes possédés » publique ; monétisation Autopilot traitée séparément.
- Configurable par owner/admin même en `admin_only`.

---

## 2. Anti-abus création (invisible)

Module cible : `functions/groups/groupCreationGuard.js`

| Mécanisme | Notes |
|-----------|-------|
| Rate limit horaire | Ex. 5 / h / uid (à calibrer) |
| Plafond quotidien | Ex. 15 / 24 h / uid |
| Heuristiques | Rafales, comptes récents |

Message client générique uniquement. Branché dans `createGroupWithCap`.

---

## 3. Cloud Functions — périmètre

| Module / callable | Action |
|-------------------|--------|
| `participationEnforcement.js` | Comptage, gates participation active |
| `groupCreationGuard.js` | Anti-abus création |
| `resolveActiveGroups` | Downgrade participation |
| `resolveAutopilotGroups` | Inchangé |
| `createGroupWithCap` | Retirer cap owned forfait ; anti-abus ; participation owner à la création |
| `joinGroupWithCap` | Cap participation active |
| `defisJoin`, TP/FGC/TS, leaderboard | Gate `participation == active` |
| `getUserPlanUsage` | Counts calculés ; flags resolution ; Nova limits inchangés |

---

## 4. Client — périmètre

| Écran / module | Changement |
|----------------|------------|
| `PlanUsageCard` | Jauge groupes actifs ; Nova usage **conservé** |
| `subscriptions/index.js` | Retirer owned/joined caps visibles ; garder ligne Nova |
| `ParticipationDowngradeModal` | Nouveau |
| `AutopilotDowngradeModal` | Conservé |
| `usePlanUsage` | Query participations actives + Nova via callable |

Copy cible :

> Ton forfait limite le nombre de groupes dans lesquels tu participes aux défis. Tu peux créer et administrer autant de groupes que tu veux.

---

## 5. Plan de migration

| Phase | Durée | Livrables |
|-------|-------|-----------|
| **0 — Spec** | 1–2 j | Seuils anti-abus ; copy FR/EN ; flag `participationLimitsV2` |
| **1 — Schéma** | 2 j | Backfill `participation: active` ; dual-read |
| **2 — Participation CF** | 4 j | Enforcement, join cap, resolveActiveGroups, gates défis/Nova **groupe** |
| **3 — Anti-abus create** | 2 j | `groupCreationGuard` |
| **4 — UI** | 3 j | Modales, badges, abonnements |
| **5 — Nettoyage** | 2 j | Rules, tests E2E, retrait flag |

**Estimation :** 12–15 j dev + 2 j QA

Ordre downgrade UX : participation → Autopilot (si les deux requis).

---

## 6. Index Firestore

```
group_memberships: (uid, status, participation)
group_memberships: (groupId, status, participation)
```

---

## 7. Hors scope MVP

- `activeGroupsCount` persisté
- Fusion Autopilot ↔ participation
- Cooldown Free sur bascule de groupe actif
- Limite visible sur création de groupes

---

## 8. Fichiers de référence (état actuel)

```
functions/subscriptions/planLimits.js      # Nova + Autopilot limits (Nova inchangé)
functions/groups/planEnforcement.js        # Autopilot (à conserver)
functions/nova/quotas/QuotaManager.js      # Nova quotas
src/subscriptions/planLimits.js            # Miroir client
src/subscriptions/AutopilotDowngradeModal.js
```
