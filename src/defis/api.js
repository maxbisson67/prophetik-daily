// src/defis/api.js (RNFB)
import firestore from '@react-native-firebase/firestore';

/** Client-side check: membre actif OU owner du groupe */
async function isGroupMemberOrOwnerClientCheck(groupId, uid) {
  try {
    if (!groupId || !uid) return false;

    // 1) membership: group_memberships/{groupId}_{uid}
    const gmRef  = firestore().doc(`group_memberships/${groupId}_${uid}`);
    const gmSnap = await gmRef.get();
    if (gmSnap.exists) {
      const gm = gmSnap.data() || {};
      const isActive = gm.active !== false;
      const role = String(gm.role || 'member').toLowerCase();
      if (isActive && (role === 'member' || role === 'owner')) return true;
    }

    // 2) fallback owner
    const gRef  = firestore().doc(`groups/${String(groupId)}`);
    const gSnap = await gRef.get();
    if (gSnap.exists && gSnap.data()?.ownerId === uid) return true;

    return false;
  } catch (e) {
    console.warn('[isGroupMemberOrOwnerClientCheck]', e?.code || e?.message || e);
    return false;
  }
}

/**
 * Crée un défi (RNFB).
 * Requis:  { groupId, title, type, gameDate, createdBy }
 * Optionnels: { participationCost, status='active', firstGameUTC, signupDeadline }
 * Règles Firestore attendues: isGroupOwner(groupId) && createdBy == request.auth.uid
 */
export async function createDefi(input = {}) {
  const {
    groupId,
    title,
    type,
    gameDate,            // "YYYY-MM-DD"
    createdBy,           // uid
    participationCost,   // number | null
    status = 'active',
    firstGameUTC = null,     // Date | ISO | null
    signupDeadline = null,   // Date | ISO | null
  } = input;

  if (!groupId)   throw new Error('groupId requis');
  if (!title)     throw new Error('title requis');
  if (!type)      throw new Error('type requis');
  if (!gameDate)  throw new Error('gameDate requis');
  if (!createdBy) throw new Error('createdBy (uid) requis');

  // Vérif UI (les règles restent l’ultime source de vérité)
  const okOwner = await isGroupMemberOrOwnerClientCheck(groupId, createdBy);
  if (!okOwner) throw new Error("Création refusée: l'utilisateur n'est pas owner/membre actif du groupe.");

  const toDate = (v) => (v instanceof Date ? v : (v ? new Date(v) : null));

  const payload = {
    groupId: String(groupId),
    title: String(title),
    type: Number(type),
    gameDate: String(gameDate),
    createdBy: String(createdBy),
    participationCost: participationCost ?? null,
    status: String(status),
    firstGameUTC: toDate(firstGameUTC) || undefined,
    signupDeadline: toDate(signupDeadline) || undefined,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };

  // Retire les undefined (RNFB ignore souvent, mais gardons propre)
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const col = firestore().collection('defis');
  const ref = await col.add(payload);
  return { id: ref.id };
}