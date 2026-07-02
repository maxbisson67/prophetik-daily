export function resolveGroupDisplayName(group = {}) {
  const name = String(group?.name || group?.title || "").trim();
  return name || null;
}

/** Titre push avec nom de groupe en suffixe (ex. « Nouveaux défis — Les Boys »). */
export function pushTitleWithGroup(baseTitle, groupName) {
  const title = String(baseTitle || "").trim();
  const name = String(groupName || "").trim();
  if (!title) return name || "";
  return name ? `${title} — ${name}` : title;
}
