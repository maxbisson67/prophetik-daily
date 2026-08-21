# Groupes Prophetik — Taille, limites et groupes publics (futur)

**Statut :** En vigueur (limite 100) + roadmap architecture  
**Dernière mise à jour :** 2026-08-08

Document de référence pour la taille des groupes privés entre amis, les risques d’échelle actuels, et le plan si Prophetik doit un jour supporter des groupes ouverts ou massifs.

---

## 1. Positionnement produit

Prophetik vise un **défi sportif quotidien entre amis**, pas une ligue publique ou un canal communautaire à milliers de membres.

| Modèle | Cible actuelle | Futur possible |
|--------|----------------|----------------|
| Groupe privé (QR / code) | **Oui** — cœur du produit | Optimiser jusqu’à ~500 |
| Groupe ouvert / public | **Non** — hors scope MVP | Mode distinct si demande réelle |

La limite **100 participants humains par groupe** est un garde-fou produit + technique, pas une promesse de support à 100 personnes avec l’architecture actuelle sans friction (voir §4).

---

## 2. Décision en vigueur — limite 100

### 2.1 Règle

- **Max 100 membres humains actifs** par groupe.
- **Nova (`uid: ai`)** exclue du décompte.
- **Rejoin** d’un membre déjà actif : autorisé (pas de consommation de slot).
- **Membre `left` qui revient** : compte comme un nouveau slot.
- **Groupes déjà > 100** (legacy / avant deploy) : *grandfathered* — seuls les **nouveaux** joins sont bloqués.

### 2.2 Implémentation (2026-08)

| Couche | Fichier | Rôle |
|--------|---------|------|
| Serveur | `functions/groups/groupMemberLimit.js` | `MAX_GROUP_MEMBERS = 100`, comptage, `GROUP_MEMBER_LIMIT_REACHED` |
| Serveur | `functions/groups/joinGroupWithCap.js` | `assertGroupHasMemberCapacity()` avant upsert membership |
| Client | `app/(drawer)/groups/join.js` | Alerte « Groupe complet » |
| i18n | `src/i18n/fr.json`, `en.json` | `groups.join.alertGroupMemberLimit*` |

**Deploy requis :** `firebase deploy --only functions:joinGroupWithCap`

### 2.3 Non inclus (volontairement, v1)

- Compteur `memberCount` dénormalisé sur `groups/{id}`
- Transaction Firestore anti-race à 99→100 (query avant write ; overshoot rare)
- Verrouillage Firestore rules sur `group_memberships`
- Affichage UI `X/100` sur fiche groupe / invite

---

## 3. Modèle de données actuel (rappel)

```
groups/{groupId}
  - name, codeInvitation, ownerId, sport, …
  - PAS de memberCount

group_memberships/{groupId}_{uid}   ← source de vérité appartenance
  - status: active | left | archived
  - participation: active | inactive | admin_only
  - role: owner | member | admin
  - type: "ai" (Nova uniquement)
```

**Limites utilisateur** (abonnement) ≠ **limite taille groupe** :
- Slots participation active : Free 1 / Pro 5 / Vip 20 (`participationEnforcement.js`)
- Un utilisateur peut rejoindre en `inactive` même si son slot actif est plein — il **compte quand même** dans la taille du groupe.

---

## 4. Comportement actuel à grande échelle (sans Phase 1)

Analyse interne — scénario extrême (ex. QR viral, ~2400 joins).

### 4.1 Ce qui tient encore

| Zone | Pourquoi |
|------|----------|
| Join + picks quotidiens | Check `group_memberships/{groupId}_{uid}` (1 doc) |
| Classement affiché | `useLeaderboardGroupMembers` → **top 50** |
| Live / Today | Scopé au groupe + user, pas de liste complète |

### 4.2 Points de rupture

| Zone | Fichiers concernés | Symptôme estimé |
|------|-------------------|-----------------|
| Fiche groupe | `app/(drawer)/groups/[groupId]/index.js` | Charge **tous** les memberships ; rend **toute** la liste (pas de virtualisation) ; `useLeaderboardProfiles` → **~2 listeners Firestore / membre** |
| Écran Membres | `app/(drawer)/groups/[groupId]/members.js` | 1 query memberships + 1 listener `participants/{uid}` / membre |
| Push défi / autopilot | `functions/notifyOnDefiCreate.js`, `functions/utils/pushUtils.js` | Query tous les membres + boucle N× lecture `participants` + tokens ; timeout / coût |
| Coûts Firestore | Partout où `where("groupId", "==", …).get()` sans pagination | Reads proportionnels à la taille à chaque action |

