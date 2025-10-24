// functions/notifyOnDefiCreate.js (remplace la partie collecte + envoi)
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Init Admin SDK une seule fois
if (!getApps().length) initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// Helper: Expo push (<=100 messages par requête)
async function sendExpoPush(tokens, payload) {
  if (!tokens?.length) return { ok: true, sent: 0, details: [] };

  // expo: <= 100 messages / requête
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

  let sent = 0;
  const details = [];

  for (const tks of chunks) {
    const messages = tks.map(to => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: 'default',
      channelId: 'challenges_v2', // ⚠️ doit exister côté Android
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    let json = {};
    try { json = await res.json(); } catch {}
    if (!res.ok) {
      logger.error('Expo push failed', { status: res.status, body: json });
      throw new Error(`Expo push failed: ${res.status}`);
    }

    // Optionnel: inspecter json.data[i].status/error
    details.push(json);
    sent += tks.length;
  }
  return { ok: true, sent, details };
}

export const notifyOnDefiCreate = onDocumentCreated('defis/{defiId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const defiId = event.params.defiId;
  const defi = snap.data() || {};
  const groupId = defi.groupId || null;
  const createdBy = defi.createdBy || null;
  const includeCreator = !!defi.debugNotifyCreator;

  try {
    logger.info('notifyOnDefiCreate: start', { defiId, groupId, createdBy, includeCreator });

    // 1) Membres (identique à ta version)
    let members = [];
    if (groupId) {
      const membSnap = await db.collection('group_memberships')
        .where('groupId', '==', groupId).get();
      const rows = membSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      members = rows.filter((m) => {
        if (m.status !== undefined) return String(m.status).toLowerCase() === 'active';
        if (m.active !== undefined) return !!m.active;
        return true;
      });
    }

    // 2) Destinataires UIDs (identique)
    const uids = new Set();
    for (const m of members) {
      const uid = m.userId || m.uid || m.participantId || m.memberId || m.ownerId || null;
      if (!uid) continue;
      if (uid === createdBy && !includeCreator) continue;
      uids.add(uid);
    }
    if (includeCreator && createdBy) uids.add(createdBy);

    if (uids.size === 0) {
      logger.info('notifyOnDefiCreate: aucun destinataire', { defiId, groupId });
      return;
    }
    logger.info('notifyOnDefiCreate: destinataires UIDs', {
      count: uids.size, uids: Array.from(uids)
    });

    // 3) Collecte des tokens Expo & FCM (map + sous-collection)
    const expoTokensByUid = {};
    const fcmTokensByUid  = {};

    for (const uid of uids) {
      const pRef = db.collection('participants').doc(uid);
      const pSnap = await pRef.get();
      const expoList = new Set();
      const fcmList  = new Set();

      if (pSnap.exists) {
        const p = pSnap.data() || {};
        // Map fcmTokens: { [token]: true }
        if (p.fcmTokens && typeof p.fcmTokens === 'object') {
          for (const token of Object.keys(p.fcmTokens)) {
            if (!token) continue;
            if (token.startsWith('ExponentPushToken[')) expoList.add(token);
            else fcmList.add(token);
          }
        }
        // Sous-collection fcm_tokens/{token} { token, type? }
        const subSnap = await pRef.collection('fcm_tokens').get();
        subSnap.forEach((tDoc) => {
          const tok = tDoc.data()?.token || tDoc.id;
          if (!tok) return;
          const isExpo = tok.startsWith('ExponentPushToken[') || tDoc.data()?.type === 'expo';
          if (isExpo) expoList.add(tok);
          else fcmList.add(tok);
        });
      }

      expoTokensByUid[uid] = Array.from(expoList);
      fcmTokensByUid[uid]  = Array.from(fcmList);
    }

    // Aplatis + dédup
    const expoTokens = Array.from(new Set(Object.values(expoTokensByUid).flat())).filter(Boolean);
    const fcmTokens  = Array.from(new Set(Object.values(fcmTokensByUid).flat())).filter(Boolean);

    logger.info('notifyOnDefiCreate: token types', {
      expo: expoTokens.length, fcm: fcmTokens.length
    });

    // 4) Payload commun
    const title = defi?.title ? `Nouveau défi: ${defi.title}` : 'Nouveau défi disponible';
    const verb  = defi?.type ? `${defi.type}x${defi.type}` : 'à relever';
    const body  =
      defi?.groupName && defi?.createdByName
        ? `${defi.createdByName} te lance un défi ${verb} dans ${defi.groupName}`
        : `Un défi ${verb} vient d’être créé. Viens le relever !`;

    const data = {
      action: 'OPEN_DEFI',
      defiId: String(defiId),
      groupId: String(groupId || ''),
      title,
      body,
    };

    let totalSuccess = 0;
    let totalFailure = 0;

    // 5A) Envoi Expo (si tokens Expo)
    if (expoTokens.length) {
      try {
        const result = await sendExpoPush(expoTokens, { title, body, data });
        logger.info('notifyOnDefiCreate: Expo push result', {
          sent: result.sent
        });
        totalSuccess += result.sent;
      } catch (e) {
        logger.error('notifyOnDefiCreate: Expo push failed', { error: e?.message || String(e) });
      }
    }

    // 5B) Envoi FCM (si tokens FCM)
    if (fcmTokens.length) {
      logger.info('notifyOnDefiCreate: tokens FCM (dedup)', {
        count: fcmTokens.length, sample: fcmTokens.slice(0, 3)
      });

      const messageBase = {
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: { channelId: 'challenges_v2' }, // ⚠️ doit exister côté app
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: { sound: 'default', badge: 1, 'content-available': 1 },
          },
        },
      };

      // FCM: chunks de ≤ 500 tokens
      const chunks = [];
      for (let i = 0; i < fcmTokens.length; i += 500) chunks.push(fcmTokens.slice(i, i + 500));

      for (const tks of chunks) {
        const resp = await messaging.sendEachForMulticast({ ...messageBase, tokens: tks });

        totalSuccess += resp.successCount;
        totalFailure += resp.failureCount;

        logger.info('notifyOnDefiCreate: FCM batch result', {
          batchSize: tks.length,
          successCount: resp.successCount,
          failureCount: resp.failureCount,
        });

        // Nettoyage tokens FCM invalides
        await Promise.all(
          resp.responses.map(async (r, idx) => {
            if (r.success) return;
            const tok = tks[idx];
            const code = r.error?.code || r.error?.message || 'unknown';
            logger.warn('FCM error for token', { token: tok, code });

            if (String(code).includes('registration-token-not-registered')) {
              await Promise.all(
                Array.from(uids).map(async (uid) => {
                  const pRef = db.collection('participants').doc(uid);
                  await pRef.update({ [`fcmTokens.${tok}`]: FieldValue.delete() }).catch(() => {});
                  await pRef.collection('fcm_tokens').doc(tok).delete().catch(() => {});
                })
              );
              logger.info('Removed invalid FCM token from Firestore', { token: tok });
            }
          })
        );
      }
    }

    logger.info('notifyOnDefiCreate: summary', {
      defiId, totalSuccess, totalFailure
    });
  } catch (err) {
    logger.error('notifyOnDefiCreate failed', { defiId, error: err?.message || String(err) });
  }
});