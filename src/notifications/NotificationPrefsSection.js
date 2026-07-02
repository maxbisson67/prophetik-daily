import React from "react";
import { View, Text, Switch, ActivityIndicator } from "react-native";
import i18n from "@src/i18n/i18n";
import {
  NOTIFICATION_PREF_KEYS,
  useNotificationPrefs,
} from "@src/notifications/useNotificationPrefs";

function PrefRow({ label, hint, value, onValueChange, disabled, colors }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        marginBottom: 10,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
        {hint ? (
          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 4 }}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

export default function NotificationPrefsSection({ colors }) {
  const { prefs, loading, savingKey, setPref, uid } = useNotificationPrefs();

  if (!uid) {
    return (
      <Text style={{ color: colors.subtext, marginBottom: 12 }}>
        {i18n.t("settings.notifications.loginRequired", {
          defaultValue: "Connecte-toi pour gérer tes notifications.",
        })}
      </Text>
    );
  }

  const disabled = loading || savingKey != null;

  return (
    <View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />
      ) : null}

      <PrefRow
        colors={colors}
        disabled={disabled}
        label={i18n.t("settings.notifications.morningChallenges", {
          defaultValue: "Nouveaux défis du matin",
        })}
        hint={i18n.t("settings.notifications.morningChallengesHint", {
          defaultValue: "Rappel quand l'autopilote crée les défis du jour dans tes groupes.",
        })}
        value={prefs[NOTIFICATION_PREF_KEYS.MORNING_CHALLENGES] !== false}
        onValueChange={(v) => setPref(NOTIFICATION_PREF_KEYS.MORNING_CHALLENGES, v)}
      />

      <PrefRow
        colors={colors}
        disabled={disabled}
        label={i18n.t("settings.notifications.tpExactScore", {
          defaultValue: "Prédire l'issue des matchs",
        })}
        hint={i18n.t("settings.notifications.tpExactScoreHint", {
          defaultValue: "Quand tu prédis le pointage exact d'un match.",
        })}
        value={prefs[NOTIFICATION_PREF_KEYS.TP_EXACT_SCORE] !== false}
        onValueChange={(v) => setPref(NOTIFICATION_PREF_KEYS.TP_EXACT_SCORE, v)}
      />

      <PrefRow
        colors={colors}
        disabled={disabled}
        label={i18n.t("settings.notifications.tsWin", {
          defaultValue: "Le trio du jour",
        })}
        hint={i18n.t("settings.notifications.tsWinHint", {
          defaultValue: "Quand tu gagnes le défi Trio du jour.",
        })}
        value={prefs[NOTIFICATION_PREF_KEYS.TS_WIN] !== false}
        onValueChange={(v) => setPref(NOTIFICATION_PREF_KEYS.TS_WIN, v)}
      />

      <PrefRow
        colors={colors}
        disabled={disabled}
        label={i18n.t("settings.notifications.fgcWin", {
          defaultValue: "Bon joueur (premier point / but)",
        })}
        hint={i18n.t("settings.notifications.fgcWinHint", {
          defaultValue: "Quand tu prédis le bon joueur au défi premier point ou but.",
        })}
        value={prefs[NOTIFICATION_PREF_KEYS.FGC_WIN] !== false}
        onValueChange={(v) => setPref(NOTIFICATION_PREF_KEYS.FGC_WIN, v)}
      />

      <PrefRow
        colors={colors}
        disabled={disabled}
        label={i18n.t("settings.notifications.leaderboardRankUp", {
          defaultValue: "Progression au classement",
        })}
        hint={i18n.t("settings.notifications.leaderboardRankUpHint", {
          defaultValue: "Quand tu grimpes dans le classement saison de ton groupe.",
        })}
        value={prefs[NOTIFICATION_PREF_KEYS.LEADERBOARD_RANK_UP] !== false}
        onValueChange={(v) => setPref(NOTIFICATION_PREF_KEYS.LEADERBOARD_RANK_UP, v)}
      />
    </View>
  );
}
