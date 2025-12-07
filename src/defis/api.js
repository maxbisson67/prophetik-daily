// src/defis/api.js (RNFB)
import firestore from '@react-native-firebase/firestore';

const APP_TZ = 'America/Toronto'; // ⚠️ DOIT rester aligné avec ProphetikDate côté backend

/** Client-side check: membre actif OU owner du groupe */
async function isGroupMemberOrOwnerClientCheck(groupId, uid) {
  try {
    if (!groupId || !uid) return false;

    const gmRef  = firestore().doc(`group_memberships/${groupId}_${uid}`);
    const gmSnap = await gmRef.get();
    if (gmSnap.exists) {
      const gm = gmSnap.data() || {};
      const isActive = gm.active !== false;
      const role = String(gm.role || 'member').toLowerCase();
      if (isActive && (role === 'member' || role === 'owner')) return true;
    }

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
 * Normalise gameDate:
 * - si string => on garde "YYYY-MM-DD" (on tronque au besoin)
 * - si Date   => on convertit en YMD dans APP_TZ (America/Toronto)
 */
function normalizeGameDate(gameDate) {
  if (!gameDate) throw new Error('gameDate requis');

  // 1) String → on suppose déjà "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm"
  if (typeof gameDate === 'string') {
    if (gameDate.length >= 10) {
      return gameDate.slice(0, 10); // ex: "2025-12-05"
    }
    throw new Error('gameDate string doit être au format "YYYY-MM-DD"');
  }

  // 2) Date → on convertit dans APP_TZ pour obtenir le YMD
  if (gameDate instanceof Date) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(gameDate);

      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;

      if (!y || !m || !d) throw new Error('formatToParts incomplet');

      return `${y}-${m}-${d}`;
    } catch (e) {
      console.warn('[normalizeGameDate] Intl error, fallback local getters', e);
      // Fallback: on utilise les getters locaux de Date (moins parfait, mais mieux que rien)
      const y = gameDate.getFullYear();
      const m = String(gameDate.getMonth() + 1).padStart(2, '0');
      const d = String(gameDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  throw new Error('gameDate doit être une string "YYYY-MM-DD" ou un Date');
}

const toDate = (v) => (v instanceof Date ? v : v ? new Date(v) : null);

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
    gameDate,            // string "YYYY-MM-DD" OU Date
    createdBy,           // uid
    participationCost,   // number | null
    status = 'active',
    firstGameUTC = null,     // Date | ISO | null
    signupDeadline = null,   // Date | ISO | null
  } = input;

  if (!groupId)   throw new Error('groupId requis');
  if (!title)     throw new Error('title requis');
  if (!type && type !== 0) throw new Error('type requis');
  if (!gameDate)  throw new Error('gameDate requis');
  if (!createdBy) throw new Error('createdBy (uid) requis');

  // Vérif UI (les règles restent l’ultime source de vérité)
  const okOwner = await isGroupMemberOrOwnerClientCheck(groupId, createdBy);
  if (!okOwner) throw new Error("Création refusée: l'utilisateur n'est pas owner/membre actif du groupe.");

  // 🔑 Normalisation fuseau → YMD dans APP_TZ
  const gameDateYmd = normalizeGameDate(gameDate);

  const payload = {
    groupId: String(groupId),
    title: String(title),
    type: Number(type),
    gameDate: gameDateYmd,
    createdBy: String(createdBy),
    participationCost: participationCost ?? null,
    status: String(status),
    // Ces champs sont des instants précis → Firestore stocke en UTC
    firstGameUTC: toDate(firstGameUTC) || undefined,
    signupDeadline: toDate(signupDeadline) || undefined,
    createdAt: firestore.FieldValue.serverTimestamp(),
    updatedAt: firestore.FieldValue.serverTimestamp(),
  };

  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  const col = firestore().collection('defis');
  const ref = await col.add(payload);
  return { id: ref.id };
}