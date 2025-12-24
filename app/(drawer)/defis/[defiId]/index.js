// app/defis/[defiId]/index.js
// Écran de participation à un défi NHL (RNFirebase)

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';

import { DrawerToggleButton } from '@react-navigation/drawer';
import { HeaderBackButton } from '@react-navigation/elements';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';

import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

import { Ionicons } from '@expo/vector-icons';
import isEqual from 'lodash.isequal';
import { useTheme } from '@src/theme/ThemeProvider';

// ✅ i18n
import i18n from '@src/i18n/i18n';

import { getDefiRules, validatePicks, getTierByIndex } from '@src/defis/tiersRules';

/* ---------------- Logos NHL (local) ---------------- */
const LOGO_MAP = {
  ANA: require('../../../../assets/nhl-logos/ANA.png'),
  ARI: require('../../../../assets/nhl-logos/ARI.png'),
  BOS: require('../../../../assets/nhl-logos/BOS.png'),
  BUF: require('../../../../assets/nhl-logos/BUF.png'),
  CAR: require('../../../../assets/nhl-logos/CAR.png'),
  CBJ: require('../../../../assets/nhl-logos/CBJ.png'),
  CGY: require('../../../../assets/nhl-logos/CGY.png'),
  CHI: require('../../../../assets/nhl-logos/CHI.png'),
  COL: require('../../../../assets/nhl-logos/COL.png'),
  DAL: require('../../../../assets/nhl-logos/DAL.png'),
  DET: require('../../../../assets/nhl-logos/DET.png'),
  EDM: require('../../../../assets/nhl-logos/EDM.png'),
  FLA: require('../../../../assets/nhl-logos/FLA.png'),
  LAK: require('../../../../assets/nhl-logos/LAK.png'),
  MIN: require('../../../../assets/nhl-logos/MIN.png'),
  MTL: require('../../../../assets/nhl-logos/MTL.png'),
  NJD: require('../../../../assets/nhl-logos/NJD.png'),
  NSH: require('../../../../assets/nhl-logos/NSH.png'),
  NYI: require('../../../../assets/nhl-logos/NYI.png'),
  NYR: require('../../../../assets/nhl-logos/NYR.png'),
  OTT: require('../../../../assets/nhl-logos/OTT.png'),
  PHI: require('../../../../assets/nhl-logos/PHI.png'),
  PIT: require('../../../../assets/nhl-logos/PIT.png'),
  SEA: require('../../../../assets/nhl-logos/SEA.png'),
  SJS: require('../../../../assets/nhl-logos/SJS.png'),
  STL: require('../../../../assets/nhl-logos/STL.png'),
  TBL: require('../../../../assets/nhl-logos/TBL.png'),
  TOR: require('../../../../assets/nhl-logos/TOR.png'),
  UTA: require('../../../../assets/nhl-logos/UTA.png'),
  VAN: require('../../../../assets/nhl-logos/VAN.png'),
  VGK: require('../../../../assets/nhl-logos/VGK.png'),
  WPG: require('../../../../assets/nhl-logos/WPG.png'),
  WSH: require('../../../../assets/nhl-logos/WSH.png'),
};

function LoadingOverlay({
  visible,
  text = i18n.t('defi.loading.generic'),
}) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View
      pointerEvents="auto"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <View
        style={{
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 12,
          backgroundColor: colors.card,
          minWidth: 220,
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
          }}
        >
          {text}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.subtext,
            textAlign: 'center',
          }}
        >
          {i18n.t('defi.loading.overlayHint')}
        </Text>
      </View>
    </View>
  );
}

function getPickPrefix() {
  // FR = C (Choix), EN = P (Pick)
  const lang = String(i18n.locale || "").toLowerCase();
  return lang.startsWith("fr") ? "C" : "P";
}

function fmtTierRequirements(rules) {
  const prefix = getPickPrefix();

  // mapping T1->(C1/P1), T2->(C2/P2), T3->(C3/P3)
  const parts = [
    rules?.T1 ? `${rules.T1} ${prefix}1` : null,
    rules?.T2 ? `${rules.T2} ${prefix}2` : null,
    rules?.T3 ? `${rules.T3} ${prefix}3` : null,
  ].filter(Boolean);

  return parts.join(", ");
}

