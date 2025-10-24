// src/auth/AuthProvider.js
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

import { db } from '@src/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

import {
  registerCurrentFcmToken,
  startFcmTokenRefreshListener,
  stopFcmTokenRefreshListener,
} from '@src/lib/push/registerFcmToken';

const AuthCtx = createContext(undefined);

// Dédup simple au niveau module pour l'enregistrement du token push
let __lastRegisteredUid = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true après le 1er onAuthStateChanged
  const tokenListenerUidRef = useRef(null);

  // --- Nouveau: état Firestore participant + profil fusionné
  const [participant, setParticipant] = useState(null);
  const [participantReady, setParticipantReady] = useState(false); // prêt après 1er snapshot (ou sign-out)

  // Écoute de l'état d'auth (SDK Web)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setReady(true);

      // Reset dédup si l'UID change
      const uid = u?.uid || null;
      if (__lastRegisteredUid && __lastRegisteredUid !== uid) {
        __lastRegisteredUid = null;
      }
    });
    return unsubscribe;
  }, []);

  // Enregistre/MAJ le token push + lance l'écoute "refresh" une seule fois par UID
  useEffect(() => {
    const uid = user?.uid || null;

    if (!uid) {
      // plus d'utilisateur => stop listener
      if (tokenListenerUidRef.current) {
        stopFcmTokenRefreshListener();
        tokenListenerUidRef.current = null;
      }
      return;
    }

    if (__lastRegisteredUid === uid) return; // déjà fait pour cet UID
    __lastRegisteredUid = uid;

    (async () => {
      try {
        await registerCurrentFcmToken(uid);
        stopFcmTokenRefreshListener();
        startFcmTokenRefreshListener(uid);
        tokenListenerUidRef.current = uid;
      } catch (err) {
        console.log('Push setup failed:', err?.message || String(err));
      }
    })();
  }, [user?.uid]);

  // --- Nouveau: abonnement Firestore au document participant/{uid}
  useEffect(() => {
    // reset à chaque changement d'utilisateur
    setParticipant(null);
    setParticipantReady(false);

    const uid = user?.uid;
    if (!uid) {
      // pas connecté => on considère participant prêt (null)
      setParticipantReady(true);
      return;
    }

    const ref = doc(db, 'participants', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setParticipant({ id: snap.id, ...snap.data() });
        } else {
          setParticipant(null);
        }
        setParticipantReady(true);
      },
      (err) => {
        console.log('participants onSnapshot error:', err?.message || err);
        setParticipant(null);
        setParticipantReady(true); // ne bloque pas l'app
      }
    );

    return () => {
      try { unsub(); } catch {}
    };
  }, [user?.uid]);

  // Profil fusionné pratique pour l’UI (fallback sur l’objet Firebase)
  const profile = {
    displayName: participant?.displayName ?? user?.displayName ?? null,
    photoURL: participant?.photoURL ?? user?.photoURL ?? null,
    email: participant?.email ?? user?.email ?? null,
  };

  const doSignOut = async () => {
    try {
      __lastRegisteredUid = null;
      stopFcmTokenRefreshListener();
      tokenListenerUidRef.current = null;
      await fbSignOut(auth);
      // La redirection est gérée par _layout (AuthGateMount)
    } catch (e) {
      console.log('Sign out failed:', e?.code || e?.message || String(e));
    }
  };

  const booting = !ready; // compat historique
  const fullyReady = ready && participantReady; // si tu veux savoir quand tout est hydraté

  return (
    <AuthCtx.Provider
      value={{
        user,
        participant,        // ← Firestore (peut être null)
        profile,            // ← fusion pratique pour l’UI
        ready: fullyReady,  // ← devient true quand auth + participant sont prêts
        booting,            // optionnel: garde l’ancien sémantique
        signOut: doSignOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}