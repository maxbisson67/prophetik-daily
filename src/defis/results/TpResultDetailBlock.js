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
  formatResultWinnerLine,
  formatTpPickLine,
  isSlotDecided,
  lookupPickByGameId,
  resolveTpPickResult,
} from "@src/defis/tpBundleDisplayHelpers";

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function TpMatchResultRow({ slot, league, pick, pickResult, bundle, colors }) {
  const awayAbbr = safeAbbr(slot?.awayAbbr);
  const homeAbbr = safeAbbr(slot?.homeAbbr);
  const awayTeam = lookupTeamByAbbr(league, awayAbbr);
  const homeTeam = lookupTeamByAbbr(league, homeAbbr);
  const pickLine = formatTpPickLine(pick, league);
  const slotDecided = isSlotDecided(slot);
  const officialLine = slotDecided ? formatResultWinnerLine(slot, league) : null;
  const resolved = resolveTpPickResult({ pick, slot, pickResult, bundle });
  const pointsLine = formatPickPoints(pickResult || resolved);
  const showPickIcon = !!pickLine && slotDecided && resolved != null;

  return (
    <View
      style={{
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {slot?.isFavoriteGame ? (
          <Text style={{ marginRight: 6, fontSize: 12 }}>★</Text>
        ) : (
          <Text style={{ marginRight: 6, color: colors.subtext, fontWeight: "900", fontSize: 12 }}>
            {slot?.slot || "·"}
          </Text>
        )}

        <TeamLogoBadge team={awayTeam} size={18} colors={colors} />
        <Text style={{ color: colors.text, fontWeight: "900", marginHorizontal: 6, fontSize: 13 }}>
          {awayAbbr}
        </Text>
        <Text style={{ color: colors.subtext, fontWeight: "900" }}>@</Text>
        <Text style={{ color: colors.text, fontWeight: "900", marginHorizontal: 6, fontSize: 13 }}>
          {homeAbbr}
        </Text>
        <TeamLogoBadge team={homeTeam} size={18} colors={colors} />
      </View>

      {officialLine ? (
        <View style={{ marginTop: 6, paddingLeft: 22 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
            {i18n.t("tp.results.officialScore", { defaultValue: "Résultat" })}
            {": "}
            {officialLine}
          </Text>
          {pickLine ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 12, flex: 1 }}>
                {i18n.t("challenges.myPickShort", { defaultValue: "Moi" })}
                {": "}
                {pickLine}
                {pointsLine ? ` · ${pointsLine}` : ""}
              </Text>
              {showPickIcon ? (
                <Ionicons
                  name={resolved.winnerCorrect ? "checkmark-circle" : "close-circle"}
                  size={18}
                  color={resolved.winnerCorrect ? "#16a34a" : "#dc2626"}
                  style={{ marginLeft: 8 }}
                />
              ) : null}
            </View>
          ) : (
            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
              {i18n.t("challenges.noPickForMatch", { defaultValue: "Aucune prédiction" })}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function TpResultDetailBlock({ item, colors, myEntry = null }) {
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
        unsub();
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

      {games.map((slot) => {
        const gameId = String(slot.gameId || "");
        return (
          <TpMatchResultRow
            key={gameId}
            slot={slot}
            league={league}
            bundle={bundle}
            pick={lookupPickByGameId(picks, gameId)}
            pickResult={lookupPickByGameId(pickResults, gameId)}
            colors={colors}
          />
        );
      })}

      {hasParticipation ? (
        <Text style={{ color: colors.text, marginTop: 10, fontSize: 13, fontWeight: "900" }}>
          {i18n.t("tp.results.myTotalPoints", {
            defaultValue: "Mon total : {{points}} pt(s)",
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
