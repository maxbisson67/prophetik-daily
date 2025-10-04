// app/defis/[defiId]/index.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Image,
  Modal,
} from 'react-native';
import { TeamLogo } from '@src/nhl/nhlAssets';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { Ionicons } from '@expo/vector-icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@src/lib/firebase';

const functions = getFunctions(app);
const participateInDefi = httpsCallable(functions, 'participateInDefi');

/* --------------------------- Utils format & fetch --------------------------- */

function fmtTSLocalHM(v) {
  try {
    const d = v?.toDate?.() ? v.toDate() : (v instanceof Date ? v : v ? new Date(v) : null);
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch { return '—'; }
}
function fmtLocalDateStr(d) {
  if (!d) return '—';
  const pad = (n) => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function toYMD(v) {
  if (typeof v === 'string') return v;
  const d = v?.toDate?.() ? v.toDate() : (v instanceof Date ? v : v ? new Date(v) : null);
  if (!d) return null;
  return fmtLocalDateStr(d);
}
function isPast(ts) {
  if (!ts) return false;
  const d = ts?.toDate?.() ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  return Date.now() > d.getTime();
}
const pick = (o, k) => (o && o[k] !== undefined ? o[k] : undefined);
const pickAbbr = (t) => pick(t, 'teamAbbrev')?.default ?? pick(t, 'teamAbbrev') ?? pick(t, 'abbrev') ?? null;

// ✅ Logos PNG (RN ne supporte pas le SVG nativement)
function teamLogoUrl(abbr) {
  if (!abbr) return null;
  return `https://assets.nhle.com/logos/nhl/png/${abbr}/light/primary_logo.png`;
}
// ✅ Headshots (playerId + abbr)
function headshotUrl(abbr, playerId) {
  if (!abbr || !playerId) return null;
  return `https://assets.nhle.com/mugs/nhl/20252026/${abbr}/${playerId}.png`;
}

async function fetchGamesOn(ymd) {
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
    if (!res.ok) return [];
    const data = await res.json();

    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find(d => d?.date === ymd)
      : null;

    const games = day ? (day.games || []) : (Array.isArray(data?.games) ? data.games : []);
    return games.map(g => ({
      id: g.id,
      away: g?.awayTeam?.abbrev || g?.awayTeamAbbrev,
      home: g?.homeTeam?.abbrev || g?.homeTeamAbbrev,
      start: g?.startTimeUTC ? new Date(g.startTimeUTC) : null,
    }));
  } catch {
    return [];
  }
}

async function fetchTeamsPlayingOn(ymd) {
  if (!ymd) return new Set();
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
    if (!res.ok) return new Set();
    const data = await res.json();

    const day = Array.isArray(data?.gameWeek) ? data.gameWeek.find(d => d?.date === ymd) : null;
    const games = day ? (day.games || []) : (Array.isArray(data?.games) ? data.games : []);
    const abbrs = new Set();
    for (const g of games) {
      const home = g?.homeTeam ?? g?.homeTeamAbbrev ?? g?.homeTeam?.abbrev;
      const away = g?.awayTeam ?? g?.awayTeamAbbrev ?? g?.awayTeam?.abbrev;
      const hAbbr = typeof home === 'string' ? home : pickAbbr(home);
      const aAbbr = typeof away === 'string' ? away : pickAbbr(away);
      if (hAbbr) abbrs.add(hAbbr);
      if (aAbbr) abbrs.add(aAbbr);
    }
    return abbrs;
  } catch {
    return new Set();
  }
}

/* --------------------------- Autocomplete (Modal) --------------------------- */

