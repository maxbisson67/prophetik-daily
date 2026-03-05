// src/groups/ScanInviteQrModal.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

// Nettoie: uppercase, enlève espaces/symboles, enlève O et 0
function sanitizeCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "")
    .replace(/0/g, "");
}

function validateCode(code) {
  if (!code) return false;
  if (code.length !== CODE_LEN) return false;
  return [...code].every((ch) => ALPHABET.includes(ch));
}

function extractCode(raw) {
  const s0 = String(raw || "").trim();
  if (!s0) return null;

  // 1) Code direct (ex: ABCD1234)
  const direct = sanitizeCode(s0);
  if (validateCode(direct) && !s0.includes("://")) return direct;

  // 2) URL standard / deep link (prophetik://join?code=XXXX)
  //    + support "https://...?...&code=XXXX"
  try {
    const url = new URL(s0);
    const c = url.searchParams.get("code");
    const cleaned = sanitizeCode(c);
    if (validateCode(cleaned)) return cleaned;
  } catch {
    // ignore
  }

  // 3) Variante: prophetik://join/ABCD1234  (code dans le path)
  //    ou n'importe quoi qui contient un token de 8 chars.
  //    Ex: "prophetik://join/ABCD1234?x=1" ou "CODE: ABCD1234"
  const tokenMatch = s0.toUpperCase().match(/[A-Z0-9]{8}/g);
  if (tokenMatch && tokenMatch.length) {
    // on tente tous les tokens trouvés, on garde le premier valide
    for (const t of tokenMatch) {
      const cleaned = sanitizeCode(t);
      if (validateCode(cleaned)) return cleaned;
    }
  }

  return null;
}

export default function ScanInviteQrModal({ visible, onClose, onCode, colors }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // reset quand on ferme
  useEffect(() => {
    if (!visible) setScanned(false);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (!permission?.granted) requestPermission();
  }, [visible, permission?.granted, requestPermission]);

  const canScan = useMemo(() => visible && !!permission?.granted && !scanned, [visible, permission?.granted, scanned]);

  const onBarcodeScanned = useCallback(
    (res) => {
      if (!canScan) return;

      setScanned(true);

      const code = extractCode(res?.data);
      if (!code) {
        Alert.alert(
          i18n.t("common.error", { defaultValue: "Erreur" }),
          i18n.t("groups.join.qrInvalid", { defaultValue: "QR invalide. Essaie encore." })
        );
        setTimeout(() => setScanned(false), 900);
        return;
      }

      onCode?.(code);
      onClose?.();
    },
    [canScan, onCode, onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 14,
            height: "75%",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {i18n.t("groups.join.scanTitle", { defaultValue: "Scanner un QR" })}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {!permission ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator />
            </View>
          ) : !permission.granted ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "800", textAlign: "center" }}>
                {i18n.t("groups.join.cameraDenied", {
                  defaultValue: "Permission caméra refusée. Autorise la caméra pour scanner un QR.",
                })}
              </Text>

              <TouchableOpacity
                onPress={requestPermission}
                style={{
                  marginTop: 12,
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>
                  {i18n.t("groups.join.cameraGrant", { defaultValue: "Autoriser" })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
              <CameraView
                style={{ flex: 1 }}
                onBarcodeScanned={onBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
              <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
                <View
                  style={{
                    backgroundColor: "rgba(0,0,0,0.55)",
                    padding: 10,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>
                    {scanned
                      ? i18n.t("groups.join.scanProcessing", { defaultValue: "Analyse…" })
                      : i18n.t("groups.join.scanHint", { defaultValue: "Place le QR dans le cadre" })}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}