**Seuil douloureux estimé :** crash / freeze UI proprio ~**100–200** ; push et coûts dégradés ~**500+**.

### 4.3 Verdict

Pas de panne globale Prophetik, mais **un groupe surdimensionné devient toxique** pour son owner, ses écrans admin et la facture Firebase.

---

## 5. Roadmap architecture — si demande « groupes publics »

Traiter le **public comme un mode produit distinct**, pas un groupe privé avec une limite plus haute.

### Phase 1 — Robuste jusqu’à ~500 membres (groupes privés)

**Complexité : moyenne · ~1–2 semaines dev**

| Travail | Détail |
|---------|--------|
| UI membres | `FlatList` virtualisée ; pagination (25–50 / page) |
| Profils | Remplacer listeners par uid dans `useLeaderboardProfiles` par fetch batch ou profils des lignes visibles seulement |
| Compteur | `groups.memberCount` + `FieldValue.increment` on join / leave / delete |
| Push | `getAll()` participants par batches de 100 ; éviter boucles séquentielles |
| Sécurité | Deny client writes sur `group_memberships` (Admin SDK only) |

**Fichiers clés :** `[groupId]/index.js`, `members.js`, `useLeaderboardProfiles.js`, `pushUtils.js`, `groupsManagement.js`, `firestore.rules`

### Phase 2 — Groupes publics v1 (~1 000–2 500)

**Complexité : moyenne-élevée · ~2–4 semaines dev**

| Travail | Détail |
|---------|--------|
| Produit | `groupType: private \| public` ; limites et UX join différentes |
| Notifications | Topics FCM ou fan-out **async** (Cloud Tasks / Pub/Sub) — pas de collecte synchrone 2k tokens |
| Classement | Pagination au-delà du top 50 |
| Modération | Signalement, kick, désactivation QR, approbation owner (option) |
| Coûts | Filtrage prefs notif **avant** collecte tokens ; pas de snapshot full-list côté client |

### Phase 3 — Très grande échelle (5 000–10 000+)

**Complexité : élevée · ~1–2 mois dev**

| Travail | Détail |
|---------|--------|
| Notifications | Digest quotidien, opt-in granulaire, pas push instantané massif |
| Données | Sharding memberships ou index secondaires ; cache Redis pour compteurs / top N |
| Produit | Discovery, recherche, anti-spam join, quotas device/IP |
| Ops | Dashboard coûts par groupe, alertes seuil |

### Estimation globale

| Ambition | Effort |
|----------|--------|
| Limite 100 (fait) | ~1–2 j |
| Robuste ~500 | **1–2 sem.** |
| Public v1 ~1–2k | **+2–4 sem.** |
| 10k+ ouvert | **+1–2 mois** |

**Total ordre de grandeur pour du public sérieux à 10k :** ~**6–10 semaines-dev** selon périmètre modération / discovery.

---

## 6. Principes directeurs (quand on reviendra)

1. **Ne pas** augmenter la limite sans Phase 1 — achète crashes et coûts.
2. **Séparer** groupe privé (amis) et groupe public (communauté) dans le modèle et l’UI.
3. **Jamais** charger ni écouter en temps réel la liste complète des membres côté client.
4. **Notifications massives = async** ; jamais 10k reads synchrones dans une Callable timeout.
5. **Compteur dénormalisé** pour join, invite, « groupe complet » — pas de `count()` query à chaque écran.
6. Valider la **demande réelle** (QR viral accidentel vs feature public voulue) avant Phase 2.

---

## 7. Références code

| Sujet | Fichier |
|-------|---------|
| Limite join | `functions/groups/groupMemberLimit.js` |
| Join callable | `functions/groups/joinGroupWithCap.js` |
| Limite participation user | `functions/groups/participationEnforcement.js` |
| Membership helpers | `functions/groups/groupMembership.js`, `participationUtils.js` |
| Liste membres client | `app/(drawer)/groups/[groupId]/index.js`, `members.js` |
| Profils leaderboard | `src/leaderboard/useLeaderboardProfiles.js` |
| Top 50 classement | `src/leaderboard/useLeaderboardGroupMembers.js` |
| Push groupe | `functions/utils/pushUtils.js`, `functions/notifyOnDefiCreate.js` |
| Rebuild leaderboard | `functions/leaderboard/leaderboard.js` |
| Abonnements (doc lié) | `docs/architecture/subscription-participation-v2.1.md` |

---

## 8. Historique

| Date | Changement |
|------|------------|
| 2026-08-08 | Limite 100 implémentée ; document créé |
| 2026-08-08 | Analyse risque QR viral (~2400) et roadmap phases 1–3 |
