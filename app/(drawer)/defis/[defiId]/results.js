  // app/(drawer)/defis/[defiId]/results.js
  // Résultats (riche) + Chat repliable (hors FlatList)

  import React, { useEffect, useMemo, useRef, useState } from 'react';
  import {
    View,
    Text,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    ScrollView,
  } from 'react-native';
  import { SvgUri } from 'react-native-svg';
  import Toast from 'react-native-toast-message';
  import {
    Stack,
    useLocalSearchParams,
    useRouter,
  } from 'expo-router';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import firestore from '@react-native-firebase/firestore';
  import { useAuth } from '@src/auth/SafeAuthProvider';

  import { useTheme } from '@src/theme/ThemeProvider';
  import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
  import { HeaderBackButton } from '@react-navigation/elements';
  import { DrawerToggleButton } from '@react-navigation/drawer';

  // ✅ i18n
  import i18n from '@src/i18n/i18n';
  import Analytics from "@src/services/analytics";
  import TsParticipantsLeaderboard from "@src/defis/results/TsParticipantsLeaderboard";
  import TeamLogoBadge from "@src/sports/TeamLogoBadge";
  import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
  import {
    buildLeaderboard,
    emptyLiveStats,
    normalizeLiveStatsDoc,
    normPlayerId,
    resolveTsHideOthersPicks,
  } from "@src/defis/results/tsResultsUtils";

  /* ----------------------------- Utils ----------------------------- */
  const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');
  const GROUP_PLACEHOLDER = require('@src/assets/group-placeholder.png');

  const CACHE_VERSION = 'v3_profiles_public_names';
  const PARTICIPANTS_CACHE_KEY = `${CACHE_VERSION}`;

  /* ----- NHL helpers ----- */
  const teamLogoUrl = (abbr) => {
    const a = String(abbr || '').trim().toUpperCase();
    return a
      ? `https://assets.nhle.com/logos/nhl/svg/${encodeURIComponent(
          a
        )}_light.svg`
      : null;
  };

  function fmtTSLocalHM(v) {
    try {
      const d = v?.toDate?.()
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

  function statusStyleBase(status) {
    const key = (status || '').toLowerCase();
    switch (key) {
      case 'open':
        return {
          bg: '#ECFEFF',
          fg: '#0E7490',
          icon: 'clock-outline',
          label: i18n.t('defi.results.status.open'),
        };
      case 'live':
        return {
          bg: '#F0FDF4',
          fg: '#166534',
          icon: 'broadcast',
          label: i18n.t('defi.results.status.live'),
        };
      case 'awaiting_result':
        return {
          bg: '#FFF7ED',
          fg: '#9A3412',
          icon: 'timer-sand',
          label: i18n.t('defi.results.status.awaiting'),
        };
      case 'closed':
        return {
          bg: '#FEF2F2',
          fg: '#991B1B',
          icon: 'lock',
          label: i18n.t('defi.results.status.closed'),
        };
      default:
        return {
          bg: '#EFEFEF',
          fg: '#111827',
          icon: 'help-circle',
          label: String(
            status || i18n.t('defi.results.status.unknown')
          ),
        };
    }
  }

    function ymdInTorontoFromAny(v) {
      try {
        const d = v?.toDate?.() ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null;
        if (!d || isNaN(d.getTime())) return null;

        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Toronto",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(d);

        const y = parts.find((p) => p.type === "year")?.value;
        const m = parts.find((p) => p.type === "month")?.value;
        const dd = parts.find((p) => p.type === "day")?.value;
        return y && m && dd ? `${y}-${m}-${dd}` : null;
      } catch {
        return null;
      }
    }

    function extractTeamsFromParts(parts = [], playerMap = {}) {
      const set = new Set();
      for (const part of parts) {
        const picks = Array.isArray(part?.picks) ? part.picks : [];
        for (const p of picks) {
          const pid = String(p?.playerId ?? "").trim();
          const abbr =
            (playerMap?.[pid]?.teamAbbr || p?.teamAbbr || "").toString().trim().toUpperCase();
          if (abbr) set.add(abbr);
        }
      }
      return Array.from(set);
    }

  /* ---------------------- Cache noms participants ---------------------- */
  const memNames = { map: {}, info: {} }; // {uid -> name}, {uid -> {photoURL}}

  async function readNamesCache() {
    try {
      const raw = await AsyncStorage.getItem(PARTICIPANTS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.map) Object.assign(memNames.map, parsed.map);
      if (parsed?.info) Object.assign(memNames.info, parsed.info);
    } catch {}
  }
  async function writeNamesCache() {
    try {
      await AsyncStorage.setItem(
        PARTICIPANTS_CACHE_KEY,
        JSON.stringify(memNames)
      );
    } catch {}
  }
  function mergeNames(partialMap, partialInfo) {
    let changed = false;
    if (partialMap) {
      for (const [uid, nm] of Object.entries(partialMap)) {
        const nextName = typeof nm === 'string' && nm.trim() ? nm.trim() : null;
        if (nextName && memNames.map[uid] !== nextName) {
          memNames.map[uid] = nextName;
          changed = true;
        }
      }
    }
    if (partialInfo) {
      for (const [uid, obj] of Object.entries(partialInfo)) {
        const old = memNames.info[uid] || {};
        const next = { ...old };
        if (obj && typeof obj === 'object') {
          if (typeof obj.photoURL === 'string' && obj.photoURL.trim())
            next.photoURL = obj.photoURL.trim();
          for (const k of Object.keys(obj)) {
            if (k === 'photoURL') continue;
            if (obj[k] != null) next[k] = obj[k];
          }
        }
        if (JSON.stringify(old) !== JSON.stringify(next)) {
          memNames.info[uid] = next;
          changed = true;
        }
      }
    }
    if (changed) writeNamesCache();
    return changed;
  }

  /* ---------------- Toast config (statique) ---------------- */
  export const toastConfig = {
    liveDelta: ({ props }) => {
      const items = Array.isArray(props?.items) ? props.items : [];
      return (
        <View
          style={{
            backgroundColor: '#111',
            padding: 12,
            borderRadius: 12,
            marginTop: 40,
            marginHorizontal: 8,
            maxWidth: '96%',
            elevation: 6,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontWeight: '800',
              marginBottom: 8,
            }}
          >
            {i18n.t('defi.results.toast.title')}
          </Text>
          {items.length === 0 ? (
            <Text style={{ color: '#fff', opacity: 0.85 }}>
              {i18n.t('defi.results.toast.empty')}
            </Text>
          ) : (
            items.map((it, i) => (
              <Text key={i} style={{ color: '#fff', marginVertical: 2 }}>
                {it}
              </Text>
            ))
          )}
        </View>
      );
    },
  };

  function withCacheBust(url, tsMillis) {
    if (!url) return null;
    const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
    return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
  }

  /* ----------------------------- Screen ----------------------------- */
  export default function DefiResultsScreen() {
    const { defiId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const { colors } = useTheme();

    const [defi, setDefi] = useState(null);
    const [group, setGroup] = useState(null);

    const [loadingDefi, setLoadingDefi] = useState(true);
    const [parts, setParts] = useState([]); // [{uid, livePoints, picks, updatedAt, _raw}]
    const [namesMap, setNamesMap] = useState({});
    const [participantInfoMap, setParticipantInfoMap] = useState({});

    const [liveStats, setLiveStats] = useState(emptyLiveStats());
    const [playerMap, setPlayerMap] = useState({});

    const [nhlPlayersReadable, setNhlPlayersReadable] = useState(true);

    const [showReveal, setShowReveal] = React.useState(false);
    const [celebrateNow, setCelebrateNow] = React.useState(false);
    const hasShownRevealRef = React.useRef(false);
    const hasCelebratedRef = React.useRef(false);

    const handleCloseReveal = React.useCallback(() => setShowReveal(false), []);

    function computeCreditDelta(defi, winnersArr) {
      const pot = Number(defi?.pot ?? 0);
      const n = Math.max(1, winnersArr?.length ?? 1);
      const rule = String(defi?.splitRule ?? 'winner_takes_all').toLowerCase();
      return rule === 'split_even' ? Math.floor(pot / n) : pot;
    }

    const goSportLive = React.useCallback(() => {
      const sport = String(defi?.sport || group?.sport || "NHL").toUpperCase();

      if (sport === "MLB") {
        router.push("/(drawer)/sports/mlb-live");
        return;
      }

      const ymd =
        ymdInTorontoFromAny(defi?.firstGameUTC) ||
        ymdInTorontoFromAny(defi?.signupDeadline) ||
        null;

      const focusTeamAbbrs = extractTeamsFromParts(parts, playerMap);

      router.push({
        pathname: "/(drawer)/sports/nhl-live",
        params: {
          ymd: ymd || "",
          focusPlayerIds: JSON.stringify(allPickedIds || []),
          focusTeamAbbrs: JSON.stringify(focusTeamAbbrs || []),
          from: "defiResults",
          defiId: String(defi?.id || ""),
        },
      });
    }, [
      router,
      defi?.sport,
      group?.sport,
      defi?.firstGameUTC,
      defi?.signupDeadline,
      defi?.id,
      parts,
      playerMap,
      allPickedIds,
    ]);


    const allPickedIds = useMemo(() => {
    const ids = new Set();
    for (const part of parts) {
      const picks = Array.isArray(part?.picks) ? part.picks : [];
      for (const p of picks) {
        const pid = String(p?.playerId ?? '').trim();
        if (pid) ids.add(pid);
      }
    }
    return Array.from(ids);
  }, [parts]);

    /* ----- Leaderboard (mémo) ----- */
    const leaderboard = useMemo(() => buildLeaderboard(parts), [parts]);

    const chip = statusStyleBase(defi?.status);

    const finalists = React.useMemo(() => {
      const src = Array.isArray(leaderboard) ? leaderboard : [];
      return src
        .filter(Boolean)
        .slice()
        .sort((a, b) => Number(b.livePoints || 0) - Number(a.livePoints || 0))
        .slice(0, 3)
        .map((r) => {
          const uid = String(r.uid || '');
          const displayName = namesMap?.[uid] || r.displayName || uid;
          const info = participantInfoMap?.[uid] || {};
          return {
            ...r,
            uid,
            displayName,
            avatarUrl: info.photoURL || null,
          };
        });
    }, [leaderboard, namesMap, participantInfoMap]);

    const winners = useMemo(() => {
      const rows = Array.isArray(leaderboard) ? leaderboard : [];
      if (!rows.length) return [];
      const top = Number(rows[0].livePoints || 0);
      return rows.filter((r) => Number(r.livePoints || 0) === top);
    }, [leaderboard]);

    // Révélation / célébration
    React.useEffect(() => {
      const iAmWinner =
        Array.isArray(winners) && winners.some((w) => w.uid === user?.uid);
      if (!showReveal && iAmWinner && !hasCelebratedRef.current) {
        hasCelebratedRef.current = true;
        handleCelebrate();
      }
    }, [showReveal, winners, user?.uid]);


    React.useEffect(() => {
      if (!celebrateNow) hasCelebratedRef.current = false;
    }, [celebrateNow]);

    React.useEffect(() => {
      const closed = String(defi?.status || '').toLowerCase() === 'closed';
      if (!closed || !user?.uid) return;
      const storageKey = `finalReveal:${defi?.id}:${user?.uid}`;
      const iAmWinner =
        Array.isArray(winners) && winners.some((w) => w.uid === user.uid);
      (async () => {
        try {
          if (hasShownRevealRef.current) return;
          const done = await AsyncStorage.getItem(storageKey);
          if (!done && iAmWinner) {
            hasShownRevealRef.current = true;
            setShowReveal(true);
            await AsyncStorage.setItem(storageKey, '1');
          }
        } catch {}
      })();
    }, [defi?.status, defi?.id, user?.uid, winners]);

    React.useEffect(() => {
      const closed = String(defi?.status || '').toLowerCase() === 'closed';
      if (!closed || !user?.uid || !finalists.length) return;
      const storageKey = `finalReveal:${defi.id}:${user.uid}`;
      (async () => {
        try {
          if (hasShownRevealRef.current) return;
          const done = await AsyncStorage.getItem(storageKey);
          const inTop = finalists.some((f) => f.uid === user.uid);
          if (!done && inTop) {
            hasShownRevealRef.current = true;
            setShowReveal(true);
            await AsyncStorage.setItem(storageKey, '1');
          }
        } catch {}
      })();
    }, [defi?.status, defi?.id, user?.uid, finalists]);

    const handleCelebrate = React.useCallback(() => {
      setCelebrateNow(true);
      setTimeout(() => setCelebrateNow(false), 2400);
    }, []);

    function resolveGroupFavoriteTeam(groupDoc, sport = "NHL") {
      const fav = groupDoc?.favoriteTeam;
      if (!fav?.abbreviation) return null;

      const league = String(fav.sport || sport || "NHL").toUpperCase();
      const abbr = String(fav.abbreviation).trim().toUpperCase();
      const base = lookupTeamByAbbr(league, abbr) || {};

      return {
        ...base,
        sport: league,
        abbreviation: abbr,
        teamId: fav.teamId ?? base.teamId,
        name: fav.name || base.name || abbr,
      };
    }

    const headerTitle = React.useMemo(
      () =>
        group?.name ||
        group?.title ||
        i18n.t("home.todayChallenge", { defaultValue: "Meilleurs pointeurs" }),
      [group?.name, group?.title]
    );

    const defiSport = React.useMemo(
      () => String(defi?.sport || group?.sport || "NHL").toUpperCase(),
      [defi?.sport, group?.sport]
    );
    const isMlbTs = defiSport === "MLB";

    const groupFavoriteTeam = React.useMemo(
      () => resolveGroupFavoriteTeam(group, defiSport),
      [group, defiSport]
    );

    // 🔒 Caviardage
    const firstGameDate = React.useMemo(() => {
      const v = defi?.firstGameUTC;
      if (!v) return null;
      if (v.toDate?.()) return v.toDate();
      if (v instanceof Date) return v;
      try {
        return new Date(v);
      } catch {
        return null;
      }
    }, [defi?.firstGameUTC]);

    const beforeFirstGame = React.useMemo(() => {
      if (!firstGameDate) return false;
      return Date.now() < firstGameDate.getTime();
    }, [firstGameDate]);

    const hideOthersPicks = React.useMemo(
      () => resolveTsHideOthersPicks(defi),
      [defi?.status, defi?.firstGameUTC]
    );

    const revealTimeLabel = React.useMemo(() => {
      if (!firstGameDate) return null;
      return fmtTSLocalHM(firstGameDate);
    }, [firstGameDate]);

    // Charger cache noms au boot
    useEffect(() => {
      readNamesCache().then(() => {
        setNamesMap({ ...memNames.map });
        setParticipantInfoMap({ ...memNames.info });
      });
    }, []);

    /* ----- Defi doc ----- */
    useEffect(() => {
      if (!defiId) return;
      setLoadingDefi(true);
      const ref = firestore().doc(`defis/${String(defiId)}`);
      const un = ref.onSnapshot(
        (snap) => {
          setDefi(snap.exists ? { id: snap.id, ...snap.data() } : null);
          setLoadingDefi(false);
        },
        () => setLoadingDefi(false)
      );
      return () => un();
    }, [defiId]);

    // Group doc
    useEffect(() => {
      if (!defi?.groupId) return;
      const ref = firestore().doc(`groups/${String(defi.groupId)}`);
      const un = ref.onSnapshot((snap) => {
        setGroup(snap.exists ? { id: snap.id, ...snap.data() } : null);
      });
      return () => un();
    }, [defi?.groupId]);

    /* ----- Participations ----- */
    useEffect(() => {
      if (!defi?.id) return;
      const colRef = firestore().collection(
        `defis/${String(defi.id)}/participations`
      );
      const un = colRef.onSnapshot((snap) => {
        const next = [];
        snap.forEach((docSnap) => {
          const v = docSnap.data() || {};
          const uid = docSnap.id;
          next.push({
            uid,
            livePoints: Number(v.livePoints || 0),
            picks: Array.isArray(v.picks) ? v.picks : [],
            updatedAt: v.liveUpdatedAt || v.updatedAt || null,
            _raw: v,
          });
        });
        setParts(next);
      });
      return () => un();
    }, [defi?.id]);

    // ----- profiles_public/{uid} -----
    // ----- participants/{uid} + profiles_public/{uid} -----
const participantProfileUnsubsRef = useRef(new Map());

useEffect(() => {
  const neededUids = Array.from(new Set(parts.map((p) => p.uid).filter(Boolean)));

  for (const [uid, cleanup] of participantProfileUnsubsRef.current) {
    if (!neededUids.includes(uid)) {
      try {
        cleanup?.();
      } catch {}
      participantProfileUnsubsRef.current.delete(uid);
    }
  }

  neededUids.forEach((uid) => {
    if (participantProfileUnsubsRef.current.has(uid)) return;

    let latestParticipant = {};
    let latestPublic = {};

    const applyMerged = () => {
      const participantName =
        latestParticipant.displayName ||
        latestParticipant.name ||
        null;

      const publicName =
        latestPublic.displayName ||
        latestPublic.name ||
        latestPublic.username ||
        latestPublic.email ||
        null;

      const displayName = participantName || publicName || uid;

      const participantAvatar =
        latestParticipant.avatarUrl ||
        latestParticipant.photoURL ||
        null;

      const publicAvatar =
        latestPublic.avatarUrl ||
        latestPublic.photoURL ||
        null;

      const avatarUrl = participantAvatar || publicAvatar || null;

      const updatedAt =
        latestParticipant.updatedAt ||
        latestPublic.updatedAt ||
        null;

      const version = updatedAt?.toMillis?.()
        ? updatedAt.toMillis()
        : updatedAt?.toDate?.()
        ? updatedAt.toDate().getTime()
        : Date.now();

      const changed = mergeNames(
        { [uid]: displayName },
        {
          [uid]: avatarUrl
            ? { photoURL: avatarUrl, version }
            : { version },
        }
      );

      if (changed) {
        setNamesMap({ ...memNames.map });
        setParticipantInfoMap({ ...memNames.info });
      } else {
        setNamesMap((prev) => ({
          ...prev,
          [uid]: memNames.map[uid] || displayName,
        }));
        setParticipantInfoMap((prev) => ({
          ...prev,
          [uid]:
            memNames.info[uid] ||
            (avatarUrl ? { photoURL: avatarUrl, version } : { version }),
        }));
      }
    };

    const unParticipant = firestore()
      .doc(`participants/${uid}`)
      .onSnapshot(
        (snap) => {
          latestParticipant = snap.exists ? snap.data() || {} : {};
          applyMerged();
        },
        () => {}
      );

    const unPublic = firestore()
      .doc(`profiles_public/${uid}`)
      .onSnapshot(
        (snap) => {
          latestPublic = snap.exists ? snap.data() || {} : {};
          applyMerged();
        },
        () => {
          latestPublic = {};
          applyMerged();
        }
      );

    participantProfileUnsubsRef.current.set(uid, () => {
      try {
        unParticipant?.();
      } catch {}
      try {
        unPublic?.();
      } catch {}
    });
  });
}, [parts]);

useEffect(() => {
  return () => {
    for (const [, cleanup] of participantProfileUnsubsRef.current) {
      try {
        cleanup?.();
      } catch {}
    }
    participantProfileUnsubsRef.current.clear();
  };
}, []);

    /* ----- Live tallies ----- */
    useEffect(() => {
      if (!defi?.id) return;
      const ref = firestore().doc(`defis/${String(defi.id)}/live/stats`);
      const un = ref.onSnapshot((snap) => {
        if (snap.exists) {
          setLiveStats(normalizeLiveStatsDoc(snap.data() || {}));
        } else {
          setLiveStats(emptyLiveStats());
        }
      });
      return () => un();
    }, [defi?.id]);

    /* ----- Player meta ----- */
    const allTalliedIds = useMemo(() => {
      return Array.from(
        new Set([
          ...Object.keys(liveStats.playerGoals || {}),
          ...Object.keys(liveStats.playerA1 || {}),
          ...Object.keys(liveStats.playerA2 || {}),
          ...Object.keys(liveStats.playerAssists || {}),
          ...Object.keys(liveStats.playerPoints || {}),
        ])
      );
    }, [liveStats]);

    const missingPlayerMeta = useMemo(() => {
      return allTalliedIds.filter((id) => !playerMap[id]);
    }, [allTalliedIds, playerMap]);

    const participantsUiCount = React.useMemo(() => {
      if (Array.isArray(parts) && parts.length > 0) return parts.length;
      return Number(defi?.participantsCount ?? 0);
    }, [parts, defi?.participantsCount]);

      const hasLoggedResultViewRef = useRef(null);

    useEffect(() => {
      if (loadingDefi) return;
      if (!defi?.id) return;

      const key = String(defi.id);
      if (hasLoggedResultViewRef.current === key) return;

      hasLoggedResultViewRef.current = key;

      Analytics.viewChallengeResult({
        challengeType: "standard",
        challengeId: String(defi.id),
        format: defi?.type ? `${defi.type}x${defi.type}` : null,
        status: String(defi?.status || "").toLowerCase(),
        participantsCount: Number(defi?.participantsCount ?? parts?.length ?? 0),
        pot: Number(defi?.pot ?? 0),
      });

    }, [
      loadingDefi,
      defi?.id,
      defi?.type,
      defi?.status,
      defi?.participantsCount,
      defi?.pot,
      parts?.length,
    ]);

    useEffect(() => {
      if (!defi?.id) return;

      const un = firestore()
        .collection(`defis/${String(defi.id)}/playerPool`)
        .onSnapshot((snap) => {
          const updates = {};
          snap.forEach((docSnap) => {
            const v = docSnap.data() || {};
            const pid = normPlayerId(v?.playerId ?? docSnap.id);
            if (!pid) return;
            updates[pid] = {
              fullName: v.fullName || v.skaterFullName || "—",
              teamAbbr: v.teamAbbr || "",
            };
          });
          if (Object.keys(updates).length) {
            setPlayerMap((prev) => ({ ...prev, ...updates }));
          }
        });

      return () => un();
    }, [defi?.id]);

    useEffect(() => {
      if (missingPlayerMeta.length === 0 || !nhlPlayersReadable || isMlbTs) return;
      let cancelled = false;
      (async () => {
        try {
          const updates = {};
          const CHUNK = 10;
          for (let i = 0; i < missingPlayerMeta.length; i += CHUNK) {
            const idsChunk = missingPlayerMeta.slice(i, i + CHUNK).map(String);
            const qRef = firestore()
              .collection('nhl_players')
              .where(firestore.FieldPath.documentId(), 'in', idsChunk);
            const s = await qRef.get();
            if (cancelled) return;
            s.forEach((docSnap) => {
              const v = docSnap.data() || {};
              updates[docSnap.id] = {
                fullName: v.fullName || '—',
                teamAbbr: v.teamAbbr || '',
              };
            });
          }
          if (!cancelled && Object.keys(updates).length) {
            setPlayerMap((prev) => ({ ...prev, ...updates }));
          }
        } catch (e) {
          if (e?.code === 'permission-denied') setNhlPlayersReadable(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [missingPlayerMeta.join(','), nhlPlayersReadable]);

    /* ----------------------------- UI ----------------------------- */
    if (loadingDefi) {
      return (
        <>
          <Stack.Screen
            options={{
              title: i18n.t('defi.results.header.defaultTitle'),
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
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.text }}>
              {i18n.t('defi.results.loading.generic')}
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
              title: i18n.t('defi.results.header.defaultTitle'),
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
              {i18n.t('defi.results.errors.notFound')}
            </Text>
          </View>
        </>
      );
    }



    return (
      <>
        <Stack.Screen
          options={{
            title: headerTitle,
            headerLeft: ({ tintColor }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <HeaderBackButton
                  tintColor={tintColor}
                  onPress={() => {
                    if (defi?.groupId) {
                      router.replace({
                        pathname: '/(drawer)/(tabs)/ChallengesScreen',
                        params: { groupId: defi.groupId },
                      });
                    } else {
                      router.replace('/(drawer)/(tabs)/ChallengesScreen');
                    }
                  }}
                />
                <DrawerToggleButton tintColor={tintColor} />
              </View>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>

                {/* Quick link sport Live (NHL / MLB) */}
                <TouchableOpacity
                  onPress={goSportLive}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  }}
                >
                  <Ionicons name="pulse" size={16} color={colors.text} />
                  <Text style={{ marginLeft: 6, fontWeight: "800", color: colors.text, fontSize: 12 }}>
                    {defiSport}
                  </Text>
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* ====== CONTENU PRINCIPAL ====== */}
            <ScrollView
              style={{ flex: 1, backgroundColor: colors.background }}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* ====== HEADER GROUPE / DÉFI ====== */}
              <View
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  elevation: 2,
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 2 },
                  margin: 16,
                  marginBottom: 8,
                }}
              >
                {/* Ligne 1 */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <View style={{ marginRight: 10 }}>
                      {groupFavoriteTeam ? (
                        <TeamLogoBadge team={groupFavoriteTeam} size={56} colors={colors} />
                      ) : (
                        <Image
                          source={
                            group?.avatarUrl
                              ? { uri: group.avatarUrl }
                              : GROUP_PLACEHOLDER
                          }
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 20,
                            backgroundColor: colors.card2,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: '800',
                          fontSize: 16,
                          color: colors.text,
                        }}
                        numberOfLines={2}
                      >
                        {group?.name ||
                          group?.title ||
                          group?.id ||
                          i18n.t('defi.results.header.groupFallback')}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="account-group"
                      size={20}
                      color={colors.subtext}
                    />
                    <Text
                      style={{
                        fontWeight: '700',
                        marginLeft: 4,
                        color: colors.text,
                      }}
                    >
                      {participantsUiCount}
                    </Text>
                  </View>
                </View>

                {/* Ligne 2 */}
                <View style={{ marginTop: 4 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="treasure-chest"
                      size={20}
                      color={colors.text}
                    />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '800',
                        marginLeft: 6,
                        color: colors.text,
                      }}
                    >
                      {i18n.t('defi.results.header.pot', {
                        count: Number(defi?.pot ?? 0),
                      })}
                    </Text>
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.subtext, lineHeight: 18 }}>
                      {isMlbTs
                        ? i18n.t("defi.results.header.scoringMlb", {
                            defaultValue:
                              "Barème : Point produit (RBI) = +1, Coup sûr (H) = +1, Circuit (HR) = bonus +1",
                          })
                        : i18n.t("defi.results.header.scoring")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ====== TABLEAU DES PARTICIPANTS ====== */}
              <TsParticipantsLeaderboard
                leaderboard={leaderboard}
                namesMap={namesMap}
                participantInfoMap={participantInfoMap}
                colors={colors}
                liveStats={liveStats}
                playerMap={playerMap}
                currentUid={user?.uid}
                hideOthersPicks={hideOthersPicks}
                revealTimeLabel={revealTimeLabel}
                isMlbTs={isMlbTs}
                sport={defiSport}
                compact={false}
              />
            </ScrollView>
          </View>

        {/* Toast en haut */}
        <Toast position="top" config={toastConfig} topOffset={60} />
      </>
    );
  }

