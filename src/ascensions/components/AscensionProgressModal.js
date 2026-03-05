// src/ascensions/AscensionProgressModal.js
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";
import { Feather } from "@expo/vector-icons";
import { withCacheBust } from "@src/home/homeUtils";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------------- helpers ---------------- */

function toCount(v) {
  if (v === true) return 1;
  if (v === "true") return 1;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeWinsByType(winsByType) {
  const src = winsByType && typeof winsByType === "object" ? winsByType : {};
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    const key = String(k).trim();
    out[key] = toCount(v);
  }
  return out;
}

function progressFromWinsByType(winsByType, stepsTotal) {
  const map = winsByType && typeof winsByType === "object" ? winsByType : {};
  let done = 0;

  for (let i = 1; i <= stepsTotal; i++) {
    const v = map[String(i)] ?? map[i];
    if (toCount(v) > 0) done++;
  }
  return { done, total: stepsTotal };
}

function safeDocs(snap) {
  return Array.isArray(snap?.docs) ? snap.docs : [];
}

function isLikelyNova(uid, displayName) {
  const u = String(uid || "").toLowerCase();
  const d = String(displayName || "").toLowerCase();
  return u.includes("nova") || d.includes("nova");
}

function usePublicProfilesFor(uids) {
  const [map, setMap] = useState({});

  useEffect(() => {
    const ids = Array.from(new Set((uids || []).filter(Boolean)));
    if (!ids.length) {
      setMap({});
      return;
    }

    const unsubs = ids.map((uid) =>
      firestore()
        .collection("profiles_public")
        .doc(uid)
        .onSnapshot((snap) => {
          if (!snap.exists) return;
          const d = snap.data() || {};
          setMap((prev) => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || null,
              avatarUrl: d.avatarUrl || null,
            },
          }));
        })
    );

    return () => unsubs.forEach((u) => u?.());
  }, [JSON.stringify(uids || [])]);

  return map;
}

/* ---------------- UI bits ---------------- */

