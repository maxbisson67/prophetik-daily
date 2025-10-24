// functions/sendTestPush.js
import { onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * Callable publique de test : envoie une notif FCM à un uid.
 * data = {
 *   uid: string,
 *   title?: string,
 *   body?: string,
 *   deviceToken?: string  // 👈 token courant du device, optionnel mais recommandé
 * }
 *
 * Stratégie :
 * - Si deviceToken présent : on n’envoie QU’A ce token (zéro ambiguïté)
 *   - S’il n’est pas en base, on l’ajoute au map fcmTokens et à la sous-collec.
 * - Sinon (legacy) : on envoie à tous les tokens en base (map + sous-collec).
 * - On nettoie automatiquement les tokens invalides (registration-token-not-registered).
 */
export const sendTestPush = onCall(
  {
    cors: true,
    invoker: 'public',
    region: 'us-central1',
  },
  async (req) => {
    logger.info('sendTestPush: context', {
      authUid: req.auth?.uid || null,
      appId: req.app?.appId || null,
    });

    const targetUid   = req?.data?.uid;
    const incomingTok = (req?.data?.deviceToken || '').trim();
    const title = req?.data?.title || 'Test push';
    const body  = req?.data?.body  || 'Si tu vois ceci, FCM est OK.';
    if (!targetUid) throw new Error('uid requis');

    const pRef  = db.collection('participants').doc(targetUid);
    const pSnap = await pRef.get();
    if (!pSnap.exists) throw new Error('participant introuvable');

    const p = pSnap.data() || {};
    const tokensSet = new Set();

    // 1) Si le client envoie le token courant → priorité à celui-ci
    if (incomingTok && !incomingTok.startsWith('ExponentPushToken')) {
      tokensSet.add(incomingTok);

      // Ajoute/merge en base si manquant
      const mapHas = !!p?.fcmTokens?.[incomingTok];
      if (!mapHas) {
        await pRef.update({ [`fcmTokens.${incomingTok}`]: true }).catch(async () => {
          // si fcmTokens n'existe pas encore
          await pRef.set({ fcmTokens: { [incomingTok]: true } }, { merge: true });
        });
      }
      await pRef
        .collection('fcm_tokens')
        .doc(incomingTok)
        .set({ token: incomingTok, updatedAt: new Date(), source: 'sendTestPush' }, { merge: true });
    } else {
      // 2) Legacy : sinon on agrège tous les tokens depuis Firestore (map + sous-collec)
      if (p.fcmTokens && typeof p.fcmTokens === 'object') {
        for (const k of Object.keys(p.fcmTokens)) {
          if (k && !k.startsWith('ExponentPushToken')) tokensSet.add(k);
        }
      }
      const sub = await pRef.collection('fcm_tokens').get();
      sub.forEach((d) => {
        const t = d.data()?.token;
        if (t && !t.startsWith('ExponentPushToken')) tokensSet.add(t);
      });
    }

    const tokens = Array.from(tokensSet);
    if (tokens.length === 0) {
      logger.warn('sendTestPush: aucun token FCM', { targetUid, incomingTok: !!incomingTok });
      return { successCount: 0, failureCount: 0, tokens: [], errors: [] };
    }

    // 3) Envoi FCM – force un channel Android "challenges_v2" si présent côté app
    const resp = await messaging.sendEachForMulticast({
      //notification: { title, body },
      data: { action: 'TEST_PUSH' },
      android: {
        priority: 'high',
        notification: { channelId: 'challenges_v2' },
      },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      tokens,
    });

    // 4) Gestion des erreurs & cleanup des tokens invalides
    const errors = [];
    await Promise.all(
      resp.responses.map(async (r, i) => {
        if (r.success) return;
        const tok  = tokens[i];
        const code = r.error?.code || '';
        const msg  = r.error?.message || '';
        errors.push({ token: tok, code, message: msg });

        if (code.includes('registration-token-not-registered')) {
          try {
            await pRef.update({ [`fcmTokens.${tok}`]: FieldValue.delete() });
          } catch (e) {
            logger.warn('Cleanup map failed', { token: tok, err: e?.message });
          }
          try {
            await pRef.collection('fcm_tokens').doc(tok).delete();
          } catch (_) {}
          logger.info('Removed invalid FCM token from Firestore', { token: tok, uid: targetUid });
        }
      })
    );

    logger.info('sendTestPush summary', {
      successCount: resp.successCount,
      failureCount: resp.failureCount,
      usedDeviceToken: !!incomingTok,
      sampleTokens: tokens.slice(0, 2),
    });

    return {
      successCount: resp.successCount,
      failureCount: resp.failureCount,
      usedDeviceToken: !!incomingTok,
      tokens,
      errors,
    };
  }
);