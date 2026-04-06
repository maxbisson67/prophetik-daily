import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

import { TeamLogo } from "@src/nhl/nhlAssets";

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

function getPlayerAvatarUrl(playerId) {
  const id = String(playerId || "").trim();
  if (!id) return null;
  return `https://assets.nhle.com/mugs/nhl/20252026/${id}.png`;
}

function getTsSelectionLines(item) {
  const entry =
    item?.myEntry ||
    item?.myParticipation ||
    item?.myPick ||
    item?.participation ||
    null;

  if (!entry) return [];

  if (Array.isArray(entry?.picks)) {
    return entry.picks
      .map((p, idx) => ({
        slotLabel: `${idx + 1}-`,
        playerName: p?.playerName || p?.fullName || p?.name || p?.label || "—",
        lastName: getPlayerLastName(
          p?.playerName || p?.fullName || p?.name || p?.label || "—"
        ),
        teamAbbr: p?.teamAbbr || "",
        playerId: p?.playerId || "",
        avatarUrl: getPlayerAvatarUrl(p?.playerId),
      }))
      .filter((r) => r.playerName && r.playerName !== "—");
  }

  if (Array.isArray(entry?.lines)) {
    return entry.lines
      .map((row, idx) => ({
        slotLabel: row?.slotLabel || row?.label || `${idx + 1}x${idx + 1}`,
        playerName: row?.playerName || row?.name || row?.fullName || row?.label || "—",
        lastName: getPlayerLastName(
          row?.playerName || row?.name || row?.fullName || row?.label || "—"
        ),
        teamAbbr: row?.teamAbbr || "",
        playerId: row?.playerId || "",
        avatarUrl: getPlayerAvatarUrl(row?.playerId),
      }))
      .filter((r) => r.playerName && r.playerName !== "—");
  }

  if (Array.isArray(entry?.selectedPlayers)) {
    return entry.selectedPlayers
      .map((p, idx) => ({
        slotLabel: p?.slotLabel || p?.slot || `${idx + 1}x${idx + 1}`,
        playerName: p?.playerName || p?.fullName || p?.name || p?.label || "—",
        lastName: getPlayerLastName(
          p?.playerName || p?.fullName || p?.name || p?.label || "—"
        ),
        teamAbbr: p?.teamAbbr || "",
        playerId: p?.playerId || "",
        avatarUrl: getPlayerAvatarUrl(p?.playerId),
      }))
      .filter((r) => r.playerName && r.playerName !== "—");
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
        slotLabel: "1x1",
        playerName: oneName,
        lastName: getPlayerLastName(oneName),
        teamAbbr: entry?.teamAbbr || "",
        playerId: entry?.playerId || "",
        avatarUrl: getPlayerAvatarUrl(entry?.playerId),
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

  return i18n.t("home.tsPlayersTitle", {
    defaultValue: count > 1 ? "Défi {{count}} joueurs" : "Défi 1 joueur",
    count,
  });
}

function TsSelectionBlock({ lines, colors }) {
  if (!lines?.length) return null;

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 6 }}>
        {i18n.t("home.myPick", { defaultValue: "Ton choix" })}:
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
    <View style={{ marginRight: 6 }}>
      <TeamLogo abbr={row.teamAbbr} size={18} />
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
  const RED_DARK = "#b91c1c";

  const uiStatus = computeUiStatus(item);
  const signupDeadlineValue = getSignupDeadlineOrFallback(item, 15);

  const { canJoin, lockedBy } = canJoinDefiUi({
    tier: tierLower,
    defiType: item?.type,
    uiStatus,
    signupDeadline: signupDeadlineValue,
  });

  const lockedByPlan = lockedBy === "PLAN";
  const lockedByDeadline = lockedBy === "DEADLINE";

  const pointsToWin = Number(
    item?.pot
  );

  

  const showResultsCta =
    lockedByDeadline ||
    uiStatus === "live" ||
    uiStatus === "awaiting_result" ||
    uiStatus === "completed";

  const isAsc = isAscensionDefi(item);
  const isTS = isTsDefi(item);

  const tsSelectionLines = isTS ? getTsSelectionLines(item) : [];
  const pickCount = getTsPickCount(item, tsSelectionLines);
  const title = isTS
    ? getTsDisplayTitle(item, pickCount, isAsc)
    : isAsc
    ? ascLabel(item)
    : normalDefiLabel(item);

  const ctaLabel = lockedByPlan
    ? i18n.t("home.upgradeCta", { defaultValue: "Voir les forfaits" })
    : showResultsCta
    ? i18n.t("home.viewResults", { defaultValue: "Voir les résultats" })
    : tsSelectionLines.length > 0
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
      });



  if (isTS) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          marginBottom: 10,
        }}
      >

        <Text
          style={{ fontWeight: "900", color: colors.text, fontSize: 15 }}
          numberOfLines={2}
        >
          {title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
          <Text style={{ color: "#f97316", fontWeight: "900", fontSize: 14 }}>
            🔥 {i18n.t("home.pointsToWin", { defaultValue: "Points à gagner" })}: +{pointsToWin}
          </Text>
        </View>

        <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
          {i18n.t("firstGoal.home.signupDeadline", {
            defaultValue: "Heure limite d'inscription",
          })}
          {": "}
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {signupDeadlineValue ? fmtTSLocalHM(signupDeadlineValue) : "—"}
          </Text>
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
          <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
            {getParticipantsCount(item)}{" "}
            {i18n.t("common.participants", { defaultValue: "participant(s)" })}
          </Text>
        </View>

        <TsSelectionBlock lines={tsSelectionLines} colors={colors} />

        {lockedByPlan ? (
          <View style={{ marginTop: 12 }}>
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
                  color={RED_DARK}
                />
                <Text
                  style={{
                    color: RED_DARK,
                    fontWeight: "900",
                    fontSize: 13,
                    marginLeft: 6,
                  }}
                >
                  {ctaLabel}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : showResultsCta ? (
          <TouchableOpacity
            onPress={onPressResults}
            activeOpacity={0.85}
            style={{
              marginTop: 12,
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
                name="clipboard-text-outline"
                size={16}
                color={RED_DARK}
              />
              <Text
                style={{
                  color: RED_DARK,
                  fontWeight: "900",
                  fontSize: 13,
                  marginLeft: 6,
                }}
              >
                {ctaLabel}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            disabled={!canJoin}
            onPress={onPressParticipate}
            activeOpacity={0.85}
            style={[
              {
                marginTop: 12,
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: RED_DARK,
              },
              !canJoin && { opacity: 0.45 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>
              {ctaLabel}
            </Text>
          </TouchableOpacity>
        )}
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
                <MaterialCommunityIcons name="lock-open-outline" size={16} color={RED_DARK} />
                <Text style={{ color: RED_DARK, fontWeight: "900", fontSize: 13 }}>
                  {i18n.t("home.upgradeCta", { defaultValue: "Voir les forfaits" })}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={RED_DARK} />
              </TouchableOpacity>
            </View>
          ) : showResultsCta ? (
            <TouchableOpacity
              onPress={onPressResults}
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
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={16}
                color={RED_DARK}
              />
              <Text style={{ color: RED_DARK, fontWeight: "900", fontSize: 13 }}>
                {i18n.t("home.viewResults", { defaultValue: "Voir les résultats" })}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={RED_DARK} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              disabled={!canJoin}
              onPress={onPressParticipate}
              activeOpacity={0.85}
              style={[
                {
                  backgroundColor: RED_DARK,
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