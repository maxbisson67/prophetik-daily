import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";
import ResultsTabHint from "@src/home/components/ResultsTabHint";
import ParticipantTaskStatusChip from "@src/defis/participant/ParticipantTaskStatusChip";
import {
  formatParticipantCtaLabel,
  resolveParticipantTaskStatus,
} from "@src/defis/participant/participantTaskStatus";
import { PARTICIPANT_MODIFY_CTA, PARTICIPANT_PRIMARY_CTA } from "@src/defis/participant/participantCtaStyles";
import { PROPHETIK_RED } from "@src/achievements/components/prophetikCardStyles";
import { resolveDefiHeadshotUrl } from "@src/mlb/mlbPlayerAssets";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";

import {
  fmtTSLocalHM,
  computeUiStatus,
  canJoinDefiUi,
  isAscensionDefi,
  ascLabel,
  normalDefiLabel,
  getSignupDeadlineOrFallback,
} from "@src/home/homeUtils";


/* ------------------------------- TS helpers -------------------------------- */

function isTsDefi(item) {
  const typeNum = Number(item?.type);
  const type = String(item?.type ?? "").toLowerCase();
  const mode = String(item?.mode ?? "").toLowerCase();
  const code = String(item?.code ?? "").toLowerCase();
  const key = String(item?.specialKey ?? "").toLowerCase();
  const title = String(item?.title ?? "").toLowerCase();
  const label = String(item?.label ?? "").toLowerCase();
  const formatLabel = String(item?.formatLabel ?? "").toLowerCase();
  const normalLabel = String(normalDefiLabel(item) ?? "").toLowerCase();

  return (
    typeNum >= 1 && typeNum <= 7 ||
    type === "ts" ||
    mode === "ts" ||
    code === "ts" ||
    key === "ts" ||
    type === "top_scorer" ||
    mode === "top_scorer" ||
    code === "top_scorer" ||
    /\b\d+\s*x\s*\d+\b/.test(title) ||
    /\b\d+\s*x\s*\d+\b/.test(label) ||
    /\b\d+\s*x\s*\d+\b/.test(formatLabel) ||
    /\b\d+\s*x\s*\d+\b/.test(normalLabel)
  );
}

function getParticipantsCount(item) {
  return (
    Number(item?.participantsCount ?? 0) ||
    (Array.isArray(item?.participantUids) ? item.participantUids.length : 0) ||
    (Array.isArray(item?.participants) ? item.participants.length : 0) ||
    0
  );
}


function getPlayerLastName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "—";
  const parts = s.split(/\s+/);
  return parts[parts.length - 1] || s;
}

function getPlayerAvatarUrl(player, sport = "NHL") {
  const explicit =
    player?.headshotUrl ||
    player?.avatarUrl ||
    player?.photoURL ||
    null;

  if (explicit) return explicit;

  const id = String(player?.playerId || "").trim();
  if (!id) return null;

  return resolveDefiHeadshotUrl(sport, player?.teamAbbr, id);
}

function normalizeTsPlayerRow(player, idx = 0, sport = "NHL") {
  if (!player || typeof player !== "object") return null;

  const playerName =
    player?.playerName ||
    player?.fullName ||
    player?.name ||
    player?.label ||
    player?.displayName ||
    null;

  if (!playerName) return null;

  return {
    slotLabel:
      player?.slotLabel ||
      player?.slot ||
      player?.positionLabel ||
      `${idx + 1}-`,
    playerName,
    lastName: getPlayerLastName(playerName),
    teamAbbr: player?.teamAbbr || player?.team || "",
    playerId: player?.playerId || "",
    avatarUrl: getPlayerAvatarUrl(player, sport),
  };
}

function objectValuesSorted(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj)
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map((k) => obj[k]);
}

