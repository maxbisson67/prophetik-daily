// app/groups/[groupId]/index.js
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Share, ScrollView, Modal, Image } from 'react-native';
import { useEffect, useMemo, useState, useRef, useCallback,useLayoutEffect } from 'react';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useFocusEffect } from '@react-navigation/native';

import { HeaderBackButton } from '@react-navigation/elements';

// Profils publics
import { usePublicProfile } from '@src/profile/usePublicProfile';
import { getNameAvatarFrom as _getNameAvatarFrom } from '@src/profile/getNameAvatar';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createDefi } from '@src/defis/api';


/* ----------------------------- Helpers NHL ----------------------------- */
async function fetchNhlDaySummary(gameDate) {
  if (!gameDate) return { count: 0, firstISO: null };
  const toInt = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(gameDate)}`);
    if (res.ok) {
      const data = await res.json();
      const day = Array.isArray(data?.gameWeek) ? data.gameWeek.find(d => d?.date === gameDate) : null;
      if (day) {
        const direct = toInt(day?.numberOfGames) ?? toInt(day?.totalGames);
        const games = Array.isArray(day?.games) ? day.games : [];
        const count = (direct ?? games.length) || 0;
        let firstISO = null;
        if (games.length) {
          const isos = games.map(g => g?.startTimeUTC || g?.startTimeUTCDate || g?.gameDate).filter(Boolean).sort();
          firstISO = isos[0] ?? null;
        }
        return { count, firstISO };
      }
      if (Array.isArray(data?.games)) {
        const games = data.games;
        const direct = toInt(data?.numberOfGames) ?? toInt(data?.totalGames);
        const count = (direct ?? games.length) || 0;
        const firstISO = games.length
          ? games.map(g => g?.startTimeUTC || g?.startTimeUTCDate || g?.gameDate).filter(Boolean).sort()[0] ?? null
          : null;
        return { count, firstISO };
      }
    }
  } catch {}
  try {
    const r2 = await fetch(`https://statsapi.web.nhl.com/api/v1/schedule?date=${encodeURIComponent(gameDate)}`);
    if (r2.ok) {
      const d2 = await r2.json();
      const day2 = (d2?.dates || []).find(x => x?.date === gameDate);
      const games2 = Array.isArray(day2?.games) ? day2.games : [];
      const count = games2.length;
      const firstISO = games2.length ? games2.map(g => g?.gameDate).filter(Boolean).sort()[0] ?? null : null;
      return { count, firstISO };
    }
  } catch {}
  return { count: 0, firstISO: null };
}

/* ----------------------------- Autres helpers ----------------------------- */
function fmtDate(ts) {
  try {
    const d = ts?.toDate?.() ?? (typeof ts === 'number' ? new Date(ts) : ts instanceof Date ? ts : null);
    if (!d) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '—'; }
}
function fmtLocalDate(d) {
  if (!(d instanceof Date)) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function resolveUid(m, group) {
  return (
    m?.uid || m?.userId || m?.participantId || m?.memberId || m?.ownerId ||
    (m?.role === 'owner' ? (group?.ownerId || group?.createdBy) : null) ||
    group?.createdBy || null
  );
}
function fmtLocalHHmmFromISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const ROW_HEIGHT = 28;
function DetailRow({ label, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: ROW_HEIGHT, marginBottom: 6 }}>
      <Text style={{ width: 130, fontWeight: '600', includeFontPadding: false, lineHeight: 18 }}>{label}</Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {typeof children === 'string'
          ? <Text style={{ includeFontPadding: false, lineHeight: 18 }}>{children}</Text>
          : children}
      </View>
    </View>
  );
}
function DetailRowWithAction({ label, value, onPress }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: ROW_HEIGHT, marginBottom: 6 }}>
      <Text style={{ width: 130, fontWeight: '600', includeFontPadding: false, lineHeight: 18 }}>{label}</Text>
      <Text style={{ flex: 1, marginRight: 8 }} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
      <TouchableOpacity
        onPress={onPress}
        style={{
          width: 26, height: 26, borderRadius: 6, borderWidth: 1, borderColor: '#111',
          alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9',
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <MaterialCommunityIcons name="share-variant" size={16} />
      </TouchableOpacity>
    </View>
  );
}
function getGroupEffectivePrice(group) {
  if (!group) return 5;
  return group.avatarId ? 1 : 5;
}

