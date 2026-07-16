import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@src/theme/ThemeProvider";
import { useLanguage } from "@src/i18n/LanguageProvider";
import i18n from "@src/i18n/i18n";
import NovaBubble from "@src/ui/NovaBubble";
import { novaCoachService, getNovaErrorKey } from "@src/nova/novaCoachService";
import NovaCoachErrorNotice from "@src/nova/NovaCoachErrorNotice";
import {
  NOVA_COACH_BUBBLE_IMAGE,
  NOVA_COACH_HEADER_IMAGE,
} from "@src/nova/novaCoachAssets";
import {
  coachTitle,
  formatCoachBody,
  getNovaCoachSuggestionGroups,
  hasVisibleNovaContent,
  mapNovaCoachError,
  normalizeNovaResponse,
  resolveNovaCapability,
} from "@src/nova/novaCoachShared";
import NovaCoachQuestionSections from "@src/nova/NovaCoachQuestionSections";

export default function NovaCoachPanel({
  challengeId,
  domain = "fgc",
  sport = "NHL",
  gameId = null,
  playerIds = [],
  disabled = false,
}) {
  const { colors, isDark } = useTheme();
  const { lang } = useLanguage();

  const [expanded, setExpanded] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [errorKey, setErrorKey] = useState(null);
  const [response, setResponse] = useState(null);

  const resetPanel = useCallback(() => {
    setExpanded(false);
    setSelectedQuestion(null);
    setMessage("");
    setBusy(false);
    setError(null);
    setErrorKey(null);
    setResponse(null);
  }, []);

  useEffect(() => {
    resetPanel();
  }, [challengeId, resetPanel]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        resetPanel();
      };
    }, [resetPanel])
  );

  const suggestionGroups = useMemo(
    () => getNovaCoachSuggestionGroups({ sport, domain, lang }),
    [lang, sport, domain]
  );

  const askNova = useCallback(
    async (text, capability) => {
      const clean = String(text || "").trim();
      if (!clean || busy || disabled) return;

      setBusy(true);
      setError(null);
      setErrorKey(null);
      setExpanded(true);
      setSelectedQuestion(clean);

      try {
        const raw = await novaCoachService({
          capability: resolveNovaCapability(clean, capability),
          message: clean,
          lang: lang === "en" ? "en" : "fr",
          context: {
            domain,
            sport,
            challengeId,
            gameId: gameId ? String(gameId) : undefined,
            playerIds: (playerIds || []).map(String).filter(Boolean),
          },
        });

        const data = normalizeNovaResponse(raw);
        if (!hasVisibleNovaContent(data)) {
          throw new Error("EMPTY_NOVA_RESPONSE");
        }

        setResponse(data);
        setExpanded(true);
      } catch (e) {
        if (__DEV__) console.warn("[NovaCoach] error", e);
        setError(mapNovaCoachError(e));
        setErrorKey(getNovaErrorKey(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, lang, sport, domain, challengeId, gameId, playerIds]
  );

  const panelBorderColor = isDark ? colors.border : "rgba(239,68,68,0.45)";
  const headerBg = isDark ? colors.card2 : "rgba(239,68,68,0.08)";
  const chevronBg = isDark ? colors.card : "rgba(239,68,68,0.14)";

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: panelBorderColor,
        borderRadius: 16,
        backgroundColor: colors.card,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.08,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <TouchableOpacity
        onPress={() => {
          if (expanded) {
            setResponse(null);
            setError(null);
            setErrorKey(null);
            setMessage("");
            setSelectedQuestion(null);
            setBusy(false);
          }
          setExpanded((v) => !v);
        }}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: headerBg,
          borderBottomWidth: expanded ? 1 : 0,
          borderBottomColor: panelBorderColor,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <Image
            source={NOVA_COACH_HEADER_IMAGE}
            resizeMode="contain"
            style={{ width: 36, height: 36 }}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
              {i18n.t("novaCoach.panelTitle")}
            </Text>
            {!expanded ? (
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                {i18n.t("novaCoach.panelHint")}
              </Text>
            ) : null}
          </View>
        </View>

        {busy ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: chevronBg,
              borderWidth: 1,
              borderColor: panelBorderColor,
            }}
          >
            <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
          </View>
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: chevronBg,
              borderWidth: 1,
              borderColor: panelBorderColor,
            }}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.primary}
            />
          </View>
        )}
      </TouchableOpacity>

      {expanded ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}
        >
          <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
            {i18n.t("novaCoach.selectQuestion", { defaultValue: "Choisis une question" })}
          </Text>

          <NovaCoachQuestionSections
            groups={suggestionGroups}
            selectedQuestion={selectedQuestion}
            busy={busy}
            disabled={disabled}
            onSelect={(s) => {
              setMessage(s.message);
              askNova(s.message, s.capability);
            }}
            colors={colors}
            isDark={isDark}
            learnAsDrawer
          />

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={i18n.t("novaCoach.placeholder")}
            placeholderTextColor={colors.subtext}
            editable={!busy && !disabled}
            multiline
            style={{
              minHeight: 44,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              backgroundColor: colors.background,
              fontSize: 14,
            }}
          />

          <TouchableOpacity
            onPress={() => askNova(message, "coach")}
            disabled={busy || disabled || !String(message).trim()}
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: busy || disabled ? colors.border : colors.primary,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {i18n.t("novaCoach.ask")}
            </Text>
          </TouchableOpacity>

          {!!error && (
            <NovaCoachErrorNotice message={error} errorKey={errorKey} colors={colors} />
          )}

          {!!response && (
            <View style={{ marginHorizontal: -12 }}>
              <NovaBubble
                layout="coach"
                imageSource={NOVA_COACH_BUBBLE_IMAGE}
                title={coachTitle(response)}
                body={formatCoachBody(response)}
              />
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
