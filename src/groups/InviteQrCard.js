// src/groups/InviteQrCard.js
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Share, Alert } from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

// tu peux changer ce domaine + deep link plus tard
function buildInviteValue(code) {
  // Option A: juste le code (simple)
  // return String(code || "");

  // Option B: lien (recommandé)
  return `prophetik://join?code=${encodeURIComponent(String(code || ""))}`;
}

export default function InviteQrCard({ code, groupName, colors }) {
  const value = useMemo(() => buildInviteValue(code), [code]);
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(String(code || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      Alert.alert(i18n.t("common.error", { defaultValue: "Erreur" }), String(e?.message || e));
    }
  }, [code]);

  const onShare = useCallback(async () => {
    try {
      const msg = i18n.t("groups.invite.shareMessage", {
        defaultValue: "Joins mon groupe {{name}} sur Prophetik avec ce code: {{code}}",
        name: groupName || "Prophetik",
        code: String(code || ""),
      });
      await Share.share({ message: msg });
    } catch (e) {
      Alert.alert(i18n.t("common.error", { defaultValue: "Erreur" }), String(e?.message || e));
    }
  }, [code, groupName]);

  if (!code) return null;

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 6 }}>
        {i18n.t("groups.invite.title", { defaultValue: "Inviter avec un QR code" })}
      </Text>

      <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 10 }}>
        {i18n.t("groups.invite.subtitle", {
          defaultValue: "Un membre peut scanner ce QR pour rejoindre sans saisir le code.",
        })}
      </Text>

      <View style={{ alignItems: "center", paddingVertical: 10 }}>
        <View
          style={{
            padding: 10,
            borderRadius: 14,
            backgroundColor: "#fff",
          }}
        >
          <QRCode value={value} size={180} />
        </View>

        <Text style={{ marginTop: 10, color: colors.text, fontWeight: "900", letterSpacing: 2 }}>
          {String(code)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        <TouchableOpacity
          onPress={onCopy}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card2,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Ionicons name="copy-outline" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {copied
              ? i18n.t("groups.invite.copied", { defaultValue: "Copié" })
              : i18n.t("groups.invite.copy", { defaultValue: "Copier" })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onShare}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: colors.primary,
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Ionicons name="share-outline" size={18} color={"#fff"} />
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {i18n.t("groups.invite.share", { defaultValue: "Partager" })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}