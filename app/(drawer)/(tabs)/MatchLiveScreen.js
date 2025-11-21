// app/(tabs)/MatchLiveScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@src/theme/ThemeProvider';

// 🔥 RNFirebase
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

/* ========================
   Helpers date / logos
========================= */

const LOGO_MAP = {
  ANA: require('../../../assets/nhl-logos/ANA.png'),
  ARI: require('../../../assets/nhl-logos/ARI.png'),
  BOS: require('../../../assets/nhl-logos/BOS.png'),
  BUF: require('../../../assets/nhl-logos/BUF.png'),
  CAR: require('../../../assets/nhl-logos/CAR.png'),
  CBJ: require('../../../assets/nhl-logos/CBJ.png'),
  CGY: require('../../../assets/nhl-logos/CGY.png'),
  CHI: require('../../../assets/nhl-logos/CHI.png'),
  COL: require('../../../assets/nhl-logos/COL.png'),
  DAL: require('../../../assets/nhl-logos/DAL.png'),
  DET: require('../../../assets/nhl-logos/DET.png'),
  EDM: require('../../../assets/nhl-logos/EDM.png'),
  FLA: require('../../../assets/nhl-logos/FLA.png'),
  LAK: require('../../../assets/nhl-logos/LAK.png'),
  MIN: require('../../../assets/nhl-logos/MIN.png'),
  MTL: require('../../../assets/nhl-logos/MTL.png'),
  NJD: require('../../../assets/nhl-logos/NJD.png'),
  NSH: require('../../../assets/nhl-logos/NSH.png'),
  NYI: require('../../../assets/nhl-logos/NYI.png'),
  NYR: require('../../../assets/nhl-logos/NYR.png'),
  OTT: require('../../../assets/nhl-logos/OTT.png'),
  PHI: require('../../../assets/nhl-logos/PHI.png'),
  PIT: require('../../../assets/nhl-logos/PIT.png'),
  SEA: require('../../../assets/nhl-logos/SEA.png'),
  SJS: require('../../../assets/nhl-logos/SJS.png'),
  STL: require('../../../assets/nhl-logos/STL.png'),
  TBL: require('../../../assets/nhl-logos/TBL.png'),
  TOR: require('../../../assets/nhl-logos/TOR.png'),
  UTA: require('../../../assets/nhl-logos/UTA.png'),
  VAN: require('../../../assets/nhl-logos/VAN.png'),
  VGK: require('../../../assets/nhl-logos/VGK.png'),
  WPG: require('../../../assets/nhl-logos/WPG.png'),
  WSH: require('../../../assets/nhl-logos/WSH.png'),
};