function getTsSelectionLines(item, sport = "NHL") {
  const entry =
    item?.myEntry ||
    item?.myParticipation ||
    item?.myPick ||
    item?.participation ||
    null;

  if (!entry || typeof entry !== "object") return [];

  const candidateCollections = [
    entry?.picks,
    entry?.lines,
    entry?.selectedPlayers,
    entry?.players,
    entry?.selectedPlayersBySlot,
    entry?.picksBySlot,
    entry?.roster,
  ];

  for (const collection of candidateCollections) {
    if (Array.isArray(collection)) {
      const rows = collection
        .map((p, idx) => normalizeTsPlayerRow(p, idx, sport))
        .filter(Boolean);

      if (rows.length) return rows;
    }

    if (collection && typeof collection === "object") {
      const rows = objectValuesSorted(collection)
        .map((p, idx) => normalizeTsPlayerRow(p, idx, sport))
        .filter(Boolean);

      if (rows.length) return rows;
    }
  }

  const oneName =
    entry?.playerName ||
    entry?.selectedPlayerName ||
    entry?.pickPlayerName ||
    entry?.name ||
    null;

  if (oneName) {
    return [
      {
        slotLabel: "1-",
        playerName: oneName,
        lastName: getPlayerLastName(oneName),
        teamAbbr: entry?.teamAbbr || "",
        playerId: entry?.playerId || "",
        avatarUrl: getPlayerAvatarUrl(entry, sport),
      },
    ];
  }

  return [];
}


function getTsPickCount(item, lines) {
  if (lines?.length) return lines.length;

  const candidates = [
    String(normalDefiLabel(item) || ""),
    String(item?.title || ""),
    String(item?.label || ""),
    String(item?.formatLabel || ""),
  ];

  for (const s of candidates) {
    const m = s.match(/(\d+)\s*x\s*(\d+)/i);
    if (m?.[1]) return Number(m[1]);
  }

  return 1;
}

function getTsDisplayTitle(item, count, isAsc) {
  if (isAsc) return ascLabel(item);

  const n = Number(item?.type || count || 1);
  if (n <= 1) {
    return i18n.t("home.tsPickOnePlayerTitle", {
      defaultValue: "1 joueur à choisir",
    });
  }

  return i18n.t("home.tsPickPlayersTitle", {
    defaultValue: "{{count}} joueurs à choisir",
    count: n,
  });
}

