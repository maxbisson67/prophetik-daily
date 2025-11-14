// src/nhl/api.js (RNFB)
import firestore from '@react-native-firebase/firestore';

const db = firestore();

// util: chunk un array en tableaux de 10 (limite "in" Firestore)
function chunk(arr, n = 10) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Retourne { players: Array<{id, fullName, pos, tri, teamName}>,
 *            firstGameAtUTC: Timestamp|null,
 *            games: number }
 */
export async function getPlayersForDate(gameDate /* YYYY-MM-DD */) {
  const idxRef = db.collection('nhl_players_by_date').doc(String(gameDate));
  const idxSnap = await idxRef.get();

  if (!idxSnap.exists) {
    return { players: [], firstGameAtUTC: null, games: 0 };
  }

  const idx = idxSnap.data() || {};
  const ids = Array.isArray(idx.players) ? idx.players : [];
  if (ids.length === 0) {
    return { players: [], firstGameAtUTC: idx.firstGameAtUTC || null, games: idx.games || 0 };
  }

  const players = [];
  const chs = chunk(ids, 10); // RNFB/Firestore limite "in" = 10

  for (const c of chs) {
    const qPlayers = db
      .collection('nhl_players')
      .where(firestore.FieldPath.documentId(), 'in', c.map(String));

    const snap = await qPlayers.get();
    snap.forEach((d) => {
      const v = d.data() || {};
      players.push({
        id: d.id,
        fullName: v.fullName,
        pos: v.pos,
        tri: v.tri,
        teamName: v.teamName || '',
      });
    });
  }

  // tri alpha nom
  players.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));

  return {
    players,
    firstGameAtUTC: idx.firstGameAtUTC || null,
    games: idx.games || 0,
  };
}