function teamLogo(abbr) {
  return LOGO_MAP[abbr] || null;
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Gère Date / string / Timestamp Firestore
function fmtTime(d) {
  if (!d) return '—';
  let date;
  try {
    if (d?.toDate) {
      date = d.toDate();
    } else if (d instanceof Date) {
      date = d;
    } else {
      date = new Date(d);
    }
  } catch {
    return '—';
  }
  if (!date || isNaN(date.getTime())) return '—';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function isGameToday(doc, todayStr) {
  // On ignore doc.date / doc.ymd pour éviter les problèmes UTC vs local
  const t = doc.startTimeUTC;
  if (!t) return false;

  let dt;
  try {
    if (t?.toDate) {
      dt = t.toDate();        // Timestamp Firestore
    } else {
      dt = new Date(t);       // string ISO ou ms
    }
  } catch {
    return false;
  }
  if (!dt || isNaN(dt.getTime())) return false;

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const ymd = `${y}-${m}-${d}`;

  return ymd === todayStr;
}

function gStartMillis(g) {
  const t = g?.startTimeUTC;
  if (!t) return 0;
  try {
    if (t?.toDate) return t.toDate().getTime();
    return new Date(t).getTime();
  } catch {
    return 0;
  }
}

function periodLabelFromGame(game) {
  const { period, periodType, clock, isLive, isFinal } = game || {};

  if (period == null && !clock) return null;

  let base = null;

  const pt = (periodType || '').toUpperCase();
  if (pt === 'OT') {
    base = 'Prolongation';
  } else if (pt === 'SO') {
    base = 'Tirs de barrage';
  } else if (period != null) {
    base = `Période ${period}`;
  }

  // Si match en direct, on ajoute le temps restant
  if (base && clock && isLive) {
    return `${base} • ${clock}`;
  }

  // Si on n’a pas de base mais on a un clock (cas bizarre), on montre au moins le clock
  return base || clock || null;
}

function seasonCodeFromDate(d) {
  let date;
  try {
    if (d?.toDate) {
      date = d.toDate();
    } else if (d instanceof Date) {
      date = d;
    } else if (d) {
      date = new Date(d);
    }
  } catch {
    date = new Date();
  }
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12

  // Saison NHL commence vers septembre (9)
  if (month >= 9) {
    return `${year}${year + 1}`;     // ex: 2024 -> "20242025"
  }
  return `${year - 1}${year}`;       // ex: février 2025 -> "20242025"
}

/* ========================
   Composant de ligne
========================= */

function GameRow({ game, onPress, colors }) {
  const {
    homeAbbr,
    awayAbbr,
    homeScore,
    awayScore,
    startTimeUTC,
    statusText,
    isLive,
    isFinal,
  } = game;

 const seasonCode = useMemo(
    () => seasonCodeFromDate(startTimeUTC || new Date()),
    [startTimeUTC]
  );

 const periodLabel = periodLabelFromGame(game);

  return (
    <TouchableOpacity
      onPress={() => onPress?.(game)}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Infos gauche : équipes + score */}
        <View style={{ flex: 1 }}>
          {/* Away */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            {teamLogo(awayAbbr) && (
              <Image
                source={teamLogo(awayAbbr)}
                style={{ width: 26, height: 26, marginRight: 8 }}
              />
            )}
            <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{awayAbbr}</Text>
            <Text style={{ color: colors.text, fontWeight: '700', width: 24, textAlign: 'right' }}>
              {awayScore}
            </Text>
          </View>
          {/* Home */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {teamLogo(homeAbbr) && (
              <Image
                source={teamLogo(homeAbbr)}
                style={{ width: 26, height: 26, marginRight: 8 }}
              />
            )}
            <Text style={{ color: colors.text, fontWeight: '600', flex: 1 }}>{homeAbbr}</Text>
            <Text style={{ color: colors.text, fontWeight: '700', width: 24, textAlign: 'right' }}>
              {homeScore}
            </Text>
          </View>
        </View>

        {/* Infos droite : statut + heure */}
        <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            {isLive && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#dc2626',
                  marginRight: 6,
                }}
              />
            )}
            <Text
              style={{
                color: isLive
                  ? '#dc2626'
                  : isFinal
                  ? colors.subtext
                  : colors.text,
                fontWeight: '700',
              }}
            >
              {statusText}
            </Text>
          </View>

           {/* 🔹 Nouvelle ligne : période + horloge */}
            {periodLabel && (
                <Text
                style={{
                    color: colors.subtext,
                    fontSize: 12,
                    marginBottom: 2,
                }}
                >
                {periodLabel}
                </Text>
            )}


          <Text style={{ color: colors.subtext, fontSize: 12 }}>
            {startTimeUTC ? `Début: ${fmtTime(startTimeUTC)}` : 'Heure inconnue'}
          </Text>
        </View>
      </View>

      {/* Hint tap */}
      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.subtext} />
        <Text style={{ marginLeft: 4, color: colors.subtext, fontSize: 12 }}>
          Touchez pour voir les détails
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ========================
   Modale détails de match
========================= */

function GameDetailModal({ visible, onClose, game, colors }) {
  const [gameDoc, setGameDoc] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔴 Écoute Firestore sur le match sélectionné + sa sous-collection "goals"
  useEffect(() => {
    if (!visible || !game?.id) {
      setGameDoc(null);
      setGoals([]);
      setLoading(false);
      return;
    }

    const ref = firestore().collection('nhl_live_games').doc(String(game.id));
    const goalsRef = ref.collection('goals');

    setLoading(true);

    const unsubGame = ref.onSnapshot(
      (snap) => {
        setGameDoc(snap.exists ? { id: snap.id, ...snap.data() } : null);
      },
      (err) => {
        console.log('[MatchLive] game doc error', err?.message || err);
      }
    );

    const unsubGoals = goalsRef
      .orderBy('period', 'asc')
      .orderBy('timeInPeriod', 'asc')
      .onSnapshot(
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setGoals(list);
          setLoading(false);
        },
        (err) => {
          console.log('[MatchLive] goals error', err?.message || err);
          setLoading(false);
        }
      );

    return () => {
      try { unsubGame(); } catch {}
      try { unsubGoals(); } catch {}
    };
  }, [visible, game?.id]);

  const g = gameDoc || game || null;

  const goalsByPeriod = useMemo(() => {
    const map = {};
    goals.forEach((goal) => {
      let label;
      const p = goal.period;
      const pt = goal.periodType;

      if (p == null) {
        label = 'Inconnu';
      } else if (pt === 'OT') {
        label = 'Prolongation';
      } else if (pt === 'SO') {
        label = 'Tirs de barrage';
      } else {
        label = `Période ${p}`;
      }

      if (!map[label]) map[label] = [];
      map[label].push(goal);
    });

    const order = [
      'Période 1',
      'Période 2',
      'Période 3',
      'Prolongation',
      'Tirs de barrage',
      'Inconnu',
    ];

    return order
      .filter((label) => map[label]?.length)
      .map((label) => ({ label, goals: map[label] }));
  }, [goals]);

  if (!visible || !g) return null;

  const {
    homeAbbr,
    awayAbbr,
    homeScore,
    awayScore,
    startTimeUTC,
    venue,
    statusText,
    isLive,
    isFinal,
    period,
    periodType,
    clock,
  } = g;

  const periodLabel = period
    ? `Période ${period}${periodType === 'OT' ? ' (Prolong.)' : periodType === 'SO' ? ' (TB)' : ''}`
    : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            maxHeight: '80%',
          }}
        >
          {/* Handle */}
          <View
            style={{
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 48,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 18,
                fontWeight: '800',
                color: colors.text,
              }}
            >
              Détail du match
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            {/* Bloc central score */}
            <View
              style={{
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                {/* Away */}
                <View style={{ alignItems: 'center', marginRight: 16 }}>
                  {teamLogo(awayAbbr) && (
                    <Image
                      source={teamLogo(awayAbbr)}
                      style={{ width: 40, height: 40, marginBottom: 4 }}
                    />
                  )}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {awayAbbr}
                  </Text>
                </View>

                {/* Score */}
                <View style={{ alignItems: 'center', marginHorizontal: 8 }}>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: '900',
                      color: colors.text,
                    }}
                  >
                    {awayScore} - {homeScore}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      color: isLive
                        ? '#dc2626'
                        : isFinal
                        ? colors.subtext
                        : colors.text,
                      fontWeight: '700',
                    }}
                  >
                    {statusText}
                  </Text>
                </View>

                {/* Home */}
                <View style={{ alignItems: 'center', marginLeft: 16 }}>
                  {teamLogo(homeAbbr) && (
                    <Image
                      source={teamLogo(homeAbbr)}
                      style={{ width: 40, height: 40, marginBottom: 4 }}
                    />
                  )}
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {homeAbbr}
                  </Text>
                </View>
              </View>

              {periodLabel && (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  {periodLabel} {clock ? `• Temps restant: ${clock}` : ''}
                </Text>
              )}
              {!periodLabel && clock && (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  Temps restant: {clock}
                </Text>
              )}
            </View>

           

            {/* Buts par période */}
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontWeight: '700',
                  marginBottom: 6,
                  color: colors.text,
                }}
              >
                Sommaire du match
              </Text>

              {loading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <ActivityIndicator size="small" color={colors.subtext} />
                  <Text style={{ color: colors.subtext, fontSize: 13 }}>
                    Chargement des buts…
                  </Text>
                </View>
              )}

              {!loading && goalsByPeriod.length === 0 && (
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  Aucun but ou statistiques non disponibles pour ce match.
                </Text>
              )}

              {!loading &&
                goalsByPeriod.map((group) => (
                  <View key={group.label} style={{ marginTop: 8 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        marginBottom: 4,
                      }}
                    >
                      {group.label}
                    </Text>

                    {group.goals.map((goal) => {
                        const time = goal.timeInPeriod || '??:??';

                        // 🔹 Buteur
                        const scorerShort = shortName(goal.scoringPlayerName || '');
                        const scorerTotal =
                            typeof goal.scoringPlayerTotal === 'number'
                            ? goal.scoringPlayerTotal
                            : (typeof goal.scoringPlayerTotal === 'string' && goal.scoringPlayerTotal !== ''
                                ? goal.scoringPlayerTotal
                                : null);

                        // 🔹 Passeurs (0, 1 ou 2)
                        const assists = [];
                        if (goal.assist1PlayerName) assists.push(shortName(goal.assist1PlayerName));
                        if (goal.assist2PlayerName) assists.push(shortName(goal.assist2PlayerName));

                        let assistsText = '';
                        if (assists.length === 1) {
                            assistsText = `Assisté de ${assists[0]}`;
                        } else if (assists.length === 2) {
                            assistsText = `Assisté de ${assists[0]} et ${assists[1]}`;
                        }

                        const strength =
                            goal.strength && goal.strength !== 'EV'
                            ? ` • ${goal.strength}`
                            : '';

                        const avatarUrl = goal.scoringPlayerAvatarUrl;
                        
                        return (
                            <View
                            key={goal.id}
                            style={{
                                flexDirection: 'row',
                                paddingVertical: 6,
                            }}
                            >
                            {/* Avatar joueur */}
                            <View
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#111827',
                                overflow: 'hidden',
                                marginRight: 8,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            >
                            {avatarUrl ? (
                                <Image
                                source={{ uri: avatarUrl }}
                                style={{ width: 32, height: 32 }}
                                resizeMode="cover"
                                />
                            ) : (
                                <Text
                                style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: '#fff',
                                }}
                                >
                                { (goal.teamAbbr || '??') }
                                </Text>
                            )}
                            </View>

                            {/* Texte buteur + ligne des assists */}
                            <View style={{ flex: 1 }}>
                                {/* Ligne 1 : A. Ovechkin (7) en gras + strength */}
                                <Text
                                style={{
                                    color: colors.text,
                                    fontWeight: '700',
                                }}
                                numberOfLines={1}
                                >
                                {scorerShort || 'But'}
                                {scorerTotal != null ? ` (${scorerTotal})` : ''}
                                {strength}
                                </Text>

                                {/* Ligne 2 : 2:17 - Assisté de ... */}
                                <Text
                                style={{
                                    color: colors.subtext,
                                    fontSize: 12,
                                    marginTop: 2,
                                }}
                                numberOfLines={2}
                                >
                                {time}
                                {assistsText ? ` - ${assistsText}` : ''}
                                </Text>
                            </View>
                            </View>
                        );
                        })}
                  </View>
                ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function shortName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]; // ex: "McDavid"

  const last = parts[parts.length - 1];
  const first = parts[0];
  const initial = first.charAt(0).toUpperCase();

  return `${initial}. ${last}`;
}

