// app/groups/create.js
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import { createGroupService } from "@src/groups/createGroupService";
import { updateGroupConfigService } from "@src/groups/manageGroupService";
import { normalizeGroupFavoriteTeam } from "@src/groups/normalizeGroupFavoriteTeam";
import GroupConfigFields from "@src/groups/components/GroupConfigFields";
import FormSectionSeparator from "@src/groups/components/FormSectionSeparator";
import Analytics from "@src/services/analytics";

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams();
  const fromOnboarding = String(from || "") === "onboarding";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("NHL");
  const [autopilotEnabled, setAutopilotEnabled] = useState(true);
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [creating, setCreating] = useState(false);

  const safeBack = useCallback(async () => {
    try {
      if (fromOnboarding && user?.uid) {
        await firestore()
          .doc(`participants/${user.uid}`)
          .set({ onboarding: { welcomeSeen: false } }, { merge: true });
        router.replace("/onboarding/welcome");
        return true;
      }

      if (router.canGoBack?.()) {
        router.back();
        return true;
      }

      router.replace("/(drawer)/(tabs)/GroupsScreen");
      return true;
    } catch (e) {
      console.log("Reset onboarding failed:", e?.message || e);
      return true;
    }
  }, [fromOnboarding, router, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", safeBack);
      return () => sub.remove();
    }, [safeBack])
  );

  async function onCreate() {
    if (!user?.uid) {
      Alert.alert(
        i18n.t("groups.alertNotConnectedTitle", { defaultValue: "Non connecté" }),
        i18n.t("groups.alertNotConnectedMessage", { defaultValue: "Connecte-toi pour créer un groupe." })
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert(
        i18n.t("groups.alertNameRequiredTitle", { defaultValue: "Nom requis" }),
        i18n.t("groups.alertNameRequiredMessage", { defaultValue: "Donne un nom à ton groupe." })
      );
      return;
    }

    try {
      setCreating(true);

      const normalizedFavoriteTeam = normalizeGroupFavoriteTeam(sport, favoriteTeam);

      if (__DEV__) {
        console.log("[CreateGroup] submit", {
          sport,
          autopilotEnabled,
          favoriteTeam: normalizedFavoriteTeam,
        });
      }

      const { groupId } = await createGroupService({
        name: name.trim(),
        description: description.trim(),
        sport,
        autopilotEnabled,
        favoriteTeam: normalizedFavoriteTeam,
      });

      try {
        await updateGroupConfigService({
          groupId,
          autopilotEnabled: autopilotEnabled !== false,
          favoriteTeam: normalizedFavoriteTeam,
        });
      } catch (configErr) {
        console.warn("[CreateGroup] updateGroupConfig failed", configErr?.message || configErr);
        Alert.alert(
          i18n.t("groups.config.saveErrorTitle", { defaultValue: "Configuration" }),
          i18n.t("groups.config.saveAfterCreateError", {
            defaultValue:
              "Le groupe a été créé, mais la configuration (autopilot / équipe favorite) n'a pas pu être enregistrée. Tu peux la modifier depuis l'écran du groupe.",
          })
        );
      }

      Analytics.createGroup({
        groupType: "private",
        source: "create_screen",
        groupId,
      });

      router.replace({
        pathname: "/(drawer)/groups/[groupId]",
        params: { groupId },
      });
    } catch (e) {
      Alert.alert(
        i18n.t("groups.alertErrorTitle", { defaultValue: "Erreur" }),
        String(e?.message || e)
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("groups.modalTitle", { defaultValue: "Nouveau groupe" }),
          headerLeft: () => (
            <TouchableOpacity onPress={safeBack} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 20,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: colors.text }}>
            {i18n.t("groups.modalSubtitle", { defaultValue: "Rassemble ton crew et dominez les défis." })}
          </Text>
          <Text
            style={{
              marginTop: 8,
              textAlign: "center",
              color: colors.subtext,
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {i18n.t("groups.emptyText", {
              defaultValue: "Organise vos défis, invite tes amis et commence à gagner des points.",
            })}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <View>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6, color: colors.text }}>
              {i18n.t("groups.fieldNameLabel", { defaultValue: "Nom du groupe" })}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={i18n.t("groups.fieldNamePlaceholder", { defaultValue: "Ex. Les Snipers du Nord" })}
              placeholderTextColor={colors.subtext}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                backgroundColor: colors.background,
                color: colors.text,
              }}
            />
          </View>

          <View>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6, color: colors.text }}>
              {i18n.t("groups.fieldDescriptionLabel", { defaultValue: "Description (optionnel)" })}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={i18n.t("groups.fieldDescriptionPlaceholder", {
                defaultValue: "Ex. Notre pool du samedi entre amis",
              })}
              placeholderTextColor={colors.subtext}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                backgroundColor: colors.background,
                color: colors.text,
              }}
              multiline
            />
          </View>

          <FormSectionSeparator colors={colors} marginVertical={6} />

          <View>
            <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6, color: colors.text }}>
              {i18n.t("groups.fieldSportLabel", { defaultValue: "Sport" })}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {["NHL", "MLB"].map((value) => {
                const active = sport === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setSport(value)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.background,
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : colors.text, fontWeight: "800" }}>
                      {value === "NHL" ? "🏒 NHL" : "⚾ MLB"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <FormSectionSeparator colors={colors} marginVertical={6} />

          <GroupConfigFields
            colors={colors}
            autopilotEnabled={autopilotEnabled}
            onAutopilotEnabledChange={setAutopilotEnabled}
            favoriteTeam={favoriteTeam}
            onFavoriteTeamChange={setFavoriteTeam}
            sport={sport}
            disabled={creating}
          />

          <FormSectionSeparator colors={colors} marginVertical={6} />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              onPress={safeBack}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                backgroundColor: colors.background,
              }}
              disabled={creating}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {i18n.t("groups.cancel", { defaultValue: "Annuler" })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onCreate}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: colors.primary,
                opacity: creating ? 0.6 : 1,
              }}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {i18n.t("groups.create", { defaultValue: "Créer" })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text
          style={{
            color: colors.subtext,
            fontSize: 13,
            textAlign: "center",
            lineHeight: 20,
            marginTop: 24,
          }}
        >
          {i18n.t("groups.emptyHint", {
            defaultValue: "Astuce : tu peux définir un groupe favori avec l’icône ★",
          })}
        </Text>
      </ScrollView>
    </>
  );
}
