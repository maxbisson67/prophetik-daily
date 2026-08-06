export function hasCompleteJersey(jerseyFrontUrl, jerseyBackUrl) {
  return !!(jerseyFrontUrl && jerseyBackUrl);
}

export function hasJerseyFrontOnly(jerseyFrontUrl, jerseyBackUrl) {
  return !!jerseyFrontUrl && !jerseyBackUrl;
}

export function shouldShowLegacyAvatar({
  avatarKind,
  avatarUrl,
  jerseyFrontUrl,
  jerseyBackUrl,
}) {
  if (hasCompleteJersey(jerseyFrontUrl, jerseyBackUrl)) return false;
  if (hasJerseyFrontOnly(jerseyFrontUrl, jerseyBackUrl)) return false;
  if (avatarKind === "jersey") return false;
  return !!avatarUrl;
}

export function resolveCatalogAvatarUrl({ avatarKind, avatarUrl, photoURL }) {
  if (avatarKind === "jersey") return null;
  return avatarUrl || photoURL || null;
}
