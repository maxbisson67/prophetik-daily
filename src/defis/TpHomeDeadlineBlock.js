import React from "react";
import { Text } from "react-native";
import i18n from "@src/i18n/i18n";
import { fmtTimeShort, formatSlotMatchup } from "@src/defis/tpDeadlineHelpers";

export default function TpHomeDeadlineBlock({
  locked,
  deadline,
  nextSlot = null,
  colors,
}) {
  const deadlineHM = fmtTimeShort(deadline);

  if (locked) {
    return (
      <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
        {i18n.t("tp.home.predictionsClosed", {
          defaultValue: "Prédictions fermées",
        })}
      </Text>
    );
  }

  const matchup = formatSlotMatchup(nextSlot);

  return (
    <>
      <Text style={{ color: colors.subtext, marginTop: 10, fontSize: 13 }}>
        {i18n.t("tp.home.participateBeforePrefix", {
          defaultValue: "Participer avant",
        })}{" "}
        <Text style={{ color: colors.text, fontWeight: "900" }}>
          {deadlineHM || "—"}
        </Text>
      </Text>
      {nextSlot ? (
        <Text style={{ color: colors.subtext, marginTop: 4, fontSize: 12 }}>
          {matchup
            ? i18n.t("tp.home.nextLockMatchWithMatchup", {
                defaultValue: "Prochain verrouillage : Match {{n}} · {{matchup}}",
                n: nextSlot?.slot || "—",
                matchup,
              })
            : i18n.t("tp.home.nextLockMatch", {
                defaultValue: "Prochain verrouillage : Match {{n}}",
                n: nextSlot?.slot || "—",
              })}
        </Text>
      ) : null}
    </>
  );
}
