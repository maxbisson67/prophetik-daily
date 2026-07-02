import React from "react";
import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import FgcResultDetailBlock from "@src/defis/results/FgcResultDetailBlock";
import TpResultDetailBlock from "@src/defis/results/TpResultDetailBlock";
import TsResultDetailBlock from "@src/defis/results/TsResultDetailBlock";
import ResultsAccueilTodoLink from "@src/defis/results/ResultsAccueilTodoLink";
import { navigateToAccueilChallenge } from "@src/defis/results/navigateToMesResultats";
import {
  isHistoryResultItem,
} from "@src/defis/results/challengeResultsModel";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import ParticipantTaskStatusChip from "@src/defis/participant/ParticipantTaskStatusChip";
import {
  participantTaskNeedsAccueil,
  resolveParticipantTaskStatusForItem,
} from "@src/defis/participant/participantTaskStatus";
import DefiTypeLeading, { resolveDefiItemSport } from "@src/home/components/DefiTypeLeading";
import DefiSectionIntroBand from "@src/home/components/DefiSectionIntroBand";
import {
  RESULTS_ACCENT,
  RESULTS_ACCENT_DARK,
  RESULTS_ACCENT_MUTED,
  RESULTS_ACCENT_DIVIDER,
  RESULTS_ACCENT_DIVIDER_STRONG,
} from "@src/defis/results/resultsTheme";

