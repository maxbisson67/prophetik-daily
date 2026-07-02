import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import i18n from "@src/i18n/i18n";

const LEARN_ACCENT = "#6366f1";
const STRATEGY_ACCENT = "#ef4444";

function SourceBadge({ kind, colors, isDark, compact = false }) {
  const isKb = kind === "kb";
  const bg = isKb
    ? isDark
      ? "rgba(99,102,241,0.22)"
      : "rgba(99,102,241,0.12)"
    : isDark
      ? "rgba(239,68,68,0.22)"
      : "rgba(239,68,68,0.12)";
  const fg = isKb ? LEARN_ACCENT : STRATEGY_ACCENT;

  return (
    <View
      style={{
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: compact ? 2 : 3,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: `${fg}55`,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: compact ? 9 : 10,
          fontWeight: "900",
          letterSpacing: 0.3,
        }}
      >
        {isKb ? i18n.t("novaCoach.badgeKb") : i18n.t("novaCoach.badgeLlm")}
      </Text>
    </View>
  );
}

function SectionHeader({ icon, title, subtitle, accent, colors, isDark, compact = false }) {
  const iconSize = compact ? 28 : 34;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 8 : 10,
        paddingVertical: compact ? 2 : 4,
      }}
    >
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: compact ? 8 : 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? `${accent}33` : `${accent}18`,
          borderWidth: 1,
          borderColor: `${accent}44`,
        }}
      >
        <Ionicons name={icon} size={compact ? 15 : 18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            fontSize: compact ? 13 : 14,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              color: colors.subtext,
              fontWeight: "600",
              fontSize: compact ? 10 : 11,
              marginTop: 1,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function QuestionRow({
  suggestion,
  selected,
  busy,
  disabled,
  onSelect,
  colors,
  isDark,
  accent,
  isLast,
  compact = false,
}) {
  const selectedRow = selected === suggestion.message;
  const isKb = suggestion.capability === "explain";

  return (
    <TouchableOpacity
      onPress={() => onSelect(suggestion)}
      disabled={busy || disabled}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 8 : 10,
        paddingHorizontal: compact ? 10 : 12,
        paddingVertical: compact ? 10 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: selectedRow ? (isDark ? `${accent}18` : `${accent}0d`) : colors.card,
      }}
    >
      <View
        style={{
          width: compact ? 18 : 20,
          height: compact ? 18 : 20,
          borderRadius: compact ? 9 : 10,
          borderWidth: 2,
          borderColor: selectedRow ? accent : colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selectedRow ? (
          <View
            style={{
              width: compact ? 8 : 10,
              height: compact ? 8 : 10,
              borderRadius: compact ? 4 : 5,
              backgroundColor: accent,
            }}
          />
        ) : null}
      </View>
      <Text
        style={{
          flex: 1,
          color: colors.text,
          fontSize: compact ? 12 : 13,
          fontWeight: selectedRow ? "800" : "600",
          lineHeight: compact ? 16 : 18,
        }}
      >
        {suggestion.message}
      </Text>
      <SourceBadge kind={isKb ? "kb" : "llm"} colors={colors} isDark={isDark} compact={compact} />
      {busy && selectedRow ? <ActivityIndicator size="small" color={accent} /> : null}
    </TouchableOpacity>
  );
}