/* ---------- Normalisation de la forme renvoyée par usePublicProfile --------- */
function unwrapProfileShape(raw) {
  if (!raw) return null;

  // 1) Si le hook renvoie { profile: ... }
  let p = raw.profile ?? raw;

  // 2) DocumentSnapshot Firestore ?
  if (p && typeof p.data === 'function') {
    const d = p.data();
    if (d && typeof d === 'object') p = d;
  }

  // 3) { data: {...} }
  if (p && p.data && typeof p.data === 'object' && !Array.isArray(p.data)) {
    p = p.data;
  }

  // 4) { doc: {...} }
  if (p && p.doc && typeof p.doc === 'object') {
    const d = p.doc.data?.() ?? p.doc.data ?? p.doc;
    if (d && typeof d === 'object') p = d;
  }

  return (p && typeof p === 'object') ? p : null;
}

/* --------------------- Fallback pour nom/avatar manquants -------------------- */
function chooseNameAvatar(profile, membershipItem) {
  const name =
    profile?.displayName?.trim?.() ||
    profile?.name?.trim?.() ||
    membershipItem?.displayName?.trim?.() ||
    membershipItem?.name?.trim?.() ||
    null;

  const avatar =
    profile?.avatarUrl ||
    profile?.photoURL ||
    membershipItem?.avatarUrl ||
    membershipItem?.photoURL ||
    null;

  return { displayName: name, avatarUrl: avatar };
}

/* --------------------- Ligne membre (depuis profiles_public) --------------------- */
function MemberRow({ uid, role, item }) {
  const pubRaw = usePublicProfile(uid);
  const profile = unwrapProfileShape(pubRaw);

  // Essaye d'abord ton utilitaire si présent
  let utilName = null, utilAvatar = null;
  try {
    if (typeof _getNameAvatarFrom === 'function') {
      const extracted = _getNameAvatarFrom(profile) || {};
      utilName = extracted.displayName || null;
      utilAvatar = extracted.avatarUrl || null;
    }
  } catch {}

  const fallback = chooseNameAvatar(profile, item);
  const displayName = utilName || fallback.displayName || 'Invité';
  const avatarUrl   = utilAvatar || fallback.avatarUrl || null;

  if (__DEV__ && !displayName) {
    console.log('[MemberRow] No displayName for uid:', uid, 'profile keys:', profile ? Object.keys(profile) : null);
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 8,
        backgroundColor: '#fff'
      }}
    >
      <Image
        source={avatarUrl ? { uri: avatarUrl } : require('@src/assets/avatar-placeholder.png')}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700' }}>{displayName || 'Invité'}</Text>
        {!!role && <Text style={{ color: '#6b7280', fontSize: 12 }}>{String(role)}</Text>}
      </View>
    </View>
  );
}

