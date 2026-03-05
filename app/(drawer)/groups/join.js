// app/groups/join.js
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import {
  Stack,
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { joinGroupService } from "@src/groups/joinGroupService";
import firestore from "@react-native-firebase/firestore";

// Safe auth + thème
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";
import i18n from "@src/i18n/i18n";

// ✅ QR scan modal
import ScanInviteQrModal from "@src/groups/ScanInviteQrModal";

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

function pickDisplayName(profile, user) {
  const p = profile || {};
  return (
    p.displayName ||
    p.name ||
    (p.email ? String(p.email).split("@")[0] : "") ||
    user?.displayName ||
    "Invité"
  );
}

function pickAvatarUrl(profile, user) {
  const p = profile || {};
  return (
    p.photoURL ||
    p.avatarUrl ||
    p.photoUrl ||
    p.avatar ||
    user?.photoURL ||
    user?.photoUrl ||
    null
  );
}

async function buildIdentityFromParticipants(uid, user) {
  try {
    const snap = await firestore().doc(`participants/${uid}`).get();
    const p = snap.exists ? snap.data() || {} : {};

    const displayName =
      (typeof p.displayName === "string" && p.displayName.trim()) ||
      (p.email ? String(p.email).split("@")[0] : "") ||
      user?.displayName ||
      "Invité";

    const avatarUrl =
      p.photoURL ||
      p.avatarUrl ||
      p.photoUrl ||
      p.avatar ||
      user?.photoURL ||
      user?.photoUrl ||
      null;

    return { displayName, avatarUrl };
  } catch {
    return {
      displayName: user?.displayName || "Invité",
      avatarUrl: user?.photoURL || user?.photoUrl || null,
    };
  }
}

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { from } = useLocalSearchParams();

  const fromOnboarding = String(from || "") === "onboarding";

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ QR scan modal state
  const [scanOpen, setScanOpen] = useState(false);

  const sanitize = useCallback(
    (s) =>
      String(s || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/O/g, "")
        .replace(/0/g, ""),
    []
  );

  const validateCode = useCallback(
    (c) => c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch)),
    []
  );

  const cleanedCode = useMemo(() => sanitize(code), [code, sanitize]);

  const canJoin = useMemo(
    () => validateCode(cleanedCode) && !busy,
    [cleanedCode, busy, validateCode]
  );

  // 🔙 Retour logique
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

      router.replace("/(drawer)/(tabs)/AccueilScreen");
      return true;
    } catch {
      return true;
    }
  }, [fromOnboarding, router, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", safeBack);
      return () => sub.remove();
    }, [safeBack])
  );

  const onJoin = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert(
        i18n.t("groups.join.alertLoginRequiredTitle"),
        i18n.t("groups.join.alertLoginRequiredMessage")
      );
      return;
    }

    if (!validateCode(cleanedCode)) {
      Alert.alert(
        i18n.t("groups.join.alertCodeInvalidTitle"),
        i18n.t("groups.join.alertCodeInvalidMessage", { len: CODE_LEN })
      );
      return;
    }

    try {
      setBusy(true);

      const identity = await buildIdentityFromParticipants(user.uid, user);
      const res = await joinGroupService({ code: cleanedCode, identity });

      const groupId = res?.groupId;
      if (!groupId) throw new Error(i18n.t("groups.join.alertServerUnexpected"));

      router.replace({
        pathname: "/(drawer)/groups/[groupId]",
        params: { groupId },
      });
    } catch (e) {
      const errCode = String(e?.code || ""); // ex: functions/failed-precondition
      const msg = String(e?.message || "");
      const details = e?.details || null;

      console.log("JOIN ERROR", { code: errCode, message: msg, details });

      // ✅ Caps (abonnement)
      if (
        errCode.includes("failed-precondition") &&
        (msg.includes("MEMBER_GROUP_LIMIT_REACHED") ||
          msg.includes("OWNER_GROUP_LIMIT_REACHED"))
      ) {
        const tier = details?.tier || "free";
        const current = details?.current ?? 0;
        const max = details?.max ?? 0;

        Alert.alert(
          i18n.t("groups.join.alertLimitTitle"),
          i18n.t("groups.join.alertLimitMessage", { tier, current, max })
        );
        return;
      }

      // Invalid code
      if (errCode.includes("not-found") || msg.toLowerCase().includes("invalid code")) {
        Alert.alert(
          i18n.t("groups.join.alertCodeNotFoundTitle"),
          i18n.t("groups.join.alertCodeNotFoundMessage")
        );
        return;
      }

      // Not logged in
      if (errCode.includes("unauthenticated")) {
        Alert.alert(
          i18n.t("groups.join.alertLoginRequiredTitle"),
          i18n.t("groups.join.alertLoginRequiredMessage")
        );
        return;
      }

      // Fallback générique
      Alert.alert(i18n.t("groups.join.alertGenericErrorTitle"), msg || "Erreur");
    } finally {
      setBusy(false);
    }
  }, [user?.uid, cleanedCode, validateCode, router, user]);

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t("groups.join.title"),
          headerLeft: () => (
            <TouchableOpacity onPress={safeBack} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      />

      {/* ✅ QR Scan Modal */}
      <ScanInviteQrModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={(c) => setCode(sanitize(c))}
        colors={colors}
      />

      <View style={{ flex: 1, padding: 20, backgroundColor: colors.background }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "900",
              textAlign: "center",
              color: colors.text,
            }}
          >
            {i18n.t("groups.join.ctaTitle")}
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
            {i18n.t("groups.join.ctaSubtitle")}
          </Text>
        </View>

        <TextInput
          value={code}
          onChangeText={(t) => setCode(sanitize(t))}
          autoCapitalize="characters"
          placeholder={i18n.t("groups.join.placeholderCode")}
          placeholderTextColor={colors.subtext}
          maxLength={CODE_LEN + 2}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 20,
            letterSpacing: 2,
            backgroundColor: colors.card,
            color: colors.text,
            textAlign: "center",
          }}
        />

        {/* ✅ Scanner QR */}
        <TouchableOpacity
          onPress={() => setScanOpen(true)}
          disabled={busy}
          style={{
            marginTop: 12,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card2,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Ionicons name="qr-code-outline" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("groups.join.scanBtn", { defaultValue: "Scanner un QR" })}
          </Text>
        </TouchableOpacity>

        {/* Join */}
        <TouchableOpacity
          onPress={onJoin}
          disabled={!canJoin}
          style={{
            marginTop: 16,
            backgroundColor: canJoin ? "#ef4444" : colors.subtext,
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {i18n.t("groups.join.btnJoin")}
            </Text>
          )}
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          onPress={safeBack}
          style={{
            marginTop: 20,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "600", color: colors.text }}>
            {i18n.t("groups.join.btnCancel")}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}