// src/profile/getNameAvatar.js
export function getNameAvatarFrom(any) {
  const displayName = any?.displayName || any?.name || "Invité";
  const avatarUrl   = any?.avatarUrl || any?.photoURL || any?.photoUrl || null;
  return { displayName, avatarUrl };
}