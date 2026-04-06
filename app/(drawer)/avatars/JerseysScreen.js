import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import functions from "@react-native-firebase/functions";
import auth from "@react-native-firebase/auth";
import { SvgUri } from "react-native-svg";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import i18n from "@src/i18n/i18n";
import { useAuth } from "@src/auth/SafeAuthProvider";
import { useTheme } from "@src/theme/ThemeProvider";

function Chip({ icon, color, bg, label }) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: bg || colors.card2,
      }}
    >
      {!!icon && <MaterialCommunityIcons name={icon} size={14} color={color || colors.text} />}
      <Text
        style={{
          color: color || colors.text,
          marginLeft: icon ? 6 : 0,
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function StepDot({ index, step, label, colors }) {
  const active = step === index;
  const done = step > index;

  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? "#ef4444" : done ? "rgba(239,68,68,0.14)" : colors.card2,
          borderWidth: 1,
          borderColor: active ? "#ef4444" : done ? "rgba(239,68,68,0.35)" : colors.border,
        }}
      >
        {done ? (
          <MaterialCommunityIcons name="check" size={18} color={active ? "#fff" : "#b91c1c"} />
        ) : (
          <Text
            style={{
              color: active ? "#fff" : colors.text,
              fontWeight: "900",
              fontSize: 13,
            }}
          >
            {index}
          </Text>
        )}
      </View>

      <Text
        style={{
          marginTop: 6,
          color: active ? colors.text : colors.subtext,
          fontWeight: active ? "900" : "700",
          fontSize: 11,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function WizardHeader({ step, colors }) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 18,
          fontWeight: "900",
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        {i18n.t("jerseys.wizard.title", { defaultValue: "Créer mon jersey Prophetik" })}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <StepDot
          index={1}
          step={step}
          label={i18n.t("jerseys.steps.current", { defaultValue: "Actuel" })}
          colors={colors}
        />
        <StepDot
          index={2}
          step={step}
          label={i18n.t("jerseys.steps.model", { defaultValue: "Modèle" })}
          colors={colors}
        />
        <StepDot
          index={3}
          step={step}
          label={i18n.t("jerseys.steps.customize", { defaultValue: "Personnaliser" })}
          colors={colors}
        />
      </View>
    </View>
  );
}

function SectionCard({ title, subtitle, children, colors }) {
  return (
    <View
      style={{
        padding: 16,
        borderWidth: 1,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderColor: colors.border,
        gap: 14,
      }}
    >
      <View>
        <Text style={{ fontWeight: "900", fontSize: 18, color: colors.text }}>{title}</Text>
        {!!subtitle && (
          <Text style={{ color: colors.subtext, marginTop: 4, lineHeight: 18 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function PreviewStage({ uri, colors, loading, emptyLabel }) {
  return (
    <View
      style={{
        width: "100%",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 18,
        minHeight: 300,
      }}
    >
      {uri ? (
        <RemoteImage uri={uri} style={{ width: 280, height: 280 }} fallback={null} />
      ) : loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={{ color: colors.subtext }}>{emptyLabel}</Text>
      )}
    </View>
  );
}

function SideToggle({ previewSide, setPreviewSide, colors }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
      <TouchableOpacity
        onPress={() => setPreviewSide("front")}
        style={{
          paddingVertical: 9,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: previewSide === "front" ? colors.primary : colors.border,
          backgroundColor: previewSide === "front" ? colors.primary : colors.card,
        }}
      >
        <Text
          style={{
            color: previewSide === "front" ? "#fff" : colors.text,
            fontWeight: "900",
          }}
        >
          {i18n.t("jerseys.preview.front", { defaultValue: "Avant" })}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setPreviewSide("back")}
        style={{
          paddingVertical: 9,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: previewSide === "back" ? colors.primary : colors.border,
          backgroundColor: previewSide === "back" ? colors.primary : colors.card,
        }}
      >
        <Text
          style={{
            color: previewSide === "back" ? "#fff" : colors.text,
            fontWeight: "900",
          }}
        >
          {i18n.t("jerseys.preview.back", { defaultValue: "Arrière" })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SummaryStrip({ selectedItem, lastName, number, colors }) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card2,
        gap: 8,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "900" }}>
        {i18n.t("jerseys.summary.title", { defaultValue: "Résumé actuel" })}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip icon="tshirt-crew" label={selectedItem?.name || "—"} />
        <Chip icon="account" label={lastName || "—"} />
        <Chip icon="numeric" label={`#${number || "—"}`} />
      </View>
    </View>
  );
}

function FooterActions({
  step,
  canNext = true,
  nextLabel,
  onBack,
  onNext,
  colors,
  loading = false,
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {step > 1 ? (
        <TouchableOpacity
          onPress={onBack}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {i18n.t("common.back", { defaultValue: "Retour" })}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onNext}
        disabled={!canNext || loading}
        style={{
          flex: 1,
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: !canNext || loading ? "#9ca3af" : "#ef4444",
        }}
      >
        {loading ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {i18n.t("jerseys.actions.generating", { defaultValue: "Génération…" })}
            </Text>
          </View>
        ) : (
          <Text style={{ color: "#fff", fontWeight: "900" }}>{nextLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function normalizeLastNameInput(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trimStart()
    .toUpperCase();
}

function normalizeNumberInput(value) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 2);
}

function isSvg(url) {
  return String(url || "").toLowerCase().includes(".svg");
}

function RemoteImage({ uri, style, resizeMode = "contain", fallback }) {
  if (!uri) return fallback || null;

  if (isSvg(uri)) {
    return (
      <View style={style}>
        <SvgUri uri={uri} width="100%" height="100%" />
      </View>
    );
  }

  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}

export default function JerseysScreen() {
  const r = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [step, setStep] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [previewSide, setPreviewSide] = useState("front");

  const [lastName, setLastName] = useState("");
  const [number, setNumber] = useState("");

  const [currentJerseyId, setCurrentJerseyId] = useState(null);
  const [currentFrontUrl, setCurrentFrontUrl] = useState(null);
  const [currentBackUrl, setCurrentBackUrl] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const selectedItem = useMemo(
    () => (catalog || []).find((x) => x.id === selectedId) || null,
    [catalog, selectedId]
  );

  const currentItem = useMemo(
    () => (catalog || []).find((x) => x.id === currentJerseyId) || null,
    [catalog, currentJerseyId]
  );

  const previewUrl = useMemo(() => {
    if (!selectedItem) return null;
    return previewSide === "front"
      ? selectedItem.previewFrontUrl || null
      : selectedItem.previewBackUrl || selectedItem.previewFrontUrl || null;
  }, [selectedItem, previewSide]);

  const currentPreviewUrl = useMemo(() => {
    if (previewSide === "front") {
      return currentFrontUrl || currentItem?.previewFrontUrl || null;
    }
    return currentBackUrl || currentItem?.previewBackUrl || currentFrontUrl || currentItem?.previewFrontUrl || null;
  }, [previewSide, currentFrontUrl, currentBackUrl, currentItem]);

  useEffect(() => {
    setLoadingCatalog(true);

    const qRef = firestore().collection("catalog_jerseys");

    const unsub = qRef.onSnapshot(
      (snap) => {
        const rows =
          (snap?.docs?.map((d) => ({ id: d.id, ...d.data() })) || [])
            .filter((x) => x.active === true)
            .sort((a, b) => Number(a.sort || 9999) - Number(b.sort || 9999));

        setCatalog(rows);
        setLoadingCatalog(false);
      },
      (err) => {
        //console.log("[JerseysScreen] catalog error", err?.message || err);
        setCatalog([]);
        setLoadingCatalog(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);

    const ref = firestore().doc(`participants/${user.uid}`);

    const unsub = ref.onSnapshot(
      (snap) => {
        const data = snap?.data?.() || {};

        const jerseyId = String(data.jerseyId || "").trim();
        const jerseyName = String(data.jerseyName || "").trim();
        const jerseyNumber = String(data.jerseyNumber || "").trim();

        setCurrentJerseyId(jerseyId || null);
        setCurrentFrontUrl(data.jerseyFrontUrl || null);
        setCurrentBackUrl(data.jerseyBackUrl || null);

        if (jerseyId) setSelectedId((prev) => prev || jerseyId);
        if (jerseyName) setLastName(jerseyName);
        if (jerseyNumber) setNumber(jerseyNumber);

        setLoadingProfile(false);
      },
      (err) => {
        //console.log("[JerseysScreen] participant read error", err?.message || err);
        setLoadingProfile(false);
      }
    );

    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!catalog.length) return;
    if (selectedId) return;
    setSelectedId(catalog[0]?.id || null);
  }, [catalog, selectedId]);

  async function handleApply() {
    if (!user?.uid) {
      Alert.alert(
        i18n.t("jerseys.alerts.loginRequiredTitle", { defaultValue: "Connexion requise" }),
        i18n.t("jerseys.alerts.loginRequiredBody", {
          defaultValue: "Connecte-toi pour personnaliser ton jersey.",
        })
      );
      return;
    }

    if (!selectedItem?.id) {
      Alert.alert(
        i18n.t("jerseys.alerts.selectRequiredTitle", { defaultValue: "Choisis un jersey" }),
        i18n.t("jerseys.alerts.selectRequiredBody", {
          defaultValue: "Sélectionne un modèle avant de continuer.",
        })
      );
      return;
    }

    const cleanLastName = normalizeLastNameInput(lastName).trim();
    const cleanNumber = normalizeNumberInput(number);

    if (!cleanLastName) {
      Alert.alert(
        i18n.t("jerseys.alerts.nameRequiredTitle", { defaultValue: "Nom requis" }),
        i18n.t("jerseys.alerts.nameRequiredBody", {
          defaultValue: "Entre un nom de famille pour ton jersey.",
        })
      );
      return;
    }

    if (!cleanNumber) {
      Alert.alert(
        i18n.t("jerseys.alerts.numberRequiredTitle", { defaultValue: "Numéro requis" }),
        i18n.t("jerseys.alerts.numberRequiredBody", {
          defaultValue: "Entre un numéro entre 0 et 99.",
        })
      );
      return;
    }

    try {
      setSubmitting(true);

      const currentUser = auth().currentUser;
      if (!currentUser?.uid) {
        throw new Error("Utilisateur non authentifié côté Firebase Auth.");
      }

      await currentUser.getIdToken(true);

      const fn = functions().httpsCallable("generateUserJersey");
      await fn({
        jerseyId: selectedItem.id,
        lastName: cleanLastName,
        number: cleanNumber,
      });

      Alert.alert(
        i18n.t("jerseys.alerts.appliedTitle", { defaultValue: "✅ Jersey appliqué" }),
        i18n.t("jerseys.alerts.appliedBody", {
          defaultValue: "Ton profil sera mis à jour dans un instant.",
        }),
        [
          {
            text: i18n.t("common.ok", { defaultValue: "OK" }),
            onPress: () => r.back(),
          },
        ]
      );
    } catch (e) {
      //console.log("[JerseysScreen] generateUserJersey error", e?.code, e?.message, e);
      Alert.alert(
        i18n.t("jerseys.alerts.applyFailedTitle", {
          defaultValue: "Impossible de générer le jersey",
        }),
        String(e?.message || e)
      );
    } finally {
      setSubmitting(false);
    }
  }

    function handleNext() {
    if (step === 1) {
        setStep(2);
        return;
    }

    if (step === 2) {
        if (!selectedItem?.id) {
        Alert.alert(
            i18n.t("jerseys.alerts.selectRequiredTitle", { defaultValue: "Choisis un jersey" }),
            i18n.t("jerseys.alerts.selectRequiredBody", {
            defaultValue: "Sélectionne un modèle avant de continuer.",
            })
        );
        return;
        }
        setStep(3);
        return;
    }

    if (step === 3) {
        handleApply();
    }
    }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: i18n.t("jerseys.title", { defaultValue: "Jerseys" }) }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.text, textAlign: "center" }}>
            {i18n.t("jerseys.loginGate.body", {
              defaultValue: "Connecte-toi pour choisir et personnaliser ton jersey.",
            })}
          </Text>

          <TouchableOpacity
            onPress={() => r.push("/(auth)/auth-choice")}
            style={{
              marginTop: 12,
              backgroundColor: "#b91c1c",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {i18n.t("auth.login", { defaultValue: "Se connecter" })}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const headerTitle = i18n.t("jerseys.headerTitle", {
    defaultValue: "Mon jersey",
  });

  const isLoadingTop = loadingCatalog || loadingProfile;

  const nextLabel =
   step === 3
    ? i18n.t("jerseys.actions.applyButton", { defaultValue: "Appliquer mon jersey" })
    : i18n.t("common.next", { defaultValue: "Suivant" });

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerLeft: () => (
            <TouchableOpacity onPress={() => r.back()} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          gap: 14,
          backgroundColor: colors.background,
        }}
      >
        <WizardHeader step={step} colors={colors} />

        {step === 1 ? (
          <SectionCard
            colors={colors}
            title={i18n.t("jerseys.current.title", { defaultValue: "Mon jersey actuel" })}
            subtitle={i18n.t("jerseys.current.subtitle", {
              defaultValue: "Voici le modèle actuellement appliqué à ton profil.",
            })}
          >
            <PreviewStage
              uri={currentPreviewUrl}
              colors={colors}
              loading={isLoadingTop}
              emptyLabel={i18n.t("jerseys.current.none", {
                defaultValue: "Aucun jersey actuel",
              })}
            />

            <SideToggle previewSide={previewSide} setPreviewSide={setPreviewSide} colors={colors} />

            <View style={{ gap: 8, alignItems: "center" }}>
              {!!currentItem?.name && (
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                  {currentItem.name}
                </Text>
              )}
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {!!lastName && <Chip icon="account" label={lastName} />}
                {!!number && <Chip icon="numeric" label={`#${number}`} />}
              </View>
            </View>
          </SectionCard>
        ) : null}

        {step === 2 ? (
          <SectionCard
            colors={colors}
            title={i18n.t("jerseys.catalog.title", { defaultValue: "Choisir un modèle" })}
            subtitle={i18n.t("jerseys.catalog.subtitle", {
              defaultValue: "Sélectionne le style de jersey que tu veux utiliser.",
            })}
          >
            <PreviewStage
              uri={previewUrl}
              colors={colors}
              loading={loadingCatalog}
              emptyLabel={i18n.t("jerseys.preview.noneSelected", {
                defaultValue: "Sélectionne un jersey",
              })}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {catalog.map((item) => {
                const active = selectedId === item.id;
                const preview = item.previewFrontUrl || item.previewBackUrl || null;

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedId(item.id)}
                    style={{
                      width: 150,
                      padding: 10,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: active ? "#ef4444" : colors.border,
                      backgroundColor: active ? "rgba(239,68,68,0.08)" : colors.card2,
                    }}
                  >
                    <View
                      style={{
                        width: "100%",
                        aspectRatio: 1,
                        borderRadius: 12,
                        backgroundColor: colors.background,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {preview ? (
                        <RemoteImage
                          uri={preview}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="contain"
                        />
                      ) : (
                        <MaterialCommunityIcons name="tshirt-crew" size={46} color={colors.subtext} />
                      )}
                    </View>

                    <Text
                      style={{
                        marginTop: 8,
                        fontWeight: "900",
                        color: colors.text,
                      }}
                      numberOfLines={1}
                    >
                      {item.name || item.id}
                    </Text>

                    <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      {!!item.sport && (
                        <Chip
                          icon={item.sport === "hockey" ? "hockey-puck" : "tshirt-crew"}
                          bg={colors.background}
                          color={colors.text}
                          label={item.sport}
                        />
                      )}

                      {active ? (
                        <MaterialCommunityIcons name="check-circle" size={20} color="#ef4444" />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SectionCard>
        ) : null}

        {step === 3 ? (
        <SectionCard
            colors={colors}
            title={i18n.t("jerseys.customize.title", { defaultValue: "Personnaliser" })}
            subtitle={i18n.t("jerseys.customize.subtitle", {
            defaultValue: "Ajoute ton nom et ton numéro au modèle choisi.",
            })}
        >
            <View style={{ gap: 12 }}>
            {!!selectedItem?.name && (
                <Chip icon="tshirt-crew" label={selectedItem.name} />
            )}

            <View>
                <Text
                style={{
                    color: colors.text,
                    fontWeight: "800",
                    marginBottom: 6,
                }}
                >
                {i18n.t("jerseys.form.lastName", { defaultValue: "Nom au dos" })}
                </Text>

                <TextInput
                value={lastName}
                onChangeText={(txt) => setLastName(normalizeLastNameInput(txt))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                placeholder={i18n.t("jerseys.form.lastNamePlaceholder", {
                    defaultValue: "BISSON",
                })}
                placeholderTextColor={colors.subtext}
                style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    fontWeight: "800",
                }}
                />
            </View>

            <View>
                <Text
                style={{
                    color: colors.text,
                    fontWeight: "800",
                    marginBottom: 6,
                }}
                >
                {i18n.t("jerseys.form.number", { defaultValue: "Numéro" })}
                </Text>

                <TextInput
                value={number}
                onChangeText={(txt) => setNumber(normalizeNumberInput(txt))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder={i18n.t("jerseys.form.numberPlaceholder", {
                    defaultValue: "67",
                })}
                placeholderTextColor={colors.subtext}
                style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    fontWeight: "800",
                }}
                />
            </View>
            </View>
        </SectionCard>
        ) : null}

        <FooterActions
          step={step}
          colors={colors}
          onBack={handleBack}
          onNext={handleNext}
          nextLabel={nextLabel}
          loading={submitting}
        />
      </ScrollView>
    </>
  );
}