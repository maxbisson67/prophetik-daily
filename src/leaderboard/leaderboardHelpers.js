function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Transforme un map { key: number } en rows triées.
 * - week keys: ex "20252026-W14" -> tri par numéro de semaine (et saison si multiple)
 * - month keys: ex "2025-12" -> tri lexicographique OK
 */
export function mapToSortedRows(mapObj, { kind = "month", limit = 12 } = {}) {
  const m = mapObj && typeof mapObj === "object" ? mapObj : {};
  const rows = Object.entries(m)
    .map(([k, v]) => ({ key: String(k), value: num(v) }))
    .filter((r) => r.key && Number.isFinite(r.value));

  if (kind === "week") {
    rows.sort((a, b) => {
      const aKey = String(a.key);
      const bKey = String(b.key);

      const aSeason = aKey.split("-W")[0] || "";
      const bSeason = bKey.split("-W")[0] || "";
      if (aSeason !== bSeason) return aSeason.localeCompare(bSeason);

      const aw = Number(aKey.split("-W")[1] || 0);
      const bw = Number(bKey.split("-W")[1] || 0);
      return aw - bw;
    });
  } else {
    rows.sort((a, b) => a.key.localeCompare(b.key));
  }

  if (rows.length > limit) return rows.slice(rows.length - limit);
  return rows;
}

export function toCumulativeSeriesFromMap(mapObj, { kind = "week", limit = 32 } = {}) {
  const rows = mapToSortedRows(mapObj, { kind, limit });
  let acc = 0;

  return rows.map((r) => {
    acc += num(r.value);

    let xLabel = r.key;
    if (kind === "week") {
      const wk = String(r.key).split("-W")[1] || r.key;
      xLabel = `W${wk}`;
    } else {
      xLabel = r.key;
    }

    return { xLabel, value: acc };
  });
}