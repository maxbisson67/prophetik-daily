import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  useWindowDimensions,
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
  NovaCoachSingleAdvice,
} from "@src/nova/NovaCoachQuestionSections";
import {
  coachTitle,
  formatCoachBody,
  getNovaCoachPlayerAdvice,
  getNovaCoachSuggestionGroups,
  hasVisibleNovaContent,
  normalizeNovaResponse,
  resolveNovaCapability,
} from "@src/nova/novaCoachShared";
import NovaCoachErrorNotice from "@src/nova/NovaCoachErrorNotice";
import useNovaCoachQuotaGate from "@src/nova/useNovaCoachQuotaGate";
import NovaCoachIndicatorView from "@src/nova/NovaCoachIndicatorView";
import {
  buildNovaIndicatorModel,
  supportsNovaIndicatorView,
} from "@src/nova/buildNovaIndicatorModel";
import { opposingProbablePitcherForPlayer } from "@src/mlb/fgcBvpUtils";

function playerIdFrom(item) {
  return String(item?.playerId ?? item?.id ?? "").trim();
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
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef(null);
  const responseBlockY = useRef(0);
  const sheetMaxHeight = Math.round(windowHeight * 0.92);

  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState(null);
  const [indicatorsMeta, setIndicatorsMeta] = useState(null);
  const [responseView, setResponseView] = useState("indicators");

  const pid = playerIdFrom(player);
  const showIndicatorToggle = supportsNovaIndicatorView(domain, sport);
  const {
    error,
    errorKey,
    showIndicatorUi,
    askDisabled,
    quotaBlockedRef,
    resetQuotaGate,
    canStartAsk,
    handleAskError,
    shouldFetchIndicators,
  } = useNovaCoachQuotaGate({ showIndicatorToggle });
  const responseLang = lang === "en" ? "en" : "fr";

  const indicatorModel = useMemo(() => {
    if (!showIndicatorUi || !indicatorsMeta) return null;
    return buildNovaIndicatorModel({
      domain,
      sport,
      indicators: indicatorsMeta,
      novaResponse: response,
      player,
      lang: responseLang,
      probablePitchers,
      homeAbbr,
      awayAbbr,
    });
  }, [
    showIndicatorUi,
    domain,
    sport,
    indicatorsMeta,
    response,
    player,
    responseLang,
    probablePitchers,
    homeAbbr,
    awayAbbr,
  ]);

  const showResponseBlock = !!response || (showIndicatorUi && !!indicatorsMeta);

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
    resetQuotaGate();
    setResponse(null);
    setIndicatorsMeta(null);
    setResponseView("indicators");
  }, [resetQuotaGate]);

  useEffect(() => {
    if (!visible) resetState();
  }, [visible, resetState, pid]);

  const scrollToResponse = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const y = Math.max(0, responseBlockY.current - 8);
        scrollRef.current?.scrollTo({ y, animated: true });
      });
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (!response && !error && !indicatorsMeta) return undefined;
    scrollToResponse();
    const t1 = setTimeout(scrollToResponse, 120);
    const t2 = setTimeout(scrollToResponse, 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [response, error, indicatorsMeta, scrollToResponse]);

  useEffect(() => {
    if (busy && selectedQuestion && !indicatorsMeta) scrollToBottom();
  }, [busy, selectedQuestion, indicatorsMeta, scrollToBottom]);

  const handleResponseLayout = useCallback(
    (e) => {
      responseBlockY.current = e.nativeEvent.layout.y;
      if (response || error || indicatorsMeta) scrollToResponse();
    },
    [response, error, indicatorsMeta, scrollToResponse]
  );

  const askNova = useCallback(
    async (text, capability) => {
      const clean = String(text || "").trim();
      if (!clean || busy || disabled || askDisabled || !pid || !canStartAsk()) return;

      setBusy(true);
      setResponse(null);
      setIndicatorsMeta(null);
      setSelectedQuestion(clean);

      const lineupSlot =
        player?.lineupSlot != null && Number.isFinite(Number(player.lineupSlot))
          ? Number(player.lineupSlot)
          : null;

      const oppPitcher =
        player?.opposingPitcherForBvp ||
        opposingProbablePitcherForPlayer(player, probablePitchers, homeAbbr, awayAbbr);
      const opposingPitcherHint =
        oppPitcher?.id || oppPitcher?.name
          ? {
              id: oppPitcher?.id ?? null,
              name: oppPitcher?.name ?? null,
              wins: oppPitcher?.wins ?? null,
              losses: oppPitcher?.losses ?? null,
              era: oppPitcher?.era ?? null,
              throwHand: oppPitcher?.throwHand ?? null,
            }
          : null;

      const focusPlayerHint = {};
      if (lineupSlot != null) focusPlayerHint.lineupSlot = lineupSlot;
      if (opposingPitcherHint) focusPlayerHint.opposingPitcher = opposingPitcherHint;

      const requestContext = {
        domain,
        sport,
        challengeId,
        gameId: gameId ? String(gameId) : undefined,
        playerIds: [pid],
        ...(Object.keys(focusPlayerHint).length ? { focusPlayerHint } : {}),
      };

      const requestLang = lang === "en" ? "en" : "fr";
      let indicatorsReceived = false;

      if (shouldFetchIndicators()) {
        novaCoachService({
          capability: "indicators",
          message: clean,
          lang: requestLang,
          context: requestContext,
        })
          .then((raw) => {
            if (quotaBlockedRef.current) return;
            if (raw?.meta?.indicators) {
              indicatorsReceived = true;
              setIndicatorsMeta(raw.meta.indicators);
              setResponseView("indicators");
            }
          })
          .catch((e) => {
            if (__DEV__) console.warn("[NovaCoachModal] indicators error", e);
          });
      }

      try {
        const raw = await novaCoachService({
          capability: resolveNovaCapability(clean, capability),
          message: clean,
          lang: requestLang,
          context: requestContext,
        });

        const data = normalizeNovaResponse(raw);
        if (!hasVisibleNovaContent(data)) {
          throw new Error("EMPTY_NOVA_RESPONSE");
        }
        if (raw?.meta?.indicators) {
          indicatorsReceived = true;
          setIndicatorsMeta(raw.meta.indicators);
        }
        setResponseView(showIndicatorUi ? "indicators" : "text");
        setResponse(data);
      } catch (e) {
        if (__DEV__) console.warn("[NovaCoachModal] error", e);
        setResponse(null);
        handleAskError(e, {
          indicatorsReceived,
          onQuotaExceeded: () => {
            setIndicatorsMeta(null);
            setResponseView("text");
          },
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, askDisabled, pid, canStartAsk, lang, domain, sport, challengeId, gameId, player?.lineupSlot, probablePitchers, homeAbbr, awayAbbr, shouldFetchIndicators, handleAskError, showIndicatorUi]
  );

  const headerBg = isDark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)";
  const panelBorder = isDark ? "rgba(239,68,68,0.45)" : "rgba(239,68,68,0.35)";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={onClose}
        />
        <View
          style={{
            maxHeight: sheetMaxHeight,
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
            style={{ flexShrink: 1, minHeight: 0 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
          >
            <NovaCoachLearnDrawer
              items={suggestionGroups?.learn || []}
              selectedQuestion={selectedQuestion}
              busy={busy}
              disabled={disabled || askDisabled}
              onSelect={(s) => askNova(s.message, s.capability)}
              colors={colors}
              isDark={isDark}
            />

            <NovaCoachSingleAdvice
              advice={playerAdvice}
              player={player}
              sport={sport}
              selectedQuestion={selectedQuestion}
              busy={busy}
              disabled={disabled || askDisabled}
              onPress={(s) => askNova(s.message, s.capability)}
              colors={colors}
              isDark={isDark}
            />

            {!!error && (
              <NovaCoachErrorNotice
                message={error}
                errorKey={errorKey}
                colors={colors}
                onBeforeNavigate={onClose}
              />
            )}

            {showResponseBlock && (
              <View
                onLayout={handleResponseLayout}
                style={{
                  borderWidth: 2,
                  borderColor: panelBorder,
                  borderRadius: 16,
                  padding: 6,
                  paddingBottom: 10,
                  backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)",
                }}
              >
                {showIndicatorUi ? (
                  <View
                    style={{
                      flexDirection: "row",
                      marginHorizontal: 6,
                      marginTop: 6,
                      marginBottom: 10,
                      padding: 4,
                      borderRadius: 12,
                      backgroundColor: isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.95)",
                      borderWidth: 1.5,
                      borderColor: panelBorder,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.3 : 0.08,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    {[
                      {
                        key: "indicators",
                        label: i18n.t("novaCoach.viewIndicators", { defaultValue: "Indicateurs" }),
                        icon: "stats-chart",
                      },
                      {
                        key: "text",
                        label: i18n.t("novaCoach.viewText", { defaultValue: "Texte" }),
                        icon: "document-text-outline",
                      },
                    ].map((tab) => {
                      const active = responseView === tab.key;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          onPress={() => {
                            setResponseView(tab.key);
                            setTimeout(scrollToResponse, 50);
                          }}
                          activeOpacity={0.85}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            paddingVertical: 10,
                            borderRadius: 9,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            backgroundColor: active ? colors.primary : "transparent",
                          }}
                        >
                          <Ionicons
                            name={tab.icon}
                            size={14}
                            color={active ? "#fff" : colors.subtext}
                          />
                          <Text
                            style={{
                              color: active ? "#fff" : colors.subtext,
                              fontWeight: "900",
                              fontSize: 13,
                            }}
                          >
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                {showIndicatorUi && responseView === "indicators" && indicatorModel ? (
                  <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
                    <NovaCoachIndicatorView
                      model={indicatorModel}
                      colors={colors}
                      isDark={isDark}
                      lang={responseLang}
                    />
                  </View>
                ) : response ? (
                  <NovaBubble
                    layout="coach"
                    imageSource={NOVA_COACH_BUBBLE_IMAGE}
                    title={coachTitle(response)}
                    body={formatCoachBody(response)}
                  />
                ) : (
                  <Text
                    style={{
                      color: colors.subtext,
                      fontWeight: "700",
                      fontSize: 13,
                      paddingHorizontal: 12,
                      paddingVertical: 16,
                      textAlign: "center",
                    }}
                  >
                    {i18n.t("novaCoach.draftingAnalysis", {
                      defaultValue: "Nova rédige l'analyse…",
                    })}
                  </Text>
                )}

                {showIndicatorUi && responseView === "indicators" && response ? (
                  <TouchableOpacity
                    onPress={() => setResponseView("text")}
                    activeOpacity={0.85}
                    style={{ alignItems: "center", paddingTop: 8, paddingHorizontal: 8 }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 12 }}>
                      {i18n.t("novaCoach.readFullAnalysis", {
                        defaultValue: "Lire l'analyse complète →",
                      })}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {response ? (
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
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
