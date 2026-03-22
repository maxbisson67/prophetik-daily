// src/leaderboard/LeaderboardTable.js
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import i18n from "@src/i18n/i18n";


const AVATAR_PLACEHOLDER = require('@src/assets/avatar-placeholder.png');

function withCacheBust(url, tsMillis) {
  if (!url) return null;
  const v = Number.isFinite(tsMillis) ? tsMillis : Date.now();
  return url.includes('?') ? `${url}&_cb=${v}` : `${url}?_cb=${v}`;
}

function asTextNode(value, colors, style) {
  if (value === null || value === undefined || value === false) return null;
  if (React.isValidElement(value)) return value;

  return (
    <Text style={[{ color: colors.text }, style]}>
      {String(value)}
    </Text>
  );
}

function usePublicProfilesFor(uids) {
  const [map, setMap] = React.useState({});
  React.useEffect(() => {
    const ids = Array.from(new Set((uids || []).filter(Boolean).map(String)));
    if (!ids.length) {
      setMap({});
      return;
    }
    const unsubs = new Map();
    ids.forEach((uid) => {
      const ref = firestore().collection('profiles_public').doc(uid);
      const un = ref.onSnapshot(
        (snap) => {
          if (!snap.exists) {
            setMap((prev) => {
              if (!prev[uid]) return prev;
              const next = { ...prev };
              delete next[uid];
              return next;
            });
            return;
          }
          const d = snap.data() || {};
          setMap((prev) => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || i18n.t("common.guest", { defaultValue: "Invité" }),
              avatarUrl: d.avatarUrl || null,
              updatedAt: d.updatedAt || null,
            },
          }));
        },
        () => {}
      );
      unsubs.set(uid, un);
    });
    return () => {
      for (const [, un] of unsubs) {
        try {
          un?.();
        } catch {}
      }
    };
  }, [JSON.stringify(uids || [])]);

  return map;
}

export default function LeaderboardTable({ rows, colors, columns, onRowPress, hideHeader = false}) {
  const firstSortKey = columns?.[0]?.key || 'wins';
  const [sort, setSort] = useState({ key: firstSortKey, dir: 'desc' });
  const t = i18n.t.bind(i18n);

  // refs pour chaque icône info
  const infoRefs = useRef({}); // key -> ref

  const uids = useMemo(() => (rows || []).map((r) => String(r.id)), [rows]);
  const profiles = usePublicProfilesFor(uids);

  const toggleSort = useCallback((key) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    );
  }, []);

  const sorted = useMemo(() => {
    const copy = [...(rows || [])];
    const col = (columns || []).find((c) => c.key === sort.key);

    copy.sort((a, b) => {
      const av = col?.getValue ? col.getValue(a) : Number(a?.[sort.key] ?? 0);
      const bv = col?.getValue ? col.getValue(b) : Number(b?.[sort.key] ?? 0);
      if (av === bv) return 0;
      return sort.dir === 'asc' ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
    });

    return copy;
  }, [rows, columns, sort]);


  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.card,
      }}
    >

 
      {!hideHeader && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.card2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ width: 40 }} />
          <View style={{ flex: 1.5 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
              {t("leaderboard.legend.name", { defaultValue: "Nom" })}
            </Text>
          </View>

          {(columns || []).map((c) => {
            const isActive = sort.key === c.key;
            const IconSet = c.iconSet === 'fa6' ? FontAwesome6 : MaterialCommunityIcons;

            if (!infoRefs.current[c.key]) infoRefs.current[c.key] = React.createRef();

            return (
              <View
                key={c.key}
                style={{
                  flex: c.flex ?? 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggleSort(c.key)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 6,
                  }}
                >
                  {c.header ? (
                    c.header
                  ) : c.icon ? (
                    <IconSet
                      name={c.icon}
                      size={18}
                      color={isActive ? colors.primary : colors.text}
                    />
                  ) : (
                    <Text style={{ color: isActive ? colors.primary : colors.text, fontWeight: "800" }}>
                      {String(c.key)}
                    </Text>
                  )}
                  {isActive ? (
                    <MaterialCommunityIcons
                      name={sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* rows */}
      {sorted.map((r, idx) => {
        const prof = profiles[String(r.id)] || {};
        const version = prof?.updatedAt?.toMillis?.() ? prof.updatedAt.toMillis() : 0;
        const display = prof.displayName || r.displayName || r.id;
        const uri = prof.avatarUrl ? withCacheBust(prof.avatarUrl, version) : null;

        return (
          <TouchableOpacity
            key={`${r.id}:${idx}`}
            activeOpacity={0.85}
            onPress={() => onRowPress?.(r, prof)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderBottomWidth: idx === sorted.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
              backgroundColor: idx % 2 ? colors.rowAlt : colors.card,
            }}
          >
            <Image
              source={uri ? { uri } : AVATAR_PLACEHOLDER}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                marginRight: 8,
                backgroundColor: colors.border,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <View style={{ flex: 1.5, paddingRight: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>
                {display}
              </Text>
            </View>

            {(columns || []).map((c) => {
            const rendered = c.render ? c.render(r) : null;

            const isElement = React.isValidElement(rendered);
            const isTextLike =
                typeof rendered === 'string' ||
                typeof rendered === 'number';

            return (
                <View
                key={c.key}
                style={{
                    flex: c.flex ?? 1,
                    alignItems: (c.cellAlign || 'center') === 'center' ? 'center' : 'flex-start',
                }}
                >
                {c.render ? (
                    isElement ? (
                    rendered
                    ) : isTextLike ? (
                    <Text style={{ color: colors.text, textAlign: 'center' }}>
                        {String(rendered)}
                    </Text>
                    ) : (
                    // fallback si render() retourne null/undefined/false
                    <Text style={{ color: colors.text, textAlign: 'center' }}>
                        —
                    </Text>
                    )
                ) : (
                    <Text style={{ color: colors.text, textAlign: 'center' }}>
                    {String(r?.[c.key] ?? 0)}
                    </Text>
                )}
                </View>
            );
            })}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}