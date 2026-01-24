import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";
import { Feather } from "@expo/vector-icons";
import { withCacheBust } from "@src/home/homeUtils";

const AVATAR_PLACEHOLDER = require("@src/assets/avatar-placeholder.png");

function stepsTotalFor(ascKey, ascState) {
  const s = Number(ascState?.stepsTotal || 0);
  if (s > 0) return s;
  return String(ascKey).toUpperCase() === "ASC7" ? 7 : 4;
}

function progressFromWinsByType(winsByType, stepsTotal) {
  const map = winsByType && typeof winsByType === "object" ? winsByType : {};
  let done = 0;
  for (let i = 1; i <= stepsTotal; i++) {
    if (map[String(i)] === true) done++;
  }
  return { done, total: stepsTotal };
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

function StepPill({ colors, label, active }) {
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.card2 : "transparent",
      }}
    >
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: "900" }}>
        {active ? "✅ " : "▫️ "}
        {label}
      </Text>
    </View>
  );
}

function MemberRow({ colors, m, stepsTotal, publicProfile }) {

  const isAI = String(m.uid || "").toLowerCase() === "ai";

const displayName = isAI
  ? (publicProfile?.displayName || m.displayName || m.uid)
  : (publicProfile?.displayName || m.displayName || m.uid);

  const avatarUrl =
    publicProfile?.avatarUrl ||
    m.avatarUrl ||
    null;

  const { done } = progressFromWinsByType(m.winsByType, stepsTotal);
  const pct = stepsTotal > 0 ? Math.round((done / stepsTotal) * 100) : 0;

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
      }}
    >
      <Image
        source={avatarUrl ? { uri: withCacheBust(avatarUrl) } : AVATAR_PLACEHOLDER}
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          backgroundColor: colors.card,
        }}
      />

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900" }}>
            {displayName}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "800" }}>
            {done}/{stepsTotal} • {pct}%
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {Array.from({ length: stepsTotal }, (_, idx) => {
            const step = idx + 1;
            const active = m.winsByType?.[String(step)] === true;
            return (
              <StepPill key={step} colors={colors} label={`${step}x${step}`} active={active} />
            );
          })}
        </View>

        {m.completed ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: colors.primary, fontWeight: "900" }}>
              🏁 {i18n.t("ascensions.completed", { defaultValue: "Quête complétée" })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function AscensionProgressModal({
  visible,
  onClose,
  colors,
  groupId,
  ascKey = "ASC4",

  // tu peux passer cycleId direct si tu l’as déjà
  cycleId: cycleIdProp = null,

  // si true, merge aussi les membres du groupe même sans doc cycle member
  includeAllGroupMembers = true,
}) {
  const [loading, setLoading] = useState(false);
  const [ascState, setAscState] = useState(null);

  // source-of-truth pour lire les membres
  const [cycleId, setCycleId] = useState(cycleIdProp);

  // members du cycle
  const [error, setError] = useState(null);

  const [cycleMembers, setCycleMembers] = useState([]); // progrès
  const [groupMembers, setGroupMembers] = useState([]); // profils

  const stepsTotal = useMemo(() => stepsTotalFor(ascKey, ascState), [ascKey, ascState]);

  const members = useMemo(() => {
  const byUid = new Map((cycleMembers || []).map((x) => [String(x.uid), x]));

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
        type: m.type || base.type || null,
        displayName: base.displayName || m.displayName || null,
        avatarUrl: base.avatarUrl || m.avatarUrl || null,
      };
    });

    // ajoute les joueurs qui ont de la progression mais pas de membership “active”
    for (const [uid, x] of byUid.entries()) {
      if (!merged.some((m) => String(m.uid) === String(uid))) merged.push(x);
    }

    return merged;
  }, [cycleMembers, groupMembers]);

  // reset quand on ouvre
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setLoading(true);
  }, [visible]);

  // 1) Lire le doc legacy ascension (pour stepsTotal/completedWinners + cycleId si présent)
  useEffect(() => {
    if (!visible) return;
    if (!groupId) return;

    const k = String(ascKey).toUpperCase();
    const ascRef = firestore().doc(`groups/${groupId}/ascensions/${k}`);

    const unsubAsc = ascRef.onSnapshot(
      (snap) => {
        const data = snap.exists ? snap.data() || {} : {};
        setAscState(data);

        // Priorité: cycleId dans doc, sinon prop
        const nextCycleId =
          cycleIdProp || data?.activeCycleId || data?.cycleId || null;

        setCycleId(nextCycleId);
      },
      (e) => {
        setError(e);
        setAscState({});
        setCycleId(cycleIdProp || null);
      }
    );

    return () => {
      try {
        unsubAsc?.();
      } catch {}
    };
  }, [visible, groupId, ascKey, cycleIdProp]);

  // 2) ✅ Lire les members du cycle AU BON CHEMIN
  useEffect(() => {
    if (!visible) return;
    if (!groupId) return;

    if (!cycleId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const cycleMembersRef = firestore().collection(
      `groups/${groupId}/ascension_cycles/${String(cycleId)}/members`
    );

    const unsubMembers = cycleMembersRef.onSnapshot(
      (snap) => {
        const rows = snap.docs.map((d) => {
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

        setCycleMembers(rows);
        setLoading(false);
      },
      (e) => {
        setError(e);
        setMembers([]);
        setLoading(false);
      }
    );

    return () => {
      try {
        unsubMembers?.();
      } catch {}
    };
  }, [visible, groupId, cycleId]);

  // 3) Optionnel: merge tous les membres du groupe + enrichir displayName/avatar
  useEffect(() => {
    if (!visible) return;
    if (!groupId) return;
    if (!includeAllGroupMembers) return;

    const q = firestore()
      .collection("group_memberships")
      .where("groupId", "==", String(groupId))
      .where("status", "==", "active");

    const unsub = q.onSnapshot(
      (snap) => {
        const gm = snap.docs
          .map((d) => d.data() || {})
          .filter((m) =>  m.active !== false);

        const byUid = new Map((members || []).map((x) => [String(x.uid), x]));

        const merged = gm.map((m) => {
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

          // ✅ enrichit base si il manque des champs
          return {
            ...base,
            displayName: base.displayName || m.displayName || null,
            avatarUrl: base.avatarUrl || m.avatarUrl || null,
          };
        });

        for (const [uid, x] of byUid.entries()) {
          if (!merged.some((m) => String(m.uid) === String(uid))) merged.push(x);
        }

        setGroupMembers(gm);
      },
      () => {}
    );

    return () => {
      try {
        unsub?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, groupId, includeAllGroupMembers, JSON.stringify((members || []).map((m) => m.uid))]);

  const rowsSorted = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    return [...list].sort((a, b) => {
      const pa = progressFromWinsByType(a.winsByType, stepsTotal).done;
      const pb = progressFromWinsByType(b.winsByType, stepsTotal).done;

      const ca = a.completed ? 1 : 0;
      const cb = b.completed ? 1 : 0;

      if (cb !== ca) return cb - ca;
      if (pb !== pa) return pb - pa;
      return String(a.displayName || a.uid).localeCompare(String(b.displayName || b.uid));
    });
  }, [members, stepsTotal]);

  const memberUids = useMemo(
    () => rowsSorted.map((m) => String(m.uid)),
    [rowsSorted]
  );

  const publicProfiles = usePublicProfilesFor(memberUids);

  const title = useMemo(() => {
    const k = String(ascKey).toUpperCase();
    const n = k === "ASC7" ? 7 : 4;
    return i18n.t("ascensions.progressTitle", {
      defaultValue: `Ascension ${n} — Progression`,
      n,
    });
  }, [ascKey]);

  const completedWinners = Array.isArray(ascState?.completedWinners)
    ? ascState.completedWinners
    : [];

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
            maxHeight: "82%",
          }}
        >
          {/* Header */}
          <View
            style={{
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{title}</Text>

              <Text style={{ color: colors.subtext, marginTop: 2, fontWeight: "700" }}>
                {i18n.t("ascensions.stepsTotal", { defaultValue: "Étapes:" })} {stepsTotal}
                {completedWinners.length ? ` • 🏆 ${completedWinners.length}` : ""}
              </Text>

              {!!cycleId ? (
                <Text style={{ color: colors.subtext, marginTop: 2, fontSize: 12 }}>
                  {i18n.t("ascensions.cycleId", { defaultValue: "Cycle:" })} {String(cycleId)}
                </Text>
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
          ) : !cycleId ? (
            <View style={{ padding: 18 }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("ascensions.noActiveCycle", {
                  defaultValue: "Aucun cycle actif pour cette Ascension.",
                })}
              </Text>
            </View>
          ) : !rowsSorted.length ? (
            <View style={{ padding: 18 }}>
              <Text style={{ color: colors.subtext }}>
                {i18n.t("ascensions.noProgressYet", { defaultValue: "Aucune progression pour l’instant." })}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16 }}>
              {rowsSorted.map((m) => (
                  <MemberRow
                    key={m.uid}
                    colors={colors}
                    m={m}
                    stepsTotal={stepsTotal}
                    publicProfile={publicProfiles[m.uid]}
                  />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}