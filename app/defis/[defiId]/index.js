// app/defis/[defiId]/index.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@src/lib/firebase';
import { useAuth } from '@src/auth/AuthProvider';
import { Ionicons } from '@expo/vector-icons';

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
  // accepte string "YYYY-MM-DD" ou Timestamp/Date
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
// petits helpers robustes sur les champs d’équipe renvoyés par api-web
const pick = (o, k) => (o && o[k] !== undefined ? o[k] : undefined);
const pickAbbr = (t) => pick(t, 'teamAbbrev')?.default ?? pick(t, 'teamAbbrev') ?? pick(t, 'abbrev') ?? null;

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

async function fetchTeamsPlayingOn(ymd /* "YYYY-MM-DD" */) {
  // Retourne Set d’abbr (ex: "MTL","TOR"...)
  if (!ymd) return new Set();
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`);
    if (!res.ok) return new Set();
    const data = await res.json();

    // structure préférée: gameWeek[].date === ymd → day.games
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

/* ----------------------- Fixed picker row (index-based) ---------------------- */

function PlayerPickerRow({
  label,
  selected,
  onOpenModal,
  locked,
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, fontWeight: '600' }}>{label}</Text>
      {selected ? (
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: '#eee',
            borderRadius: 10,
            backgroundColor: '#fafafa',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text numberOfLines={1} style={{ flex: 1 }}>
            {selected.fullName} {selected.teamAbbr ? `• ${selected.teamAbbr}` : ''}
          </Text>
          {!locked && (
            <TouchableOpacity
              onPress={onOpenModal}
              accessibilityRole="button"
              accessibilityLabel="Changer le joueur"
              style={{ paddingHorizontal: 6, paddingVertical: 4 }}
            >
              <Ionicons name="create-outline" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onOpenModal}
          disabled={locked}
          style={{
            paddingVertical:12, paddingHorizontal:12,
            borderWidth:1, borderColor:'#ddd', borderRadius:10,
            backgroundColor:'#fff'
          }}
        >
          <Text style={{ color:'#666' }}>{locked ? 'Inscription fermée' : 'Choisir un joueur…'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ------------------------- Full-screen picker modal ------------------------- */

function PlayerPickerModal({
  visible,
  onClose,
  onSelect,
  options,         // full list of players [{playerId, fullName, teamAbbr}]
  title = 'Choisir un joueur',
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return options.slice(0, 100);
    return options.filter(p =>
      (p.fullName || '').toLowerCase().includes(s) ||
      (p.teamAbbr || '').toLowerCase().includes(s)
    ).slice(0, 100);
  }, [query, options]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex:1 }}
      >
        <View style={{ flex:1, paddingTop: 12 }}>
          {/* Header */}
          <View style={{ paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderColor:'#eee' }}>
            <Text style={{ fontSize:18, fontWeight:'700' }}>{title}</Text>
            <View style={{ marginTop:10, flexDirection:'row', alignItems:'center' }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Tape le nom d’un joueur…"
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:10,
                  paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff'
                }}
              />
              <TouchableOpacity onPress={onClose} style={{ marginLeft:8, paddingHorizontal:12, paddingVertical:10, borderWidth:1, borderRadius:10 }}>
                <Text>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flex:1 }}>
            {filtered.length === 0 ? (
              <View style={{ padding:16 }}>
                <Text style={{ color:'#666' }}>Aucun résultat</Text>
              </View>
            ) : (
              filtered.map((p) => (
                <TouchableOpacity
                  key={String(p.playerId)}
                  onPress={() => onSelect(p)}
                  style={{ paddingVertical:12, paddingHorizontal:16, borderBottomWidth:1, borderColor:'#f0f0f0' }}
                >
                  <Text numberOfLines={1}>{p.fullName} {p.teamAbbr ? `• ${p.teamAbbr}` : ''}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

  // dérivés precoces (avant effets qui l’utilisent)
  const gameYMD = useMemo(() => toYMD(defi?.gameDate), [defi?.gameDate]);

  // équipes du jour
  const [teamAbbrs, setTeamAbbrs] = useState(new Set());
  const [loadingTeams, setLoadingTeams] = useState(false);

  // joueurs (liste brute des équipes qui jouent)
  const [players, setPlayers] = useState([]); // [{playerId, fullName, teamAbbr}]
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // fixed fields state
  const [selected, setSelected] = useState([]);        // [player|null, ...]
  const [saving, setSaving] = useState(false);

  // games table
  const [games, setGames] = useState([]);

  // picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null);

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

  // nb de choix autorisés = type
  const maxChoices = useMemo(() => {
    const t = Number(defi?.type || 0);
    return Number.isFinite(t) && t > 0 ? t : 1;
  }, [defi?.type]);

  // initialise selected à la bonne taille
  useEffect(() => {
    setSelected((old) => {
      const next = Array.from({ length: maxChoices }, (_, i) => old?.[i] ?? null);
      return next;
    });
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
          setSelected((prev) => {
            const next = Array.from({ length: maxChoices }, (_, i) => {
              const x = picks[i];
              return x ? { playerId: x.playerId, fullName: x.fullName, teamAbbr: x.teamAbbr } : prev?.[i] ?? null;
            });
            return next;
          });
        }
      } catch (e) {
        setError(e);
      }
    })();
  }, [defi?.id, user?.uid, maxChoices]);

  // Récup la table des matchs + équipes
  useEffect(() => {
    (async () => {
      if (!gameYMD) return;
      setGames(await fetchGamesOn(gameYMD));
      setLoadingTeams(true);
      const set = await fetchTeamsPlayingOn(gameYMD);
      setTeamAbbrs(set);
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
        // Firestore n'autorise pas "where in" sur plus de 10 valeurs → on batch par 10
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
        // tri alphabétique
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
    // bloqué si deadline passée OU status != active
    if (!defi) return true;
    if (String(defi.status || '').toLowerCase() !== 'active') return true;
    if (!defi.signupDeadline) return false; // si pas de deadline, autorise
    return isPast(defi.signupDeadline);
  }, [defi]);

  const headerTitle = useMemo(() => {
    const base = defi?.title || (defi?.type ? `Défi ${defi.type}x${defi.type}` : 'Défi');
    return base;
  }, [defi]);

  // open picker for slot
  const openPicker = useCallback((slotIndex) => {
    if (locked) return;
    setPickerSlot(slotIndex);
    setPickerOpen(true);
  }, [locked]);

  // selection from modal
  const selectFromModal = useCallback((p) => {
    if (pickerSlot == null) return;
    setSelected(prev => {
      const next = [...prev];
      next[pickerSlot] = p;
      return next;
    });
    setPickerOpen(false);
    setPickerSlot(null);
  }, [pickerSlot]);

  // condition bouton
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
      const ref = doc(db, 'defis', String(defi.id), 'participations', user.uid);
      await setDoc(ref, {
        uid: user.uid,
        picks: selected.map(p => ({
          playerId: p.playerId,
          fullName: p.fullName,
          teamAbbr: p.teamAbbr,
        })),
        updatedAt: new Date(),
      }, { merge: true });
      Alert.alert('Participation enregistrée', 'Bonne chance !');
      router.back();
    } catch (e) {
      Alert.alert('Erreur', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }, [user?.uid, defi?.id, selected, maxChoices, locked, allChosen, router]);

  /* --------------------------------- Render --------------------------------- */

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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          {/* Carte infos défi */}
          <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff', elevation:3,
            shadowColor:'#000', shadowOpacity:0.1, shadowRadius:6, shadowOffset:{width:0, height:3} }}>
            <Text style={{ fontWeight:'700', marginBottom:8 }}>{headerTitle}</Text>
            <Text>Date NHL: {gameDayStr || '—'}</Text>
            {defi.signupDeadline && (
              <Text>Limite inscription: {fmtTSLocalHM(defi.signupDeadline)}</Text>
            )}
            {defi.firstGameAtUTC && (
              <Text>Premier match (UTC): {fmtTSLocalHM(defi.firstGameAtUTC)}</Text>
            )}
            <Text>Nombre de choix: {maxChoices}</Text>
            <Text>Statut: {defi.status || '—'} {locked ? ' (verrouillé)' : ''}</Text>
          </View>

          {/* Info équipes */}
          <View style={{
              padding: 12, borderWidth: 1, borderRadius: 12, backgroundColor: '#fff', elevation: 3,
              shadowColor:'#000', shadowOpacity:0.1, shadowRadius:6, shadowOffset:{ width:0, height:3 },
            }}>
            <Text style={{ fontWeight:'700', marginBottom:8, textAlign:'center' }}>Matchs NHL du jour</Text>
            {games.length === 0 ? (
              <Text style={{ color: '#666', textAlign: 'center' }}>Aucun match trouvé.</Text>
            ) : (
              <View>
                {/* entêtes */}
                <View style={{ flexDirection:'row', paddingVertical:6, borderBottomWidth:1, borderColor:'#ddd' }}>
                  <Text style={{ flex: 1, fontWeight: '700' }}>Heure</Text>
                  <Text style={{ flex: 1, fontWeight: '700' }}>Visiteur</Text>
                  <Text style={{ flex: 1, fontWeight: '700' }}>Domicile</Text>
                </View>
                {/* lignes */}
                {games.map((g, idx) => (
                  <View key={g.id || idx} style={{ flexDirection:'row', paddingVertical:6, borderBottomWidth:1, borderColor:'#eee' }}>
                    <Text style={{ flex: 1 }}>{g.start ? fmtTSLocalHM(g.start) : '—'}</Text>
                    <Text style={{ flex: 1 }}>{g.away}</Text>
                    <Text style={{ flex: 1 }}>{g.home}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Pickers fixes */}
          <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff', elevation:3,
            shadowColor:'#000', shadowOpacity:0.1, shadowRadius:6, shadowOffset:{width:0, height:3} }}>
            <Text style={{ fontWeight:'700', marginBottom:8 }}>Sélectionne tes joueurs</Text>
            {Array.from({ length: maxChoices }).map((_, i) => (
              <PlayerPickerRow
                key={i}
                label={`Choix ${i + 1}`}
                selected={selected[i]}
                onOpenModal={() => openPicker(i)}
                locked={locked}
              />
            ))}
            <Text style={{ color:'#555' }}>
              {selected.filter(Boolean).length}/{maxChoices} sélection(s)
            </Text>
          </View>

          {/* Actions */}
          <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff', gap:8 }}>
            <TouchableOpacity
              disabled={locked || saving || !allChosen}
              onPress={save}
              style={{
                padding:14, borderRadius:10, alignItems:'center',
                backgroundColor: (locked || saving || !allChosen) ? '#9ca3af' : '#111'
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
      <PlayerPickerModal
        visible={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerSlot(null); }}
        onSelect={selectFromModal}
        options={players}
      />
    </>
  );
}
