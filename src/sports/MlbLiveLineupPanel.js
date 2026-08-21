import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { formatMlbTeamDisplayName } from "@src/mlb/mlbTeamDisplayName";
import { formatMlbPlayerBroadcastName } from "@src/mlb/mlbPlayerDisplayName";
import {
  fetchMlbLineupDisplayFromApi,
  hasMlbLineupDisplay,
  lineupDisplayFromGameDoc,
} from "@src/mlb/mlbLiveLineupDisplay";

function resolveBattingTeamAbbr(game = {}) {
  const explicit = String(game?.battingTeamAbbr || "").trim().toUpperCase();
  if (explicit) return explicit;

  const half = String(game?.inningHalf || "").toLowerCase();
  if (half === "top") return String(game?.awayAbbr || "").trim().toUpperCase();
  if (half === "bottom") return String(game?.homeAbbr || "").trim().toUpperCase();

  return "";
}

function LineupColumn({ title, team, abbr, entries = [], colors, currentBatterId, isBatting }) {
  if (!entries?.length) return null;

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <TeamLogoBadge team={team || { sport: "MLB", abbreviation: abbr }} size={22} colors={colors} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }} numberOfLines={1}>
            {title}
          </Text>
          {isBatting ? (
            <Text style={{ color: "#dc2626", fontWeight: "700", fontSize: 11, marginTop: 2 }}>
              {i18n.t("live.mlb.atBat", { defaultValue: "Au bâton" })}
            </Text>
          ) : null}
        </View>
      </View>

      {entries.map((entry) => {
        const isCurrent =
          currentBatterId != null && String(entry?.playerId) === String(currentBatterId);
        const label = entry?.name
          ? formatMlbPlayerBroadcastName(entry.name)
          : `#${entry?.playerId || "?"}`;

        return (
          <View
            key={`${abbr}-${entry.slot}-${entry.playerId}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 10,
              marginBottom: 4,
              backgroundColor: isCurrent ? "rgba(220,38,38,0.1)" : colors.card2 || colors.card,
              borderWidth: 1,
              borderColor: isCurrent ? "rgba(220,38,38,0.35)" : colors.border,
            }}
          >
            <Text
              style={{
                width: 22,
                color: isCurrent ? "#dc2626" : colors.subtext,
                fontWeight: "900",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              {entry.slot}
            </Text>
            <Text
              style={{
                flex: 1,
                color: colors.text,
                fontWeight: isCurrent ? "800" : "600",
                fontSize: 13,
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
            {isCurrent ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#dc2626",
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function MlbLiveLineupPanel({ game, colors, teamForAbbr, enabled = true }) {
  const [fallback, setFallback] = useState(null);
  const [loadingFallback, setLoadingFallback] = useState(false);

  const fromDoc = useMemo(() => lineupDisplayFromGameDoc(game), [game]);

  useEffect(() => {
    if (!enabled || !game?.gamePk && !game?.id) {
      setFallback(null);
      setLoadingFallback(false);
      return undefined;
    }

    if (hasMlbLineupDisplay(fromDoc)) {
      setFallback(null);
      setLoadingFallback(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingFallback(true);

    fetchMlbLineupDisplayFromApi(game?.gamePk || game?.id)
      .then((result) => {
        if (!cancelled) setFallback(result);
      })
      .finally(() => {
        if (!cancelled) setLoadingFallback(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, game?.gamePk, game?.id, fromDoc]);

  const display = hasMlbLineupDisplay(fromDoc) ? fromDoc : fallback || fromDoc;
  const hasLineups = hasMlbLineupDisplay(display);
  const showCurrentBatter = !!game?.isLive && !!display?.currentBatterName;

  if (!enabled || (!hasLineups && !showCurrentBatter && !loadingFallback)) {
    return null;
  }

  const awayTeam = teamForAbbr?.(game?.awayAbbr);
  const homeTeam = teamForAbbr?.(game?.homeAbbr);
  const awayLabel = formatMlbTeamDisplayName(awayTeam, game?.awayAbbr);
  const homeLabel = formatMlbTeamDisplayName(homeTeam, game?.homeAbbr);
  const battingAbbr = String(display?.battingTeamAbbr || "").toUpperCase();

  return (
    <View style={{ marginBottom: 14 }}>
      {showCurrentBatter ? (
        <View
          style={{
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(220,38,38,0.25)",
            backgroundColor: "rgba(220,38,38,0.06)",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>
            {i18n.t("live.mlb.currentBatter", { defaultValue: "Frappeur au bâton" }).toUpperCase()}
          </Text>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>
            {formatMlbPlayerBroadcastName(display.currentBatterName)}
          </Text>
          {display.currentPitcherName ? (
            <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
              {i18n.t("live.mlb.currentPitcher", {
                defaultValue: "vs {{pitcher}}",
                pitcher: formatMlbPlayerBroadcastName(display.currentPitcherName),
              })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
          {i18n.t("live.mlb.battingOrder", { defaultValue: "Ordre de frappe" })}
        </Text>
        {loadingFallback ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {hasLineups ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <LineupColumn
            title={awayLabel}
            team={awayTeam}
            abbr={game?.awayAbbr}
            entries={display.awayBattingOrder}
            colors={colors}
            currentBatterId={display.currentBatterId}
            isBatting={battingAbbr && battingAbbr === String(game?.awayAbbr || "").toUpperCase()}
          />
          <LineupColumn
            title={homeLabel}
            team={homeTeam}
            abbr={game?.homeAbbr}
            entries={display.homeBattingOrder}
            colors={colors}
            currentBatterId={display.currentBatterId}
            isBatting={battingAbbr && battingAbbr === String(game?.homeAbbr || "").toUpperCase()}
          />
        </View>
      ) : loadingFallback ? (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("live.mlb.loadingLineups", { defaultValue: "Chargement des alignements…" })}
        </Text>
      ) : (
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {i18n.t("live.mlb.noLineups", { defaultValue: "Alignements non disponibles pour le moment." })}
        </Text>
      )}
    </View>
  );
}

export function MlbCurrentBatterHint({ game, colors, variant = "compact", teamForAbbr }) {
  if (!game?.isLive || !game?.currentBatterName) return null;

  if (variant === "summary") {
    const battingAbbr = resolveBattingTeamAbbr(game);
    const battingTeam = battingAbbr && teamForAbbr ? teamForAbbr(battingAbbr) : null;

    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {battingAbbr ? (
          <TeamLogoBadge
            team={battingTeam || { sport: "MLB", abbreviation: battingAbbr }}
            size={22}
            colors={colors}
          />
        ) : (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: "rgba(220,38,38,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 12 }}>⚾</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 10, letterSpacing: 0.4 }}>
            {i18n.t("live.mlb.currentBatter", { defaultValue: "Frappeur au bâton" }).toUpperCase()}
          </Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 1 }} numberOfLines={1}>
            {formatMlbPlayerBroadcastName(game.currentBatterName)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Text
      style={{
        color: colors.text,
        fontWeight: "700",
        fontSize: 11,
        textAlign: "right",
        marginTop: 4,
        maxWidth: 140,
      }}
      numberOfLines={2}
    >
      {formatMlbPlayerBroadcastName(game.currentBatterName)}
    </Text>
  );
}
