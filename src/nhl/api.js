import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@src/lib/firebase";

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
  const idxRef = doc(db, "nhl_players_by_date", gameDate);
  const idxSnap = await getDoc(idxRef);
  if (!idxSnap.exists()) {
    return { players: [], firstGameAtUTC: null, games: 0 };
  }
  const idx = idxSnap.data();
  const ids = Array.isArray(idx.players) ? idx.players : [];
  const chs = chunk(ids, 10);
  const players = [];

  for (const c of chs) {
    const qPlayers = query(
      collection(db, "nhl_players"),
      where("__name__", "in", c) // docId in chunk
    );
    const snap = await getDocs(qPlayers);
    snap.forEach(d => {
      const v = d.data();
      players.push({
        id: d.id,
        fullName: v.fullName,
        pos: v.pos,
        tri: v.tri,
        teamName: v.teamName || ""
      });
    });
  }

  // trie alpha nom
  players.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));

  return {
    players,
    firstGameAtUTC: idx.firstGameAtUTC || null,
    games: idx.games || 0
  };
}