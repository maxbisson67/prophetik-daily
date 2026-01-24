// src/leaderboard/LeaderboardLegend.js
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ProphetikIcons from "@src/ui/ProphetikIcons";
import i18n from "@src/i18n/i18n";
import WinRateIcon from "@src/ui/WinRateIcon";

export default function LeaderboardLegend({ colors, tierLower, onUpgrade }) {
  const t = i18n.t.bind(i18n);
  const [open, setOpen] = useState(false);

  const tier = String(tierLower || "free").toLowerCase();
  const isFree = tier === "free";
  const isPro = tier === "pro" || tier === "starter";
  const isVip = tier === "vip";

  const rows = useMemo(() => {
    const base = [
      {
        key: "pointsTotal",
        icon: <ProphetikIcons mode="points" amount={null} size="sm" iconOnly />,
        label: t("leaderboard.legend.pointsTotal", { defaultValue: "Points totaux" }),
        text: t("leaderboard.legend.pointsTotalHelp", {
          defaultValue: "Total des points Prophetik gagnés dans ce groupe (tous défis confondus).",
        }),
        locked: false,
      },
      {
        key: "winRate",
        icon: <WinRateIcon size={18} />,
        label: t("leaderboard.legend.winRate", { defaultValue: "Win rate" }),
        text: t("leaderboard.legend.winRateHelp", {
          defaultValue: "Victoires ÷ participations (global).",
        }),
        locked: false,
      },
      {
        key: "ppg",
        icon: <MaterialCommunityIcons name="chart-line" size={18} color={colors.primary} />,
        // ✅ clés existantes dans ton JSON
        label: t("leaderboard.legend.ppg", { defaultValue: "PPG (sélections)" }),
        text: t("leaderboard.legend.ppgHelp", {
          defaultValue: "Points réels générés par tes sélections ÷ matchs (global).",
        }),
        locked: false,
      },
    ];

    // ✅ FREE: tout lock sauf pointsTotal
    if (isFree) return base.map((r) => ({ ...r, locked: r.key !== "pointsTotal" }));

    // ✅ PRO: PPG lock (VIP only)
    if (isPro && !isVip) return base.map((r) => ({ ...r, locked: r.key === "ppg" }));

    // ✅ VIP: tout unlock
    return base;
  }, [t, colors.primary, isFree, isPro, isVip]);

  const subtitle = useMemo(() => {
    if (isFree)
      return t("leaderboard.legend.subtitleFree", {
        defaultValue: "Débloque le classement détaillé avec Pro ou VIP.",
      });
    if (isPro)
      return t("leaderboard.legend.subtitlePro", {
        defaultValue: "Version abrégée (Pro).",
      });
    if (isVip)
      return t("leaderboard.legend.subtitleVip", {
        defaultValue: "Version complète (VIP).",
      });
    return "";
  }, [t, isFree, isPro, isVip]);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.card,
        padding: 12,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {t("leaderboard.legend.title", { defaultValue: "Légende du classement" })}
          </Text>

          {!!subtitle && (
            <Text style={{ marginTop: 2, color: colors.subtext, fontSize: 12 }}>
              {subtitle}
            </Text>
          )}
        </View>

        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.subtext}
        />
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 10, gap: 10 }}>
          {rows.map((r) => (
            <LegendRow
              key={r.key}
              icon={r.icon}
              label={r.label}
              text={r.text}
              colors={colors}
              locked={r.locked}
            />
          ))}

          {/* CTA FREE -> PRO */}
          {isFree ? (
            <LegendCta
              colors={colors}
              eyebrow={t("leaderboard.legend.cta.free.eyebrow", { defaultValue: "Pourquoi Pro ?" })}
              title={t("leaderboard.legend.cta.free.title", { defaultValue: "Débloque le classement détaillé" })}
              body={t("leaderboard.legend.cta.free.body", {
                defaultValue: "Avec Pro, tu vois le win rate et tu peux ouvrir le détail des participants.",
              })}
              bullets={[
                t("leaderboard.legend.cta.free.b1", { defaultValue: "Win rate + stats avancées" }),
                t("leaderboard.legend.cta.free.b2", { defaultValue: "Accès au détail des participants" }),
                t("leaderboard.legend.cta.free.b3", { defaultValue: "Meilleure lecture des performances" }),
              ]}
              buttonLabel={t("leaderboard.legend.cta.free.button", { defaultValue: "Passer Pro" })}
              onPress={onUpgrade}
            />
          ) : null}

          {/* CTA PRO -> VIP */}
          {isPro ? (
            <LegendCta
              colors={colors}
              eyebrow={t("leaderboard.legend.cta.pro.eyebrow", { defaultValue: "Pourquoi VIP ?" })}
              title={t("leaderboard.legend.cta.pro.title", { defaultValue: "Version complète du classement" })}
              body={t("leaderboard.legend.cta.pro.body", {
                defaultValue: "VIP débloque PPG (sélections) et les détails avancés.",
              })}
              bullets={[
                t("leaderboard.legend.cta.pro.b1", { defaultValue: "Graphiques & tendances" }),
                t("leaderboard.legend.cta.pro.b2", { defaultValue: "PPG (sélections) + stats avancées" }),
                t("leaderboard.legend.cta.pro.b3", { defaultValue: "Comparaisons plus riches" }),
              ]}
              buttonLabel={t("leaderboard.legend.cta.pro.button", { defaultValue: "Passer VIP" })}
              onPress={onUpgrade}
            />
          ) : null}

          {/* VIP details */}
          {isVip ? (
            <View
              style={{
                marginTop: 6,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={{ marginTop: 1 }}>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>
                    {t("leaderboard.legend.vipDetails.title", { defaultValue: "Détail participant (VIP)" })}
                  </Text>
                  <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>
                    {t("leaderboard.legend.vipDetails.body", {
                      defaultValue: "Chaque participant est cliquable : touche une ligne pour ouvrir les détails.",
                    })}
                  </Text>

                  <View style={{ marginTop: 8, gap: 6 }}>
                    <VipBullet colors={colors} text={t("leaderboard.legend.vipDetails.b1")} />
                    <VipBullet colors={colors} text={t("leaderboard.legend.vipDetails.b2")} />
                    <VipBullet colors={colors} text={t("leaderboard.legend.vipDetails.b3")} />
                    <VipBullet colors={colors} text={t("leaderboard.legend.vipDetails.b4")} />
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {/* footer FREE */}
          {isFree ? (
            <View
              style={{
                marginTop: 6,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.subtext, fontSize: 12 }}>
                {t("leaderboard.legend.freeFootnote", {
                  defaultValue: "🔒 Certaines statistiques sont réservées aux abonnés.",
                })}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function LegendRow({ icon, label, text, colors, locked }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={{ marginTop: 1, opacity: locked ? 0.45 : 1 }}>{icon}</View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "800", opacity: locked ? 0.75 : 1 }}>
            {label}
          </Text>
          {locked ? <MaterialCommunityIcons name="lock-outline" size={16} color={colors.subtext} /> : null}
        </View>

        <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2, opacity: locked ? 0.7 : 1 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function LegendCta({ colors, eyebrow, title, body, bullets = [], buttonLabel, onPress }) {
  return (
    <View style={{ marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      {!!eyebrow ? <Text style={{ color: colors.subtext, fontSize: 12, fontWeight: "900" }}>{eyebrow}</Text> : null}
      <Text style={{ color: colors.text, fontWeight: "900", marginTop: 6 }}>{title}</Text>
      <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>{body}</Text>

      {!!bullets?.length ? (
        <View style={{ marginTop: 8, gap: 6 }}>
          {bullets.map((b, idx) => <VipBullet key={idx} colors={colors} text={b} />)}
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <MaterialCommunityIcons name="rocket-launch-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "900" }}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function VipBullet({ colors, text }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
      <MaterialCommunityIcons name="checkbox-blank-circle" size={6} color={colors.subtext} style={{ marginTop: 6 }} />
      <Text style={{ color: colors.subtext, fontSize: 12, flex: 1 }}>{text}</Text>
    </View>
  );
}