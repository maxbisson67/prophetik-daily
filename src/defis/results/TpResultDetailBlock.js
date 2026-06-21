import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TpParticipantsModal from "@src/defis/results/TpParticipantsModal";
import { tpEntryHasParticipation } from "@src/defis/results/challengeResultsModel";
import {
  formatPickPoints,
  getLiveScores,
  getPickScores,
  getSlotOfficialScores,
  formatOfficialPeriodSuffix,
  isSlotDecided,
  lookupPickByGameId,
  resolveTpPickResult,
  resolveTpSlotResultsStatus,
  scoreTpPickAgainstLive,
} from "@src/defis/tpBundleDisplayHelpers";
import useLiveGameScores from "@src/defis/results/useLiveGameScores";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function formatScoreValue(v) {
  return v != null && Number.isFinite(Number(v)) ? String(v) : "—";
}

function TpScoreboardRow({ label, awayTeam, homeTeam, awayAbbr, homeAbbr, awayScore, homeScore, suffix, colors }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: colors.subtext, fontSize: 11, fontWeight: "800", marginBottom: 4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        <TeamLogoBadge team={awayTeam} size={16} colors={colors} />
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>{awayAbbr}</Text>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>
          ({formatScoreValue(awayScore)})
        </Text>
        <Text style={{ color: colors.subtext, fontWeight: "900", fontSize: 13, marginHorizontal: 2 }}>
          -
        </Text>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>
          ({formatScoreValue(homeScore)})
        </Text>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>{homeAbbr}</Text>
        <TeamLogoBadge team={homeTeam} size={16} colors={colors} />
        {suffix ? (
          <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MatchDivider() {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: "rgba(239,68,68,0.24)",
        marginVertical: 12,
      }}
    />
  );
}

function TpSlotStatusChip({ status, colors }) {
  const ui = (() => {
    if (status === "registered") {
      return {
        label: i18n.t("challenges.joined", { defaultValue: "Inscrit" }),
        color: "#16a34a",
        icon: "checkmark-circle-outline",
        bg: "rgba(22,163,74,0.10)",
      };
    }
    if (status === "completed") {
      return {
        label: i18n.t("challenges.status.completed", { defaultValue: "Terminé" }),
        color: "#6b7280",
        icon: "checkmark-circle",
        bg: "rgba(107,114,128,0.10)",
      };
    }
    return {
      label: i18n.t("challenges.status.awaiting", { defaultValue: "En cours" }),
      color: "#ea580c",
      icon: "timer-outline",
      bg: "rgba(234,88,12,0.10)",
    };
  })();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: ui.bg,
      }}
    >
      <Ionicons name={ui.icon} size={12} color={ui.color} />
      <Text style={{ marginLeft: 5, color: ui.color, fontWeight: "800", fontSize: 11 }}>
        {ui.label}
      </Text>
    </View>
  );
}

