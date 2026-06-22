import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import FgcResultDetailBlock from "@src/defis/results/FgcResultDetailBlock";
import TpResultDetailBlock from "@src/defis/results/TpResultDetailBlock";
import {
  isHistoryResultItem,
  resolveChallengeDisplayStatus,
} from "@src/defis/results/challengeResultsModel";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import { isTpResultsViewStatus } from "@src/defis/results/navigateToMesResultats";
import ParticipantTaskStatusChip from "@src/defis/participant/ParticipantTaskStatusChip";
import MatchTaskStatusChip from "@src/defis/match/MatchTaskStatusChip";
import {
  formatParticipantCtaLabel,
  resolveParticipantTaskStatusForItem,
} from "@src/defis/participant/participantTaskStatus";
import { resolveFgcMatchStatus } from "@src/defis/match/matchTaskStatus";

function initialsFrom(nameOrEmail = "") {
  const s = String(nameOrEmail).trim();
  if (!s) return "?";
  const parts = s.replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtHM(v) {
  try {
    if (!v) return "—";
    const d =
      typeof v?.toDate === "function"
        ? v.toDate()
        : v instanceof Date
        ? v
        : new Date(v);

    if (!d || Number.isNaN(d.getTime())) return "—";

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "—";
  }
}

function safeText(v) {
  const s = String(v || "").trim();
  return s || "—";
}

function getWinnerUids(raw) {
  if (Array.isArray(raw?.winnersPreviewUids)) return raw.winnersPreviewUids.map(String);
  if (Array.isArray(raw?.winners)) return raw.winners.map(String);
  return [];
}

function getWinnerShares(raw) {
  return raw?.winnerShares || {};
}

function getTotalPayout(raw) {
  return Number(raw?.payoutTotal ?? raw?.pot ?? raw?.stakePoints ?? 0) || 0;
}

function hasNoWinner(item) {
  if (item.kind === "ts") return false;

  const winnerUids = getWinnerUids(item.raw);
  const winnersCount = Number(item.raw?.winnersCount ?? winnerUids.length ?? 0);

  if (winnerUids.length > 0) return false;
  if (winnersCount > 0) return false;

  const st = String(item?.status || "").toLowerCase().trim();
  return ["decided", "closed", "completed"].includes(st);
}

function AvatarBubble({ uri, name, size = 22, colors }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 10 }}>
          {initialsFrom(name)}
        </Text>
      )}
    </View>
  );
}

function cardAccent(kind) {
  if (kind === "fgc") return "🏒";
  if (kind === "tp") return "🏆";
  return "🎯";
}

function cardTypeTitle(item) {
  if (item?.kind === "fgc") {
    return getFgcTitle(item?.raw || {}, i18n.t.bind(i18n));
  }
  if (item?.kind === "tp") {
    return i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" });
  }
  return i18n.t("home.todayChallenge", { defaultValue: "Top scoreur" });
}

const RED = "#b91c1c";
const RED_BOTTOM = "#991b1b";