/* --------------------------- helpers --------------------------- */
function fmtTSLocalHM(v) {
  try {
    const d =
      v?.toDate?.()
        ? v.toDate()
        : v instanceof Date
        ? v
        : v
        ? new Date(v)
        : null;
    if (!d) return '—';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '—';
  }
}
function fmtLocalDateStr(d) {
  if (!d) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtUTCDateStr(d) {
  if (!d) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toYMD(v) {
  if (!v) return null;

  // Si déjà une string "YYYY-MM-DD", on la garde
  if (typeof v === "string") {
    const s = v.trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : new Date(v);
  if (!d || Number.isNaN(d.getTime())) return null;

  // ✅ UTC pour être stable peu importe le timezone
  return fmtUTCDateStr(d);
}
function isPast(ts) {
  if (!ts) return false;
  const d =
    ts?.toDate?.()
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : new Date(ts);
  return Date.now() > d.getTime();
}
const pick = (o, k) => (o && o[k] !== undefined ? o[k] : undefined);
const pickAbbr = (t) =>
  (pick(t, 'teamAbbrev')?.default ??
    pick(t, 'teamAbbrev') ??
    pick(t, 'abbrev') ??
    '')?.toUpperCase?.();

function teamLogo(abbr) {
  return LOGO_MAP[abbr];
}
function headshotUrl(abbr, playerId) {
  return abbr && playerId
    ? `https://assets.nhle.com/mugs/nhl/20252026/${abbr}/${playerId}.png`
    : null;
}


function TierBadge({ tier }) {
  const { colors } = useTheme();
  const t = String(tier || 'T3');

  const styles = {
    T1: { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)', fg: '#b45309' }, // amber
    T2: { bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.35)', fg: '#1d4ed8' }, // blue
    T3: { bg: 'rgba(107,114,128,0.14)', border: colors.border, fg: colors.subtext },     // neutral
  }[t] || { bg: 'rgba(107,114,128,0.14)', border: colors.border, fg: colors.subtext };

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: styles.bg,
        borderWidth: 1,
        borderColor: styles.border,
        alignSelf: 'center',
        transform: [{ translateY: 1 }],
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: styles.fg,
          lineHeight: 14,
        }}
      >
        {t}
      </Text>
    </View>
  );
}