function initialsFrom(nameOrEmail = "") {
  const s = String(nameOrEmail).trim();
  if (!s) return "?";
  const parts = s.replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

function cardTypeTitle(item) {
  if (item?.kind === "fgc") {
    return getFgcTitle(item?.raw || {}, i18n.t.bind(i18n));
  }
  if (item?.kind === "tp") {
    return i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" });
  }
  return i18n.t("home.todayChallenge", { defaultValue: "Meilleurs pointeurs" });
}

const HOME_ACCENT = "#b91c1c";
const HOME_ACCENT_DARK = "#991b1b";
const HOME_ACCENT_MUTED = "rgba(239,68,68,0.22)";

const ChallengeItemCard = React.memo(function ChallengeItemCard({
  item,
  isToday,
  colors,
  winnerInfoMap,
  participationMaps,
  scheduleByChallengeId = {},
  scheduleByGameId = {},
  onOpen,
  accentColor = HOME_ACCENT,
  accentColorDark = HOME_ACCENT_DARK,
  accentMuted = HOME_ACCENT_MUTED,
  dividerColor = "rgba(239,68,68,0.24)",
  dividerColorStrong = "rgba(239,68,68,0.32)",
  introBandVariant = "home",
}) {
  const router = useRouter();
  const scheduleInfo = scheduleByChallengeId?.[item.id] || null;
  const payout = getTotalPayout(item.raw);
  const tpEntry = item.kind === "tp" ? participationMaps?.tp?.[item.id] : null;
  const tsEntry = item.kind === "ts" ? participationMaps?.ts?.[item.id] : null;
  const tsHasPicks = Array.isArray(tsEntry?.picks) && tsEntry.picks.length > 0;

  const participantTask = resolveParticipantTaskStatusForItem(item, {
    isToday,
    participationMaps,
    scheduleStatus: scheduleInfo?.status,
    scheduleByGameId,
  });

  const showPastSummary = isHistoryResultItem(item, {
    scheduleStatus: scheduleInfo?.status,
  });

  const showAccueilTodoLink =
    isToday && participantTaskNeedsAccueil(participantTask) && !!item?.id && !!item?.kind;

  const onGoToAccueilDefi = () => {
    navigateToAccueilChallenge(router, {
      groupId: item?.groupId || item?.raw?.groupId,
      challengeId: item.id,
      kind: item.kind,
    });
  };

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
    <View style={{ paddingBottom: 4 }}>
      <DefiSectionIntroBand bleedTop={false} variant={introBandVariant}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
            <DefiTypeLeading
              kind={item.kind}
              sport={resolveDefiItemSport(item)}
              colors={colors}
              glyphSize={22}
            />
            <Text
              style={{
                fontWeight: "900",
                fontSize: 16,
                color: colors.text,
                flex: 1,
              }}
              numberOfLines={2}
            >
              {cardTypeTitle(item)}
            </Text>
          </View>

          {item.kind === "fgc" || item.kind === "tp" || item.kind === "ts" ? (
            <ParticipantTaskStatusChip task={participantTask} colors={colors} />
          ) : null}
        </View>
      </DefiSectionIntroBand>

      <View>
        {item.kind === "fgc" ? (
          <FgcResultDetailBlock
            item={item}
            colors={colors}
            scheduleStatus={scheduleInfo?.status}
            accentColor={accentColor}
          />
        ) : item.kind === "tp" && item.subtype === "bundle" ? (
          <TpResultDetailBlock
            item={item}
            colors={colors}
            myEntry={tpEntry}
            showLiveScores
            scheduleByGameId={scheduleByGameId}
            accentColor={accentColor}
            dividerColor={dividerColor}
            dividerColorStrong={dividerColorStrong}
          />
        ) : item.kind === "tp" ? (
            <Text style={{ color: colors.text, fontWeight: "900" }}>
            {safeText(item.raw?.awayAbbr)} @ {safeText(item.raw?.homeAbbr)}
            </Text>
        ) : item.kind === "ts" ? (
          <TsResultDetailBlock
            item={item}
            colors={colors}
            myEntry={tsEntry}
            compact
            onOpenFullResults={() =>
              onOpen(item, isToday, participantTask, { forceResults: true })
            }
          />
        ) : null}
      </View>

      {showAccueilTodoLink ? (
        <ResultsAccueilTodoLink
          colors={colors}
          accentColor={accentColor}
          onPress={onGoToAccueilDefi}
        />
      ) : null}

      {showPastSummary && item.kind !== "tp" && item.kind !== "fgc" && item.kind !== "ts" ? (
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

            {renderWinnersBlock()}
        </>
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
  accentColor = RESULTS_ACCENT,
  accentColorDark = RESULTS_ACCENT_DARK,
  accentMuted = RESULTS_ACCENT_MUTED,
  dividerColor = RESULTS_ACCENT_DIVIDER,
  dividerColorStrong = RESULTS_ACCENT_DIVIDER_STRONG,
  introBandVariant = "results",
}) {
  const isToday = section.key === getTodayKey();

  const sectionSubtitle = i18n.t("challenges.pastDaySummary", {
    defaultValue: "Résultats des défis de cette journée",
  });

  return (
    <View
      style={{
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
        borderBottomWidth: 3,
        borderBottomColor: accentColorDark,
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
        {section.data.map((item, index) => {
          const prevKind = index > 0 ? section.data[index - 1]?.kind : null;
          const kindChanged = prevKind && prevKind !== item.kind;

          return (
          <View key={`${item.kind}-${item.id}`}>
            {kindChanged ? <View style={{ height: 4 }} /> : null}
            <ChallengeItemCard
              item={item}
              isToday={isToday}
              colors={colors}
              winnerInfoMap={winnerInfoMap}
              participationMaps={participationMaps}
              scheduleByChallengeId={scheduleByChallengeId}
              scheduleByGameId={scheduleByGameId}
              onOpen={onOpen}
              accentColor={accentColor}
              accentColorDark={accentColorDark}
              accentMuted={accentMuted}
              introBandVariant={introBandVariant}
              dividerColor={dividerColor}
              dividerColorStrong={dividerColorStrong}
            />

            {index < section.data.length - 1 ? (
            <View
                style={{
                height: 4,
                backgroundColor: accentMuted,
                marginTop: 10,
                marginBottom: 8,
                marginHorizontal: 2,
                }}
            />
            ) : null}
          </View>
          );
        })}
      </View>
    </View>
  );
});

export { ChallengeItemCard };
export default ChallengeDayCard;