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
  Keyboard,
  Image,
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

// helpers
function teamLogoUrl(abbr) {
  return `https://assets.nhle.com/logos/nhl/png/${abbr}/light/primary_logo.png`;
}
function headshotUrl(abbr, playerId) {
  return `https://assets.nhle.com/mugs/nhl/latest/${abbr}/${playerId}.png`;
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

/* ----------------------- Fixed picker row with modal ------------------------ */

function PlayerPickerRow({ label, selected, onSelect, locked }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [q, setQ] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'nhl_players'));
        const players = [];
        snap.forEach(docSnap => players.push(docSnap.data()));
        setAllPlayers(players);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!q) { setFiltered([]); return; }
    const s = q.toLowerCase();
    setFiltered(allPlayers.filter(p => p.fullName.toLowerCase().includes(s)).slice(0,30));
  }, [q, allPlayers]);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, fontWeight: '600' }}>{label}</Text>
      {selected ? (
        <View style={{
          flexDirection:'row', alignItems:'center',
          paddingVertical:8, paddingHorizontal:10,
          borderWidth:1, borderColor:'#eee', borderRadius:10,
          backgroundColor:'#fafafa'
        }}>
          <Image source={{ uri: headshotUrl(selected.teamAbbr, selected.playerId) }}
            style={{ width:32, height:32, borderRadius:16, marginRight:8 }} />
          <Text numberOfLines={1} style={{ flex:1 }}>
            {selected.fullName} {selected.teamAbbr ? `• ${selected.teamAbbr}` : ''}
          </Text>
          {!locked && (
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Ionicons name="create-outline" size={20} color="#555" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        !locked && (
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={{ borderWidth:1, borderColor:'#ddd', borderRadius:10, padding:12, backgroundColor:'#fff' }}
          >
            <Text style={{ color:'#666' }}>Choisir un joueur…</Text>
          </TouchableOpacity>
        )
      )}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex:1, padding:16, backgroundColor:'#fff' }}>
          <TextInput
            placeholder="Tape le nom d’un joueur…"
            value={q}
            onChangeText={setQ}
            style={{ borderWidth:1, borderColor:'#ddd', borderRadius:10, padding:10, marginBottom:12 }}
          />
          <ScrollView>
            {filtered.map(p => (
              <TouchableOpacity key={p.playerId} onPress={() => {
                onSelect(p);
                setModalVisible(false);
                setQ('');
              }} style={{ flexDirection:'row', alignItems:'center', padding:8, borderBottomWidth:1, borderColor:'#eee' }}>
                <Image source={{ uri: headshotUrl(p.teamAbbr, p.playerId) }}
                  style={{ width:32, height:32, borderRadius:16, marginRight:8 }} />
                <Text>{p.fullName} {p.teamAbbr ? `• ${p.teamAbbr}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop:12, alignSelf:'center' }}>
            <Text style={{ color:'#b00020' }}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  const [games, setGames] = useState([]);

  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  // Charger défi
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);
    const ref = doc(db, 'defis', String(defiId));
    const unsub = onSnapshot(ref, snap => {
      const d = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setDefi(d);
      setLoadingDefi(false);
    }, e => { setError(e); setLoadingDefi(false); });
    return () => unsub();
  }, [defiId]);

  const gameYMD = useMemo(() => toYMD(defi?.gameDate), [defi?.gameDate]);
  useEffect(() => {
    if (!gameYMD) return;
    fetchGamesOn(gameYMD).then(setGames);
  }, [gameYMD]);

  const maxChoices = useMemo(() => Number(defi?.type||1), [defi?.type]);
  useEffect(() => {
    setSelected(Array.from({ length: maxChoices }, (_,i)=>null));
  }, [maxChoices]);

  const locked = useMemo(() => {
    if (!defi) return true;
    if (String(defi.status||'').toLowerCase()!=='open') return true;
    if (!defi.signupDeadline) return false;
    return isPast(defi.signupDeadline);
  }, [defi]);

  const allChosen = useMemo(() => selected.filter(Boolean).length===maxChoices, [selected,maxChoices]);

  const save = useCallback(async () => {
    if (!user?.uid || !defi?.id) return;
    if (!allChosen) return;
    setSaving(true);
    try {
      const ref = doc(db,'defis',String(defi.id),'participations',user.uid);
      await setDoc(ref,{ uid:user.uid, picks:selected, updatedAt:new Date() },{ merge:true });
      Alert.alert('Participation enregistrée');
      router.back();
    } catch(e){ Alert.alert('Erreur', String(e)); }
    finally{ setSaving(false); }
  }, [user?.uid,defi?.id,selected,allChosen,router]);

  if (loadingDefi) return <ActivityIndicator style={{ flex:1 }} />;
  if (error) return <Text>Erreur: {String(error.message||error)}</Text>;
  if (!defi) return <Text>Défi introuvable</Text>;

  return (
    <ScrollView contentContainerStyle={{ padding:16, gap:16 }}>
      <Stack.Screen options={{ title:defi?.title||`Défi ${defi?.type}x${defi?.type}` }} />

      {/* Infos défi */}
      <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff' }}>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>{defi?.title}</Text>
        <Text>Date NHL: {gameYMD}</Text>
        {defi.signupDeadline && <Text>Limite: {fmtTSLocalHM(defi.signupDeadline)}</Text>}
      </View>

      {/* Matchs NHL du jour */}
      <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff' }}>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>Matchs NHL du jour</Text>
        {games.length===0 ? <Text>Aucun match trouvé</Text> : (
          <View>
            {games.map(g=>(
              <View key={g.id} style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                <Image source={{ uri:teamLogoUrl(g.away) }} style={{ width:32, height:32, marginRight:8 }} />
                <Text>{g.away}</Text>
                <Text style={{ marginHorizontal:8 }}>@</Text>
                <Text>{g.home}</Text>
                <Image source={{ uri:teamLogoUrl(g.home) }} style={{ width:32, height:32, marginLeft:8 }} />
                <Text style={{ marginLeft:8 }}>{g.start?fmtTSLocalHM(g.start):'—'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Choix joueurs */}
      <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff' }}>
        <Text style={{ fontWeight:'700', marginBottom:8 }}>Sélectionne tes joueurs</Text>
        {Array.from({length:maxChoices}).map((_,i)=>(
          <PlayerPickerRow
            key={i}
            label={`Choix ${i+1}`}
            selected={selected[i]}
            onSelect={(p)=>{
              setSelected(prev=>{
                const next=[...prev];
                next[i]=p;
                return next;
              });
            }}
            locked={locked}
          />
        ))}
        <Text>{selected.filter(Boolean).length}/{maxChoices} sélection(s)</Text>
      </View>

      {/* Actions */}
      <View style={{ padding:12, borderWidth:1, borderRadius:12, backgroundColor:'#fff' }}>
        <TouchableOpacity
          disabled={!allChosen||locked||saving}
          onPress={save}
          style={{ backgroundColor:(!allChosen||locked)?'#ccc':'#111', padding:14, borderRadius:10, alignItems:'center' }}
        >
          <Text style={{ color:'#fff' }}>{saving?'Enregistrement…':'Enregistrer ma participation'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
