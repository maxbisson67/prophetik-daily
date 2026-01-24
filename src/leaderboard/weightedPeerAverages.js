// src/leaderboard/weightedPeerAverages.js

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeDiv(a, b) {
  const aa = num(a);
  const bb = num(b);
  return bb > 0 ? aa / bb : 0;
}

function toMap(obj) {
  return obj && typeof obj === "object" ? obj : {};
}

/**
 * Extract by-type aggregates from row.winsByType[type]
 * We keep:
 * - plays, wins, points (Prophetik pointsTotal)
 * - nhlPointsTotal, nhlGamesTotal, nhlPPG (NHL performance)
 */
function extractTypeAgg(row) {
  const byType = toMap(row?.winsByType);
  const out = {};

  for (const [typeKey, v] of Object.entries(byType)) {
    const plays = num(v?.plays);
    const wins = num(v?.wins);
    const points = num(v?.pointsTotal); // ✅ Prophetik (potInc)

    const nhlPointsTotal = num(v?.nhlPointsTotal);
    const nhlGamesTotal = num(v?.nhlGamesTotal);
    const nhlPPG = safeDiv(nhlPointsTotal, nhlGamesTotal);

    out[String(typeKey)] = {
      plays,
      wins,
      points,

      nhlPointsTotal,
      nhlGamesTotal,
      nhlPPG,
    };
  }

  return out;
}

/**
 * Calcule les comparatifs (toi vs moyenne des autres)
 *
 * - winRate & pointsPerPlay: pondérés via (sumWins/sumPlays) et (sumPoints/sumPlays)
 * - pointsTotal des autres (Carte 1): moyenne simple = sumPoints / count
 *
 * ✅ NHL:
 * - nhlPPG des autres: pondéré via (sumNhlPoints/sumNhlGames)
 * - nhlPointsTotal des autres: moyenne simple = sumNhlPoints / count (optionnel)
 */