function TsSelectionBlock({ lines, colors, sport = "NHL" }) {
  if (!lines?.length) return null;

  const league = String(sport || "NHL").toUpperCase();

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 6 }}>
        {i18n.t("home.tsMyPrediction", { defaultValue: "Ma prédiction" })}:
      </Text>

      <View style={{ gap: 6 }}>
        {lines.map((row, idx) => (
          <View
            key={`${row.slotLabel}-${idx}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.subtext,
                fontSize: 13,
                fontWeight: "700",
                width: 25,
              }}
            >
              {row.slotLabel}
            </Text>

<View style={{ flexDirection: "row", alignItems: "center" }}>
  {row.avatarUrl ? (
    <Image
      source={{ uri: row.avatarUrl }}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: 6,
        backgroundColor: colors.card2,
      }}
    />
  ) : (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: 6,
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    />
  )}

  {row.teamAbbr ? (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 6 }}>
      <TeamLogoBadge
        team={{
          ...lookupTeamByAbbr(league, row.teamAbbr),
          sport: league,
          abbreviation: row.teamAbbr,
        }}
        size={18}
        colors={colors}
      />
      <Text
        style={{
          marginLeft: 4,
          color: colors.subtext,
          fontWeight: "800",
          fontSize: 11,
        }}
      >
        {String(row.teamAbbr).trim().toUpperCase()}
      </Text>
    </View>
  ) : null}
</View>

            <Text
              style={{
                color: colors.text,
                fontWeight: "900",
                fontSize: 13,
                flex: 1,
              }}
              numberOfLines={1}
            >
              {row.lastName}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------ Main component ----------------------------- */

export default function DefiListItem({
  item,
  colors,
  tierLower,
  groupName,
  onPress,
  onPressUpgrade,
  onPressResults,
  onPressParticipate,
}) {
  const uiStatus = computeUiStatus(item);
  const signupDeadlineValue = getSignupDeadlineOrFallback(item, 15);
  const signupDeadlinePassed = (() => {
    if (!signupDeadlineValue) return false;
    const ms =
      typeof signupDeadlineValue?.getTime === "function"
        ? signupDeadlineValue.getTime()
        : new Date(signupDeadlineValue).getTime();
    return Number.isFinite(ms) && Date.now() >= ms;
  })();

  const { canJoin, lockedBy } = canJoinDefiUi({
    tier: tierLower,
    defiType: item?.type,
    uiStatus,
    signupDeadline: signupDeadlineValue,
  });

  const lockedByPlan = lockedBy === "PLAN";
  const lockedByDeadline = lockedBy === "DEADLINE";

  const showResultsCta =
    lockedByDeadline ||
    uiStatus === "live" ||
    uiStatus === "awaiting_result" ||
    uiStatus === "completed";

  const isAsc = isAscensionDefi(item);
  const isTS = isTsDefi(item);

  const itemSport = String(item?.sport || "NHL").toUpperCase();
  const tsSelectionLines = isTS ? getTsSelectionLines(item, itemSport) : [];

  const participantTask = useMemo(() => {
    if (!isTS) return null;
    return resolveParticipantTaskStatus(
      {
        kind: "ts",
        id: item?.id,
        type: item?.type,
        status: item?.status,
        signupDeadline: signupDeadlineValue,
        raw: item,
      },
      {
        isToday: true,
        entry: item?.myParticipation,
        uiStatus,
      }
    );
  }, [isTS, item, signupDeadlineValue, uiStatus]);

  const pickCount = getTsPickCount(item, tsSelectionLines);
  const title = isTS
    ? getTsDisplayTitle(item, pickCount, isAsc)
    : isAsc
    ? ascLabel(item)
    : normalDefiLabel(item);

  const ctaFromTask = participantTask?.showPrimaryCta
    ? formatParticipantCtaLabel(participantTask.ctaKey)
    : participantTask?.showModifyCta
    ? formatParticipantCtaLabel(participantTask.ctaKey)
    : null;

  const ctaLabel = lockedByPlan
    ? i18n.t("home.upgradeCta", { defaultValue: "Voir les forfaits" })
    : showResultsCta
    ? i18n.t("home.viewResults", { defaultValue: "Voir les résultats" })
    : ctaFromTask ||
      (tsSelectionLines.length > 0
        ? i18n.t("home.modifyMySelection", {
            defaultValue: "Modifier ma sélection",
          })
        : pickCount > 1
        ? i18n.t("home.pickMyXPlayers", {
            defaultValue: "Choisir mes {{count}} joueurs",
            count: pickCount,
          })
        : i18n.t("home.pickMyOnePlayer", {
            defaultValue: "Choisir mon joueur",
          }));

  const showTsPrimaryCta =
    isTS &&
    !lockedByPlan &&
    !showResultsCta &&
    canJoin &&
    (participantTask?.showPrimaryCta || !participantTask?.showModifyCta);

  const showTsModifyCta =
    isTS &&
    !lockedByPlan &&
    !showResultsCta &&
    canJoin &&
    (participantTask?.showModifyCta || tsSelectionLines.length > 0) &&
    !showTsPrimaryCta;

  const showTsResultsHint =
    isTS &&
    !lockedByPlan &&
    (showResultsCta ||
      (signupDeadlinePassed && !showTsPrimaryCta && !showTsModifyCta));

  if (isTS) {
    const cardStyle = {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginBottom: 10,
    };

    const cardBody = (
      <>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{ fontWeight: "900", color: colors.text, fontSize: 17, flex: 1 }}
            numberOfLines={2}
          >
            {title}
          </Text>

          {participantTask ? (
            <ParticipantTaskStatusChip
              task={participantTask}
              colors={colors}
              compact
            />
          ) : null}
        </View>

        <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
          {i18n.t("firstGoal.home.signupDeadline", {
            defaultValue: "Heure limite d'inscription",
          })}
          {": "}
          {signupDeadlinePassed ? (
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {i18n.t("firstGoal.home.signupClosed", { defaultValue: "Fermé" })}
            </Text>
          ) : (
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              {signupDeadlineValue ? fmtTSLocalHM(signupDeadlineValue) : "—"}
            </Text>
          )}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
          <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
            {getParticipantsCount(item)}{" "}
            {i18n.t("common.participants", { defaultValue: "participant(s)" })}
          </Text>
        </View>

        <TsSelectionBlock lines={tsSelectionLines} colors={colors} sport={itemSport} />

        <View style={{ marginTop: 12 }}>
          {lockedByPlan ? (
            <>
              <Text
                style={{
                  color: colors.subtext,
                  fontSize: 12,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                {i18n.t("home.upgradeToJoin", {
                  defaultValue: "Passe à Pro/Vip pour participer à ce défi.",
                })}
              </Text>

              <TouchableOpacity
                onPress={onPressUpgrade}
                activeOpacity={0.85}
                style={{
                  marginTop: 4,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  width: "100%",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <MaterialCommunityIcons
                    name="lock-open-outline"
                    size={16}
                    color={PROPHETIK_RED}
                  />
                  <Text
                    style={{
                      color: PROPHETIK_RED,
                      fontWeight: "900",
                      fontSize: 13,
                      marginLeft: 6,
                    }}
                  >
                    {ctaLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          ) : showTsResultsHint ? (
            <ResultsTabHint colors={colors} groupId={item?.groupId} />
          ) : (
            <>
              {showTsPrimaryCta ? (
                <TouchableOpacity
                  disabled={!canJoin}
                  onPress={onPressParticipate}
                  activeOpacity={0.85}
                  style={[PARTICIPANT_PRIMARY_CTA.button, { marginTop: 12 }, !canJoin && { opacity: 0.45 }]}
                >
                  <Text style={[PARTICIPANT_PRIMARY_CTA.text, { fontSize: 13 }]}>{ctaLabel}</Text>
                </TouchableOpacity>
              ) : null}

              {showTsModifyCta ? (
                <TouchableOpacity
                  disabled={!canJoin}
                  onPress={onPressParticipate}
                  activeOpacity={0.85}
                  style={[PARTICIPANT_MODIFY_CTA.button, { marginTop: 12 }, !canJoin && { opacity: 0.45 }]}
                >
                  <Text style={[PARTICIPANT_MODIFY_CTA.text, { fontSize: 13 }]}>{ctaLabel}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </>
    );

    if (showTsResultsHint) {
      return <View style={cardStyle}>{cardBody}</View>;
    }

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={cardStyle}>
        {cardBody}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
      activeOpacity={0.9}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.subtext,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {groupName}
          </Text>

          {isAsc ? <AscBadge ascKey={item?.ascension?.key} colors={colors} /> : null}

          <Text style={{ fontWeight: "900", color: colors.text }} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={colors.subtext} />
          <Text style={{ color: colors.subtext }}>
            {signupDeadlineValue
              ? `${i18n.t("home.challengeLimit")} ${fmtTSLocalHM(signupDeadlineValue)}`
              : item?.firstGameUTC
              ? `${i18n.t("home.challengeStarts")} ${fmtTSLocalHM(item.firstGameUTC)}`
              : "—"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8 }}>
          {lockedByPlan ? (
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "700" }}>
                {i18n.t("home.upgradeToJoin", {
                  defaultValue: "Passe à Pro/Vip pour participer à ce défi.",
                })}
              </Text>

              <TouchableOpacity
                onPress={onPressUpgrade}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text style={{ color: PROPHETIK_RED, fontWeight: "900", fontSize: 13 }}>
                  {i18n.t("home.upgradeCta", { defaultValue: "Voir les forfaits" })}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={PROPHETIK_RED} />
              </TouchableOpacity>
            </View>
          ) : showResultsCta ? (
            <ResultsTabHint colors={colors} groupId={item?.groupId} />
          ) : (
            <TouchableOpacity
              disabled={!canJoin}
              onPress={onPressParticipate}
              activeOpacity={0.85}
              style={[
                {
                  backgroundColor: PROPHETIK_RED,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                },
                !canJoin && { opacity: 0.45 },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
                {i18n.t("home.participate", { defaultValue: "Participer" })}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}