/* ----------------------------- Écran ----------------------------- */
export default function GroupDetailScreen() {
  const { user } = useAuth();
  const r = useRouter();
  const params = useLocalSearchParams();
  const openCreateParam = params?.openCreate;

  const id = useMemo(() => {
    const raw = params.groupId;
    return Array.isArray(raw) ? String(raw[0]) : String(raw || '');
  }, [params.groupId]);

  const initial = useMemo(() => {
    try { return params.initial ? JSON.parse(params.initial) : null; } catch { return null; }
  }, [params.initial]);

  const navigation = useNavigation();
 
  useLayoutEffect(() => {
    const goToGroupsTab = () => {
      // Remplace l’écran détail par l’onglet Groupes (pas d’empilement infini)
      r.replace('/(drawer)/(tabs)/GroupsScreen');
    };

    navigation.setOptions({
      title: group?.name || 'Groupe',
      headerLeft: ({ tintColor }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={goToGroupsTab} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="arrow-back" size={24} color={tintColor} />
          </TouchableOpacity>
          <DrawerToggleButton tintColor={tintColor} />
        </View>
      ),
    });
  }, [navigation, r, group?.name]);

  useFocusEffect(
    useCallback(() => {
      const onBeforeRemove = (e) => {
        // Empêche le back natif (hardware, swipe, bouton du header par défaut)
        e.preventDefault();
        // Envoie toujours vers l’onglet Groupes
        r.replace('/(drawer)/(tabs)/GroupsScreen');
      };
      const sub = navigation.addListener('beforeRemove', onBeforeRemove);
      return sub; // unsubscribe on blur/unmount
    }, [navigation, r])
  );


  const [group, setGroup] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);
  const [memberships, setMemberships] = useState([]);

  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState('idle');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyCount, setVerifyCount] = useState(null);
  const [verifyFirstISO, setVerifyFirstISO] = useState(null);

  const SIZES = ['1x1', '2x2', '3x3', '4x4', '5x5'];
  const [openCreate, setOpenCreate] = useState(false);
  const [size, setSize] = useState('1x1');
  const [gameDay, setGameDay] = useState(new Date());
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [creating, setCreating] = useState(false);



  useEffect(() => {
    if (openCreateParam === '1') {
      setOpenCreate(true);
      try { r.setParams({ openCreate: undefined }); } catch {}
    }
  }, [openCreateParam, r]);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError(null);
    const ref = doc(db, 'groups', id);
    const unsub = onSnapshot(
      ref,
      (snap) => { setGroup(snap.exists() ? ({ id: snap.id, ...snap.data() }) : null); setLoading(false); },
      (e) => { setError(e); setLoading(false); }
    );
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const qM = query(collection(db, 'group_memberships'), where('groupId', '==', id));
    const unsub = onSnapshot(qM, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const activeRows = rows.filter(m => (m.status ? m.status === 'active' : (m.active === true || m.active === undefined)));
      const norm = activeRows.map(m => ({ ...m, role: String(m.role || 'member').toLowerCase() }));
      setMemberships(norm);
    });
    return () => unsub();
  }, [id]);

  const normalizedMemberships = useMemo(
    () => memberships
      .map(m => ({ ...m, uidNorm: resolveUid(m, group) }))
      .filter(m => !!m.uidNorm),
    [memberships, group]
  );

  const memberList = useMemo(
    () => normalizedMemberships.filter(m => ['member', 'owner'].includes(m.role)),
    [normalizedMemberships]
  );

  const name = group?.name;
  const codeInvitation = group?.codeInvitation;
  const createdAt = group?.createdAt;
  const isPrivate = group?.isPrivate;

  const inviteMessage = `Rejoins mon groupe "${name || id}" dans Prophetik-daily.\nCode: ${codeInvitation ?? '—'}\nID: ${group?.id || id}`;
  const onShareInvite = async () => {
    try { await Share.share({ message: inviteMessage }); }
    catch (e) { Alert.alert('Partage impossible', String(e?.message ?? e)); }
  };

  const nType = useMemo(() => {
    const n = parseInt(String(size).split('x')[0], 10);
    return Number.isFinite(n) ? n : 0;
  }, [size]);
  const participationCost = nType;
  const computedTitle = `Défi ${size}`;
  const gameDateStr = useMemo(() => fmtLocalDate(gameDay), [gameDay]);

  const verifyDate = useCallback(async () => {
    setVerifying(true);
    setVerifyStatus('idle');
    setVerifyMsg('');
    try {
      const { count, firstISO } = await fetchNhlDaySummary(gameDateStr);
      setVerifyCount(count);
      setVerifyFirstISO(firstISO);

      if (!count) {
        setVerifyStatus('none');
        setVerifyMsg(`Aucun match NHL le ${gameDateStr}.`);
        return;
      }

      const timeMsg = firstISO ? ` Premier match à ${fmtLocalHHmmFromISO(firstISO)}.` : '';
      setVerifyStatus('ok');
      setVerifyMsg(`${count} match(s) trouvé(s).${timeMsg}`);
    } catch (e) {
      setVerifyStatus('error');
      setVerifyMsg(`Impossible de vérifier: ${String(e?.message || e)}`);
      setVerifyCount(0);
      setVerifyFirstISO(null);
    } finally {
      setVerifying(false);
    }
  }, [gameDateStr]);

  useEffect(() => { if (openCreate) verifyDate(); }, [openCreate, verifyDate]);
  useEffect(() => { if (openCreate) verifyDate(); }, [gameDateStr, openCreate, verifyDate]);

  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - 60 * 60 * 1000);
  }, [verifyFirstISO]);

  const canCreate = useMemo(() => true, [verifyCount, signupDeadlineLocal]);

  async function handleCreateDefi() {
    if (!group?.id) return;
    if (!verifyCount) {
      Alert.alert('Aucun match NHL', `Aucun match trouvé pour le ${gameDateStr}.`);
      return;
    }
    setCreating(true);
    try {
      let firstISO = verifyFirstISO;
      if (!firstISO) {
        const { count, firstISO: fromApi } = await fetchNhlDaySummary(gameDateStr);
        if (!count) {
          Alert.alert('Aucun match NHL', `Aucun match trouvé pour le ${gameDateStr}.`);
          return;
        }
        firstISO = fromApi;
      }
      const firstGameDate = new Date(firstISO);
      const signupDeadline = new Date(firstGameDate);
      signupDeadline.setHours(signupDeadline.getHours() - 1);

      const now = new Date();
      if (now >= signupDeadline) {
        const hh = String(signupDeadline.getHours()).padStart(2, '0');
        const mm = String(signupDeadline.getMinutes()).padStart(2, '0');
        Alert.alert('Trop tard', `La limite d’inscription pour ${gameDateStr} était ${hh}:${mm}. Impossible de créer le défi.`);
        return;
      }

      await createDefi({
        groupId: group.id,
        title: computedTitle,
        type: nType,
        gameDate: gameDateStr,
        createdBy: user?.uid,
        participationCost,
        status: 'open',
        pot: 0,
        firstGameUTC: firstGameDate,
        signupDeadline,
        ...( __DEV__ ? { debugNotifyCreator: true } : {} )
      });

      setOpenCreate(false);
      setSize('1x1');
      setGameDay(new Date());
      setVerifyStatus('idle'); setVerifyMsg('');
      setVerifyCount(null); setVerifyFirstISO(null);
      r.replace({ pathname: '/(drawer)/(tabs)/ChallengesScreen', params: { groupId: group.id } });
    } catch (e) {
      Alert.alert('Création impossible', String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Chargement…'}} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
          <Text>Chargement du groupe…</Text>
        </View>
      </>
    );
  }
  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Erreur'}} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Erreur : {String(error?.message || error)}</Text>
          <Text style={{ marginTop:6 }}>ID: {id}</Text>
        </View>
      </>
    );
  }
  if (!group) {
    return (
      <>
        <Stack.Screen options={{ title: 'Groupe introuvable' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Aucun groupe trouvé (ID: {id})</Text>
        </View>
      </>
    );
  }

  const effectivePrice = getGroupEffectivePrice(group);
  const isOwner =
    !!user?.uid && (
      group?.ownerId === user.uid ||
      group?.createdBy === user.uid ||
      (memberships || []).some(m => {
        const uidNorm = m?.uidNorm || m?.uid || m?.participantId;
        return uidNorm === user.uid && String(m?.role || '').toLowerCase() === 'owner';
      })
    );

  return (
    <>
      <Stack.Screen
        options={{
          title: group?.name || 'Groupe',
          // on reconstruit manuellement la zone gauche
          headerLeft: ({ tintColor }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Back d’abord, si possible */}
              {navigation.canGoBack() && (
                <HeaderBackButton
                  tintColor={tintColor}
                  onPress={() => navigation.goBack()}
                />
              )}
              {/* Puis le hamburger du Drawer */}
              <DrawerToggleButton tintColor={tintColor} />
            </View>
          ),
        
        }}
      />

      <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
        {/* === Carte Avatar de groupe === */}
        <View style={{
          padding:14,
          borderWidth:1,
          borderRadius:12,
          backgroundColor:'#fff',
          borderColor:'#eee',
          elevation:3,
          shadowColor:'#000',
          shadowOpacity:0.08,
          shadowRadius:6,
          shadowOffset:{width:0,height:3}
        }}>
          <View style={{ alignItems:'center' }}>
            <Image
              source={group?.avatarUrl ? { uri: group.avatarUrl } : require('@src/assets/group-placeholder.png')}
              style={{ width:120, height:120, borderRadius:60, backgroundColor:'#f3f4f6', borderWidth:2, borderColor:'#eee' }}
            />
            <Text style={{ fontWeight:'800', fontSize:18, marginTop:10 }}>
              {group?.name || group?.title || 'Groupe'}
            </Text>
          
          </View>

          <View style={{ marginTop:12 }}>
            {isOwner ? (
              <TouchableOpacity
                onPress={() => r.push({ pathname:'/avatars/GroupAvatarsScreen', params: { groupId: group.id } })}
                style={{
                  backgroundColor:'#ef4444',
                  paddingVertical:12,
                  paddingHorizontal:20,
                  borderRadius:10,
                  alignItems:'center',
                  justifyContent:'center',
                  elevation:2
                }}
              >
                <Text style={{ color:'#fff', fontWeight:'900' }}>
                  {effectivePrice === 1
                    ? 'Modifier l’avatar du groupe (1 crédit)'
                    : 'Acheter un avatar de groupe (5 crédits)'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor:'#e5e7eb', paddingVertical:12, borderRadius:10, alignItems:'center' }}>
                <Text style={{ color:'#374151', fontWeight:'700' }}>Seul le propriétaire peut changer l’avatar</Text>
              </View>
            )}
          </View>
        </View>

        {/* Carte Détails */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12 }}>
          <Text style={{ fontWeight:'800', marginBottom: 4, textAlign:'center' }}>Détails</Text>
          <DetailRow label="Type de groupe">{group?.isPrivate ? 'Privé' : 'Public'}</DetailRow>
          {!!codeInvitation && (
            <DetailRowWithAction label="Code d’invitation" value={codeInvitation} onPress={onShareInvite} />
          )}
          <DetailRow label="Créé le">{fmtDate(group?.createdAt)}</DetailRow>
          {!!group?.signupDeadline && (
            <DetailRow label="Inscription jusqu’à">{fmtDate(group.signupDeadline)}</DetailRow>
          )}
        </View>

        {/* Carte Membres (depuis profiles_public) */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor: "#fff"  }}>
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Membres du groupe</Text>
          </View>
          {memberList.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, color: '#6b7280' }}>Aucun membre.</Text>
          ) : (
            memberList.map((m) => (
              <MemberRow key={m.id || m.uidNorm} uid={m.uidNorm} role={m.role} item={m} />
            ))
          )}
        </View>

        {/* Carte Actions */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12, gap:8 }}>
          <Text style={{ fontWeight:'700', textAlign:'center' }}>Actions</Text>
          <TouchableOpacity onPress={() => setOpenCreate(true)} style={{ backgroundColor:'#111', padding:14, borderRadius:10, alignItems:'center' }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>Créer un défi</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onShareInvite} style={{ backgroundColor:'#f2f2f2', padding:14, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#e5e5e5' }}>
            <Text style={{ fontWeight:'600' }}>
              Partager le code d’invitation{codeInvitation ? ` (${codeInvitation})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('À venir', 'Quitter le groupe sera implémenté prochainement.')}
            style={{ backgroundColor:'#fff5f5', padding:14, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#ffd6d6' }}
          >
            <Text style={{ fontWeight:'600', color:'#b00020' }}>Quitter ce groupe</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Création Défi */}
      <Modal visible={openCreate} animationType="slide" onRequestClose={() => setOpenCreate(false)}>
        <ScrollView contentContainerStyle={{ padding:16, gap:12 }}>
          <Text style={{ fontSize:18, fontWeight:'700' }}>Nouveau défi</Text>

          <View style={{
            marginTop: 4,
            marginBottom: 8,
            padding: 10,
            borderWidth: 1,
            borderRadius: 10,
            borderColor: '#eee',
            backgroundColor: '#fafafa'
          }}>
            <Text style={{ fontSize:12, color:'#6b7280' }}>Groupe</Text>
            <Text style={{ fontWeight:'800', fontSize:16, marginTop:2 }}>
              {group?.name || group?.title || `ID: ${group?.id || id}`}
            </Text>
          </View>

          <Text style={{ fontWeight:'600' }}>Format du défi</Text>
          <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
            {SIZES.map((s) => {
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(s)}
                  style={{
                    paddingVertical:8, paddingHorizontal:12, borderWidth:1, borderRadius:999,
                    borderColor: active ? '#111' : '#ccc',
                    backgroundColor: active ? '#111' : '#fff',
                  }}
                >
                  <Text style={{ color: active ? '#fff' : '#111', fontWeight:'700' }}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ padding:12, borderWidth:1, borderRadius:10, gap:6, backgroundColor:'#fafafa' }}>
            <View style={{ flexDirection:'row' }}>
              <Text style={{ width: 160, fontWeight:'600' }}>Titre</Text>
              <Text>{`Défi ${size}`}</Text>
            </View>
            <View style={{ flexDirection:'row' }}>
              <Text style={{ width: 160, fontWeight:'600' }}>Coût participation</Text>
              <Text>{nType} crédit(s)</Text>
            </View>
          </View>

          <Text style={{ fontWeight:'600' }}>
            {`Date NHL${
              verifyCount != null
                ? ` (${verifyCount} match(s)${
                    verifyFirstISO ? ` – 1er à ${fmtLocalHHmmFromISO(verifyFirstISO)}` : ''
                  }${
                    signupDeadlineLocal
                      ? ` – Limite ${String(signupDeadlineLocal.getHours()).padStart(2,'0')}:${String(signupDeadlineLocal.getMinutes()).padStart(2,'0')}`
                      : ''
                  })`
                : ''
            }`}
          </Text>
          {verifyCount != null && (
            <Text style={{ fontSize:12, marginTop:4, color: canCreate ? '#0a7' : '#b00020' }}>
              {canCreate ? 'Tu peux créer ce défi.' : 'Trop tard : la limite d’inscription est dépassée.'}
            </Text>
          )}

          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <View style={{ flex:1, padding:12, borderWidth:1, borderRadius:10 }}>
              <Text style={{ fontWeight:'600' }}>{gameDateStr}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setShowDayPicker(true); }}
              style={{ paddingVertical:10, paddingHorizontal:12, borderRadius:10, borderWidth:1 }}
            >
              <Text>Changer</Text>
            </TouchableOpacity>
          </View>
          {showDayPicker && (
            <DateTimePicker
              value={gameDay}
              mode="date"
              onChange={(e, d) => {
                setShowDayPicker(false);
                if (d) {
                  const norm = new Date(d);
                  norm.setHours(0,0,0,0);
                  setGameDay(norm);
                }
              }}
            />
          )}

          <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
            <TouchableOpacity
              onPress={() => setOpenCreate(false)}
              style={{ flex:1, padding:12, borderRadius:10, borderWidth:1, alignItems:'center' }}
              disabled={creating}
            >
              <Text>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreateDefi}
              disabled={creating || !verifyCount || !canCreate}
              style={{
                flex:1, padding:12, borderRadius:10,
                backgroundColor:(creating || !verifyCount || !canCreate) ? '#6b7280' : '#111',
                alignItems:'center'
              }}
            >
              <Text style={{ color:'#fff', fontWeight:'700' }}>
                {creating ? 'Création…' : 'Créer'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color:'#666', fontSize:12, marginTop:8 }}>
            La limite d’inscription est fixée à 1h avant le premier match (heure locale).
          </Text>
        </ScrollView>
      </Modal>
    </>
  );
}