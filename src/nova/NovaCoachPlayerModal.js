import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@src/theme/ThemeProvider";
import { useLanguage } from "@src/i18n/LanguageProvider";
import i18n from "@src/i18n/i18n";
import NovaBubble from "@src/ui/NovaBubble";
import { novaCoachService } from "@src/nova/novaCoachService";
import { NOVA_COACH_BUBBLE_IMAGE, NOVA_COACH_HEADER_IMAGE } from "@src/nova/novaCoachAssets";
import {
  NovaCoachLearnDrawer,
  NovaCoachPlayerHero,
  NovaCoachSingleAdvice,
} from "@src/nova/NovaCoachQuestionSections";
import {
  coachTitle,
  formatCoachBody,
  getNovaCoachPlayerAdvice,
  getNovaCoachSuggestionGroups,
  hasVisibleNovaContent,
  mapNovaCoachError,
  normalizeNovaResponse,
  resolveNovaCapability,
} from "@src/nova/novaCoachShared";

function playerIdFrom(item) {
  return String(item?.playerId ?? item?.id ?? "").trim();
}

function safeAbbr(v) {
  return String(v ?? "").trim().toUpperCase();
}

function opposingPitcherForPlayer(player, probablePitchers, homeAbbr, awayAbbr) {
  const team = safeAbbr(player?.teamAbbr);
  const home = safeAbbr(homeAbbr);
  const away = safeAbbr(awayAbbr);
  if (team === away) return probablePitchers?.home || null;
  if (team === home) return probablePitchers?.away || null;
  return null;
}

export default function NovaCoachPlayerModal({
  visible,
  onClose,
  player = null,
  challengeId,
  domain = "fgc",
  sport = "NHL",
  gameId = null,
  probablePitchers = null,
  homeAbbr = null,
  awayAbbr = null,
  disabled = false,
}) {
  const { colors, isDark } = useTheme();
  const { lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  const pid = playerIdFrom(player);

  const suggestionGroups = useMemo(
    () => getNovaCoachSuggestionGroups({ sport, domain, lang, player }),
    [sport, domain, lang, player, player?.lineupSlot]
  );

  const playerAdvice = useMemo(
    () => getNovaCoachPlayerAdvice({ sport, domain }),
    [sport, domain]
  );

  const resetState = useCallback(() => {
    setSelectedQuestion(null);
    setBusy(false);
    setError(null);
    setResponse(null);
  }, []);

  useEffect(() => {
    if (!visible) resetState();
  }, [visible, resetState, pid]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });
  }, []);

  useEffect(() => {
    if (!response && !error) return undefined;
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(t);
  }, [response, error, scrollToBottom]);

  useEffect(() => {
    if (busy && selectedQuestion) scrollToBottom();
  }, [busy, selectedQuestion, scrollToBottom]);

  const askNova = useCallback(
    async (text, capability) => {
      const clean = String(text || "").trim();
      if (!clean || busy || disabled || !pid) return;

      setBusy(true);
      setError(null);
      setSelectedQuestion(clean);

      try {
        const lineupSlot =
          player?.lineupSlot != null && Number.isFinite(Number(player.lineupSlot))
            ? Number(player.lineupSlot)
            : null;

        const oppPitcher = opposingPitcherForPlayer(player, probablePitchers, homeAbbr, awayAbbr);
        const opposingPitcherHint =
          oppPitcher?.id || oppPitcher?.name
            ? {
                id: oppPitcher?.id ?? null,
                name: oppPitcher?.name ?? null,
              }
            : null;

        const focusPlayerHint = {};
        if (lineupSlot != null) focusPlayerHint.lineupSlot = lineupSlot;
        if (opposingPitcherHint) focusPlayerHint.opposingPitcher = opposingPitcherHint;

        const raw = await novaCoachService({
          capability: resolveNovaCapability(clean, capability),
          message: clean,
          lang: lang === "en" ? "en" : "fr",
          context: {
            domain,
            sport,
            challengeId,
            gameId: gameId ? String(gameId) : undefined,
            playerIds: [pid],
            ...(Object.keys(focusPlayerHint).length ? { focusPlayerHint } : {}),
          },
        });

        const data = normalizeNovaResponse(raw);
        if (!hasVisibleNovaContent(data)) {
          throw new Error("EMPTY_NOVA_RESPONSE");
        }
        setResponse(data);
      } catch (e) {
        if (__DEV__) console.warn("[NovaCoachModal] error", e);
        setResponse(null);
        setError(mapNovaCoachError(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, pid, lang, domain, sport, challengeId, gameId, player?.lineupSlot, probablePitchers, homeAbbr, awayAbbr]
  );

  const headerBg = isDark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)";
  const panelBorder = isDark ? "rgba(239,68,68,0.45)" : "rgba(239,68,68,0.35)";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            maxHeight: "92%",
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1.5,
            borderColor: panelBorder,
            paddingBottom: Math.max(insets.bottom, 12),
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 12,
              backgroundColor: headerBg,
              borderBottomWidth: 1,
              borderBottomColor: panelBorder,
              gap: 10,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark ? colors.card : "#fff",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: panelBorder,
              }}
            >
              <Image source={NOVA_COACH_HEADER_IMAGE} style={{ width: 28, height: 28 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17 }}>
                {i18n.t("novaCoach.playerModalTitle")}
              </Text>
              <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
                {i18n.t("novaCoach.playerModalSubtitle")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
          >
            <NovaCoachPlayerHero player={player} colors={colors} isDark={isDark} />

            <NovaCoachLearnDrawer
              items={suggestionGroups?.learn || []}
              selectedQuestion={selectedQuestion}
              busy={busy}
              disabled={disabled}
              onSelect={(s) => askNova(s.message, s.capability)}
              colors={colors}
              isDark={isDark}
            />

            <NovaCoachSingleAdvice
              advice={playerAdvice}
              selectedQuestion={selectedQuestion}
              busy={busy}
              disabled={disabled}
              onPress={(s) => askNova(s.message, s.capability)}
              colors={colors}
              isDark={isDark}
            />

            {busy && !response ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isDark ? colors.card2 : "rgba(99,102,241,0.08)",
                }}
              >
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.subtext, fontWeight: "700" }}>
                  {i18n.t("novaCoach.thinking")}
                </Text>
              </View>
            ) : null}

            {!!error && (
              <Text style={{ color: colors.danger || "#ef4444", fontSize: 13, fontWeight: "700" }}>
                {error}
              </Text>
            )}

            {!!response && (
              <View
                onLayout={scrollToBottom}
                style={{
                  borderWidth: 2,
                  borderColor: panelBorder,
                  borderRadius: 16,
                  padding: 6,
                  paddingBottom: 10,
                  backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)",
                }}
              >
                <NovaBubble
                  layout="coach"
                  imageSource={NOVA_COACH_BUBBLE_IMAGE}
                  title={coachTitle(response)}
                  body={formatCoachBody(response)}
                />
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  }}
                >
                  <Ionicons name="checkmark-circle" size={14} color={colors.subtext} />
                  <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 11 }}>
                    {i18n.t("novaCoach.adviceComplete", {
                      defaultValue: "Fin de l'analyse",
                    })}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
