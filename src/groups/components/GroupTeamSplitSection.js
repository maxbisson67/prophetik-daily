import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import i18n from "@src/i18n/i18n";
import {
  isParticipatingMember,
  isNovaMember,
} from "@src/groups/participationUtils";
import { getGroupTeamSplit, isTeamSplitReady } from "@src/groups/teamSplitUtils";
import { setGroupTeamSplitService } from "@src/groups/groupTeamSplitService";
import { parseGroupTeamSplitError } from "@src/groups/groupTeamSplitErrors";
import ParticipantAvatar from "@src/ui/ParticipantAvatar";
import { resolveLeaderboardMember } from "@src/leaderboard/useLeaderboardProfiles";

const RED = "#b91c1c";

function cardStyle(colors) {
  return {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: "hidden",
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: RED,
  };
}

function TeamChip({ label, active, onPress, colors, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.background,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          fontWeight: "800",
          fontSize: 12,
          color: active ? "#fff" : colors.text,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function GroupTeamSplitSection({
  group,
  memberships = [],
  profiles,
  colors,
  isOwner,
}) {
  const t = i18n.t.bind(i18n);
  const groupId = String(group?.id || group?.groupId || "").trim();
  const serverSplit = getGroupTeamSplit(group);

  const [teamAName, setTeamAName] = useState(serverSplit?.teamA?.name || "");
  const [teamBName, setTeamBName] = useState(serverSplit?.teamB?.name || "");
  const [roster, setRoster] = useState({ ...(serverSplit?.roster || {}) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ts = getGroupTeamSplit(group);
    setTeamAName(ts?.teamA?.name || "");
    setTeamBName(ts?.teamB?.name || "");
    setRoster({ ...(ts?.roster || {}) });
  }, [group?.teamSplit, group?.updatedAt]);

  const participatingUids = useMemo(() => {
    const out = [];
    for (const m of memberships) {
      const uid = String(m.uidNorm || m.uid || m.userId || "").trim();
      if (!uid || isNovaMember(m, uid)) continue;
      if (!isParticipatingMember(m)) continue;
      out.push(uid);
    }
    return [...new Set(out)];
  }, [memberships]);

  const dirty = useMemo(() => {
    const s = serverSplit;
    if (String(teamAName || "").trim() !== String(s?.teamA?.name || "").trim()) return true;
    if (String(teamBName || "").trim() !== String(s?.teamB?.name || "").trim()) return true;
    const a = s?.roster || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(roster)]);
    for (const k of keys) {
      if (a[k] !== roster[k]) return true;
    }
    return false;
  }, [serverSplit, teamAName, teamBName, roster]);

  const ready = isTeamSplitReady({ roster, ready: false });

  const setTeamForUid = useCallback((uid, team) => {
    setRoster((prev) => ({ ...prev, [uid]: team }));
  }, []);

  const onSave = useCallback(async () => {
    if (!groupId || !isOwner || !dirty) return;
    try {
      setSaving(true);
      await setGroupTeamSplitService({
        groupId,
        teamAName,
        teamBName,
        roster,
      });
    } catch (e) {
      Alert.alert(
        t("groups.config.saveErrorTitle", { defaultValue: "Erreur" }),
        parseGroupTeamSplitError(e) || String(e?.message || e)
      );
    } finally {
      setSaving(false);
    }
  }, [groupId, isOwner, dirty, teamAName, teamBName, roster, t]);

  if (!isOwner) return null;

  const displayA =
    String(teamAName || "").trim() ||
    t("groups.teamSplit.teamA", { defaultValue: "Équipe A" });
  const displayB =
    String(teamBName || "").trim() ||
    t("groups.teamSplit.teamB", { defaultValue: "Équipe B" });

  return (
    <View style={cardStyle(colors)}>
      <Text style={{ fontWeight: "900", fontSize: 17, color: colors.text }}>
        {t("groups.teamSplit.sectionTitle", { defaultValue: "Duel par équipes (optionnel)" })}
      </Text>
      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>
        {t("groups.teamSplit.sectionHint", {
          defaultValue:
            "Assigne les membres actifs. Le classement équipes apparaît pour tout le groupe une fois au moins un joueur par équipe.",
        })}
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6 }}>
            {t("groups.teamSplit.teamA", { defaultValue: "Équipe A" })}
          </Text>
          <TextInput
            value={teamAName}
            onChangeText={setTeamAName}
            editable={!saving}
            placeholder={t("groups.teamSplit.teamAPlaceholder", { defaultValue: "Ex. Parents" })}
            placeholderTextColor={colors.subtext}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.background,
              color: colors.text,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 6 }}>
            {t("groups.teamSplit.teamB", { defaultValue: "Équipe B" })}
          </Text>
          <TextInput
            value={teamBName}
            onChangeText={setTeamBName}
            editable={!saving}
            placeholder={t("groups.teamSplit.teamBPlaceholder", { defaultValue: "Ex. Ados" })}
            placeholderTextColor={colors.subtext}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: colors.background,
              color: colors.text,
            }}
          />
        </View>
      </View>

      <View
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: ready ? "#16a34a22" : "#f59e0b22",
        }}
      >
        <Text
          style={{
            fontWeight: "800",
            fontSize: 12,
            color: ready ? "#16a34a" : "#d97706",
          }}
        >
          {ready
            ? t("groups.teamSplit.ready", {
                defaultValue: "Visible dans le Classement pour tous",
              })
            : t("groups.teamSplit.notReady", {
                defaultValue: "Assigne au moins un membre par équipe",
              })}
        </Text>
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        {participatingUids.length === 0 ? (
          <Text style={{ color: colors.subtext }}>
            {t("groups.teamSplit.noParticipatingMembers", {
              defaultValue: "Aucun membre actif à assigner.",
            })}
          </Text>
        ) : (
          participatingUids.map((uid) => {
            const m = memberships.find(
              (x) => String(x.uidNorm || x.uid) === uid
            );
            const lb = resolveLeaderboardMember({ uid, id: uid }, profiles || {});
            const name = lb.displayName || m?.displayName || uid.slice(0, 8);
            const pick = roster[uid];
            return (
              <View
                key={uid}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <ParticipantAvatar
                  name={name}
                  photoURL={lb.avatarUrl}
                  avatarUrl={lb.avatarUrl}
                  jerseyFrontUrl={lb.jerseyFrontUrl}
                  jerseyBackUrl={lb.jerseyBackUrl}
                  avatarKind={lb.avatarKind}
                  size={36}
                  colors={colors}
                />
                <Text
                  style={{ flex: 1, fontWeight: "700", color: colors.text }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TeamChip
                    label={displayA.length > 12 ? "A" : displayA}
                    active={pick === "a"}
                    onPress={() => setTeamForUid(uid, "a")}
                    colors={colors}
                    disabled={saving}
                  />
                  <TeamChip
                    label={displayB.length > 12 ? "B" : displayB}
                    active={pick === "b"}
                    onPress={() => setTeamForUid(uid, "b")}
                    colors={colors}
                    disabled={saving}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>

      <TouchableOpacity
        onPress={onSave}
        disabled={!dirty || saving}
        style={{
          marginTop: 14,
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: "center",
          backgroundColor: colors.primary,
          opacity: !dirty || saving ? 0.5 : 1,
        }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {t("groups.teamSplit.save", { defaultValue: "Enregistrer le duel" })}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