/* --------------------------- API NHL --------------------------- */
async function fetchGamesOn(ymd) {
  try {
    
    const res = await fetch(
      `https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`
    );
    
    if (!res.ok) return [];
    const data = await res.json();
    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find((d) => d?.date === ymd)
      : null;
    const games = day
      ? day.games || []
      : Array.isArray(data?.games)
      ? data.games
      : [];
    return games.map((g) => {
      const awayRaw = g?.awayTeam?.abbrev || g?.awayTeamAbbrev || g?.awayTeam;
      const homeRaw = g?.homeTeam?.abbrev || g?.homeTeamAbbrev || g?.homeTeam;
      const away =
        typeof awayRaw === 'string'
          ? awayRaw.toUpperCase()
          : pickAbbr(awayRaw);
      const home =
        typeof homeRaw === 'string'
          ? homeRaw.toUpperCase()
          : pickAbbr(homeRaw);
      return {
        id: g.id,
        away,
        home,
        start: g?.startTimeUTC ? new Date(g.startTimeUTC) : null,
      };
    });
  } catch (e){
    console.log("[ERROR:] status =", e);
    return [];
  }
}
async function fetchTeamsPlayingOn(ymd) {
  if (!ymd) return new Set();
  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/schedule/${encodeURIComponent(ymd)}`
    );
    if (!res.ok) return new Set();
    const data = await res.json();
    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find((d) => d?.date === ymd)
      : null;
    const games = day
      ? day.games || []
      : Array.isArray(data?.games)
      ? data.games
      : [];
    const abbrs = new Set();
    for (const g of games) {
      const home = g?.homeTeam ?? g?.homeTeamAbbrev ?? g?.homeTeam?.abbrev;
      const away = g?.awayTeam ?? g?.awayTeamAbbrev ?? g?.awayTeam?.abbrev;
      const hAbbr =
        typeof home === 'string' ? home.toUpperCase() : pickAbbr(home);
      const aAbbr =
        typeof away === 'string' ? away.toUpperCase() : pickAbbr(away);
      if (hAbbr) abbrs.add(hAbbr);
      if (aAbbr) abbrs.add(aAbbr);
    }
    return abbrs;
  } catch {
    return new Set();
  }
}

/* --------------------------- Saison & cache --------------------------- */
const DAY = 24 * 60 * 60 * 1000;
function msUntilNextSept15(from = new Date()) {
  const y = from.getFullYear();
  const sept15ThisYear = new Date(y, 8, 15, 0, 0, 0, 0);
  const target =
    from <= sept15ThisYear
      ? sept15ThisYear
      : new Date(y + 1, 8, 15, 0, 0, 0, 0);
  return target.getTime() - from.getTime();
}
function getCurrentSeasonId(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const start = m >= 7 ? y : y - 1;
  return `${start}${start + 1}`;
}
function getPreviousSeasonId(date = new Date()) {
  const curStart = Number(getCurrentSeasonId(date).slice(0, 4));
  const prevStart = curStart - 1;
  return `${prevStart}${prevStart + 1}`;
}
function ttlForSeason(seasonId, now = new Date()) {
  const cur = getCurrentSeasonId(now);
  const prev = getPreviousSeasonId(now);
  if (seasonId === cur) return DAY;
  if (seasonId === prev) return Math.max(msUntilNextSept15(now), DAY);
  return 180 * DAY;
}

// ✅ Version du cache (augmente si structure change)
const CACHE_VERSION = 'v5';
const cacheKeyForSeason = (seasonId) =>
  `${CACHE_VERSION}_nhl_stats_current_${seasonId}`;

/* ----------- Firestore (RNFirebase) utils: stats paginées ----------- */
async function loadAllSkaterStatsForSeason(seasonId) {
  const map = {};
  try {
    let pageQ = firestore()
      .collection('nhl_player_stats_current')
      .where('seasonId', '==', seasonId)
      .orderBy('playerId')
      .limit(500);

    while (true) {
      const snap = await pageQ.get();
      if (snap.empty) break;

      snap.forEach((docSnap) => {
        const s = docSnap.data() || {};
        const pid = String(s.playerId ?? "");
        if (!pid) return;

        const g = Number(s.goals ?? 0);
        const a = Number(s.assists ?? 0);
        const pts = Number.isFinite(s.points) ? Number(s.points) : g + a;

        const coeff = Number(s.coeff);
        const safeCoeff = Number.isFinite(coeff) ? coeff : 1;

        map[pid] = {
          goals: g,
          assists: a,
          points: pts,

          // ✅ champs d’ingestion (ton nhlIngest écrit skaterFullName / teamAbbrevs)
          teamAbbr: (s.teamAbbrevs ?? s.teamAbbr ?? "").toUpperCase() || null,
          fullName: s.skaterFullName ?? s.fullName ?? null,

          // ✅ nouveau
          coeff: safeCoeff,
          positionCode: s.positionCode ?? null,

          playerId: pid,
        };
      });
      const last = snap.docs[snap.docs.length - 1];
      pageQ = firestore()
        .collection('nhl_player_stats_current')
        .where('seasonId', '==', seasonId)
        .orderBy('playerId')
        .startAfter(last)
        .limit(500);
    }

    console.log(
      `[FIRESTORE] seasonId=${seasonId} fetched=${Object.keys(map).length}`
    );
    return map;
  } catch (err) {
    console.log('[STATS] Fallback no-index path', err?.message || err);
    try {
      let pageQ = firestore()
        .collection('nhl_player_stats_current')
        .orderBy('playerId')
        .limit(500);
      while (true) {
        const snap = await pageQ.get();
        if (snap.empty) break;
        snap.forEach((docSnap) => {
          const s = docSnap.data() || {};
          const pid = String(s.playerId ?? "");
          if (!pid) return;

          const g = Number(s.goals ?? 0);
          const a = Number(s.assists ?? 0);
          const pts = Number.isFinite(s.points) ? Number(s.points) : g + a;

          const coeff = Number(s.coeff);
          const safeCoeff = Number.isFinite(coeff) ? coeff : 1;

          map[pid] = {
            goals: g,
            assists: a,
            points: pts,

            // ✅ champs d’ingestion (ton nhlIngest écrit skaterFullName / teamAbbrevs)
            teamAbbr: (s.teamAbbrevs ?? s.teamAbbr ?? "").toUpperCase() || null,
            fullName: s.skaterFullName ?? s.fullName ?? null,

            // ✅ nouveau
            coeff: safeCoeff,
            positionCode: s.positionCode ?? null,

            playerId: pid,
          };
        });
        const last = snap.docs[snap.docs.length - 1];
        pageQ = firestore()
          .collection('nhl_player_stats_current')
          .orderBy('playerId')
          .startAfter(last)
          .limit(500);
      }
      console.log(
        `[FIRESTORE] (fallback) seasonId=${seasonId} fetched=${Object.keys(
          map
        ).length}`
      );
      return map;
    } catch (e2) {
      console.log('[STATS] fallback failed', e2?.message || e2);
      return {};
    }
  }
}

async function loadAllSkaterStatsWithCache(seasonId, { force = false } = {}) {
  const key = cacheKeyForSeason(seasonId);
  const ttl = ttlForSeason(seasonId);

  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && parsed?.seasonId === seasonId) {
          const age = Date.now() - parsed.ts;
          if (
            age < ttl &&
            parsed?.data &&
            Object.keys(parsed.data).length
          ) {
            console.log(
              `[STATS] cache hit seasonId=${seasonId} players=${Object.keys(
                parsed.data
              ).length}`
            );
            return parsed.data;
          }
        }
      }
    } catch {}
  }

  const fresh = await loadAllSkaterStatsForSeason(seasonId);
  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ ts: Date.now(), seasonId, data: fresh })
    );
  } catch {}
  return fresh;
}

/* --------------------------- Modal de sélection --------------------------- */
function PlayerSelectModal({ visible, onClose, options, onPick }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (visible) setQ('');
  }, [visible]);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKbHeight(e.endCoordinates?.height ?? 0)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const filtered = useMemo(() => {
    const base = Array.isArray(options) ? options.slice() : [];
    const qq = q.trim().toLowerCase();
    const list = qq
      ? base.filter((p) =>
          String(p.fullName || '')
            .toLowerCase()
            .includes(qq)
        )
      : base;
    list.sort(
      (a, b) =>
        Number(b.points ?? 0) - Number(a.points ?? 0) ||
        String(a.fullName || '').localeCompare(String(b.fullName || ''))
    );
    return list;
  }, [q, options]);

  const keyboardVerticalOffset = Platform.select({ ios: 64, android: 0 });

  function Avatar({ player, size = 36, style }) {
    const primary =
      headshotUrl(player?.teamAbbr, player?.playerId) ||
      player?.photoUrl ||
      player?.avatarUrl ||
      null;
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      player?.fullName || 'Joueur'
    )}&background=111827&color=f9fafb&size=${Math.max(64, size * 2)}`;
    const [uri, setUri] = React.useState(primary || fallback);
    React.useEffect(() => {
      setUri(primary || fallback);
    }, [player?.playerId, primary]);
    return (
      <Image
        source={{ uri }}
        onError={() => setUri(fallback)}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.card,
          },
          style,
        ]}
      />
    );
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 8,
            paddingHorizontal: 12,
            maxHeight: '85%',
            minHeight: 300,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 6 }}>
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingBottom: 6,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                flex: 1,
                color: colors.text,
              }}
            >
              {i18n.t('defi.playerSelect.title')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 16, color: colors.primary }}>
                {i18n.t('defi.playerSelect.close')}
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={i18n.t('defi.playerSelect.searchPlaceholder')}
            placeholderTextColor={colors.subtext}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              marginBottom: 8,
              backgroundColor: colors.background,
              color: colors.text,
            }}
            returnKeyType="search"
          />

          <FlatList
            data={filtered}
            keyExtractor={(item, idx) =>
              String(item?.playerId ?? item?.id ?? `player-${idx}`)
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: kbHeight + 24 }}
            ListFooterComponent={<View style={{ height: kbHeight }} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onPick?.(item);
                  onClose?.();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Avatar player={item} size={36} style={{ marginRight: 10 }} />
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 16, flexShrink: 1, color: colors.text }}
                  >
                    {item.fullName}
                  </Text>
                  {!!item.teamAbbr && (
                    <Image
                      source={teamLogo(item.teamAbbr)}
                      style={{ width: 18, height: 18, marginLeft: 6 }}
                    />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontVariant: ['tabular-nums'],
                    fontWeight: '600',
                    marginLeft: 8,
                    color: colors.subtext,
                  }}
                >
                  {(item.goals ?? 0) + "-" + (item.assists ?? 0) + "-" + (item.points ?? 0)}
                </Text>

                <View style={{ marginLeft: 10 }}>
                  <TierBadge tier={item.tier} />
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