/* ========================
   Screen principal
========================= */

export default function MatchLiveScreen() {
  const { colors } = useTheme();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedGame, setSelectedGame] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const effectiveYmd = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const today = todayYMD();

    // 👉 Entre 00:00 et 04:59, on affiche les matchs d'hier
    if (hour < 5) {
        return addDaysToYMD(today, -1);
    }
    return today;
   }, []);


function addDaysToYMD(baseYmd, delta) {
  // baseYmd = 'YYYY-MM-DD'
  if (!baseYmd || typeof baseYmd !== 'string' || baseYmd.length < 10) return baseYmd;
  const [y, m, d] = baseYmd.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function periodLabelFromGame(game) {
  const { period, periodType, clock, isLive, isFinal } = game || {};

  if (period == null && !clock) return null;

  let base = null;

  const pt = (periodType || '').toUpperCase();
  if (pt === 'OT') {
    base = 'Prolongation';
  } else if (pt === 'SO') {
    base = 'Tirs de barrage';
  } else if (period != null) {
    base = `Période ${period}`;
  }

  // Si match en direct, on ajoute le temps restant
  if (base && clock && isLive) {
    return `${base} • ${clock}`;
  }

  // Si on n’a pas de base mais on a un clock (cas bizarre), on montre au moins le clock
  return base || clock || null;
}

// 🔴 Écoute Firestore UNIQUEMENT sur les matchs du jour via 'date'
useEffect(() => {
  const ref = firestore().collection('nhl_live_games');

  const unsub = ref.onSnapshot(
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const todays = all.filter((g) => isGameToday(g, effectiveYmd));

      

      setGames(todays);
      setLoading(false);
    },
    (err) => {
      console.log('[MatchLive] nhl_live_games error', err?.message || err);
      setLoading(false);
    }
  );

  return () => {
    try { unsub(); } catch {}
  };
}, [effectiveYmd]);

  // Tri: LIVE -> à venir -> final, puis par heure de début
  const sortedGames = useMemo(() => {
    const s = [...games];
    const weight = (g) => (g.isLive ? 0 : g.isFinal ? 2 : 1);
    s.sort((a, b) => {
      const w = weight(a) - weight(b);
      if (w !== 0) return w;

      const ta = gStartMillis(a);
      const tb = gStartMillis(b);
      return ta - tb;
    });
    return s;
  }, [games]);

  const handlePressGame = useCallback((game) => {
    setSelectedGame(game);
    setModalVisible(true);
  }, []);

  // Appelle la Cloud Function onCall pour forcer une mise à jour côté backend
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fn = functions().httpsCallable('updateNhlLiveGamesNow');
      await fn({});
    } catch (e) {
      console.log('[MatchLive] manual refresh error', e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Match Live' }} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: colors.subtext }}>
            Chargement des matchs…
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedGames}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={() => (
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: colors.text,
                  marginBottom: 4,
                }}
              >
                Matchs NHL d’aujourd’hui
              </Text>
              <Text style={{ color: colors.subtext, fontSize: 13 }}>
                Touchez un match pour voir les buts et les buteurs en temps réel.
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <GameRow game={item} onPress={handlePressGame} colors={colors} />
          )}
          ListEmptyComponent={() => (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.subtext }}>
                Aucun match trouvé pour aujourd’hui.
              </Text>
            </View>
          )}
        />
      )}

      <GameDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        game={selectedGame}
        colors={colors}
      />
    </>
  );
}