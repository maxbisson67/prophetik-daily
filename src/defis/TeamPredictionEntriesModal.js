// src/defis/TeamPredictionEntriesModal.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SvgUri } from "react-native-svg";
import firestore from "@react-native-firebase/firestore";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

const RED = "#b91c1c";

function safeUpper(v) {
  return String(v || "").trim().toUpperCase();
}

function isSvg(uri) {
  return String(uri || "").toLowerCase().includes(".svg");
}

function buildNhlLogoUri(abbr, variant = "dark") {
  const code = safeUpper(abbr);
  if (!code) return null;
  return `https://assets.nhle.com/logos/nhl/svg/${code}_${variant}.svg`;
}

function TeamLogo({ uri, abbr, size = 28 }) {
  const resolvedUri =
    uri || buildNhlLogoUri(abbr, "dark") || buildNhlLogoUri(abbr, "light");

  if (!resolvedUri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="shield-outline" size={size * 0.62} color="#9ca3af" />
      </View>
    );
  }

  if (isSvg(resolvedUri)) {
    return (
      <View style={{ width: size, height: size }}>
        <SvgUri uri={resolvedUri} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: resolvedUri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

function Avatar({ uri, size = 34, colors }) {
  if (!uri) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.card2,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="person-outline" size={size * 0.55} color={colors.subtext} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
      resizeMode="cover"
    />
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  const d =
    value?.toDate?.() ? value.toDate() :
    value instanceof Date ? value :
    new Date(value);

  if (!d || Number.isNaN(d.getTime?.())) return "—";

  return d.toLocaleString("fr-CA", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusMeta(status, colors) {
  const s = String(status || "").toLowerCase();

  if (s === "locked") {
    return {
      label: i18n.t("tp.modal.locked", { defaultValue: "Verrouillé" }),
      bg: colors.card2,
      fg: colors.text,
      icon: "lock-closed-outline",
    };
  }

  if (s === "decided") {
    return {
      label: i18n.t("tp.modal.decided", { defaultValue: "Résultats" }),
      bg: "rgba(239,68,68,0.10)",
      fg: RED,
      icon: "trophy-outline",
    };
  }

  return {
    label: i18n.t("tp.modal.open", { defaultValue: "Ouvert" }),
    bg: "rgba(239,68,68,0.10)",
    fg: RED,
    icon: "lock-open-outline",
  };
}

function StatusChip({ status, colors }) {
  const meta = getStatusMeta(status, colors);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: meta.bg,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={meta.icon} size={14} color={meta.fg} />
      <Text
        style={{
          marginLeft: 6,
          color: meta.fg,
          fontWeight: "900",
          fontSize: 12,
        }}
      >
        {meta.label}
      </Text>
    </View>
  );
}

function EntryRow({ row, colors, awayAbbr, homeAbbr, showResult = false }) {
  const predictedAwayScore =
    row?.predictedAwayScore !== undefined && row?.predictedAwayScore !== null
      ? String(row.predictedAwayScore)
      : "—";

  const predictedHomeScore =
    row?.predictedHomeScore !== undefined && row?.predictedHomeScore !== null
      ? String(row.predictedHomeScore)
      : "—";

  const predictedOutcome = safeUpper(row?.predictedOutcome || "—");
  const displayName =
    row?.displayName ||
    row?.name ||
    i18n.t("common.participant", { defaultValue: "Participant" });

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        backgroundColor: colors.card2,
        padding: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Avatar uri={row?.avatarUrl || null} colors={colors} />

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text
            style={{
              color: colors.text,
              fontWeight: "900",
              fontSize: 14,
            }}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          <Text
            style={{
              color: colors.subtext,
              marginTop: 2,
              fontWeight: "700",
            }}
          >
            {awayAbbr} {predictedAwayScore} - {predictedHomeScore} {homeAbbr} • {predictedOutcome}
          </Text>
        </View>

        {showResult ? (
          <View
            style={{
              marginLeft: 10,
              alignItems: "flex-end",
            }}
          >
            <Text
              style={{
                color: row?.won ? RED : colors.subtext,
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {row?.won
                ? i18n.t("tp.modal.win", { defaultValue: "Gagnant" })
                : i18n.t("tp.modal.noWin", { defaultValue: "Perdu" })}
            </Text>

            {row?.payout > 0 ? (
              <Text
                style={{
                  color: RED,
                  fontWeight: "900",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                +{row.payout}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function TeamPredictionEntriesModal({
  visible,
  onClose,
  challengeId,
}) {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!visible || !challengeId) return;

    let mounted = true;
    let unsubChallenge = null;
    let unsubEntries = null;

    async function start() {
      setLoading(true);
      setChallenge(null);
      setRows([]);

      const challengeRef = firestore().doc(`team_prediction_challenges/${challengeId}`);

      unsubChallenge = challengeRef.onSnapshot(
        async (snap) => {
          const ch = snap?.data?.() || null;
          if (!mounted) return;
          setChallenge(ch);

          if (unsubEntries) {
            try { unsubEntries(); } catch {}
            unsubEntries = null;
          }

          const entriesRef = firestore()
            .collection(`team_prediction_challenges/${challengeId}/entries`);

          unsubEntries = entriesRef.onSnapshot(
            async (entriesSnap) => {
              try {
                const baseRows = (entriesSnap?.docs || []).map((d) => ({
                  id: d.id,
                  ...(d.data() || {}),
                }));

                const enrichedRows = await Promise.all(
                  baseRows.map(async (row) => {
                    try {
                      const pSnap = await firestore().doc(`participants/${row.id}`).get();
                      const pdata = pSnap?.data?.() || {};

                      return {
                        ...row,
                        displayName: pdata.displayName || row.displayName || null,
                        avatarUrl:
                          pdata.jerseyFrontUrl ||
                          pdata.avatarUrl ||
                          pdata.photoURL ||
                          pdata.photoUrl ||
                          null,
                      };
                    } catch {
                      return row;
                    }
                  })
                );

                enrichedRows.sort((a, b) => {
                  const an = String(a?.displayName || a?.name || "").toLowerCase();
                  const bn = String(b?.displayName || b?.name || "").toLowerCase();
                  return an.localeCompare(bn);
                });

                if (!mounted) return;
                setRows(enrichedRows);
                setLoading(false);
              } catch (e) {
                console.log("[TP entries modal] entries error", e?.message || e);
                if (mounted) setLoading(false);
              }
            },
            (err) => {
              console.log("[TP entries modal] entries listener error", err?.message || err);
              if (mounted) setLoading(false);
            }
          );
        },
        (err) => {
          console.log("[TP entries modal] challenge error", err?.message || err);
          if (mounted) setLoading(false);
        }
      );
    }

    start();

    return () => {
      mounted = false;
      try { unsubChallenge?.(); } catch {}
      try { unsubEntries?.(); } catch {}
    };
  }, [visible, challengeId]);

  const awayAbbr = challenge?.awayAbbr || "AWAY";
  const homeAbbr = challenge?.homeAbbr || "HOME";

  const awayLogo =
    challenge?.awayDarkLogo ||
    challenge?.awayLogo ||
    challenge?.away?.darkLogo ||
    challenge?.away?.logo ||
    null;

  const homeLogo =
    challenge?.homeDarkLogo ||
    challenge?.homeLogo ||
    challenge?.home?.darkLogo ||
    challenge?.home?.logo ||
    null;

  const potValue = useMemo(() => {
    const participantsCount = Number(challenge?.participantsCount ?? rows.length ?? 0);
    const stakePoints = Number(challenge?.stakePoints ?? 2);
    const carry = Number(challenge?.jackpotCarryIn ?? 0);
    return participantsCount * stakePoints + carry;
  }, [challenge?.participantsCount, challenge?.stakePoints, challenge?.jackpotCarryIn, rows.length]);

  const showResult = String(challenge?.status || "").toLowerCase() === "decided";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            maxHeight: "82%",
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: 20,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: 10 }}>
            <View
              style={{
                width: 42,
                height: 4,
                borderRadius: 999,
                backgroundColor: colors.border,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: "900",
                }}
              >
                {i18n.t("tp.modal.title", { defaultValue: "Défi TP" })}
              </Text>
              <Text
                style={{
                  color: colors.subtext,
                  marginTop: 2,
                }}
              >
                {awayAbbr} @ {homeAbbr}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 30 }}>
              <ActivityIndicator color={RED} />
              <Text style={{ color: colors.subtext, marginTop: 10 }}>
                {i18n.t("common.loading", { defaultValue: "Chargement…" })}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                gap: 12,
                paddingBottom: 6,
              }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  padding: 14,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <TeamLogo uri={awayLogo} abbr={awayAbbr} size={30} />
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        marginLeft: 8,
                      }}
                    >
                      {awayAbbr}
                    </Text>

                    <Text
                      style={{
                        color: colors.subtext,
                        fontWeight: "900",
                        marginHorizontal: 10,
                      }}
                    >
                      @
                    </Text>

                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        marginRight: 8,
                      }}
                    >
                      {homeAbbr}
                    </Text>
                    <TeamLogo uri={homeLogo} abbr={homeAbbr} size={30} />
                  </View>

                  <StatusChip status={challenge?.status} colors={colors} />
                </View>

                <View style={{ gap: 8 }}>
                  <InfoRow
                    label={i18n.t("tp.modal.start", { defaultValue: "Début" })}
                    value={formatDateTime(challenge?.gameStartTimeUTC)}
                    colors={colors}
                  />
                  <InfoRow
                    label={i18n.t("tp.modal.pot", { defaultValue: "Cagnotte" })}
                    value={String(potValue)}
                    colors={colors}
                  />
                  <InfoRow
                    label={i18n.t("tp.modal.entries", { defaultValue: "Participants" })}
                    value={String(rows.length)}
                    colors={colors}
                  />
                </View>
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  padding: 14,
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.text,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  {showResult
                    ? i18n.t("tp.modal.resultsTitle", { defaultValue: "Résultats des participants" })
                    : i18n.t("tp.modal.entriesTitle", { defaultValue: "Prédictions des participants" })}
                </Text>

                {rows.length === 0 ? (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 14,
                      backgroundColor: colors.card2,
                      padding: 14,
                    }}
                  >
                    <Text style={{ color: colors.subtext }}>
                      {i18n.t("tp.modal.noEntries", {
                        defaultValue: "Aucune prédiction enregistrée pour le moment.",
                      })}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {rows.map((row) => (
                      <EntryRow
                        key={row.id}
                        row={row}
                        colors={colors}
                        awayAbbr={awayAbbr}
                        homeAbbr={homeAbbr}
                        showResult={showResult}
                      />
                    ))}
                  </View>
                )}
              </View>

              {showResult && challenge?.officialResult ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "900",
                      fontSize: 16,
                    }}
                  >
                    {i18n.t("tp.modal.officialTitle", { defaultValue: "Résultat officiel" })}
                  </Text>

                  <Text style={{ color: colors.text }}>
                    {awayAbbr} {challenge.officialResult.awayScore ?? "—"} -{" "}
                    {challenge.officialResult.homeScore ?? "—"} {homeAbbr}
                  </Text>

                  <Text style={{ color: colors.text }}>
                    {i18n.t("tp.modal.officialOutcome", { defaultValue: "Fin de match" })}:{" "}
                    <Text style={{ fontWeight: "900" }}>
                      {challenge.officialResult.outcome || "—"}
                    </Text>
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}