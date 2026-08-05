import React from "react";
import { View, Text } from "react-native";

import i18n from "@src/i18n/i18n";
import FgcResultDetailBlock from "@src/defis/results/FgcResultDetailBlock";
import TpResultDetailBlock from "@src/defis/results/TpResultDetailBlock";
import TsResultDetailBlock from "@src/defis/results/TsResultDetailBlock";
import DefiTypeLeading, { resolveDefiItemSport } from "@src/home/components/DefiTypeLeading";
import DefiSectionIntroBand from "@src/home/components/DefiSectionIntroBand";
import { getFgcTitle } from "@src/firstGoal/fgcChallengeUtils";
import {
  RESULTS_ACCENT,
  RESULTS_ACCENT_MUTED,
} from "@src/defis/results/resultsTheme";

function sectionTitle(item) {
  if (item?.kind === "fgc") {
    return getFgcTitle(item?.raw || {}, i18n.t.bind(i18n));
  }
  if (item?.kind === "tp") {
    return i18n.t("tp.home.title", { defaultValue: "Prédire l'issue des matchs" });
  }
  return i18n.t("home.todayChallenge", { defaultValue: "Meilleurs pointeurs" });
}

function SectionDivider({ color = RESULTS_ACCENT_MUTED }) {
  return (
    <View
      style={{
        height: 4,
        backgroundColor: color,
        marginVertical: 14,
        marginHorizontal: 2,
      }}
    />
  );
}

function DefiTypeSectionHeader({ item, colors }) {
  return (
    <DefiSectionIntroBand bleedTop={false} variant="results">
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
        <DefiTypeLeading
          kind={item.kind}
          sport={resolveDefiItemSport(item)}
          colors={colors}
          glyphSize={22}
        />
        <Text
          style={{
            fontWeight: "900",
            fontSize: 16,
            color: colors.text,
            flex: 1,
          }}
          numberOfLines={2}
        >
          {sectionTitle(item)}
        </Text>
      </View>
    </DefiSectionIntroBand>
  );
}

export default function HistoryDayDetailSections({
  items = [],
  isToday = false,
  colors,
  participationMaps,
  scheduleByChallengeId = {},
  scheduleByGameId = {},
}) {
  const fgcItems = items.filter((item) => item.kind === "fgc");
  const tpItems = items.filter((item) => item.kind === "tp" && item.subtype === "bundle");
  const tsItems = items.filter((item) => item.kind === "ts");

  if (!fgcItems.length && !tpItems.length && !tsItems.length) {
    return (
      <Text
        style={{
          color: colors.subtext,
          marginTop: 4,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {i18n.t("challenges.noDefiForSelectedDay", {
          defaultValue: "Aucun défi pour cette journée.",
        })}
      </Text>
    );
  }

  const sections = [];

  fgcItems.forEach((item, index) => {
    sections.push(
      <View key={`fgc-${item.id}`}>
        {index > 0 ? <SectionDivider /> : null}
        <DefiTypeSectionHeader item={item} colors={colors} />
        <FgcResultDetailBlock
          item={item}
          colors={colors}
          scheduleStatus={scheduleByChallengeId?.[item.id]?.status}
          accentColor={RESULTS_ACCENT}
          showParticipantsInline
        />
      </View>
    );
  });

  tpItems.forEach((item, index) => {
    sections.push(
      <View key={`tp-${item.id}`}>
        {sections.length > 0 || index > 0 ? <SectionDivider /> : null}
        <DefiTypeSectionHeader item={item} colors={colors} />
        <TpResultDetailBlock
          item={item}
          colors={colors}
          myEntry={participationMaps?.tp?.[item.id]}
          showLiveScores={isToday}
          scheduleByGameId={scheduleByGameId}
          accentColor={RESULTS_ACCENT}
          showParticipantsInline
        />
      </View>
    );
  });

  tsItems.forEach((item, index) => {
    sections.push(
      <View key={`ts-${item.id}`}>
        {sections.length > 0 || index > 0 ? <SectionDivider /> : null}
        <DefiTypeSectionHeader item={item} colors={colors} />
        <TsResultDetailBlock
          item={item}
          colors={colors}
          myEntry={participationMaps?.ts?.[item.id]}
          compact={false}
          hideWinnerBadge
        />
      </View>
    );
  });

  return <View>{sections}</View>;
}
