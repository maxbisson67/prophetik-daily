/**
 * Stats API MLB — live feed (source unique côté Functions).
 */

const MLB_LIVE_FEED_URL = (gamePk) =>
  `https://statsapi.mlb.com/api/v1.1/game/${encodeURIComponent(String(gamePk))}/feed/live`;

export async function fetchMlbLiveFeed(gamePk) {
  const url = MLB_LIVE_FEED_URL(gamePk);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "prophetik/1.0" },
  });

  if (!res.ok) {
    throw new Error(`MLB live feed failed ${res.status} gamePk=${gamePk}`);
  }

  return res.json();
}

export { MLB_LIVE_FEED_URL };