function PlayerSelectModal({ visible, onClose, options, onPick }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 50);
    return options.filter(p =>
      (p.fullName || '').toLowerCase().includes(s) ||
      (p.teamAbbr || '').toLowerCase().includes(s)
    ).slice(0, 50);
  }, [q, options]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.25)', justifyContent:'flex-end' }}>
        <View style={{ maxHeight:'75%', backgroundColor:'#fff', borderTopLeftRadius:16, borderTopRightRadius:16 }}>
          <View style={{ padding:12, borderBottomWidth:1, borderColor:'#eee', flexDirection:'row', alignItems:'center' }}>
            <TextInput
              placeholder="Tape le nom d’un joueur…"
              value={q}
              onChangeText={setQ}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              style={{ flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:10, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff' }}
            />
            <TouchableOpacity onPress={onClose} style={{ marginLeft:8, padding:8 }}>
              <Ionicons name="close" size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding:8 }}>
            {filtered.length === 0 ? (
              <Text style={{ textAlign:'center', color:'#666', paddingVertical:12 }}>Aucun résultat</Text>
            ) : filtered.map(p => (
              <TouchableOpacity
                key={String(p.playerId)}
                onPress={() => { onPick?.(p); onClose?.(); }}
                style={{ flexDirection:'row', alignItems:'center', paddingVertical:10, paddingHorizontal:8, borderBottomWidth:1, borderColor:'#f3f3f3' }}
              >
                <Image
                  source={{ uri: headshotUrl(p.teamAbbr, p.playerId) }}
                  style={{ width:34, height:34, borderRadius:17, marginRight:10, backgroundColor:'#eee' }}
                />
                <Text numberOfLines={1} style={{ flex:1 }}>{p.fullName} {p.teamAbbr ? `• ${p.teamAbbr}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ----------------------- Fixed picker row (index-based) ---------------------- */

function PlayerPickerRow({ label, value, onEdit, locked }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, fontWeight: '600' }}>{label}</Text>
      {value ? (
        <View style={{ paddingVertical:10, paddingHorizontal:12, borderWidth:1, borderColor:'#eee', borderRadius:10, backgroundColor:'#fafafa', flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <View style={{ flexDirection:'row', alignItems:'center', flex:1, marginRight:10 }}>
            <Image
              source={{ uri: headshotUrl(value.teamAbbr, value.playerId) }}
              style={{ width:34, height:34, borderRadius:17, marginRight:8, backgroundColor:'#eee' }}
            />
            <Text numberOfLines={1} style={{ flex:1 }}>
              {value.fullName} {value.teamAbbr ? `• ${value.teamAbbr}` : ''}
            </Text>
          </View>
          {!locked && (
            <TouchableOpacity onPress={onEdit} style={{ padding:6 }}>
              <Ionicons name="create-outline" size={20} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onEdit}
          disabled={locked}
          style={{ paddingVertical:12, paddingHorizontal:12, borderWidth:1, borderColor:'#ddd', borderRadius:10, backgroundColor:'#fff' }}
        >
          <Text style={{ color:'#666' }}>Choisir un joueur…</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------------------------------- Screen ---------------------------------- */

export default function DefiParticipationScreen() {
  const { defiId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [defi, setDefi] = useState(null);
  const [loadingDefi, setLoadingDefi] = useState(true);
  const [error, setError] = useState(null);

  const [teamAbbrs, setTeamAbbrs] = useState(new Set());
  const [games, setGames] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const [players, setPlayers] = useState([]); // [{playerId, fullName, teamAbbr}]
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  const [selected, setSelected] = useState([]); // [player|null, ...]
  const [saving, setSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);

  // keyboard spacer
  useEffect(() => {
    const sh = Keyboard.addListener('keyboardDidShow', () => {});
    const hd = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { sh.remove(); hd.remove(); };
  }, []);

  // Charger le défi
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);
    const ref = doc(db, 'defis', String(defiId));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setDefi(d);
        setLoadingDefi(false);
      },
      (e) => {
        setError(e);
        setLoadingDefi(false);
      }
    );
    return () => unsub();
  }, [defiId]);

  const maxChoices = useMemo(() => {
    const t = Number(defi?.type || 0);
    return Number.isFinite(t) && t > 0 ? t : 1;
  }, [defi?.type]);

  useEffect(() => {
    setSelected(prev => Array.from({ length: maxChoices }, (_, i) => prev?.[i] ?? null));
  }, [maxChoices]);

  // Charger participation existante (remplit selected)
  useEffect(() => {
    (async () => {
      if (!defi?.id || !user?.uid) return;
      try {
        const ref = doc(db, 'defis', String(defi.id), 'participations', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const p = snap.data();
          const picks = Array.isArray(p.picks) ? p.picks : [];
          setSelected((prev) =>
            Array.from({ length: maxChoices }, (_, i) => {
              const x = picks[i];
              return x ? { playerId: x.playerId, fullName: x.fullName, teamAbbr: x.teamAbbr } : prev?.[i] ?? null;
            })
          );
        }
      } catch (e) {
        setError(e);
      }
    })();
  }, [defi?.id, user?.uid, maxChoices]);

  const gameYMD = useMemo(() => toYMD(defi?.gameDate), [defi?.gameDate]);

  // Récup équipes & matchs
  useEffect(() => {
    (async () => {
      if (!gameYMD) return;
      setLoadingTeams(true);
      const [set, gm] = await Promise.all([
        fetchTeamsPlayingOn(gameYMD),
        fetchGamesOn(gameYMD),
      ]);
      setTeamAbbrs(set);
      setGames(gm || []);
      setLoadingTeams(false);
    })();
  }, [gameYMD]);

  // Charger joueurs des équipes qui jouent (depuis Firestore nhl_players)
  const abbrList = useMemo(() => Array.from(teamAbbrs), [teamAbbrs]);
  useEffect(() => {
    (async () => {
      if (!abbrList.length) { setPlayers([]); return; }
      setLoadingPlayers(true);
      try {
        const chunks = [];
        for (let i = 0; i < abbrList.length; i += 10) chunks.push(abbrList.slice(i, i + 10));
        const results = [];
        for (const chunk of chunks) {
          const qRef = query(collection(db, 'nhl_players'), where('teamAbbr', 'in', chunk));
          const snap = await getDocs(qRef);
          snap.forEach(docSnap => {
            const p = docSnap.data();
            results.push({ playerId: p.playerId, fullName: p.fullName, teamAbbr: p.teamAbbr });
          });
        }
        results.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
        setPlayers(results);
      } catch (e) {
        setError(e);
      } finally {
        setLoadingPlayers(false);
      }
    })();
  }, [abbrList]);

  const locked = useMemo(() => {
    if (!defi) return true;
    const statusKey = String(defi.status || '').toLowerCase();
    if (statusKey !== 'open') return true;
    if (!defi.signupDeadline) return false;
    return isPast(defi.signupDeadline);
  }, [defi]);

  const headerTitle = useMemo(() => {
    const base = defi?.title || (defi?.type ? `Défi ${defi.type}x${defi.type}` : 'Défi');
    return base;
  }, [defi]);

  const openPicker = useCallback((index) => {
    setPickerIndex(index);
    setPickerOpen(true);
    Keyboard.dismiss();
  }, []);

  const handlePick = useCallback((p) => {
    setSelected(prev => {
      const next = [...prev];
      next[pickerIndex] = p;
      return next;
    });
  }, [pickerIndex]);

  const allChosen = useMemo(() => selected.filter(Boolean).length === maxChoices, [selected, maxChoices]);

  // Sauvegarde
  const save = useCallback(async () => {
  if (!user?.uid || !defi?.id) return;
  if (locked) {
    Alert.alert('Inscription fermée', 'La date limite est dépassée.');
    return;
  }
  if (!allChosen) {
    Alert.alert('Sélection incomplète', `Tu dois choisir ${maxChoices} joueur(s).`);
    return;
  }
  setSaving(true);
  try {
    const res = await participateInDefi({
      defiId: defi.id,
      picks: selected.map(p => ({
        playerId: p.playerId,
        fullName: p.fullName,
        teamAbbr: p.teamAbbr,
      })),
    });

    const ok = res?.data?.ok === true;
    const newPot = typeof res?.data?.newPot === 'number' ? res.data.newPot : null;

    if (ok) {
      const potMsg = (newPot !== null)
        ? `Cagnotte: ${newPot} crédits`
        : 'Participation enregistrée.';
      Alert.alert('Participation enregistrée', `Bonne chance ! ${potMsg}`);
      router.back();
    } else {
      throw new Error(res?.data?.error || "Erreur inconnue");
    }
  } catch (e) {
    Alert.alert('Erreur', String(e?.message || e));
  } finally {
    setSaving(false);
  }
}, [user?.uid, defi?.id, selected, maxChoices, locked, allChosen, router]);

  if (loadingDefi) {
    return (
      <>
        <Stack.Screen options={{ title: 'Chargement…' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop:8 }}>Chargement…</Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Erreur' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Erreur : {String(error?.message || error)}</Text>
        </View>
      </>
    );
  }

  if (!defi) {
    return (
      <>
        <Stack.Screen options={{ title: 'Défi introuvable' }} />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
          <Text>Aucun défi trouvé.</Text>
        </View>
      </>
    );
  }

  const gameDayStr = typeof defi.gameDate === 'string' ? defi.gameDate : toYMD(defi.gameDate);

  return (
    <>
      <Stack.Screen options={{ title: headerTitle }} />

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        >
          {/* Carte infos défi */}
          <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff', elevation:3 }}>
            <Text style={{ fontWeight:'700', marginBottom:8 }}>{headerTitle}</Text>
            <Text>Date NHL: {gameDayStr || '—'}</Text>
            {defi.signupDeadline && <Text>Limite inscription: {fmtTSLocalHM(defi.signupDeadline)}</Text>}
            {defi.firstGameAtUTC && <Text>Premier match (UTC): {fmtTSLocalHM(defi.firstGameAtUTC)}</Text>}
            <Text>Nombre de choix: {maxChoices}</Text>
            <Text>Statut: {defi.status || '—'} {locked ? ' (verrouillé)' : ''}</Text>
            <Text>Cagnotte: {defi.pot ?? 0} crédit(s)</Text>
          </View>

          {/* Matchs du jour avec logos */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: '#fff',
              elevation: 3,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Text style={{ fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
              Matchs NHL du jour
            </Text>
            {games.length === 0 ? (
              <Text style={{ color: '#666', textAlign: 'center' }}>Aucun match trouvé.</Text>
            ) : (
              <View>
                <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#ddd' }}>
                  <Text style={{ flex: 1, fontWeight: '700' }}>Heure</Text>
                  <Text style={{ flex: 2, fontWeight: '700' }}>Visiteur</Text>
                  <Text style={{ flex: 2, fontWeight: '700' }}>Domicile</Text>
                </View>
                {games.map((g, idx) => (
                  <View key={g.id || idx} style={{ flexDirection: 'row', alignItems:'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
                    <Text style={{ flex: 1 }}>{g.start ? fmtTSLocalHM(g.start) : '—'}</Text>
                    <View style={{ flex: 2, flexDirection:'row', alignItems:'center' }}>
                      <TeamLogo abbr={g.away} size={24} style={{ marginRight: 8 }} />
                      <Text>{g.away}</Text>
                    </View>
                    <View style={{ flex: 2, flexDirection:'row', alignItems:'center' }}>
                      <TeamLogo abbr={g.home} size={24} style={{ marginRight: 8 }} />
                      <Text>{g.home}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 👇 Bouton déplacé ici entre "Matchs NHL du jour" et "Sélectionne tes joueurs" */}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/nhl/top-scorers', params: { date: gameDayStr || '' } })}
            style={{
              padding:12,
              borderRadius:10,
              borderWidth:1,
              borderColor:'#e5e7eb',
              alignItems:'center',
              backgroundColor:'#fff'
            }}
          >
            <Text style={{ fontWeight:'700' }}>Voir les meilleurs marqueurs</Text>
          </TouchableOpacity>

          {/* Pickers fixes */}
          <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff', elevation: 3 }}>
            <Text style={{ fontWeight:'700', marginBottom:8 }}>Sélectionne tes joueurs</Text>
            {Array.from({ length: maxChoices }).map((_, i) => (
              <PlayerPickerRow
                key={i}
                label={`Choix ${i + 1}`}
                value={selected[i]}
                onEdit={() => openPicker(i)}
                locked={locked}
              />
            ))}
            <Text style={{ color:'#555' }}>
              {selected.filter(Boolean).length}/{maxChoices} sélection(s)
            </Text>
          </View>

          {/* Actions (sans le bouton top-scorers désormais) */}
          <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff', gap:8 }}>
            <TouchableOpacity
              disabled={locked || saving || !selected.every(Boolean)}
              onPress={save}
              style={{
                padding:14, borderRadius:10, alignItems:'center',
                backgroundColor: (locked || saving || !selected.every(Boolean)) ? '#9ca3af' : '#111'
              }}
            >
              <Text style={{ color:'#fff', fontWeight:'700' }}>
                {locked ? 'Inscription fermée' : (saving ? 'Enregistrement…' : 'Enregistrer ma participation')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding:12, borderRadius:10, borderWidth:1, alignItems:'center', backgroundColor:'#fff' }}
            >
              <Text>Annuler</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de sélection */}
      <PlayerSelectModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        options={players}
        onPick={handlePick}
      />
    </>
  );
}