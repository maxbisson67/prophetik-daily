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
import functions from "@react-native-firebase/functions";
import { useRouter } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TeamLogoBadge from "@src/sports/TeamLogoBadge";
import { lookupTeamByAbbr } from "@src/groups/data/fallbackTeams";
import TeamPredictionLiveCard from "@src/defis/TeamPredictionLiveCard";
import TeamPredictionBundleHomeCard from "@src/defis/TeamPredictionBundleHomeCard";
import { listenRNFB } from "@src/home/firestoreListen";

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

function formatTpPickLine(entry, league = "NHL") {
  const away = entry?.predictedAwayScore;
  const home = entry?.predictedHomeScore;
  const score = `${away}-${home}`;
  const outcome = safeAbbr(entry?.predictedOutcome);
  const lg = String(league || "NHL").toUpperCase();

  if (lg === "MLB" || outcome === "FINAL") return score;
  if (outcome === "REG" || outcome === "OT" || outcome === "TB") {
    return `${score} (${outcome})`;
  }

  return score;
}

function getSecondaryCtaLabel() {
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
                "Choisis l’équipe gagnante, le score exact et le type de victoire. Pour gagner, ta prédiction doit être parfaite. Si personne ne trouve, la cagnotte est reportée au prochain défi.",
            })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MatchupRow({ awayAbbr, homeAbbr, sport = "NHL", colors }) {
  const away = safeAbbr(awayAbbr);
  const home = safeAbbr(homeAbbr);
  const league = String(sport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";
  const awayTeam = lookupTeamByAbbr(league, away);
  const homeTeam = lookupTeamByAbbr(league, home);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <TeamLogoBadge team={awayTeam} size={22} colors={colors} />
      <Text style={{ color: colors.text, fontWeight: "900", marginLeft: 8 }}>
        {away || "—"}
      </Text>

      <Text style={{ color: colors.subtext, marginHorizontal: 10, fontWeight: "900" }}>
        @
      </Text>

      <Text style={{ color: colors.text, fontWeight: "900", marginRight: 8 }}>
        {home || "—"}
      </Text>
      <TeamLogoBadge team={homeTeam} size={22} colors={colors} />
    </View>
  );
}

function shouldKeepVisibleBundle(bundle, businessYmdCompact) {
  const status = String(bundle?.status || "open").toLowerCase();
  if (["decided", "closed"].includes(status)) {
    const ts = bundle?.decidedAt ?? bundle?.updatedAt ?? null;
    const d = toDateAny(ts);
    return !!(d && Date.now() - d.getTime() <= 4 * 60 * 60 * 1000);
  }

  const bundleYmd = String(bundle?.gameYmd || "").trim();
  if (bundleYmd === businessYmdCompact) return true;
  if (["open", "partial", "locked", "pending"].includes(status)) return true;

  const games = Array.isArray(bundle?.games) ? bundle.games : [];
  const hasOpenSlot = games.some((slot) => {
    const slotStatus = String(slot?.status || "open").toLowerCase();
    if (slotStatus !== "open") return false;
    const lockedAt = toDateAny(slot?.lockedAt);
    return !lockedAt || Date.now() < lockedAt.getTime();
  });
  if (hasOpenSlot) return true;

  const ts = bundle?.decidedAt ?? bundle?.updatedAt ?? null;
  const d = toDateAny(ts);
  return !!(d && Date.now() - d.getTime() <= 4 * 60 * 60 * 1000);
}

function isLegacyChallenge(ch) {
  return !String(ch?.id || "").startsWith("tpb_");
}

function buildTpBundleDocId({ league, groupId, gameYmd }) {
  const lg = String(league || "NHL").toUpperCase() === "MLB" ? "mlb" : "nhl";
  return `tpb_${lg}_${groupId}_${gameYmd}`;
}

/* ---------------- Component ---------------- */

