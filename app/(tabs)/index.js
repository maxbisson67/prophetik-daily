// app/(tabs)/index.js — Accueil engageant (Expo Router + ton Auth/Firestore)

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// ✅ Tes hooks & Firebase (chemins adaptés à ton projet)
import { useAuth } from '../../src/auth/AuthProvider';
import { db } from '../../src/lib/firebase';

import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';

// -------- Utils
function todayKey() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// -------- Firestore helpers
async function getUserDailyCredits(uid) {
  let dailyLimit = 5;
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data()?.credits?.dailyLimit != null) {
    dailyLimit = userSnap.data().credits.dailyLimit;
  }
  const cRef = doc(db, 'userSelections', uid, 'byDay', todayKey());
  const cSnap = await getDoc(cRef);
  const used = cSnap.exists() ? (cSnap.data()?.creditsUsed ?? 0) : 0;
  return { used, dailyLimit };
}

function listenUserGroups(uid, cb) {
  // Remplace par ton useGroups si tu l’as
  const q = query(collection(db, 'memberships'), where('uid', '==', uid));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => d.data())));
}

function listenUserChallenges(uid, cb) {
  const q = query(collection(db, 'challenges'), where('participants', 'array-contains', uid));
  return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

async function getFunFact() {
  try {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const ref = doc(db, 'funFacts', `${mm}-${dd}`);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data().text;
  } catch {}
  return "Le saviez-vous? Gretzky détient des dizaines de records de la LNH.";
}

// -------- Écran Accueil
export default function HomeScreen() {
  const r = useRouter();
  const { user, initializing } = useAuth();
  const [credits, setCredits] = useState({ used: 0, dailyLimit: 5 });
  const [groupsCount, setGroupsCount] = useState(0);
  const [activeChallenges, setActiveChallenges] = useState(0);
  const [fact, setFact] = useState('');

  useEffect(() => {
    if (!user) return;
    getUserDailyCredits(user.uid).then(setCredits);
    getFunFact().then(setFact);

    const unsubG = listenUserGroups(user.uid, (mships) => setGroupsCount(mships.length));
    const unsubC = listenUserChallenges(user.uid, (chs) => {
      const active = chs.filter(c => c.status === 'active').length;
      setActiveChallenges(active);
    });
    return () => { unsubG?.(); unsubC?.(); };
  }, [user?.uid]);

  const tiles = useMemo(() => ([
    { title: 'Mes groupes', subtitle: groupsCount ? `${groupsCount}` : null, onPress: () => r.push('/(tabs)/GroupsScreen') },
    { title: 'Mes défis', subtitle: activeChallenges ? 'En cours' : '—', onPress: () => r.push('/(tabs)/ChallengesScreen') },
    { title: 'Résultats', subtitle: 'Mes joueurs', onPress: () => r.push('/(tabs)/ResultsScreen') },
  ]), [groupsCount, activeChallenges]);

  if (initializing) {
    return <View style={S.center}><Text>Initialisation…</Text></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
    <ScrollView style={S.page} contentContainerStyle={S.container}>
      {/* Hero */}
      <View style={S.hero}>
        <View style={S.pill}><Text style={S.pillText}>MTL 2 – 1 2E</Text></View>
        <Text style={S.heroTitle}>Vos joueurs jouent ce soir !</Text>
      </View>

      {/* Crédits */}
      <View style={S.cardWhite}>
        <Text style={S.cardTitle}>Crédits restants aujourd’hui</Text>
        <Text style={S.creditsValue}>{Math.max(0, credits.dailyLimit - credits.used)}/{credits.dailyLimit}</Text>
      </View>

      {/* Activités */}
      <Text style={S.sectionTitle}>Mes activités</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {tiles.map((t, i) => (
          <Pressable key={i} onPress={t.onPress} style={S.tile}>
            <Text style={S.tileTitle}>{t.title}</Text>
            {t.subtitle ? (
              <View style={S.badge}><Text style={S.badgeText}>{t.subtitle}</Text></View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      {/* CTAs */}
      <Pressable onPress={() => r.push('/create-challenge')} style={S.ctaPrimary}>
        <Text style={S.ctaText}>🎯 Créer un défi</Text>
      </Pressable>
      <Pressable onPress={() => r.push('/join-group')} style={S.ctaSecondary}>
        <Text style={S.ctaTextDark}>👥 Rejoindre un groupe</Text>
      </Pressable>

      {/* Fait marquant */}
      <View style={S.cardWhite}>
        <Text style={S.cardHeader}>Le fait marquant du jour</Text>
        <Text style={S.cardBody}>{fact}</Text>
      </View>

      {/* Top performers */}
      <View style={S.cardWhite}>
        <Text style={S.cardHeader}>Top performers de la soirée</Text>
        <Text style={S.cardBody}>À venir après les matchs…</Text>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
    </SafeAreaView>
  );
}

// -------- Styles
const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f3f4f6' },
  container: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hero: { backgroundColor: '#e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 },
  pill: { alignSelf: 'flex-start', backgroundColor: '#d1d5db', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  pillText: { fontWeight: '600' },
  heroTitle: { fontSize: 18, fontWeight: '700' },

  cardWhite: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  creditsValue: { fontSize: 24, fontWeight: '800', marginTop: 6 },

  sectionTitle: { fontSize: 20, fontWeight: '800', marginVertical: 8 },
  tile: { backgroundColor: '#e5e7eb', borderRadius: 16, padding: 16, marginRight: 10, width: 160 },
  tileTitle: { fontWeight: '700', marginBottom: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12 },

  ctaPrimary: { backgroundColor: '#e5e7eb', borderRadius: 16, padding: 16, marginBottom: 12 },
  ctaSecondary: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  ctaText: { fontSize: 16 },
  ctaTextDark: { fontSize: 16, color: '#111827' },

  cardHeader: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  cardBody: { fontSize: 15, color: '#374151' },
});