function ProgressBar({ colors, pct }) {
  const w = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <View
      style={{
        height: 8,
        borderRadius: 999,
        backgroundColor: colors.card2,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${w}%`,
          height: "100%",
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}

function StepChip({ colors, label, active, count }) {
  const showBadge = (count || 0) >= 2;

  return (
    <View style={{ flexBasis: "23%", maxWidth: "23%", marginBottom: 8 }}>
      <View
        style={{
          borderRadius: 14,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.card2 : "transparent",
          position: "relative",
        }}
      >
        <Text style={{ fontWeight: "900", color: colors.text }}>
          {active ? "✅ " : "▫️ "}
          {label}
        </Text>

        {showBadge ? (
          <View
            style={{
              position: "absolute",
              top: -7,
              right: -7,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: 9,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: colors.card,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{count}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function MemberCard({ colors, m, stepsTotal, publicProfile, expanded, onToggle }) {
  const displayName = publicProfile?.displayName || m.displayName || m.uid;
  const avatarUrl = publicProfile?.avatarUrl || m.avatarUrl || null;

  const wins = useMemo(() => normalizeWinsByType(m.winsByType), [m.winsByType]);
  const { done } = progressFromWinsByType(wins, stepsTotal);
  const pct = stepsTotal > 0 ? Math.round((done / stepsTotal) * 100) : 0;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image
          source={avatarUrl ? { uri: withCacheBust(avatarUrl) } : AVATAR_PLACEHOLDER}
          style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: colors.card }}
        />

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {displayName}
            </Text>
            <Text style={{ color: colors.subtext, fontWeight: "800" }}>
              {done}/{stepsTotal}
            </Text>
          </View>

          <View style={{ marginTop: 8 }}>
            <ProgressBar colors={colors} pct={pct} />
            <Text style={{ marginTop: 6, color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
              {pct}%
              {m.completed ? ` • 🏁 ${i18n.t("ascensions.labels.completed", { defaultValue: "Quête complétée" })}` : ""}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.85}
          style={{
            padding: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {expanded ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ color: colors.subtext, fontWeight: "800", marginBottom: 8 }}>
            {i18n.t("ascensions.formats", { defaultValue: "Formats" })}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {Array.from({ length: stepsTotal }, (_, idx) => {
              const step = idx + 1;
              const count = wins[String(step)] || 0;
              const active = count > 0;
              return (
                <StepChip
                  key={step}
                  colors={colors}
                  label={`${step}x${step}`}
                  active={active}
                  count={count}
                />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ---------------- Modal (RUN-BASED) ---------------- */

export default function AscensionProgressModal({
  visible,
  onClose,
  colors,
  groupId,
  includeAllGroupMembers = true,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ root ASC7
  const [ascRoot, setAscRoot] = useState(null); // groups/{groupId}/ascensions/ASC7
  const [activeRunId, setActiveRunId] = useState(null);

  // ✅ run doc
  const [run, setRun] = useState(null); // .../runs/{runId}

  // ✅ members progression
  const [runMembers, setRunMembers] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  const [openUids, setOpenUids] = useState({});

  const stepsTotal = 7;

  // reset à l'ouverture
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setLoading(true);
    setOpenUids({});
    setAscRoot(null);
    setActiveRunId(null);
    setRun(null);
    setRunMembers([]);
  }, [visible]);

  // 1) root ASC7
  useEffect(() => {
    if (!visible || !groupId) return;

    const ref = firestore().doc(`groups/${groupId}/ascensions/ASC7`);

    const unsub = ref.onSnapshot(
      (snap) => {
        const d = snap.exists ? snap.data() || {} : null;
        setAscRoot(d);
        const rid = d?.activeRunId ? String(d.activeRunId) : null;
        setActiveRunId(rid);
      },
      (e) => {
        setError(e);
        setAscRoot(null);
        setActiveRunId(null);
        setLoading(false);
      }
    );

    return () => {
      try { unsub?.(); } catch {}
    };
  }, [visible, groupId]);

  // 2) run doc
  useEffect(() => {
    if (!visible || !groupId || !activeRunId) {
      setRun(null);
      setLoading(false);
      return;
    }

    const runRef = firestore().doc(`groups/${groupId}/ascensions/ASC7/runs/${activeRunId}`);

    const unsub = runRef.onSnapshot(
      (snap) => {
        const d = snap.exists ? snap.data() || {} : null;
        setRun(d);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setRun(null);
        setLoading(false);
      }
    );

    return () => {
      try { unsub?.(); } catch {}
    };
  }, [visible, groupId, activeRunId]);

  // 3) run members
  useEffect(() => {
    if (!visible || !groupId || !activeRunId) {
      setRunMembers([]);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = firestore()
      .collection("groups")
      .doc(String(groupId))
      .collection("ascensions")
      .doc("ASC7")
      .collection("runs")
      .doc(String(activeRunId))
      .collection("members");

    const unsub = ref.onSnapshot(
      (snap) => {
        const rows = safeDocs(snap).map((d) => {
          const v = d.data() || {};
          const uid = v.uid || d.id;
          return {
            uid,
            winsByType: v.winsByType || {},
            completed: v.completed === true,
            displayName: v.displayName || null,
            avatarUrl: v.avatarUrl || null,
            updatedAt: v.updatedAt || null,
          };
        });
        setRunMembers(rows);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setRunMembers([]);
        setLoading(false);
      }
    );

    return () => {
      try { unsub?.(); } catch {}
    };
  }, [visible, groupId, activeRunId]);

  // 4) group memberships (optional) pour inclure les membres “sans progression”
  useEffect(() => {
    if (!visible || !groupId || !includeAllGroupMembers) return;

    const q = firestore()
      .collection("group_memberships")
      .where("groupId", "==", String(groupId))
      .where("status", "==", "active");

    const unsub = q.onSnapshot(
      (snap) => {
        const gm = safeDocs(snap)
          .map((d) => d.data() || {})
          .filter((m) => m.active !== false);
        setGroupMembers(gm);
      },
      () => {}
    );

    return () => {
      try { unsub?.(); } catch {}
    };
  }, [visible, groupId, includeAllGroupMembers]);

  // merge runMembers + groupMembers
  const members = useMemo(() => {
    const byUid = new Map((runMembers || []).map((x) => [String(x.uid), x]));

    const merged = (groupMembers || []).map((m) => {
      const uid = String(m.uid || m.userId || m.participantId || "");
      const base = byUid.get(uid);

      if (!base) {
        return {
          uid,
          winsByType: {},
          completed: false,
          displayName: m.displayName || null,
          avatarUrl: m.avatarUrl || null,
        };
      }

      return {
        ...base,
        displayName: base.displayName || m.displayName || null,
        avatarUrl: base.avatarUrl || m.avatarUrl || null,
      };
    });

    for (const [uid, x] of byUid.entries()) {
      if (!merged.some((m) => String(m.uid) === String(uid))) merged.push(x);
    }

    return merged;
  }, [runMembers, groupMembers]);

  // sort: completed, progress, name — Nova en bas
  const rowsSorted = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    const scored = list.map((m) => {
      const wins = normalizeWinsByType(m.winsByType);
      const { done } = progressFromWinsByType(wins, stepsTotal);
      return { ...m, __done: done };
    });

    scored.sort((a, b) => {
      const na = isLikelyNova(a.uid, a.displayName) ? 1 : 0;
      const nb = isLikelyNova(b.uid, b.displayName) ? 1 : 0;
      if (na !== nb) return na - nb; // Nova en bas

      const ca = a.completed ? 1 : 0;
      const cb = b.completed ? 1 : 0;
      if (cb !== ca) return cb - ca;

      if (b.__done !== a.__done) return b.__done - a.__done;

      return String(a.displayName || a.uid).localeCompare(String(b.displayName || b.uid));
    });

    return scored;
  }, [members, stepsTotal]);

  const memberUids = useMemo(() => rowsSorted.map((m) => String(m.uid)), [rowsSorted]);
  const publicProfiles = usePublicProfilesFor(memberUids);

  const runStatus = String(run?.status || "active").toLowerCase();
  const isRunCompleted = runStatus === "completed";

  const title = useMemo(() => {
    return i18n.t("ascensions.progressTitle", {
      defaultValue: "Ascension 7 — Progression",
    });
  }, []);

  const startYmd = run?.startYmd || activeRunId || null;
  const jackpot = Number(run?.jackpot || 0);
  const winnerUids = Array.isArray(run?.winnerUids) ? run.winnerUids : [];

  const toggleUid = (uid) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenUids((prev) => ({ ...prev, [uid]: !prev?.[uid] }));
  };

  return (
    <Modal visible={!!visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: "85%",
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 14,
              paddingTop: 14,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
                {title}
              </Text>

              {startYmd ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                    {i18n.t("ascensions.labels.startLabel", { defaultValue: "Début" })}: {startYmd}
                  </Text>

                  <Text style={{ color: colors.subtext, fontWeight: "700", marginTop: 2 }}>
                    {i18n.t("ascensions.labels.jackpot", { defaultValue: "Jackpot" })}: {jackpot}
                  </Text>

                  {isRunCompleted && winnerUids.length ? (
                    <Text style={{ color: colors.subtext, fontWeight: "700", marginTop: 2 }}>
                      🏁 {i18n.t("ascensions.labels.winners", { defaultValue: "Gagnant(s)" })}:{" "}
                      {winnerUids.length}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <TouchableOpacity onPress={onClose} style={{ padding: 8 }} activeOpacity={0.8}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loading ? (
            <View style={{ padding: 18, alignItems: "center" }}>
              <ActivityIndicator />
              <Text style={{ marginTop: 8, color: colors.subtext }}>
                {i18n.t("common.loading", { defaultValue: "Chargement…" })}
              </Text>
            </View>
          ) : error ? (
            <View style={{ padding: 18 }}>
              <Text style={{ color: colors.text }}>
                {i18n.t("common.errorLabel", { defaultValue: "Erreur:" })}{" "}
                {String(error?.message || error)}
              </Text>
            </View>
          ) : !activeRunId ? (
            <View style={{ padding: 18 }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("ascensions.noActiveRun", {
                  defaultValue: "Aucune Ascension 7 active pour ce groupe.",
                })}
              </Text>
            </View>
          ) : !rowsSorted.length ? (
            <View style={{ padding: 18 }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("ascensions.noProgressYet", {
                  defaultValue: "Aucune progression pour l’instant.",
                })}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18 }}>
              {rowsSorted.map((m) => (
                <MemberCard
                  key={m.uid}
                  colors={colors}
                  m={m}
                  stepsTotal={stepsTotal}
                  publicProfile={publicProfiles[m.uid]}
                  expanded={!!openUids[m.uid]}
                  onToggle={() => toggleUid(m.uid)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}