export function computeWeightedPeerAverages({ row, peerRows }) {
  const meUid = String(row?.uid || row?.id || "");
  const list = Array.isArray(peerRows) ? peerRows : [];

  // --- ME (global)
  const mePlays = num(row?.participations);
  const meWins = num(row?.wins);
  const mePoints = num(row?.pointsTotal);

  const meNhlPointsTotal = num(row?.nhlPointsTotal);
  const meNhlGamesTotal = num(row?.nhlGamesTotal);
  const meNhlPPG = safeDiv(meNhlPointsTotal, meNhlGamesTotal);

  const me = {
    uid: row?.uid || row?.id || null,
    id: row?.id || row?.uid || null,
    displayName: row?.displayName || null,
    avatarUrl: row?.avatarUrl || null,

    // Prophetik
    plays: mePlays,
    wins: meWins,
    points: mePoints,
    winRate: safeDiv(meWins, mePlays),
    pointsPerPlay: safeDiv(mePoints, mePlays),

    // NHL
    nhlPointsTotal: meNhlPointsTotal,
    nhlGamesTotal: meNhlGamesTotal,
    nhlPPG: meNhlPPG,

    byType: {},
  };

  // --- ME (by type)
  const meTypeAgg = extractTypeAgg(row);
  for (const [type, agg] of Object.entries(meTypeAgg)) {
    me.byType[type] = {
      ...agg,
      winRate: safeDiv(agg.wins, agg.plays),
      pointsPerPlay: safeDiv(agg.points, agg.plays),

      // NHL (déjà calculé dans extractTypeAgg)
      nhlPPG: safeDiv(agg.nhlPointsTotal, agg.nhlGamesTotal),
    };
  }

  // --- OTHERS aggregations
  let othersCount = 0;

  // Prophetik sums (for ratios)
  let sumPlays = 0;
  let sumWins = 0;
  let sumPoints = 0; // Prophetik pointsTotal (potInc)

  // NHL sums
  let sumNhlPoints = 0;
  let sumNhlGames = 0;

  const sumByType = {};       // Prophetik by type: {plays,wins,points, nhlPointsTotal, nhlGamesTotal}
  const typeCounts = {};      // count peers having that type (for simple averages if needed)

  for (const r of list) {
    const uid = String(r?.uid || r?.id || "");
    if (!uid) continue;
    if (uid === meUid) continue;

    othersCount += 1;

    const plays = num(r?.participations);
    const wins = num(r?.wins);
    const points = num(r?.pointsTotal);

    sumPlays += plays;
    sumWins += wins;
    sumPoints += points;

    const nhlPts = num(r?.nhlPointsTotal);
    const nhlG = num(r?.nhlGamesTotal);
    sumNhlPoints += nhlPts;
    sumNhlGames += nhlG;

    const typeAgg = extractTypeAgg(r);
    for (const [type, agg] of Object.entries(typeAgg)) {
      if (!sumByType[type]) {
        sumByType[type] = {
          plays: 0,
          wins: 0,
          points: 0,

          nhlPointsTotal: 0,
          nhlGamesTotal: 0,
        };
      }

      sumByType[type].plays += num(agg.plays);
      sumByType[type].wins += num(agg.wins);
      sumByType[type].points += num(agg.points);

      sumByType[type].nhlPointsTotal += num(agg.nhlPointsTotal);
      sumByType[type].nhlGamesTotal += num(agg.nhlGamesTotal);

      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
  }

  const others = {
    count: othersCount,

    // Prophetik (sums)
    plays: sumPlays,
    wins: sumWins,
    points: sumPoints,

    // Prophetik (averages/ratios)
    avgPointsTotal: safeDiv(sumPoints, othersCount), // ✅ moyenne simple par participant
    winRate: safeDiv(sumWins, sumPlays),             // ✅ pondéré par plays
    pointsPerPlay: safeDiv(sumPoints, sumPlays),     // ✅ pondéré par plays

    // NHL (sums)
    nhlPointsTotal: sumNhlPoints,
    nhlGamesTotal: sumNhlGames,

    // NHL (averages/ratios)
    avgNhlPointsTotal: safeDiv(sumNhlPoints, othersCount), // moyenne simple (optionnel)
    nhlPPG: safeDiv(sumNhlPoints, sumNhlGames),            // ✅ pondéré par games

    byType: {},
  };

  for (const [type, agg] of Object.entries(sumByType)) {
    others.byType[type] = {
      ...agg,

      // Prophetik
      avgPointsTotal: safeDiv(agg.points, typeCounts[type] || 0), // simple avg across peers having type (optionnel)
      winRate: safeDiv(agg.wins, agg.plays),
      pointsPerPlay: safeDiv(agg.points, agg.plays),

      // NHL
      avgNhlPointsTotal: safeDiv(agg.nhlPointsTotal, typeCounts[type] || 0), // optionnel
      nhlPPG: safeDiv(agg.nhlPointsTotal, agg.nhlGamesTotal),                // ✅ pondéré par games
    };
  }

  // --- DELTAS (toi - autres)
  const deltas = {
    // Prophetik
    pointsTotal: me.points - others.avgPointsTotal,
    winRate: me.winRate - others.winRate,
    pointsPerPlay: me.pointsPerPlay - others.pointsPerPlay,

    // NHL
    nhlPointsTotal: me.nhlPointsTotal - others.avgNhlPointsTotal, // optionnel
    nhlPPG: me.nhlPPG - others.nhlPPG,

    byType: {},
  };

  const typeKeys = new Set([...Object.keys(me.byType), ...Object.keys(others.byType)]);
  for (const type of typeKeys) {
    const a = me.byType[type] || {
      points: 0,
      winRate: 0,
      pointsPerPlay: 0,
      nhlPointsTotal: 0,
      nhlGamesTotal: 0,
      nhlPPG: 0,
    };

    const b = others.byType[type] || {
      avgPointsTotal: 0,
      winRate: 0,
      pointsPerPlay: 0,
      avgNhlPointsTotal: 0,
      nhlPPG: 0,
    };

    deltas.byType[type] = {
      // Prophetik
      pointsTotal: num(a.points) - num(b.avgPointsTotal),
      winRate: num(a.winRate) - num(b.winRate),
      pointsPerPlay: num(a.pointsPerPlay) - num(b.pointsPerPlay),

      // NHL
      nhlPointsTotal: num(a.nhlPointsTotal) - num(b.avgNhlPointsTotal), // optionnel
      nhlPPG: num(a.nhlPPG) - num(b.nhlPPG),
    };
  }

  return { me, others, deltas };
}

/**
 * Petit helper: liste des types présents (tri numérique)
 */
export function listTypesFromComparisons(comp) {
  const keys = new Set([
    ...Object.keys(comp?.me?.byType || {}),
    ...Object.keys(comp?.others?.byType || {}),
  ]);
  return Array.from(keys).sort((a, b) => Number(a) - Number(b));
}