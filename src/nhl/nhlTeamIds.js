/** NHL API numeric team id by abbreviation (api-web.nhle.com). */
export const NHL_ABBR_TO_TEAM_ID = {
  ANA: "24",
  BOS: "6",
  BUF: "7",
  CAR: "12",
  CBJ: "29",
  CGY: "20",
  CHI: "16",
  COL: "21",
  DAL: "25",
  DET: "17",
  EDM: "22",
  FLA: "13",
  LAK: "26",
  MIN: "30",
  MTL: "8",
  NJD: "1",
  NSH: "18",
  NYI: "2",
  NYR: "3",
  OTT: "9",
  PHI: "4",
  PIT: "5",
  SEA: "55",
  SJS: "28",
  STL: "19",
  TBL: "14",
  TOR: "10",
  UTA: "53",
  VAN: "23",
  VGK: "54",
  WPG: "52",
  WSH: "15",
};

export function resolveNhlTeamId(abbreviation, teamId) {
  const abbr = String(abbreviation || "").trim().toUpperCase();
  const fromMap = NHL_ABBR_TO_TEAM_ID[abbr];
  if (fromMap) return fromMap;

  const id = String(teamId || "").trim();
  if (/^\d+$/.test(id)) return id;
  return id || abbr;
}
