function pickPrefixFromI18n(i18n) {
  const locale = String(i18n?.locale || "").toLowerCase();
  return locale.startsWith("fr") ? "C" : "P";
}

function labelForTier(tier, prefix) {
  const n = tier === "T1" ? 1 : tier === "T2" ? 2 : 3;
  return `${prefix}${n}`;
}

export function getDefiRules(defiType) {
  switch (Number(defiType)) {
    case 1: return { picks: 1, T1: 1, T2: 0, T3: 0 }; // 1x1
    case 2: return { picks: 2, T1: 1, T2: 1, T3: 0 }; // 2x2
    case 3: return { picks: 3, T1: 1, T2: 1, T3: 1 }; // 3x3
    case 4: return { picks: 4, T1: 1, T2: 1, T3: 2 }; // 4x4
    case 5: return { picks: 5, T1: 1, T2: 2, T3: 2 }; // 5x5
    case 6: return { picks: 6, T1: 2, T2: 2, T3: 2 }; // 6x6
    case 7: return { picks: 7, T1: 2, T2: 2, T3: 3 }; // 7x7

    default: return { picks: 0, T1: 0, T2: 0, T3: 0 };
  }
}

// ✅ tier selon rang (Top 10 / 11–20 / 21+)
export function getTierByIndex(idx) {
  if (idx <= 9) return "T1";
  if (idx <= 19) return "T2";
  return "T3";
}

/** Trio 3x3 : exclusion par rang selon le slot (0 = tous, 1 = hors top 10, 2 = hors top 20). */
export function usesRankSlotExclusion(defiType) {
  return Number(defiType) === 3;
}

export function rankExcludeTopForSlot(slotIndex, defiType) {
  if (!usesRankSlotExclusion(defiType)) return null;
  const slot = Number(slotIndex);
  if (slot === 0) return 0;
  if (slot === 1) return 10;
  if (slot === 2) return 20;
  return 20;
}

export function isPlayerEligibleForSlot(player, slotIndex, defiType) {
  const excludeTop = rankExcludeTopForSlot(slotIndex, defiType);
  if (excludeTop == null || excludeTop <= 0) return true;
  const rank = Number(player?.rank);
  if (!Number.isFinite(rank) || rank <= 0) return true;
  return rank > excludeTop;
}

function slotRankError(i18n, slotIndex, excludeTop) {
  const slotNum = slotIndex + 1;
  if (excludeTop === 10) {
    return i18n
      ? i18n.t("defi.rules.slotExcludeTop10", {
          slot: slotNum,
          defaultValue: `Choix ${slotNum} : ce joueur fait partie du top 10.`,
        })
      : `Choix ${slotNum} : hors du top 10 requis.`;
  }
  if (excludeTop >= 20) {
    return i18n
      ? i18n.t("defi.rules.slotExcludeTop20", {
          slot: slotNum,
          defaultValue: `Choix ${slotNum} : ce joueur fait partie du top 20.`,
        })
      : `Choix ${slotNum} : hors du top 20 requis.`;
  }
  return null;
}

export function validateSlotPickAtIndex(player, slotIndex, defiType, i18n) {
  if (!player || !usesRankSlotExclusion(defiType)) return null;
  const excludeTop = rankExcludeTopForSlot(slotIndex, defiType);
  if (!excludeTop || excludeTop <= 0) return null;
  const rank = Number(player?.rank);
  if (Number.isFinite(rank) && rank > 0 && rank <= excludeTop) {
    return slotRankError(i18n, slotIndex, excludeTop);
  }
  return null;
}

export function validatePicksPartialBySlot(chosen, defiType, i18n) {
  const list = Array.isArray(chosen) ? chosen : [];
  for (let i = 0; i < list.length; i++) {
    const err = validateSlotPickAtIndex(list[i], i, defiType, i18n);
    if (err) return err;
  }
  return null;
}

function validatePicksByTier(picks, rules, i18n) {
  const list = Array.isArray(picks) ? picks : [];
  const count = { T1: 0, T2: 0, T3: 0 };

  for (const p of list) {
    const t = p?.tier || "T3";
    count[t] = (count[t] || 0) + 1;
  }

  const prefix = pickPrefixFromI18n(i18n);

  if (list.length !== rules.picks) {
    return i18n
      ? i18n.t("defi.rules.wrongPickCount", { expected: rules.picks })
      : `Tu dois sélectionner exactement ${rules.picks} joueurs`;
  }

  for (const tier of ["T1", "T2", "T3"]) {
    const required = Number(rules[tier] ?? 0);
    const used = Number(count[tier] ?? 0);

    if (used < required) {
      const missing = required - used;
      const tierLabel = labelForTier(tier, prefix);
      return i18n
        ? i18n.t("defi.rules.tierMissingCount", { missing, tierLabel })
        : `Il te manque ${missing} joueur(s) ${tier}`;
    }

    if (used > required) {
      const tierLabel = labelForTier(tier, prefix);
      return i18n
        ? i18n.t("defi.rules.tierTooMany", { tierLabel, max: required, used })
        : `Tu as trop de joueurs ${tier}`;
    }
  }

  return null;
}

// ✅ version i18n-friendly
export function validatePicks(picks, rules, i18n, defiType) {
  if (usesRankSlotExclusion(defiType)) {
    const list = Array.isArray(picks) ? picks : [];
    if (list.length !== rules.picks) {
      return i18n
        ? i18n.t("defi.rules.wrongPickCount", { expected: rules.picks })
        : `Tu dois sélectionner exactement ${rules.picks} joueurs`;
    }
    return validatePicksPartialBySlot(list, defiType, i18n);
  }
  return validatePicksByTier(picks, rules, i18n);
}