const ChallengeItemCard = React.memo(function ChallengeItemCard({
  item,
  isToday,
  colors,
  winnerInfoMap,
  participationMaps,
  scheduleByChallengeId = {},
  scheduleByGameId = {},
  onOpen,
}) {
  const scheduleInfo = scheduleByChallengeId?.[item.id] || null;
  const displayStatus = resolveChallengeDisplayStatus(item, {
    scheduleStatus: scheduleInfo?.status,
  });
  const payout = getTotalPayout(item.raw);
  const tpEntry = item.kind === "tp" ? participationMaps?.tp?.[item.id] : null;

  const participantTask = resolveParticipantTaskStatusForItem(item, {
    isToday,
    participationMaps,
    scheduleStatus: scheduleInfo?.status,
    scheduleByGameId,
  });

  const showPastSummary = isHistoryResultItem(item, {
    scheduleStatus: scheduleInfo?.status,
  });

  const hasInlineResultsDetail =
    (item.kind === "tp" && item.subtype === "bundle") ||
    (showPastSummary && item.kind === "fgc");

  const showParticipantPrimaryCta =
    isToday && (participantTask.showPrimaryCta || participantTask.showModifyCta);

  const showLegacyResultsCta = !hasInlineResultsDetail && !showParticipantPrimaryCta;

  const participantPrimaryLabel = formatParticipantCtaLabel(
    participantTask.showPrimaryCta ? participantTask.ctaKey : null
  );
  const participantModifyLabel = formatParticipantCtaLabel(
    participantTask.showModifyCta ? "modify" : null
  );

  const openCtaLabel = (() => {
    if (item.kind === "tp") {
      return isTpResultsViewStatus(displayStatus) || isHistoryResultItem(item)
        ? i18n.t("challenges.seeResults", { defaultValue: "Voir les résultats" })
        : i18n.t("challenges.openChallenge", { defaultValue: "Ouvrir" });
    }
    if (item.kind === "fgc") {
      return i18n.t("challenges.seeResults", { defaultValue: "Voir les résultats" });
    }
    return i18n.t("challenges.seeResults", { defaultValue: "Voir les résultats" });
  })();

  const renderWinnersBlock = () => {
    const winnerUids = getWinnerUids(item.raw);
    const winnerShares = getWinnerShares(item.raw);

    if (hasNoWinner(item)) {
      return (
        <View
          style={{
            marginTop: 8,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: colors.card2,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "700" }}>
            {i18n.t("challenges.noWinner", { defaultValue: "Aucun gagnant" })}
          </Text>
        </View>
      );
    }

    if (!winnerUids.length) return null;

    return (
      <View
        style={{
          marginTop: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          backgroundColor: colors.card2,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <MaterialCommunityIcons name="trophy" size={16} color="#16a34a" />
          <Text style={{ marginLeft: 6, color: colors.text, fontWeight: "800" }}>
            {winnerUids.length > 1
              ? i18n.t("challenges.winnersTitlePlural", { defaultValue: "Gagnants" })
              : i18n.t("challenges.winnersTitleSingular", { defaultValue: "Gagnant" })}
          </Text>
        </View>

        {winnerUids.map((uid) => {
          const info = winnerInfoMap[uid] || { name: uid, photoURL: null };
          const share = Number(winnerShares?.[uid] ?? 0);

          return (
            <View
              key={uid}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <AvatarBubble uri={info.photoURL} name={info.name} colors={colors} size={22} />
              <Text style={{ color: colors.text }}>
                {info.name}
                {share > 0 ? ` (+${share})` : ""}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ paddingVertical: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>{cardAccent(item.kind)}</Text>
          <Text
            style={{
              fontWeight: "900",
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {cardTypeTitle(item)}
          </Text>
        </View>

        {item.kind === "fgc" || item.kind === "tp" ? (
          <ParticipantTaskStatusChip task={participantTask} colors={colors} />
        ) : null}
      </View>

        <View style={{ marginTop: 10 }}>
        {item.kind === "fgc" && showPastSummary ? (
          <FgcResultDetailBlock
            item={item}
            colors={colors}
            scheduleStatus={scheduleInfo?.status}
          />
        ) : item.kind === "fgc" && isToday && !showPastSummary ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14, flex: 1 }}>
              {safeText(item.raw?.awayAbbr)} @ {safeText(item.raw?.homeAbbr)}
            </Text>
            <MatchTaskStatusChip
              task={resolveFgcMatchStatus(item.raw, { scheduleStatus: scheduleInfo?.status })}
              colors={colors}
              compact
            />
          </View>
        ) : item.kind === "tp" && item.subtype === "bundle" ? (
          <TpResultDetailBlock
            item={item}
            colors={colors}
            myEntry={tpEntry}
            showLiveScores={!showPastSummary}
            scheduleByGameId={scheduleByGameId}
          />
        ) : item.kind === "tp" ? (
            <Text style={{ color: colors.text, fontWeight: "900" }}>
            {safeText(item.raw?.awayAbbr)} @ {safeText(item.raw?.homeAbbr)}
            </Text>
        ) : null}
        </View>

      {isToday && !showPastSummary && displayStatus === "open" ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.subtext, fontSize: 13 }}>
            {i18n.t("challenges.signupDeadlineLabel", { defaultValue: "Heure limite" })}:{" "}
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {fmtHM(item.signupDeadline)}
            </Text>
          </Text>
        </View>
      ) : null}

        {showPastSummary && item.kind !== "tp" && item.kind !== "fgc" ? (
        <>
            {!hasNoWinner(item) ? (
            <View
                style={{
                marginTop: 8,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: colors.card2,
                borderWidth: 1,
                borderColor: colors.border,
                }}
            >
                <Text style={{ color: colors.text, fontWeight: "800" }}>
                💰 {i18n.t("challenges.potWon", { defaultValue: "Cagnotte gagnée" })}: +{payout}
                </Text>
            </View>
            ) : null}

            {renderWinnersBlock(item)}
        </>
        ) : null}

        {showParticipantPrimaryCta ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {participantTask.showPrimaryCta && participantPrimaryLabel ? (
              <TouchableOpacity
                onPress={() => onOpen(item, isToday, participantTask)}
                activeOpacity={0.9}
                style={{
                  width: "100%",
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: "#b91c1c",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>{participantPrimaryLabel}</Text>
              </TouchableOpacity>
            ) : null}

            {participantTask.showModifyCta &&
            participantModifyLabel &&
            !participantTask.showPrimaryCta ? (
              <TouchableOpacity
                onPress={() => onOpen(item, isToday, participantTask)}
                activeOpacity={0.9}
                style={{
                  width: "100%",
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: colors.card2,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {participantModifyLabel}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {showLegacyResultsCta ? (
          <View style={{ marginTop: 12 }}>
            <TouchableOpacity
              onPress={() => onOpen(item, isToday, participantTask)}
              style={{
                width: "100%",
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: isToday ? "#b91c1c" : colors.card2,
                borderWidth: isToday ? 0 : 1,
                borderColor: isToday ? "transparent" : colors.border,
              }}
            >
              <Text
                style={{
                  color: isToday ? "#fff" : colors.text,
                  fontWeight: "900",
                }}
              >
                {openCtaLabel}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
            </View>
  );
});

const ChallengeDayCard = React.memo(function ChallengeDayCard({
  section,
  colors,
  winnerInfoMap,
  participationMaps,
  scheduleByChallengeId = {},
  scheduleByGameId = {},
  onOpen,
  getTodayKey,
}) {
  const isToday = section.key === getTodayKey();
  const hasActiveTodayItems =
    isToday &&
    section.data.some(
      (item) =>
        !isHistoryResultItem(item, {
          scheduleStatus: scheduleByChallengeId?.[item.id]?.status,
        })
    );
  const hasFinishedTodayItems =
    isToday &&
    section.data.some((item) =>
      isHistoryResultItem(item, {
        scheduleStatus: scheduleByChallengeId?.[item.id]?.status,
      })
    );

  const sectionSubtitle = (() => {
    if (!isToday) {
      return i18n.t("challenges.pastDaySummary", {
        defaultValue: "Résultats des défis de cette journée",
      });
    }
    if (hasActiveTodayItems && hasFinishedTodayItems) {
      return i18n.t("challenges.todayMixedSummary", {
        defaultValue: "Défis et résultats du jour",
      });
    }
    if (hasActiveTodayItems) {
      return i18n.t("challenges.todayDaySummary", {
        defaultValue: "Défis disponibles aujourd’hui",
      });
    }
    return i18n.t("challenges.pastDaySummary", {
      defaultValue: "Résultats des défis de cette journée",
    });
  })();

  return (
    <View
      style={{
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: RED,
        borderBottomWidth: 3,
        borderBottomColor: RED_BOTTOM,
        borderRadius: 16,
        backgroundColor: colors.card,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 10,
          backgroundColor: colors.card,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
          {section.title}
        </Text>

        <Text style={{ marginTop: 2, color: colors.subtext, fontSize: 12 }}>
          {sectionSubtitle}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
        {section.data.map((item, index) => (
          <View key={`${item.kind}-${item.id}`}>
            <ChallengeItemCard
              item={item}
              isToday={isToday}
              colors={colors}
              winnerInfoMap={winnerInfoMap}
              participationMaps={participationMaps}
              scheduleByChallengeId={scheduleByChallengeId}
              scheduleByGameId={scheduleByGameId}
              onOpen={onOpen}
            />

            {index < section.data.length - 1 ? (
            <View
                style={{
                height: 4,
                backgroundColor: "rgba(239,68,68,0.22)",
                marginTop: 10,
                marginBottom: 8,
                marginHorizontal: 2,
                }}
            />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

export default ChallengeDayCard;