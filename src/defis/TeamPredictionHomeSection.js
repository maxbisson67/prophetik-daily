// src/defis/TeamPredictionHomeSection.js

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { TeamLogo } from "@src/nhl/nhlAssets";
import TeamPredictionLiveCard from "@src/defis/TeamPredictionLiveCard";

/* ---------------- Helpers ---------------- */

function toDateAny(ts) {
  if (!ts) return null;
  try {
    if (typeof ts?.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function toYmdCompact(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getBusinessDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function getBusinessYmdCompact(now = new Date()) {
  return toYmdCompact(getBusinessDate(now));
}

function getPreviousBusinessYmdCompact(now = new Date()) {
  const d = new Date(getBusinessDate(now));
  d.setDate(d.getDate() - 1);
  return toYmdCompact(d);
}

function fmtTimeShort(ts) {
  const d = toDateAny(ts);
  if (!d || Number.isNaN(d.getTime?.())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getDeadline(ch) {
  const explicit =
    ch?.signupDeadline ??
    ch?.signupDeadlineUTC ??
    ch?.signupDeadlineAt ??
    ch?.signupDeadlineAtUTC ??
    ch?.lockedAt ??
    ch?.lockAt ??
    null;

  const d1 = toDateAny(explicit);
  if (d1) return d1;

  const start = toDateAny(ch?.gameStartTimeUTC);
  if (!start || Number.isNaN(start.getTime?.())) return null;
  return new Date(start.getTime() - 5 * 60 * 1000);
}

function safeAbbr(v) {
  return String(v || "").trim().toUpperCase();
}

function getPredictedWinnerAbbr(entry, awayAbbr, homeAbbr) {
  const away = Number(entry?.predictedAwayScore);
  const home = Number(entry?.predictedHomeScore);

  if (!Number.isFinite(away) || !Number.isFinite(home)) {
    return safeAbbr(entry?.winnerAbbr);
  }

  if (away > home) return safeAbbr(awayAbbr);
  if (home > away) return safeAbbr(homeAbbr);

  return safeAbbr(entry?.winnerAbbr);
}

function getSecondaryCtaLabel(status) {
  const st = String(status || "").toLowerCase();

  if (st === "open") {
    return i18n.t("tp.home.viewParticipants", {
      defaultValue: "Voir les participants",
    });
  }

  return i18n.t("tp.home.viewPredictions", {
    defaultValue: "Voir les prédictions",
  });
}

function isChallengeStillActive(status) {
  const st = String(status || "").toLowerCase();
  return ["open", "locked", "live", "pending", "awaiting_result"].includes(st);
}

function isRecentlyFinished(challenge, delayHours = 4) {
  const ts =
    challenge?.decidedAt ??
    challenge?.closedAt ??
    challenge?.finalizedAt ??
    challenge?.updatedAt ??
    null;

  const d = toDateAny(ts);
  if (!d) return false;

  return Date.now() - d.getTime() <= delayHours * 60 * 60 * 1000;
}

function shouldKeepVisible(challenge, businessYmdCompact) {
  const challengeYmd = String(challenge?.gameYmd || "").trim();

  if (challengeYmd === businessYmdCompact) return true;
  if (isChallengeStillActive(challenge?.status)) return true;
  if (isRecentlyFinished(challenge, 4)) return true;

  return false;
}

/* ---------------- UI subcomponents ---------------- */

function InfoBubbleTP({ colors }) {
  const [open, setOpen] = useState(false);

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={colors.subtext}
            style={{ marginTop: 1 }}
          />
          <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8, flex: 1 }}>
            {i18n.t("tp.home.infoTitle", {
              defaultValue: "C’est quoi ce défi?",
            })}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingBottom: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Text style={{ color: colors.subtext, marginTop: 10, lineHeight: 18 }}>
            {i18n.t("tp.home.infoBody", {
              defaultValue:
                "Choisis l’équipe gagnante, le score exact et le type de victoire. Pour gagner, ta prédiction doit être parfaite. Si personne ne trouve, la cagnotte est reportée au prochain défi équipe gagnante.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MatchupRow({ awayAbbr, homeAbbr, colors }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TeamLogo abbr={away} size={22} />
      <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>
        {away || "—"}
      </Text>

      <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>
        @
      </Text>

      <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>
        {home || "—"}
      </Text>
      <TeamLogo abbr={home} size={22} />
    </View>
  );
}

/* ---------------- Component ---------------- */

export default function TeamPredictionHomeSection({
  groups = [],
  colors,
  currentGroupId = null,
  onHasChallengeChange,
}) {
  const router = useRouter();
  const { user } = useAuth();

  const groupBonusById = useMemo(() => {
    const map = {};
    (groups || []).forEach((g) => {
      const id = String(g?.id || "");
      if (!id) return;
      map[id] = Math.max(0, Number(g?.tpBonus ?? 0));
    });
    return map;
  }, [groups]);

  const selectedGroupBonus = useMemo(() => {
    const gid = String(currentGroupId || "").trim();

    if (gid) return groupBonusById[gid] ?? 0;

    const firstGroupId = (groups || []).find((g) => g?.id)?.id || null;
    return firstGroupId ? groupBonusById[firstGroupId] ?? 0 : 0;
  }, [currentGroupId, groups, groupBonusById]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myEntries, setMyEntries] = useState({});
  const [showStateModal, setShowStateModal] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);

  /* ---------------- Challenges ---------------- */

  useEffect(() => {
    if (typeof onHasChallengeChange === "function") {
      onHasChallengeChange(items.length > 0);
    }
  }, [items.length, onHasChallengeChange]);

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();

    if (!gid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const businessToday = getBusinessYmdCompact();
    const businessYesterday = getPreviousBusinessYmdCompact();

    setLoading(true);

    const mapById = new Map();

    const applyMerged = () => {
      const merged = Array.from(mapById.values())
        .filter((ch) => shouldKeepVisible(ch, businessToday))
        .sort((a, b) => {
          const ta = toDateAny(a?.gameStartTimeUTC)?.getTime?.() || 0;
          const tb = toDateAny(b?.gameStartTimeUTC)?.getTime?.() || 0;
          return ta - tb;
        });

      setItems(merged);
      setLoading(false);
    };

    const attachListenerForYmd = (ymd) =>
      firestore()
        .collection("team_prediction_challenges")
        .where("groupId", "==", gid)
        .where("gameYmd", "==", ymd)
        .onSnapshot(
          (snap) => {
            const nextIds = new Set();

            snap.docs.forEach((d) => {
              nextIds.add(d.id);
              mapById.set(d.id, {
                id: d.id,
                ...d.data(),
              });
            });

            for (const [id, doc] of mapById.entries()) {
              if (String(doc?.groupId || "") !== gid) continue;
              if (String(doc?.gameYmd || "") !== ymd) continue;
              if (!nextIds.has(id)) {
                mapById.delete(id);
              }
            }

            applyMerged();
          },
          (err) => {
            console.log("[TeamPredictionHomeSection] challenges error", err?.message || err);
            setLoading(false);
          }
        );

    const unsubToday = attachListenerForYmd(businessToday);
    const unsubYesterday = businessToday === businessYesterday ? null : attachListenerForYmd(businessYesterday);

    return () => {
      try {
        unsubToday?.();
      } catch {}
      try {
        unsubYesterday?.();
      } catch {}
    };
  }, [currentGroupId]);

  /* ---------------- Entries (user picks) ---------------- */

  useEffect(() => {
    if (!user?.uid || !items.length) {
      setMyEntries({});
      return;
    }

    setMyEntries({});

    const unsubs = [];

    items.forEach((ch) => {
      const challengeId = String(ch?.id || "").trim();
      if (!challengeId) return;

      const ref = firestore()
        .collection("team_prediction_challenges")
        .doc(String(challengeId))
        .collection("entries")
        .doc(String(user.uid));

      const unsub = ref.onSnapshot(
        (snap) => {
          const data = snap && snap.exists ? snap.data() || null : null;

          setMyEntries((prev) => ({
            ...prev,
            [challengeId]: data,
          }));
        },
        (err) => {
          console.log(
            "[TeamPredictionHomeSection] entry error",
            challengeId,
            err?.message || err
          );

          setMyEntries((prev) => ({
            ...prev,
            [challengeId]: null,
          }));
        }
      );

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u?.();
        } catch {}
      });
    };
  }, [items, user?.uid]);

  /* ---------------- UI ---------------- */

  if (loading) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <ActivityIndicator size="small" color={colors.subtext} />
      </View>
    );
  }

  if (!items.length) {
    return (
      <>
        <View style={{ marginBottom: 14 }}>
          <InfoBubbleTP colors={colors} />

          <View
            style={{
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: "#f97316", fontWeight: "900", fontSize: 14 }}>
              🔥 {i18n.t("tp.home.boni", { defaultValue: "Points bonis" })}: +{selectedGroupBonus}
            </Text>

            <Text style={{ color: colors.subtext, fontSize: 13, marginTop: 8 }}>
              {i18n.t("tp.home.empty", {
                defaultValue: "Aucun défi équipe gagnante aujourd’hui dans tes groupes.",
              })}
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <View style={{ marginBottom: 14 }}>
        <InfoBubbleTP colors={colors} />

        <View style={{ gap: 10 }}>
          {items.map((ch) => {
            const awayAbbr = safeAbbr(ch?.awayAbbr);
            const homeAbbr = safeAbbr(ch?.homeAbbr);

            const entry = myEntries[ch.id];
            const hasEntry = !!entry;

            const deadline = getDeadline(ch);
            const deadlineHM = fmtTimeShort(deadline);

            const participants =
              Number(ch?.participantsCount ?? 0) ||
              (Array.isArray(ch?.participantUids) ? ch.participantUids.length : 0);

            const groupId = String(ch?.groupId || "");
            const bonus = Number(groupBonusById[groupId] ?? 0);

            const statusLower = String(ch.status || "").toLowerCase();

            const locked =
              statusLower === "locked" ||
              statusLower === "live" ||
              statusLower === "pending" ||
              statusLower === "decided" ||
              statusLower === "closed" ||
              (deadline ? Date.now() >= deadline.getTime() : false);

            const ctaLabel = locked
              ? i18n.t("tp.home.seeResults", { defaultValue: "Voir le résultat" })
              : hasEntry
              ? i18n.t("tp.home.modifyTeam", { defaultValue: "Modifier mon équipe" })
              : i18n.t("tp.home.pickTeam", { defaultValue: "Choisir mon équipe" });

            const secondaryCtaLabel = getSecondaryCtaLabel(statusLower);

            const winnerAbbr = entry
              ? getPredictedWinnerAbbr(entry, awayAbbr, homeAbbr)
              : null;

            const onPressPrimary = () => {
              router.push({
                pathname: "/(drawer)/(team-prediction)/pick/[challengeId]",
                params: { challengeId: ch.id },
              });
            };

            const onPressSecondary = () => {
              setSelectedChallengeId(String(ch.id));
              setShowStateModal(true);
            };

            return (
              <View
                key={ch.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <MatchupRow awayAbbr={awayAbbr} homeAbbr={homeAbbr} colors={colors} />

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                  <Text style={{ color: "#f97316", fontWeight: "900", fontSize: 14 }}>
                    🔥 {i18n.t("tp.home.boni", { defaultValue: "Points bonis" })}: +{bonus}
                  </Text>
                </View>

                <Text style={{ color: colors.subtext, marginTop: 8, fontSize: 13 }}>
                  {i18n.t("tp.home.signupDeadline", {
                    defaultValue: "Heure limite d'inscription",
                  })}
                  {": "}
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {deadlineHM || "—"}
                  </Text>
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <MaterialCommunityIcons name="account-group" size={16} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, marginLeft: 6, fontSize: 13 }}>
                    {participants}{" "}
                    {i18n.t("common.participants", { defaultValue: "participant(s)" })}
                  </Text>
                </View>

                {entry ? (
                  <View
                    style={{
                      marginTop: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={{ color: colors.subtext, fontSize: 13 }}>
                      {i18n.t("tp.home.myPick", { defaultValue: "Ton choix" })}
                      {": "}
                    </Text>

                    {winnerAbbr ? <TeamLogo abbr={winnerAbbr} size={18} /> : null}

                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginLeft: winnerAbbr ? 6 : 0,
                      }}
                    >
                      {entry.predictedAwayScore}-{entry.predictedHomeScore} ({entry.predictedOutcome})
                    </Text>
                  </View>
                ) : null}

                <View style={{ marginTop: 12, gap: 10 }}>
                  <TouchableOpacity
                    onPress={onPressPrimary}
                    activeOpacity={0.9}
                    style={{
                      width: "100%",
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: "#b91c1c",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900" }}>
                      {ctaLabel}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onPressSecondary}
                    activeOpacity={0.9}
                    style={{
                      width: "100%",
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {secondaryCtaLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <Modal
        visible={showStateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStateModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 16,
              maxHeight: "85%",
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <View
                style={{
                  width: 48,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.border,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                {i18n.t("tp.live.title", { defaultValue: "Défi équipe gagnante" })}
              </Text>

              <TouchableOpacity
                onPress={() => setShowStateModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TeamPredictionLiveCard
              visible={showStateModal}
              challengeId={selectedChallengeId}
              colors={colors}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}