// app/groups/[groupId]/index.js
import { View, Text, ActivityIndicator, TouchableOpacity, Alert, Share, ScrollView, Modal, Image } from 'react-native';
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useLocalSearchParams, Link, Stack, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createDefi } from '@src/defis/api';

/* ----------------------------- Helpers NHL ----------------------------- */

// Résumé NHL strict pour "YYYY-MM-DD" via api-web (gameWeek->day) puis fallback statsapi
async function fetchNhlDaySummary(gameDate) {
  if (!gameDate) return { count: 0, firstISO: null };

  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // 1) Source principale
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(gameDate)}`);
    if (res.ok) {
      const data = await res.json();

      const day = Array.isArray(data?.gameWeek)
        ? data.gameWeek.find(d => d?.date === gameDate)
        : null;

      if (day) {
        const direct = toInt(day?.numberOfGames) ?? toInt(day?.totalGames);
        const games = Array.isArray(day?.games) ? day.games : [];
        const count = (direct ?? games.length) || 0;

        let firstISO = null;
        if (games.length) {
          const isos = games
            .map(g => g?.startTimeUTC || g?.startTimeUTCDate || g?.gameDate)
            .filter(Boolean)
            .sort();
          firstISO = isos[0] ?? null;
        }
        return { count, firstISO };
      }

      // fallback du même endpoint
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

  // 2) Fallback: statsapi
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
    if (!d) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return null; }
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

// Lignes uniformes
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

/* -------- Prix dynamique avatar groupe : 5 (premier) / 1 (changement) -------- */
function getGroupEffectivePrice(group) {
  if (!group) return 5;
  return group.avatarId ? 1 : 5;
}

/* ----------------------------- Écran ----------------------------- */

export default function GroupDetailScreen() {
  // Auth & nav
  const { user } = useAuth();
  const r = useRouter();
  const params = useLocalSearchParams();
  const openCreateParam = params?.openCreate;

  // Params
  const id = useMemo(() => {
    const raw = params.groupId;
    return Array.isArray(raw) ? String(raw[0]) : String(raw || '');
  }, [params.groupId]);

  const initial = useMemo(() => {
    try { return params.initial ? JSON.parse(params.initial) : null; } catch { return null; }
  }, [params.initial]);

  // State: groupe, membres, profils
  const [group, setGroup] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [participantsMap, setParticipantsMap] = useState({});
  const participantsUnsubsRef = useRef(new Map());

  // --- états vérification & création (modal) ---
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState('idle'); // 'idle' | 'ok' | 'none' | 'error'
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyCount, setVerifyCount] = useState(null);         // nombre de matchs
  const [verifyFirstISO, setVerifyFirstISO] = useState(null);   // ISO du 1er match

  const SIZES = ['1x1', '2x2', '3x3', '4x4', '5x5'];
  const [openCreate, setOpenCreate] = useState(false);
  const [size, setSize] = useState('1x1'); // "NxN"
  const [gameDay, setGameDay] = useState(new Date()); // jour NHL
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (openCreateParam === '1') {
      setOpenCreate(true);
      try { r.setParams({ openCreate: undefined }); } catch {}
    }
  }, [openCreateParam, r]);

  // --- Firestore: groupe ---
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

  // --- Firestore: memberships actives ---
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

  // Normalisation UID
  const normalizedMemberships = useMemo(
    () => memberships.map(m => ({ ...m, uidNorm: resolveUid(m, group) })).filter(m => !!m.uidNorm),
    [memberships, group]
  );

  // Profils participants
  useEffect(() => {
    const uids = Array.from(new Set(normalizedMemberships.map(m => m.uidNorm).filter(Boolean)));
    for (const [uid, un] of participantsUnsubsRef.current) {
      if (!uids.includes(uid)) {
        try { un(); } catch {}
        participantsUnsubsRef.current.delete(uid);
        setParticipantsMap(prev => { const { [uid]: _removed, ...rest } = prev; return rest; });
      }
    }
    for (const uid of uids) {
      if (participantsUnsubsRef.current.has(uid)) continue;
      const pref = doc(db, 'participants', uid);
      const un = onSnapshot(pref,
        (snap) => { setParticipantsMap(prev => ({ ...prev, [uid]: snap.exists() ? { uid, ...snap.data() } : { uid } })); },
        () => { setParticipantsMap(prev => ({ ...prev, [uid]: { uid } })); }
      );
      participantsUnsubsRef.current.set(uid, un);
    }
  }, [normalizedMemberships]);

  useEffect(() => {
    return () => {
      for (const [, un] of participantsUnsubsRef.current) { try { un(); } catch {} }
      participantsUnsubsRef.current.clear();
    };
  }, []);

  const HeaderAvatar = () => (
    <TouchableOpacity onPress={() => r.push(user ? "/profile" : "/(auth)/sign-in")} style={{ paddingHorizontal: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontWeight: '700' }}>{user?.displayName?.[0]?.toUpperCase() ?? '🙂'}</Text>
      </View>
    </TouchableOpacity>
  );

  const memberList = useMemo(
    () => normalizedMemberships.filter(m => ['member', 'owner'].includes(m.role)),
    [normalizedMemberships]
  );

  // dérivés groupe
  const name = group?.name;
  const codeInvitation = group?.codeInvitation;
  const createdAt = group?.createdAt;
  const isPrivate = group?.isPrivate;

  const inviteMessage = `Rejoins mon groupe "${name || id}" dans Prophetik-daily.\nCode: ${codeInvitation ?? '—'}\nID: ${group?.id || id}`;
  const onShareInvite = async () => {
    try { await Share.share({ message: inviteMessage }); }
    catch (e) { Alert.alert('Partage impossible', String(e?.message ?? e)); }
  };

  function getParticipantFields(uid, item) {
    const key = uid || item?.uidNorm || item?.uid || resolveUid(item, group);
    const p = (key && participantsMap[key]) || {};
    const name = p.displayName || p.name || item?.displayName || item?.name || key || '—';
    const email = p.email || item?.email || '—';
    let credits = null;
    if (typeof p.credits === 'number') credits = p.credits;
    else if (p.credits && typeof p.credits.balance === 'number') credits = p.credits.balance;
    else if (typeof p.balance === 'number') credits = p.balance;
    return { name, email, credits, role: item?.role };
  }

  /* ----------------------- Création défi (modal) ----------------------- */

  // dérivés création
  const nType = useMemo(() => {
    const n = parseInt(String(size).split('x')[0], 10);
    return Number.isFinite(n) ? n : 0;
  }, [size]);
  const participationCost = nType;
  const computedTitle = `Défi ${size}`;
  const gameDateStr = useMemo(() => fmtLocalDate(gameDay), [gameDay]);

  // Vérification automatique: à l'ouverture + à chaque changement de date
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

  useEffect(() => {
    if (openCreate) verifyDate();
  }, [openCreate, verifyDate]);

  useEffect(() => {
    if (openCreate) verifyDate();
  }, [gameDateStr, openCreate, verifyDate]);

  // Deadline locale et autorisation de créer
  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - 60 * 60 * 1000);
  }, [verifyFirstISO]);

  const canCreate = useMemo(() => {
    return true; // on laisse créer même si on ne connaît pas encore la deadline (souplesse)
    // if (!verifyCount || !signupDeadlineLocal) return false;
    // return Date.now() < signupDeadlineLocal.getTime();
  }, [verifyCount, signupDeadlineLocal]);

  // Création du défi
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
        Alert.alert(
          'Trop tard',
          `La limite d’inscription pour ${gameDateStr} était ${hh}:${mm}. Impossible de créer le défi.`
        );
        return;
      }

      await createDefi({
        groupId: group.id,
        title: computedTitle,
        type: nType,
        gameDate: gameDateStr,
        createdBy: user?.uid || 'system',
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
      setVerifyStatus('idle');
      setVerifyMsg('');
      setVerifyCount(null);
      setVerifyFirstISO(null);
      r.replace({ pathname: '/(drawer)/(tabs)/ChallengesScreen', params: { groupId: group.id } });
    } catch (e) {
      Alert.alert('Création impossible', String(e?.message || e));
    } finally {
      setCreating(false);
    }
  }

  /* ----------------------------- Rendu ----------------------------- */

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Chargement…', headerRight: () => <HeaderAvatar /> }} />
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
        <Stack.Screen options={{ title: 'Erreur', headerRight: () => <HeaderAvatar /> }} />
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
        <Stack.Screen options={{ title: 'Groupe introuvable', headerRight: () => <HeaderAvatar /> }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Aucun groupe trouvé (ID: {id})</Text>
        </View>
      </>
    );
  }

  const effectivePrice = getGroupEffectivePrice(group);

  // Put this ABOVE any early returns (right after you have user, group, memberships):
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
      <Stack.Screen options={{ title: name || 'Groupe', headerRight: () => <HeaderAvatar /> }} />

      <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
        <Text style={{ fontSize:22, fontWeight:'700', marginBottom:8 }}>{name || `Groupe ${group.id}`}</Text>

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
            {!!group?.avatarId && (
              <Text style={{ marginTop:4, color:'#6b7280', fontSize:12 }}>
                Avatar actif : {group.avatarId}
              </Text>
            )}
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
          <DetailRow label="Type de groupe">{isPrivate ? 'Privé' : 'Public'}</DetailRow>
          {!!codeInvitation && (
            <DetailRowWithAction label="Code d’invitation" value={codeInvitation} onPress={onShareInvite} />
          )}
          <DetailRow label="Créé le">{fmtDate(createdAt)}</DetailRow>
          {!!group?.signupDeadline && (
            <DetailRow label="Inscription jusqu’à">
              {fmtDate(group.signupDeadline)}
            </DetailRow>
          )}
        </View>

        {/* Carte Membres */}
        <View style={{ padding:12, borderWidth:1, borderRadius:12 }}>
          <Text style={{ fontWeight:'700', marginBottom:10, textAlign:'center' }}>Membres ({memberList.length})</Text>
          <View style={{ flexDirection:'row', marginBottom:6 }}>
            <Text style={{ flex:3, fontWeight:'700' }}>Nom</Text>
            <Text style={{ flex:3, fontWeight:'700' }}>Email</Text>
            <Text style={{ width:80, textAlign:'right', fontWeight:'700' }}>Crédits</Text>
          </View>
          {memberList.length === 0 ? (
            <Text style={{ color:'#666' }}>Aucun membre pour le moment.</Text>
          ) : (
            memberList.map((item, idx) => {
              const { name, email, credits, role } = getParticipantFields(item.uidNorm, item);
              return (
                <View
                  key={item.uidNorm ?? item.uid ?? item.id ?? String(idx)}
                  style={{ minHeight: 28, borderTopWidth: idx === 0 ? 0 : 1, borderColor:'#eee', justifyContent: 'center', paddingVertical: 4 }}
                >
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <Text style={{ flex:3 }}>
                      {name}
                      {role === 'owner' && (
                        <MaterialCommunityIcons name="account-wrench" size={14} color="black" style={{ marginLeft: 4 }} />
                      )}
                    </Text>
                    <Text style={{ flex:3, color:'#555' }} numberOfLines={1} ellipsizeMode="tail">{email}</Text>
                    <Text style={{ width:80, textAlign:'right' }}>{credits ?? '—'}</Text>
                  </View>
                </View>
              );
            })
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

          {/* Groupe affiché en clair */}
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

          {/* Sélecteur format 1x1 → 5x5 */}
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

          {/* Aperçu automatique */}
          <View style={{ padding:12, borderWidth:1, borderRadius:10, gap:6, backgroundColor:'#fafafa' }}>
            <View style={{ flexDirection:'row' }}>
              <Text style={{ width: 160, fontWeight:'600' }}>Titre</Text>
              <Text>{computedTitle}</Text>
            </View>
            <View style={{ flexDirection:'row' }}>
              <Text style={{ width: 160, fontWeight:'600' }}>Coût participation</Text>
              <Text>{participationCost} crédit(s)</Text>
            </View>
          </View>

          {/* Date NHL + résumé */}
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

          {/* Actions modal */}
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