/* ----------------------- Ligne de sélection ---------------------- */
function PlayerPickerRow({ label, value, onEdit, locked }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          marginBottom: 6,
          fontWeight: '600',
          color: colors.text,
        }}
      >
        {label}
      </Text>
      {value ? (
        <View
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.card,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flex: 1,
              marginRight: 10,
            }}
          >
            <Image
              source={{
                uri: headshotUrl(value.teamAbbr, value.playerId),
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                marginRight: 8,
                backgroundColor: colors.background,
              }}
            />
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.text }}
            >
              {value.fullName}{' '}
              {value.teamAbbr ? `• ${value.teamAbbr}` : ''}
            </Text>
             {/* ✅ Stats + coeff sous le nom */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>
                {(value.goals ?? 0) + "-" + (value.assists ?? 0) + "-" + (value.points ?? 0)}
                {value.rank ? `  •  #${value.rank}` : ''}
              </Text>
              <TierBadge tier={value.tier} />
            </View>
          </View>
          {!locked && (
            <TouchableOpacity
              onPress={onEdit}
              style={{ padding: 6 }}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={colors.subtext}
              />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onEdit}
          disabled={locked}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.subtext }}>
            {i18n.t('defi.playerSelect.emptyChoice')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* --------------------------- Sélecteur de saison --------------------------- */
function SeasonToggle({ seasonId, onChange }) {
  const { colors } = useTheme();
  const cur = getCurrentSeasonId();
  const prev = getPreviousSeasonId();
  const Button = ({ label, value, active }) => (
    <TouchableOpacity
      onPress={() => onChange(value)}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: active ? colors.primary : colors.card,
        marginRight: 8,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={{
          color: active ? '#fff' : colors.text,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
      }}
    >
      <Button
        label={i18n.t('defi.seasonToggle.current', { id: cur })}
        value={cur}
        active={seasonId === cur}
      />
      <Button
        label={i18n.t('defi.seasonToggle.previous', { id: prev })}
        value={prev}
        active={seasonId === prev}
      />
    </View>
  );
}

/* ---------------------------------- Screen ---------------------------------- */
export default function DefiParticipationScreen() {
  const { defiId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [defi, setDefi] = useState(null);
  const [error, setError] = useState(null);
  const [loadingDefi, setLoadingDefi] = useState(true);

  const [teamAbbrs, setTeamAbbrs] = useState(new Set());
  const [games, setGames] = useState([]);

  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]); // [player|null, ...]

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [statsById, setStatsById] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshNote, setRefreshNote] = useState(null);

  const [saving, setSaving] = useState(false);

    

  // snapshot des picks "déjà sauvegardés" (pour détecter une modification)
  const savedPicksRef = useRef(null); // array de picks normalisés
  const [hasSavedOnce, setHasSavedOnce] = useState(false);

  const savingRef = useRef(false);

  // Saison & cache
  const [seasonId, _setSeasonId] = useState(getCurrentSeasonId());
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('preferred_seasonId');
        if (saved) _setSeasonId(saved);
      } catch {}
    })();
  }, []);
  useEffect(() => {
    AsyncStorage.setItem('preferred_seasonId', seasonId).catch(() => {});
  }, [seasonId]);

  // Charger défi (RNFirebase)
  useEffect(() => {
    if (!defiId) return;
    setLoadingDefi(true);
    const ref = firestore().doc(`defis/${String(defiId)}`);

    let lastDefi = null;
    const unsub = ref.onSnapshot(
      (snap) => {
        const next = snap.exists ? { id: snap.id, ...snap.data() } : null;
        if (!isEqual(next, lastDefi)) {
          lastDefi = next;
          setDefi(next);
        }
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

  const rules = useMemo(() => getDefiRules(defi?.type), [defi?.type]);

  const requirementsText = useMemo(() => {
    if (!rules) return null;
    return fmtTierRequirements(rules);
  }, [rules]);

  useEffect(() => {
    setSelected((prev) =>
      Array.from({ length: maxChoices }, (_, i) => prev?.[i] ?? null)
    );
  }, [maxChoices]);

  // Charger participation existante (RNFirebase)
  useEffect(() => {
    (async () => {
      if (!defi?.id || !user?.uid) return;
      try {
        const ref = firestore().doc(
          `defis/${String(defi.id)}/participations/${user.uid}`
        );
        const snap = await ref.get();
        if (snap.exists) {
          const p = snap.data() || {};
          const picks = Array.isArray(p.picks) ? p.picks : [];

          // ✅ flag "déjà sauvegardé"
          setHasSavedOnce(picks.length > 0);

          // ✅ mémorise les picks sauvegardés pour comparer avant save
          savedPicksRef.current = picks.map((x) => ({
            playerId: String(x?.playerId ?? ""),
          }));

          setSelected((prev) =>
            Array.from({ length: maxChoices }, (_, i) => {
              const x = picks[i];
              return x
                ? {
                    playerId: x.playerId,
                    fullName: x.fullName,
                    teamAbbr: x.teamAbbr,
                  }
                : prev?.[i] ?? null;
            })
          );
        } else {
          setHasSavedOnce(false);
          savedPicksRef.current = null;
        }
      } catch (e) {
        setError(e);
      }
    })();
  }, [defi?.id, user?.uid, maxChoices]);

  const gameYMD = useMemo(
    () => toYMD(defi?.gameDate),
    [defi?.gameDate]
  );

  useEffect(() => {
  console.log("[defi] raw gameDate:", defi?.gameDate);
  console.log("[defi] gameYMD computed:", gameYMD);
}, [defi?.gameDate, gameYMD]);

  // Équipes & matchs du jour
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!gameYMD) return;
      const [set, gm] = await Promise.all([
        fetchTeamsPlayingOn(gameYMD),
        fetchGamesOn(gameYMD),
      ]);
      if (cancelled) return;
      setTeamAbbrs((prev) => (isEqual(prev, set) ? prev : set));
      setGames((prev) => (isEqual(prev, gm) ? prev : gm));
    })();
    return () => {
      cancelled = true;
    };
  }, [gameYMD]);

  const abbrList = useMemo(() => Array.from(teamAbbrs), [teamAbbrs]);

  // Joueurs des équipes qui jouent
  useEffect(() => {
    (async () => {
      if (!abbrList.length) {
        setPlayers([]);
        return;
      }
      try {
        const chunks = [];
        for (let i = 0; i < abbrList.length; i += 10)
          chunks.push(abbrList.slice(i, i + 10));
        const results = [];
        for (const chunk of chunks) {
          const snap = await firestore()
            .collection('nhl_players')
            .where('teamAbbr', 'in', chunk)
            .get();

          snap.forEach((docSnap) => {
            const p = docSnap.data() || {};
            results.push({
              playerId: p.playerId,
              fullName: p.fullName,
              teamAbbr: (p.teamAbbr || '').toUpperCase(),
            });
          });
        }
        results.sort((a, b) =>
          String(a.fullName).localeCompare(String(b.fullName))
        );
        setPlayers((prev) => (isEqual(prev, results) ? prev : results));
      } catch (e) {
        setError(e);
      }
    })();
  }, [JSON.stringify(abbrList)]);

  // Chargement des stats pour la saison
  const loadingRef = useRef(false);
  const lastAppliedRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loadingRef.current) return;
      if (lastAppliedRef.current === seasonId) return;
      loadingRef.current = true;
      try {
        const isCurrent = seasonId === getCurrentSeasonId();
        if (isCurrent)
          setRefreshNote(i18n.t('defi.loading.statsUpdatingToday'));
        setLoadingStats(true);
        const data = await loadAllSkaterStatsWithCache(seasonId, {
          force: false,
        });
        if (!cancelled && !isEqual(lastAppliedRef.current?.data, data)) {
          setStatsById(data);
          lastAppliedRef.current = { id: seasonId, data };
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
          setRefreshNote(null);
        }
        loadingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  function normalizeCurrentPickIds(selectedArr) {
    return (selectedArr || []).map((p) => String(p?.playerId ?? ""));
  }

  function sameIds(a = [], b = []) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
    return true;
  }

  // Changement de saison → force reload
  const setSeasonId = useCallback((val) => {
    setStatsById({});
    setLoadingStats(true);
    setRefreshNote(i18n.t('defi.loading.statsUpdatingSeason'));
    _setSeasonId(val);
    setTimeout(async () => {
      const map = await loadAllSkaterStatsWithCache(val, { force: true });
      console.log(
        '[STATS] applied seasonId (forced)',
        val,
        'players',
        Object.keys(map).length
      );
      setStatsById(map);
      setLoadingStats(false);
      setRefreshNote(null);
      lastAppliedRef.current = val;
    }, 0);
  }, []);

  const locked = useMemo(() => {
    if (!defi) return true;
    const statusKey = String(defi.status || '').toLowerCase();
    if (statusKey !== 'open') return true;
    if (!defi.signupDeadline) return false;
    return isPast(defi.signupDeadline);
  }, [defi]);

  const headerTitle = useMemo(() => {
    const base =
      defi?.title ||
      (defi?.type
        ? `${i18n.t('home.challenge')} ${defi.type}x${defi.type}`
        : i18n.t('defi.header.defaultTitle'));
    return base;
  }, [defi]);