function QuestionSection({
  title,
  subtitle,
  icon,
  accent,
  items,
  selectedQuestion,
  busy,
  disabled,
  onSelect,
  colors,
  isDark,
  compact = false,
}) {
  if (!items?.length) return null;

  return (
    <View style={{ gap: compact ? 6 : 8 }}>
      <SectionHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        accent={accent}
        colors={colors}
        isDark={isDark}
        compact={compact}
      />
      <View
        style={{
          borderWidth: 1.5,
          borderColor: `${accent}55`,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: colors.card,
        }}
      >
        {items.map((suggestion, index) => (
          <QuestionRow
            key={suggestion.id || suggestion.message}
            suggestion={suggestion}
            selected={selectedQuestion}
            busy={busy}
            disabled={disabled}
            onSelect={onSelect}
            colors={colors}
            isDark={isDark}
            accent={accent}
            isLast={index === items.length - 1}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
}

function LearnDrawer({
  items,
  selectedQuestion,
  busy,
  disabled,
  onSelect,
  colors,
  isDark,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items?.length) return null;

  const count = items.length;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: colors.card,
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Ionicons name="book-outline" size={16} color={colors.subtext} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ color: colors.subtext, fontWeight: "800", fontSize: 12 }}>
            {i18n.t("novaCoach.learnDrawerTitle", { defaultValue: "Apprendre les bases" })}
          </Text>
          <Text style={{ color: colors.subtext, fontWeight: "600", fontSize: 10, opacity: 0.85 }}>
            {i18n.t("novaCoach.learnDrawerHint", {
              defaultValue: "{{count}} sujets · réponses instantanées",
              count,
            })}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {expanded ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {items.map((suggestion, index) => (
            <QuestionRow
              key={suggestion.id || suggestion.message}
              suggestion={suggestion}
              selected={selectedQuestion}
              busy={busy}
              disabled={disabled}
              onSelect={onSelect}
              colors={colors}
              isDark={isDark}
              accent={LEARN_ACCENT}
              isLast={index === items.length - 1}
              compact
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function NovaCoachStrategyQuestions({
  groups,
  selectedQuestion,
  busy,
  disabled,
  onSelect,
  colors,
  isDark,
  title,
  subtitle,
}) {
  return (
    <QuestionSection
      title={
        title ||
        i18n.t("novaCoach.sectionPlayerAdvice", { defaultValue: "Conseil sur ce joueur" })
      }
      subtitle={
        subtitle ||
        i18n.t("novaCoach.sectionPlayerAdviceHint", {
          defaultValue: "Analyse personnalisée · IA",
        })
      }
      icon="sparkles"
      accent={STRATEGY_ACCENT}
      items={groups?.strategy || []}
      selectedQuestion={selectedQuestion}
      busy={busy}
      disabled={disabled}
      onSelect={onSelect}
      colors={colors}
      isDark={isDark}
    />
  );
}

export function NovaCoachLearnDrawer(props) {
  return <LearnDrawer {...props} />;
}

export function NovaCoachSingleAdvice({ advice, busy, disabled, onPress, colors, isDark, selectedQuestion }) {
  if (!advice) return null;

  const selected = selectedQuestion === advice.message;
  const loading = busy && selected;

  return (
    <View style={{ gap: 8 }}>
      <SectionHeader
        icon="sparkles"
        title={i18n.t("novaCoach.sectionPlayerAdvice", { defaultValue: "Conseil sur ce joueur" })}
        subtitle={i18n.t("novaCoach.singleAdviceHint", {
          defaultValue: "Analyse complète pour ce choix",
        })}
        accent={STRATEGY_ACCENT}
        colors={colors}
        isDark={isDark}
      />
      <TouchableOpacity
        onPress={() => onPress(advice)}
        disabled={busy || disabled}
        activeOpacity={0.88}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: selected ? STRATEGY_ACCENT : `${STRATEGY_ACCENT}66`,
          backgroundColor: selected
            ? isDark
              ? `${STRATEGY_ACCENT}28`
              : `${STRATEGY_ACCENT}14`
            : isDark
              ? colors.card
              : "#fff",
          opacity: busy && !selected ? 0.65 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={STRATEGY_ACCENT} />
        ) : (
          <Ionicons name="sparkles" size={18} color={STRATEGY_ACCENT} />
        )}
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
          {i18n.t("novaCoach.singleAdviceButton", { defaultValue: "Obtenir l'avis de Nova" })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function NovaCoachQuestionSections({
  groups,
  selectedQuestion,
  busy,
  disabled,
  onSelect,
  colors,
  isDark,
  learnAsDrawer = false,
  strategyTitle,
  strategySubtitle,
}) {
  const learnItems = groups?.learn || [];

  const resolvedStrategyTitle =
    strategyTitle ||
    (learnAsDrawer
      ? i18n.t("novaCoach.sectionPlayerAdvice", { defaultValue: "Conseil sur ce joueur" })
      : i18n.t("novaCoach.sectionStrategy"));

  const resolvedStrategySubtitle =
    strategySubtitle ||
    (learnAsDrawer
      ? i18n.t("novaCoach.sectionPlayerAdviceHint", {
          defaultValue: "Analyse personnalisée · IA",
        })
      : i18n.t("novaCoach.sectionStrategyHint"));

  return (
    <View style={{ gap: learnAsDrawer ? 12 : 16 }}>
      <NovaCoachStrategyQuestions
        groups={groups}
        selectedQuestion={selectedQuestion}
        busy={busy}
        disabled={disabled}
        onSelect={onSelect}
        colors={colors}
        isDark={isDark}
        title={resolvedStrategyTitle}
        subtitle={resolvedStrategySubtitle}
      />

      {learnAsDrawer ? (
        <LearnDrawer
          items={learnItems}
          selectedQuestion={selectedQuestion}
          busy={busy}
          disabled={disabled}
          onSelect={onSelect}
          colors={colors}
          isDark={isDark}
        />
      ) : (
        <QuestionSection
          title={i18n.t("novaCoach.sectionLearn")}
          subtitle={i18n.t("novaCoach.sectionLearnHint")}
          icon="book-outline"
          accent={LEARN_ACCENT}
          items={learnItems}
          selectedQuestion={selectedQuestion}
          busy={busy}
          disabled={disabled}
          onSelect={onSelect}
          colors={colors}
          isDark={isDark}
        />
      )}
    </View>
  );
}

export function NovaCoachPlayerHero({ player, colors, isDark }) {
  const name = String(player?.fullName || player?.name || "").trim();
  const uri = player?.headshotUrl || player?.headshot || null;
  const team = String(player?.teamAbbr || "").trim();
  const slot = player?.lineupSlot != null ? Number(player.lineupSlot) : null;
  const slotLabel = slot != null ? i18n.t("novaCoach.lineupSlotShort", { slot }) : null;
  const isMlb = String(player?.league || "").toUpperCase() === "MLB";
  const lineupText =
    slot != null
      ? i18n.t("firstGoal.pick.lineupOrder", { defaultValue: "{{slot}}e frappeur", slot })
      : isMlb
      ? i18n.t("firstGoal.pick.lineupPending", { defaultValue: "Ordre de frappe à confirmer" })
      : null;
  const subtitleParts = isMlb
    ? [team, lineupText].filter(Boolean)
    : [team, player?.positionCode].filter(Boolean);

  if (!name) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: isDark ? "rgba(239,68,68,0.35)" : "rgba(239,68,68,0.25)",
        backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          overflow: "hidden",
          backgroundColor: colors.card2,
          borderWidth: 2,
          borderColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: 52, height: 52 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
            {name.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: colors.subtext, fontWeight: "700", fontSize: 12 }}>
          {subtitleParts.join(" · ")}
        </Text>
      </View>
      {slotLabel ? (
        <View
          style={{
            minWidth: 44,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11 }}>{slotLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}
