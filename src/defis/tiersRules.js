function pickPrefixFromI18n(i18n) {
  const locale = String(i18n?.locale || "").toLowerCase();
  return locale.startsWith("fr") ? "C" : "P";
}

function labelForTier(tier, prefix) {
  const n = tier === "T1" ? 1 : tier === "T2" ? 2 : 3;
  return `${prefix}${n}`;
}

// ✅ règles par type de défi
export function getDefiRules(defiType) {
  switch (Number(defiType)) {
    case 1: return { picks: 1, T1: 1, T2: 0, T3: 0 };       // 1x1
    case 2: return { picks: 2, T1: 1, T2: 1, T3: 0 };       // 2x2
    case 3: return { picks: 3, T1: 1, T2: 1, T3: 1 };       // 3x3
    case 4: return { picks: 4, T1: 1, T2: 1, T3: 2 };       // 4x4
    case 5: return { picks: 5, T1: 1, T2: 2, T3: 2 };       // 5x5
    case 6: return { picks: 7, T1: 2, T2: 2, T3: 3 };       // 6x7
    default: return { picks: 0, T1: 0, T2: 0, T3: 0 };
  }
}

// ✅ tier selon rang (Top 10 / 11–20 / 21+)
export function getTierByIndex(idx) {
  if (idx <= 9) return "T1";
  if (idx <= 19) return "T2";
  return "T3";
}

// ✅ version i18n-friendly
export function validatePicks(picks, rules, i18n) {
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