const playersWithStats = useMemo(() => {
  const arr = (players || []).map((p) => {
    const st = statsById[String(p.playerId)] || {};
    const g = Number(st.goals ?? 0);
    const a = Number(st.assists ?? 0);
    const pts = Number.isFinite(st.points) ? Number(st.points) : g + a;
    return {
      ...p,
      goals: g,
      assists: a,
      points: pts,
      positionCode: st.positionCode ?? null,
    };
  });

  // tri par points (desc)
  arr.sort(
    (x, y) =>
      Number(y.points ?? 0) - Number(x.points ?? 0) ||
      String(x.fullName || '').localeCompare(String(y.fullName || ''))
  );

  // ✅ ajoute rank + tier (sur la liste du soir)
  return arr.map((p, idx) => ({
    ...p,
    rank: idx + 1,
    tier: getTierByIndex(idx),
  }));
}, [players, statsById]);

const tierById = useMemo(() => {
  const m = {};
  for (const p of playersWithStats) {
    if (p?.playerId) m[String(p.playerId)] = { tier: p.tier, rank: p.rank };
  }
  return m;
}, [playersWithStats]);

const selectedWithStats = useMemo(() => {
  return (selected || []).map((p) => {
    if (!p?.playerId) return p;
    const st = statsById[String(p.playerId)] || {};
    const g = Number(st.goals ?? 0);
    const a = Number(st.assists ?? 0);
    const pts = Number.isFinite(st.points) ? Number(st.points) : g + a;

    const extra = tierById[String(p.playerId)] || {};
    return {
      ...p,
      goals: g,
      assists: a,
      points: pts,
      tier: extra.tier || 'T3',
      rank: extra.rank || null,
    };
  });
}, [selected, statsById, tierById]);

  const openPicker = useCallback((index) => {
    setPickerIndex(index);
    setPickerOpen(true);
    Keyboard.dismiss();
  }, []);

  function withTier(pl, tierById) {
    if (!pl?.playerId) return pl;
    const extra = tierById?.[String(pl.playerId)];
    return {
      ...pl,
      tier: pl.tier || extra?.tier || "T3",
      rank: pl.rank || extra?.rank || null,
    };
  }

