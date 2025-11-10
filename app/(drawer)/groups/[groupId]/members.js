// app/groups/[groupId]/members.js
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import MembersTable from '@src/groups/components/MembersTable';

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

// Normalise un document group_membership
function normaliseMembership(m) {
  const uid = m.uid || m.userId || m.participantId || m.memberId || null;
  const role = String(m.role ?? 'member').trim().toLowerCase();
  const status = m.status ?? (m.active === false ? 'inactive' : 'active');
  return { ...m, uid, role, status };
}

export default function GroupMembersScreen() {
  const params = useLocalSearchParams();
  const id = useMemo(() => {
    const raw = params.groupId;
    return Array.isArray(raw) ? String(raw[0]) : String(raw || '');
  }, [params.groupId]);

  const [memberships, setMemberships] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const participantsUnsubsRef = useRef(new Map());
  const prevUidsRef = useRef(new Set());
  const prevMembershipSigRef = useRef('');

  // 1) Abonnement aux memberships du groupe
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const qM = query(collection(db, 'group_memberships'), where('groupId', '==', id));
    const un = onSnapshot(
      qM,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).map(normaliseMembership);
        const active = rows.filter((m) => m.status === 'active');
        const onlyMembers = active.filter((m) => m.role === 'member');

        // signature pour éviter les setState inutiles
        const sig = onlyMembers
          .map((m) => `${m.uid || ''}|${m.role}|${m.id}`)
          .sort()
          .join('~');

        if (sig !== prevMembershipSigRef.current) {
          prevMembershipSigRef.current = sig;
          setMemberships(onlyMembers);
        }
        setLoading(false);
      },
      (e) => {
        setError(e);
        setLoading(false);
      }
    );
    return () => un();
  }, [id]);

  // 2) Abonnement aux profils participants/{uid}
  useEffect(() => {
    const uidsArr = Array.from(new Set(memberships.map((m) => m.uid).filter(Boolean)));
    const nextUids = new Set(uidsArr);
    const prevUids = prevUidsRef.current;

    if (setsEqual(prevUids, nextUids)) return;

    // Retirer les listeners obsolètes
    for (const [uid, un] of participantsUnsubsRef.current) {
      if (!nextUids.has(uid)) {
        try {
          un();
        } catch {}
        participantsUnsubsRef.current.delete(uid);
      }
    }

    // Batch des updates
    let pending = {};
    let scheduled = false;
    const flush = () => {
      if (!scheduled) return;
      setParticipantsMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [uid, val] of Object.entries(pending)) {
          if (!shallowEqual(prev[uid], val)) {
            next[uid] = val;
            changed = true;
          }
        }
        pending = {};
        scheduled = false;
        return changed ? next : prev;
      });
    };

    // Ajouter les nouveaux listeners
    for (const uid of nextUids) {
      if (participantsUnsubsRef.current.has(uid)) continue;
      const pref = doc(db, 'participants', uid);
      const un = onSnapshot(
        pref,
        (snap) => {
          pending[uid] = snap.exists() ? { uid, ...snap.data() } : { uid };
          scheduled = true;
          Promise.resolve().then(flush);
        },
        () => {
          pending[uid] = { uid };
          scheduled = true;
          Promise.resolve().then(flush);
        }
      );
      participantsUnsubsRef.current.set(uid, un);
    }

    prevUidsRef.current = nextUids;
  }, [memberships]);

  // 3) Cleanup à l’unmount
  useEffect(
    () => () => {
      for (const [, un] of participantsUnsubsRef.current) {
        try {
          un();
        } catch {}
      }
      participantsUnsubsRef.current.clear();
      prevUidsRef.current = new Set();
      prevMembershipSigRef.current = '';
    },
    []
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text>Chargement des membres…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text>Erreur : {String(error?.message || error)}</Text>
      </View>
    );
  }

  return <MembersTable members={memberships} participantsMap={participantsMap} />;
}