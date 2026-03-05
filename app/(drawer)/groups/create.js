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
} from "react-native";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import i18n from "@src/i18n/i18n";

import { useAuth } from "@src/auth/SafeAuthProvider";
import { createGroupService } from "@src/groups/createGroupService";

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { from } = useLocalSearchParams(); // ?from=onboarding
  const fromOnboarding = String(from || "") === "onboarding";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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

      const { groupId } = await createGroupService({
        name: name.trim(),
        description: description.trim(),
        uid: user.uid,
        displayName: user.displayName || null,
        avatarUrl: user.photoURL || null,
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
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1, padding: 20, backgroundColor: "#f9fafb" }}>
        {/* Hero */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            padding: 20,
            marginBottom: 18,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: "#111827" }}>
            {i18n.t("groups.modalSubtitle", { defaultValue: "Rassemble ton crew et dominez les défis." })}
          </Text>

          {/* Optionnel: si tu veux garder un petit texte secondaire, ajoute une clé dédiée plus tard */}
          <Text
            style={{
              marginTop: 8,
              textAlign: "center",
              color: "#374151",
              fontSize: 15,
              lineHeight: 22,
            }}
          >
            {i18n.t("groups.emptyText", {
              defaultValue: "Organise vos défis, invite tes amis et commence à gagner des points.",
            })}
          </Text>
        </View>

        {/* Form */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6 }}>
            {i18n.t("groups.fieldNameLabel", { defaultValue: "Nom du groupe" })}
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={i18n.t("groups.fieldNamePlaceholder", { defaultValue: "Ex. Les Snipers du Nord" })}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
              backgroundColor: "#fafafa",
            }}
          />

          <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: 6 }}>
            {i18n.t("groups.fieldDescriptionLabel", { defaultValue: "Description (optionnel)" })}
          </Text>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={i18n.t("groups.fieldDescriptionPlaceholder", {
              defaultValue: "Ex. Notre pool du samedi entre amis",
            })}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
              backgroundColor: "#fafafa",
            }}
            multiline
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={safeBack}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#111827",
                alignItems: "center",
                backgroundColor: "#fff",
              }}
              disabled={creating}
            >
              <Text style={{ color: "#111827", fontWeight: "700" }}>
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
                backgroundColor: "#ef4444",
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

        {/* Footer (optionnel: tu as déjà emptyHint) */}
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <Text style={{ color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            {i18n.t("groups.emptyHint", { defaultValue: "Astuce : tu peux définir un groupe favori avec l’icône ★" })}
          </Text>
        </View>
      </View>
    </>
  );
}