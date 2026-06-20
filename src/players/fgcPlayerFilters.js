/** Exclut les lanceurs de la sélection FGC MLB (premier point produit). */
export function isMlbPitcher(player) {
  const code = String(player?.positionCode || "").trim().toUpperCase();
  const type = String(player?.positionType || "").trim().toLowerCase();
  const name = String(player?.positionName || "").trim().toLowerCase();

  if (["P", "SP", "RP", "CP"].includes(code)) return true;
  if (type.includes("pitcher")) return true;
  if (name.includes("pitcher")) return true;

  return false;
}

export function filterFgcSelectablePlayers(players, league) {
  const L = String(league || "NHL").toUpperCase();
  if (L !== "MLB") return players;
  return players.filter((p) => !isMlbPitcher(p));
}