function TpMatchResultRow({ slot, league, pick, pickResult, bundle, colors, liveGame }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);

  const slotDecided = isSlotDecided(slot);
  const slotStatus = String(slot?.status || "").toLowerCase();
  const liveScores = getLiveScores(liveGame);
  const hasLiveScores = liveScores.away != null && liveScores.home != null;
  const showLive = !slotDecided && hasLiveScores && ["live", "locked"].includes(slotStatus);

  const officialScores = getSlotOfficialScores(slot);
  const pickScores = getPickScores(pick);
  const hasPick = pickScores.away != null && pickScores.home != null;

  const resolved = slotDecided
    ? resolveTpPickResult({ pick, slot, pickResult, bundle })
    : showLive
    ? scoreTpPickAgainstLive(pick, slot, liveGame, bundle)
    : null;

  const pointsLine = formatPickPoints(pickResult || resolved);
  const isProvisional = showLive && resolved?.provisional;

  const liveSuffix = showLive
    ? String(liveGame?.statusText || "").trim() || null
    : slotDecided
    ? formatOfficialPeriodSuffix(slot, league)
    : null;

  const scoreboardProps = {
    awayTeam,
    homeTeam,
    awayAbbr,
    homeAbbr,
    colors,
  };

  const slotResultsStatus = resolveTpSlotResultsStatus(slot);

  return (
    <View style={{ paddingVertical: 4 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>
          {awayAbbr} @ {homeAbbr}
        </Text>
        <TpSlotStatusChip status={slotResultsStatus} colors={colors} />
      </View>

      {slotDecided ? (
        <TpScoreboardRow
          {...scoreboardProps}
          label={i18n.t("tp.results.officialScore", { defaultValue: "Résultat" })}
          awayScore={officialScores.away}
          homeScore={officialScores.home}
          suffix={liveSuffix}
        />
      ) : showLive ? (
        <TpScoreboardRow
          {...scoreboardProps}
          label={i18n.t("tp.results.liveScore", { defaultValue: "Live" })}
          awayScore={liveScores.away}
          homeScore={liveScores.home}
          suffix={liveSuffix}
        />
      ) : null}

      {hasPick ? (
        <TpScoreboardRow
          {...scoreboardProps}
          label={i18n.t("tp.results.predictionLine", { defaultValue: "Prédiction" })}
          awayScore={pickScores.away}
          homeScore={pickScores.home}
        />
      ) : (
        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>
          {i18n.t("challenges.noPickForMatch", { defaultValue: "Aucune prédiction" })}
        </Text>
      )}

      {resolved != null && (isProvisional || slotDecided) ? (
        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: isProvisional ? colors.subtext : colors.text,
              fontSize: 12,
              fontWeight: isProvisional ? "700" : "900",
              flex: 1,
            }}
          >
            {isProvisional
              ? i18n.t("tp.results.unconfirmedPoints", {
                  defaultValue: "{{points}} pt(s) non confirmés",
                  points: Number(resolved?.points ?? 0),
                })
              : pointsLine ||
                i18n.t("tp.results.noPoints", { defaultValue: "0 pt" })}
          </Text>
          {hasPick ? (
            <Ionicons
              name={resolved.winnerCorrect ? "checkmark-circle" : "close-circle"}
              size={18}
              color={resolved.winnerCorrect ? "#16a34a" : "#dc2626"}
              style={{ marginLeft: 8 }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function TpResultDetailBlock({ item, colors, myEntry = null, showLiveScores = false }) {
  const { user } = useAuth();
  const uid = String(user?.uid || "");

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  const bundle = item?.raw || {};
  const bundleId = String(item?.id || bundle?.id || "");
  const league = String(bundle?.league || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const gameCount = Number(bundle?.gameCount || games.length || 0);

  const myEntryEffective = useMemo(() => {
    const fromList = entries.find((e) => String(e.uid) === uid);
    return fromList || myEntry;
  }, [entries, uid, myEntry]);

  const picks = myEntryEffective?.picks || {};
  const pickResults = myEntryEffective?.pickResults || {};
  const totalPoints = Number(myEntryEffective?.totalPoints ?? 0);
  const hasParticipation = tpEntryHasParticipation(myEntryEffective);

  const liveGameIds = useMemo(() => {
    if (!showLiveScores) return [];
    return games
      .filter((slot) => {
        const st = String(slot?.status || "").toLowerCase();
        return !isSlotDecided(slot) && ["live", "locked"].includes(st);
      })
      .map((slot) => String(slot.gameId || ""))
      .filter(Boolean);
  }, [games, showLiveScores]);

  const liveScores = useLiveGameScores(liveGameIds, league, bundle?.gameYmd);

  useEffect(() => {
    if (!bundleId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const ref = firestore()
      .collection("team_prediction_bundles")
      .doc(bundleId)
      .collection("entries");

    const unsub = ref.onSnapshot(
      (snap) => {
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((e) => tpEntryHasParticipation(e))
          .sort((a, b) =>
            String(a.displayName || a.uid || "").localeCompare(
              String(b.displayName || b.uid || "")
            )
          );
        setEntries(list);
        setLoading(false);
      },
      () => {
        setEntries([]);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [bundleId]);

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginBottom: 4 }}>
        {i18n.t("tp.home.bundleTitle", {
          defaultValue: "{{count}} match(s) à prédire",
          count: gameCount,
        })}
      </Text>

      {games.map((slot, index) => {
        const gameId = String(slot.gameId || "");
        return (
          <View key={gameId}>
            <TpMatchResultRow
              slot={slot}
              league={league}
              bundle={bundle}
              pick={lookupPickByGameId(picks, gameId)}
              pickResult={lookupPickByGameId(pickResults, gameId)}
              colors={colors}
              liveGame={liveScores[gameId] || null}
            />
            {index < games.length - 1 ? <MatchDivider /> : null}
          </View>
        );
      })}

      {hasParticipation ? (
        <Text style={{ color: colors.text, marginTop: 10, fontSize: 13, fontWeight: "900" }}>
          {i18n.t("tp.results.myTotalPoints", {
            defaultValue: "Mes points : {{points}} pt(s)",
            points: totalPoints,
          })}
        </Text>
      ) : (
        <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
          {i18n.t("challenges.notJoined", { defaultValue: "Non inscrit" })}
        </Text>
      )}

      {!loading && entries.length > 0 ? (
        <TouchableOpacity
          onPress={() => setShowParticipantsModal(true)}
          activeOpacity={0.85}
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "#b91c1c", fontWeight: "800", fontSize: 13 }}>
            {i18n.t("challenges.viewOtherParticipantsPicks", {
              defaultValue: "Voir les choix des autres participants",
            })}
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>
            ({entries.length})
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#b91c1c" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      ) : loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <ActivityIndicator size="small" color={colors.subtext} />
        </View>
      ) : null}

      <TpParticipantsModal
        visible={showParticipantsModal}
        onClose={() => setShowParticipantsModal(false)}
        bundle={bundle}
        entries={entries}
        loading={loading}
        currentUid={uid}
        colors={colors}
      />
    </View>
  );
}
