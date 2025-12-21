export function getDefiRules(defiType) {
  switch (Number(defiType)) {
    case 1: // 1x1
      return { picks: 1, T1: 0, T2: 0, T3: 1 };

    case 2: // 2x2
      return { picks: 2, T1: 1, T2: 1, T3: 0 };

    case 3: // 3x3
      return { picks: 3, T1: 1, T2: 1, T3: 1 };

    case 4: // 4x4
      return { picks: 4, T1: 1, T2: 1, T3: 2 };

    case 5: // 5x5
      return { picks: 5, T1: 1, T2: 2, T3: 2 };

    case 6: // ✅ 6x7
      return { picks: 7, T1: 2, T2: 2, T3: 3 };

    default:
      return { picks: 0, T1: 0, T2: 0, T3: 0 };
  }
}

export function getTierByIndex(idx) {
  if (idx <= 9) return 'T1';      // Top 10
  if (idx <= 19) return 'T2';     // 11–20
  return 'T3';                    // 21+
}

export function validatePicks(picks, rules) {
  const count = { T1: 0, T2: 0, T3: 0 };

  for (const p of picks) {
    count[p.tier] = (count[p.tier] || 0) + 1;
  }

  if (picks.length !== rules.picks) {
    return `Tu dois sélectionner exactement ${rules.picks} joueurs`;
  }

  for (const tier of ['T1', 'T2', 'T3']) {
    if (count[tier] < rules[tier]) {
      return `Il te manque ${rules[tier] - count[tier]} joueur(s) ${tier}`;
    }
  }

  return null; // ✅ valide
}

export function allowedDefiTypes(gameCount) {
  if (gameCount <= 1) return [1, 2];        // 1x1, 2x2
  if (gameCount === 2) return [1, 2, 3];
  if (gameCount === 3) return [1, 2, 3, 4];
  return [1, 2, 3, 4, 5, 6];                 // 4+ matchs
}