export default function TeamPredictionHomeSection({
  groups = [],
  colors,
  currentGroupId = null,
  currentSport = "NHL",
  hintBundleId = null,
  onHasChallengeChange,
  onCanCreateBundleChange,
}) {
  const router = useRouter();
  const { user, authReady } = useAuth();

  const sportLeague = String(currentSport || "NHL").toUpperCase() === "MLB" ? "MLB" : "NHL";

  const [bundle, setBundle] = useState(null);
  const [bundleEntry, setBundleEntry] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myEntries, setMyEntries] = useState({});
  const [showStateModal, setShowStateModal] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);

  const legacyItems = useMemo(
    () =>
      items.filter(
        (ch) =>
          isLegacyChallenge(ch) &&
          String(ch?.league || sportLeague).toUpperCase() === sportLeague
      ),
    [items, sportLeague]
  );

  const hasAnyTpContent = !!bundle || legacyItems.length > 0;

  useEffect(() => {
    if (typeof onHasChallengeChange === "function") {
      onHasChallengeChange(hasAnyTpContent);
    }
  }, [hasAnyTpContent, onHasChallengeChange]);

  useEffect(() => {
    if (typeof onCanCreateBundleChange === "function") {
      onCanCreateBundleChange(!bundle);
    }
  }, [bundle, onCanCreateBundleChange]);

  /* ---------------- Bundles ---------------- */

  useEffect(() => {
    const gid = String(currentGroupId || "").trim();
    const uid = String(user?.uid || "").trim();

    if (!authReady || !gid || !uid) {
      if (authReady && !uid) {
        setBundle(null);
        setBundleEntry(null);
      }
      return;
    }

    let cancelled = false;

    async function loadViaCallable() {
      try {
        const fn = functions().httpsCallable("getTeamPredictionBundleForHome");
        const res = await fn({
          groupId: gid,
          league: sportLeague,
          hintBundleId: String(hintBundleId || "").trim() || null,
        });

        if (cancelled) return;

        const nextBundle = res?.data?.bundle || null;
        if (nextBundle) {
          setBundle(nextBundle);
          setBundleEntry(res?.data?.entry ?? null);
        }

        console.log("[TeamPredictionHomeSection] callable bundle", {
          groupId: gid,
          sportLeague,
          selectedId: nextBundle?.id || null,
        });
      } catch (err) {
        console.log("[TeamPredictionHomeSection] callable error", err?.message || err);
      }
    }

    loadViaCallable();

    const unsubs = [];
    const businessToday = getBusinessYmdCompact();
    const businessYesterday = getPreviousBusinessYmdCompact();

    const applyBundleDoc = (bundleId, snap) => {
      if (cancelled) return;

      const exists =
        typeof snap?.exists === "function" ? snap.exists() : !!snap?.exists;
      if (!exists) return;

      const data = { id: bundleId, ...(snap?.data?.() || snap?.data || {}) };
      const status = String(data?.status || "open").toLowerCase();
      if (["decided", "closed"].includes(status)) return;

      setBundle(data);
      console.log("[TeamPredictionHomeSection] firestore bundle", {
        groupId: gid,
        selectedId: bundleId,
      });
    };

    [businessToday, businessYesterday].forEach((gameYmd) => {
      const bundleId = buildTpBundleDocId({
        league: sportLeague,
        groupId: gid,
        gameYmd,
      });

      const ref = firestore().doc(`team_prediction_bundles/${bundleId}`);
      const unsub = listenRNFB(
        ref,
        (snap) => applyBundleDoc(bundleId, snap),
        `tpb:live:${bundleId}`,
        (err) => {
          console.log("[TeamPredictionHomeSection] bundle live error", bundleId, err?.message || err);
        }
      );

      unsubs.push(unsub);
    });

    const hintId = String(hintBundleId || "").trim();
    if (hintId.startsWith("tpb_")) {
      const hintRef = firestore().doc(`team_prediction_bundles/${hintId}`);
      const unsubHint = listenRNFB(
        hintRef,
        (snap) => applyBundleDoc(hintId, snap),
        `tpb:hint:${hintId}`,
        (err) => {
          console.log("[TeamPredictionHomeSection] bundle hint error", hintId, err?.message || err);
        }
      );
      unsubs.push(unsubHint);
    }

    const queryRef = firestore()
      .collection("team_prediction_bundles")
      .where("groupId", "==", gid);

    const unsubQuery = listenRNFB(
      queryRef,
      (snap) => {
        if (cancelled) return;

        const rows = (snap?.docs || [])
          .map((d) => ({ id: d.id, ...(d?.data?.() || d?.data || {}) }))
          .filter((b) => String(b?.league || sportLeague).toUpperCase() === sportLeague)
          .filter((b) => {
            const status = String(b?.status || "open").toLowerCase();
            return !["decided", "closed"].includes(status);
          })
          .sort((a, b) => String(b?.gameYmd || "").localeCompare(String(a?.gameYmd || "")));

        if (rows[0]) {
          setBundle(rows[0]);
          console.log("[TeamPredictionHomeSection] query bundle", {
            groupId: gid,
            selectedId: rows[0].id,
          });
        }
      },
      `tpb:query:${gid}`,
      (err) => {
        console.log("[TeamPredictionHomeSection] bundle query error", err?.message || err);
      }
    );

    unsubs.push(unsubQuery);

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => {
        try {
          unsub?.();
        } catch {}
      });
    };
  }, [authReady, user?.uid, currentGroupId, sportLeague, hintBundleId]);

  useEffect(() => {
    if (!user?.uid || !bundle?.id) {
      return;
    }

    const ref = firestore()
      .collection("team_prediction_bundles")
      .doc(String(bundle.id))
      .collection("entries")
      .doc(String(user.uid));

    const unsub = ref.onSnapshot(
      (snap) => setBundleEntry(snap?.exists ? snap.data() || null : null),
      (err) => {
        const msg = String(err?.code || err?.message || "");
        if (!msg.includes("permission-denied")) {
          console.log("[TeamPredictionHomeSection] entry error", bundle.id, msg);
        }
      }
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
  }, [bundle?.id, user?.uid]);

  /* ---------------- Legacy challenges ---------------- */

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

  if (loading && !bundle && legacyItems.length === 0) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <ActivityIndicator size="small" color={colors.subtext} />
      </View>
    );
  }

  if (!hasAnyTpContent) {
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
            <Text style={{ color: colors.subtext, fontSize: 13 }}>
              {i18n.t("tp.home.empty", {
                defaultValue: "Aucune prédiction de matchs disponible aujourd’hui dans tes groupes.",
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
          {bundle ? (
            <TeamPredictionBundleHomeCard
              bundle={bundle}
              entry={bundleEntry}
              league={sportLeague}
              colors={colors}
              onPressSecondary={() => {
                router.push({
                  pathname: "/(drawer)/(team-prediction)/pick/[challengeId]",
                  params: { challengeId: bundle.id },
                });
              }}
            />
          ) : null}

          {legacyItems.map((ch) => {
            const awayAbbr = safeAbbr(ch?.awayAbbr);
            const homeAbbr = safeAbbr(ch?.homeAbbr);
            const challengeLeague =
              String(ch?.league || sportLeague).toUpperCase() === "MLB" ? "MLB" : "NHL";

            const entry = myEntries[ch.id];
            const hasEntry = !!entry;

            const deadline = getDeadline(ch);
            const deadlineHM = fmtTimeShort(deadline);

            const participants =
              Number(ch?.participantsCount ?? 0) ||
              (Array.isArray(ch?.participantUids) ? ch.participantUids.length : 0);

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
              : i18n.t("common.participate", { defaultValue: "Participer" });

            const secondaryCtaLabel = getSecondaryCtaLabel();
            const showSecondaryCta = statusLower !== "open";

            const awayTeam = lookupTeamByAbbr(challengeLeague, awayAbbr);
            const homeTeam = lookupTeamByAbbr(challengeLeague, homeAbbr);

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
                <MatchupRow
                  awayAbbr={awayAbbr}
                  homeAbbr={homeAbbr}
                  sport={challengeLeague}
                  colors={colors}
                />

                <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
                  {i18n.t("tp.home.signupDeadline", {
                    defaultValue: "Heure limite d'inscription",
                  })}
                  {": "}
                  {locked ? (
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {i18n.t("tp.home.signupClosed", { defaultValue: "Fermé" })}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.text, fontWeight: "900" }}>
                      {deadlineHM || "—"}
                    </Text>
                  )}
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

                    <TeamLogoBadge team={awayTeam} size={18} colors={colors} />

                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "900",
                        fontSize: 13,
                        marginHorizontal: 6,
                      }}
                    >
                      {formatTpPickLine(entry, challengeLeague)}
                    </Text>

                    <TeamLogoBadge team={homeTeam} size={18} colors={colors} />
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

                  {showSecondaryCta ? (
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
                  ) : null}
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
                {i18n.t("tp.live.title", { defaultValue: "Prédire l'issue des matchs" })}
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