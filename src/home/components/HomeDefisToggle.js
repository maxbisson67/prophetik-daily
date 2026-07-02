import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts, BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import i18n from "@src/i18n/i18n";

const DEFI_TABS = [
  { value: "fgc", number: 1 },
  { value: "tp", number: 2 },
  { value: "ts", number: 3 },
];

const COMPLETE_GREEN = "#16a34a";
const DISPLAY_FONT = "BebasNeue_400Regular";
const CHEVRON_HALF = 9;

function resolveTabProgress(value) {
  if (value && typeof value === "object" && "done" in value) {
    const done = Math.max(0, Number(value.done) || 0);
    const total = Math.max(0, Number(value.total) || 0);
    const expiredCount = Math.max(0, Number(value.expiredCount) || 0);
    const enrolled = !!value.enrolled;
    const expired = !!value.expired && total > 0 && done < total && !enrolled;
    return { done, total, expired, expiredCount, enrolled };
  }

  if (value === true) return { done: 1, total: 1, expired: false, expiredCount: 0, enrolled: false };
  if (value === false) return { done: 0, total: 0, expired: false, expiredCount: 0, enrolled: false };

  return { done: 0, total: 0, expired: false, expiredCount: 0, enrolled: false };
}

export function isHomeDefiTabComplete(value) {
  const { done, total, enrolled } = resolveTabProgress(value);
  if (enrolled) return true;
  return total > 0 && done >= total;
}

export function areAllHomeDefisComplete(completedByTab = {}) {
  return DEFI_TABS.every((tab) => isHomeDefiTabComplete(completedByTab?.[tab.value]));
}

export function countCompletedHomeDefis(completedByTab = {}) {
  return DEFI_TABS.filter((tab) => isHomeDefiTabComplete(completedByTab?.[tab.value])).length;
}

function ExpiredTag({ active, colors }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "rgba(255,255,255,0.45)" : colors.border,
        backgroundColor: active ? "rgba(255,255,255,0.12)" : colors.card,
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : colors.subtext,
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 0.2,
        }}
      >
        {i18n.t("home.defiTabExpired")}
      </Text>
    </View>
  );
}

function TodoTag({ active, colors }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "rgba(255,255,255,0.45)" : colors.border,
        backgroundColor: active ? "rgba(255,255,255,0.12)" : colors.card,
      }}
    >
      <Text
        style={{
          color: active ? "#fff" : colors.subtext,
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 0.2,
        }}
      >
        {i18n.t("home.defiTabTodo")}
      </Text>
    </View>
  );
}

function TabCompletionBadge({ progress, active, colors }) {
  const { done, total, expired, expiredCount, enrolled } = progress;
  if (!total) return null;

  const complete = done >= total;
  const showCheck = complete || enrolled;

  if (showCheck) {
    return (
      <View style={{ alignItems: "center", maxWidth: 56 }}>
        <MaterialCommunityIcons
          name="check-circle"
          size={20}
          color={active ? "#fff" : COMPLETE_GREEN}
        />
        {expiredCount > 0 ? (
          <Text
            style={{
              color: active ? "rgba(255,255,255,0.88)" : colors.subtext,
              fontSize: 8,
              fontWeight: "900",
              marginTop: 2,
              textAlign: "center",
              lineHeight: 10,
            }}
            numberOfLines={2}
          >
            {i18n.t("home.defiTabExpiredMatches", { count: expiredCount })}
          </Text>
        ) : null}
      </View>
    );
  }

  if (expired) {
    return <ExpiredTag active={active} colors={colors} />;
  }

  return <TodoTag active={active} colors={colors} />;
}

function StyledTabNumber({ number, active, colors, displayFontLoaded }) {
  const numberColor = active ? "#fff" : colors.text;

  return (
    <Text
      style={{
        color: numberColor,
        fontSize: 32,
        lineHeight: 34,
        letterSpacing: 0.5,
        fontFamily: displayFontLoaded ? DISPLAY_FONT : undefined,
        fontWeight: displayFontLoaded ? "400" : "900",
        includeFontPadding: false,
      }}
    >
      {number}
    </Text>
  );
}

function TabPointer({ color }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: CHEVRON_HALF,
        borderRightWidth: CHEVRON_HALF,
        borderTopWidth: CHEVRON_HALF,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: color,
      }}
    />
  );
}

export default function HomeDefisToggle({
  value = "fgc",
  onChange,
  colors,
  completedByTab = {},
  title = null,
  headerBleed = 12,
  accentColor,
  neutralHeader = true,
}) {
  const accent = accentColor || colors.primary;
  const [displayFontLoaded] = useFonts({ BebasNeue_400Regular });
  const [toggleWidth, setToggleWidth] = useState(0);
  const chevronX = useRef(new Animated.Value(0)).current;

  const activeIndex = Math.max(
    0,
    DEFI_TABS.findIndex((tab) => tab.value === value)
  );

  useEffect(() => {
    if (!toggleWidth) return;
    const targetX = (toggleWidth / DEFI_TABS.length) * (activeIndex + 0.5) - CHEVRON_HALF;
    Animated.spring(chevronX, {
      toValue: targetX,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }, [activeIndex, toggleWidth, chevronX]);

  const showHeader = Boolean(title);
  const useNeutralHeader = showHeader && neutralHeader;

  return (
    <View style={{ marginBottom: showHeader && !useNeutralHeader ? 0 : 12 }}>
      {showHeader && useNeutralHeader ? (
        <Text
          style={{
            color: colors.text,
            fontWeight: "900",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 12,
            lineHeight: 22,
          }}
        >
          {title}
        </Text>
      ) : null}

      {showHeader && !useNeutralHeader ? (
        <View
          style={{
            marginHorizontal: -headerBleed,
            marginTop: -headerBleed,
            backgroundColor: accent,
            paddingTop: 14,
            paddingBottom: 4,
            paddingHorizontal: headerBleed,
            marginBottom: 2,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "900",
              fontSize: 16,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            {title}
          </Text>
          <View style={{ height: CHEVRON_HALF + 2, marginTop: 6 }}>
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: [{ translateX: chevronX }],
              }}
            >
              <TabPointer color={accent} />
            </Animated.View>
          </View>
        </View>
      ) : null}

      <View
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0 && nextWidth !== toggleWidth) {
            setToggleWidth(nextWidth);
            const initialX =
              (nextWidth / DEFI_TABS.length) * (activeIndex + 0.5) - CHEVRON_HALF;
            chevronX.setValue(initialX);
          }
        }}
        style={{
          flexDirection: "row",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: colors.card2,
          marginBottom: 12,
        }}
      >
        {DEFI_TABS.map((tab) => {
          const active = value === tab.value;
          const progress = resolveTabProgress(completedByTab?.[tab.value]);

          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => onChange?.(tab.value)}
              activeOpacity={0.85}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? accent : "transparent",
                minHeight: 44,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <StyledTabNumber
                  number={tab.number}
                  active={active}
                  colors={colors}
                  displayFontLoaded={displayFontLoaded}
                />
                <TabCompletionBadge progress={progress} active={active} colors={colors} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