const handlePick = useCallback(
  (p) => {
    const rules = getDefiRules(defi?.type);

    setSelected((prev) => {
      const alreadyUsed = prev.some(
        (pl, idx) => pl?.playerId === p.playerId && idx !== pickerIndex
      );
      if (alreadyUsed) {
        Alert.alert(
          i18n.t('defi.alerts.playerDuplicateTitle'),
          i18n.t('defi.alerts.playerDuplicateMessage', { name: p.fullName }),
          [{ text: i18n.t('common.ok') }]
        );
        return prev;
      }

      const next = [...prev];
      next[pickerIndex] = p;

      // ✅ Enrichit TOUS les picks avec tier/rank avant validation
      const chosen = next
        .filter(Boolean)
        .map((pl) => withTier(pl, tierById));

      if (chosen.length === rules.picks) {
        const err = validatePicks(chosen, rules, i18n);
        if (err) {
          Alert.alert('Règles de tiers', err, [{ text: 'OK' }]);
          return prev;
        }
      } else {
        // ✅ Comptage sur les tiers enrichis
        const count = { T1: 0, T2: 0, T3: 0 };
        for (const pl of chosen) {
          const t = pl?.tier || 'T3';
          count[t] = (count[t] || 0) + 1;
        }

        for (const tier of ['T1', 'T2', 'T3']) {
          if (count[tier] > rules[tier]) {
            Alert.alert(
              'Règles de tiers',
              `Tu as dépassé la limite ${tier} (${rules[tier]} max) pour ce défi.`,
              [{ text: 'OK' }]
            );
            return prev;
          }
        }
      }

      return next;
    });
  },
  [pickerIndex, defi?.type, tierById] // ✅ ajoute tierById ici
);

  const allChosen = useMemo(
    () => selected.filter(Boolean).length === maxChoices,
    [selected, maxChoices]
  );

  const save = useCallback(async () => {
    if (!user?.uid || !defi?.id) return;
    if (locked) {
      Alert.alert(
        i18n.t('defi.alerts.lockedTitle'),
        i18n.t('defi.alerts.lockedMessage')
      );
      return;
    }
    if (!allChosen) {
      Alert.alert(
        i18n.t('defi.alerts.incompleteTitle'),
        i18n.t('defi.alerts.incompleteMessage', { count: maxChoices })
      );
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const msgTimer = setTimeout(() => {
      setRefreshNote(i18n.t('defi.alerts.savingSlow'));
    }, 400);

    try {
      // ✅ Avertissement: modification après 1ère sauvegarde = 1 crédit
      const savedIds = Array.isArray(savedPicksRef.current)
        ? savedPicksRef.current.map((x) => String(x.playerId ?? ""))
        : null;

      const currentIds = normalizeCurrentPickIds(selected);

      const isEditAfterFirstSave =
        hasSavedOnce &&
        savedIds &&
        savedIds.length === currentIds.length &&
        !sameIds(savedIds, currentIds);

      if (isEditAfterFirstSave) {
        const proceed = await new Promise((resolve) => {
          Alert.alert(
            i18n.t("credits.editWarningTitle", { defaultValue: "Modify picks?" }),
            i18n.t("credits.editWarningBody", {
              defaultValue:
                "Changing your selection after your first save costs 1 credit. Continue?",
            }),
            [
              { text: i18n.t("common.cancel", { defaultValue: "Cancel" }), style: "cancel", onPress: () => resolve(false) },
              { text: i18n.t("common.continue", { defaultValue: "Continue" }), style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });

        if (!proceed) return;
      }
      const call = functions().httpsCallable('participateInDefi');
      const res = await call({
        defiId: defi.id,
        picks: selected.map((p) => ({
          playerId: p.playerId,
          fullName: p.fullName,
          teamAbbr: p.teamAbbr,
        })),
      });

      const ok = res?.data?.ok === true;
      const newPot =
        typeof res?.data?.newPot === 'number' ? res.data.newPot : null;
      if (ok) {
        const potMsg =
          newPot !== null
            ? i18n.t('defi.alerts.successPotMessage', {
                count: newPot,
              })
            : i18n.t('defi.alerts.successPotMessageSimple');

        // ✅ met à jour la référence des picks sauvegardés
        setHasSavedOnce(true);
        savedPicksRef.current = selected.map((p) => ({ playerId: String(p?.playerId ?? "") }));

        Alert.alert(
          i18n.t('defi.alerts.successTitle'),
          i18n.t('defi.alerts.successMessage', {
            potMessage: potMsg,
          }),
          [
            {
              text: i18n.t('common.ok'),
              onPress: () =>
                router.replace('/(drawer)/(tabs)/ChallengesScreen'),
            },
          ]
        );
      } else {
        throw new Error(res?.data?.error || 'Erreur inconnue');
      }
    } catch (e) {
      Alert.alert(
        i18n.t('defi.alerts.genericErrorTitle'),
        String(e?.message || e)
      );
    } finally {
      clearTimeout(msgTimer);
      setRefreshNote(null);
      setSaving(false);
      savingRef.current = false;
    }
  }, [
    user?.uid,
    defi?.id,
    selected,
    maxChoices,
    locked,
    allChosen,
    router,
  ]);

  if (loadingDefi) {
    return (
      <>
        <Stack.Screen
          options={{
            title: i18n.t('defi.loading.title'),
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <Text
            style={{ marginTop: 8, color: colors.subtext }}
          >
            {i18n.t('defi.loading.generic')}
          </Text>
        </View>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            title: i18n.t('defi.header.errorTitle'),
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text }}>
            {i18n.t('common.errorLabel')}{' '}
            {String(error?.message || error)}
          </Text>
        </View>
      </>
    );
  }

  if (!defi) {
    return (
      <>
        <Stack.Screen
          options={{
            title: i18n.t('defi.header.notFoundTitle'),
            headerStyle: { backgroundColor: colors.card },
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
          }}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text }}>
            {i18n.t('defi.errors.notFoundMessage')}
          </Text>
        </View>
      </>
    );
  }

  const gameDayStr =
    typeof defi.gameDate === 'string'
      ? defi.gameDate
      : toYMD(defi.gameDate);

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle || i18n.t('defi.header.defaultTitle'),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
          headerLeft: ({ tintColor }) => (
            <View
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <HeaderBackButton
                tintColor={tintColor ?? colors.text}
                onPress={() =>
                  router.replace('/(drawer)/(tabs)/ChallengesScreen')
                }
              />
              <DrawerToggleButton
                tintColor={tintColor ?? colors.text}
              />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.select({
          ios: 'padding',
          android: undefined,
        })}
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 16,
            gap: 16,
            paddingBottom: 40,
            backgroundColor: colors.background,
          }}
        >
          {/* Infos défi */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              elevation: 3,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                marginBottom: 8,
                color: colors.text,
              }}
            >
              {headerTitle}
            </Text>
            <Text style={{ color: colors.text }}>
              {i18n.t('defi.infoCard.nhlDate')}:{' '}
              {gameDayStr || '—'}
            </Text>
            {defi.signupDeadline && (
              <Text style={{ color: colors.text }}>
                {i18n.t('defi.infoCard.signupDeadline')}{' '}
                {fmtTSLocalHM(defi.signupDeadline)}
              </Text>
            )}
            {defi.firstGameAtUTC && (
              <Text style={{ color: colors.text }}>
                {i18n.t('defi.infoCard.firstGameUtc')}{' '}
                {fmtTSLocalHM(defi.firstGameAtUTC)}
              </Text>
            )}
            <Text style={{ color: colors.text }}>
              {i18n.t('defi.infoCard.choicesCount')}{' '}
              {maxChoices}
            </Text>
            <Text style={{ color: colors.text }}>
              {i18n.t('defi.infoCard.status')}{' '}
              {defi.status || '—'}{' '}
              {locked
                ? `(${i18n.t('defi.infoCard.lockedSuffix')})`
                : ''}
            </Text>
            <Text style={{ color: colors.text }}>
              {i18n.t('defi.infoCard.pot', {
                count: defi.pot ?? 0,
              })}
            </Text>
          </View>

          {/* Matchs du jour */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              elevation: 3,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                marginBottom: 8,
                textAlign: 'center',
                color: colors.text,
              }}
            >
              {i18n.t('defi.gamesCard.title')}
            </Text>
            {games.length === 0 ? (
              <Text
                style={{
                  color: colors.subtext,
                  textAlign: 'center',
                }}
              >
                {i18n.t('defi.gamesCard.none')}
              </Text>
            ) : (
              <View>
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: '700',
                      color: colors.text,
                    }}
                  >
                    {i18n.t('defi.gamesCard.time')}
                  </Text>
                  <Text
                    style={{
                      flex: 2,
                      fontWeight: '700',
                      color: colors.text,
                    }}
                  >
                    {i18n.t('defi.gamesCard.away')}
                  </Text>
                  <Text
                    style={{
                      flex: 2,
                      fontWeight: '700',
                      color: colors.text,
                    }}
                  >
                    {i18n.t('defi.gamesCard.home')}
                  </Text>
                </View>
                {games.map((g, idx) => (
                  <View
                    key={g.id || idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ flex: 1, color: colors.text }}>
                      {g.start ? fmtTSLocalHM(g.start) : '—'}
                    </Text>
                    <View
                      style={{
                        flex: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Image
                        source={teamLogo(g.away)}
                        style={{
                          width: 24,
                          height: 24,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ color: colors.text }}>
                        {g.away}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Image
                        source={teamLogo(g.home)}
                        style={{
                          width: 24,
                          height: 24,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ color: colors.text }}>
                        {g.home}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Sélecteur de saison */}
          <SeasonToggle seasonId={seasonId} onChange={setSeasonId} />

          {/* Pickers */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              elevation: 3,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                marginBottom: 8,
                color: colors.text,
              }}
            >
              {i18n.t('defi.pickersCard.title')}
            </Text>

            {/* ✅ RÈGLES DU DÉFI */}
            {!!requirementsText && (
              <Text
                style={{
                  textAlign: "center",
                  color: colors.text,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                {i18n.t("defi.pickersCard.requirementsPrefix")} {requirementsText}.
              </Text>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <TierBadge tier="T1" />
            <TierBadge tier="T2" />
            <TierBadge tier="T3" />
          </View>
          <Text style={{ textAlign: 'center', color: colors.subtext, fontSize: 12, marginBottom: 8 }}>
            T1 = Top 10 • T2 = 11–20 • T3 = 21+
          </Text>
            {Array.from({ length: maxChoices }).map((_, i) => (
              <PlayerPickerRow
                key={`choice-${i}`}
                label={i18n.t('defi.pickersCard.choiceLabel', {
                  index: i + 1,
                })}
                value={selectedWithStats[i]} 
                onEdit={() => {
                  openPicker(i);
                }}
                locked={locked}
              />
            ))}
            <Text style={{ color: colors.subtext }}>
              {i18n.t('defi.pickersCard.summary', {
                current: selected.filter(Boolean).length,
                max: maxChoices,
              })}
            </Text>
          </View>

          {/* Actions */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 12,
              backgroundColor: colors.card,
              gap: 8,
              borderColor: colors.border,
            }}
          >
            <TouchableOpacity
              disabled={locked || !selected.every(Boolean) || saving}
              onPress={save}
              style={{
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor:
                  locked || !selected.every(Boolean) || saving
                    ? colors.subtext
                    : colors.primary,
              }}
            >
              {saving ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <ActivityIndicator size="small" color="#fff" />
                  <Text
                    style={{
                      color: '#fff',
                      fontWeight: '700',
                    }}
                  >
                    {i18n.t('defi.actions.primarySaving')}
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '700',
                  }}
                >
                  {locked
                    ? i18n.t('defi.actions.primaryLocked')
                    : i18n.t('defi.actions.primaryDefault')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                alignItems: 'center',
                backgroundColor: colors.background,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>
                {i18n.t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal & overlay */}
      <PlayerSelectModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        options={playersWithStats}
        onPick={handlePick}
      />
      <LoadingOverlay
        visible={loadingStats || saving}
        text={
          saving
            ? i18n.t('defi.actions.primarySaving')
            : refreshNote || i18n.t('defi.loading.statsGeneric')
        }
      />
    </>
  );
}