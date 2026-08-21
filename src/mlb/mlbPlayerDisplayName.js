/** Style diffusion : « M. Gasper » depuis « Mickey Gasper ». */
export function formatMlbPlayerBroadcastName(fullName) {
  const name = String(fullName || "").trim();
  if (!name) return "";

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  const initial = parts[0].charAt(0).toUpperCase();
  const rest = parts.slice(1).join(" ");
  return `${initial}. ${rest}`;
}
