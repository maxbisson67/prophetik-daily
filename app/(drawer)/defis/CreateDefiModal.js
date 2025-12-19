const APP_TZ = 'America/Toronto'; // utilisé pour metadata + rules (6x7), pas pour calculer le YYYY-MM-DD
// src/defis/CreateDefiModal.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';
import { createDefi } from '@src/defis/api';
import i18n from '@src/i18n/i18n';

/* ----------------------- NHL helpers ----------------------- */
async function fetchNhlDaySummary(gameDateYmd) {
  if (!gameDateYmd) return { count: 0, firstISO: null };

  const safeToInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/schedule/${encodeURIComponent(gameDateYmd)}`
    );
    if (!res.ok) return { count: 0, firstISO: null };

    const data = await res.json();

    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find((d) => d?.date === gameDateYmd)
      : null;

    let games = [];
    if (day) games = Array.isArray(day.games) ? day.games : [];
    else if (Array.isArray(data?.games)) games = data.games;

    const directCount =
      safeToInt(day?.numberOfGames) ??
      safeToInt(day?.totalGames) ??
      safeToInt(data?.numberOfGames) ??
      safeToInt(data?.totalGames);

    const count = directCount ?? games.length ?? 0;
    if (!count || games.length === 0) return { count: 0, firstISO: null };

    const isoList = games
      .map((g) => g?.startTimeUTC || g?.startTimeUTCDate || g?.gameDate || null)
      .filter(Boolean)
      .sort();

    const firstISO = isoList[0] ?? null;
    return { count, firstISO };
  } catch {
    return { count: 0, firstISO: null };
  }
}

function fmtLocalHHmmFromISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ----------------------- YMD helpers (timezone-proof) ----------------------- */
function pad2(n) {
  return String(n).padStart(2, '0');
}

// ✅ YMD basé sur la date LOCALE (pour affichage / logique côté user)
function ymdFromLocalDate(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

// ✅ Date à midi local (stable visuellement dans le picker, évite “la veille”)
function dateForPickerFromYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // midi local
}

/**
 * ✅ LE FIX ANDROID IMPORTANT:
 * Le DateTimePicker Android peut renvoyer une date “décalée” (souvent liée à UTC/minuit).
 * On force la reconstruction à midi local AVANT d’extraire le YMD.
 */
function ymdFromPickerDate(d) {
  const fixed = new Date(d);
  fixed.setHours(12, 0, 0, 0); // ✅ midi local = pas de glissement de jour
  return ymdFromLocalDate(fixed);
}

// ✅ règle samedi seulement basée sur YYYY-MM-DD, sans Intl/timeZone
function isSaturdayYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  // midi UTC pour éviter les glitches
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.getUTCDay() === 6;
}

/* ----------------------- Component ----------------------- */
export default function CreateDefiModal({
  visible,
  onClose,
  groups = [],
  initialGroupId = null,
  onCreated,
}) {
  const { user } = useAuth();
  const { colors } = useTheme();

  const selectableGroups = useMemo(
    () =>
      (groups || []).filter((g) => {
        if (!g) return false;
        const st = String(g.status || '').toLowerCase();
        return !['archived', 'deleted'].includes(st);
      }),
    [groups]
  );

  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [size, setSize] = useState('1x1');

  // ✅ Source de vérité unique: date NHL sous forme YYYY-MM-DD
  const [gameDateYmd, setGameDateYmd] = useState(() => ymdFromLocalDate(new Date()));
  const [showDayPicker, setShowDayPicker] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyCount, setVerifyCount] = useState(null);
  const [verifyFirstISO, setVerifyFirstISO] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState('idle');
  const [verifyMsg, setVerifyMsg] = useState('');

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (initialGroupId && selectableGroups.some((g) => g.id === initialGroupId)) {
      setSelectedGroupId(initialGroupId);
    } else if (!selectedGroupId && selectableGroups.length === 1) {
      setSelectedGroupId(selectableGroups[0].id);
    } else if (selectedGroupId && !selectableGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(selectableGroups[0]?.id ?? null);
    }
  }, [initialGroupId, selectableGroups, selectedGroupId]);

  const SIZES = ['1x1', '2x2', '3x3', '4x4', '5x5', '6x7'];
  const isSpecial67 = size === '6x7';

  const nType = useMemo(() => {
    if (size === '6x7') return 6; // pricing/compat
    const n = parseInt(String(size).split('x')[0], 10);
    return Number.isFinite(n) ? n : 0;
  }, [size]);

  const participationCost = nType;

  const computedTitle = useMemo(() => {
    if (size === '6x7') return i18n.t('defi.create.autoTitle67', { defaultValue: 'Défi 6x7' });
    return i18n.t('defi.create.autoTitle', { format: size, defaultValue: `Défi ${size}` });
  }, [size]);

  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - 60 * 60 * 1000);
  }, [verifyFirstISO]);

  const isSatForSelectedDate = useMemo(() => isSaturdayYmd(gameDateYmd), [gameDateYmd]);

  const canCreate = useMemo(() => {
    if (!selectedGroupId || !verifyCount || !signupDeadlineLocal || selectableGroups.length === 0) {
      return false;
    }
    if (isSpecial67 && !isSatForSelectedDate) return false;

    const now = new Date();
    return now < signupDeadlineLocal;
  }, [
    selectedGroupId,
    verifyCount,
    signupDeadlineLocal,
    selectableGroups.length,
    isSpecial67,
    isSatForSelectedDate,
  ]);

  const verifyDate = useCallback(async () => {
    if (!gameDateYmd) return;

    setVerifying(true);
    setVerifyStatus('idle');
    setVerifyMsg('');

    try {
      const { count, firstISO } = await fetchNhlDaySummary(gameDateYmd);

      setVerifyCount(count);
      setVerifyFirstISO(firstISO);

      if (!count) {
        setVerifyStatus('none');
        setVerifyMsg(
          i18n.t('defi.create.verify.noGames', {
            date: gameDateYmd,
            defaultValue: `Aucun match NHL trouvé pour ${gameDateYmd}.`,
          })
        );
        return;
      }

      const timeMsg = firstISO
        ? i18n.t('defi.create.verify.okWithTime', {
            count,
            time: fmtLocalHHmmFromISO(firstISO),
            defaultValue: `${count} matchs trouvés. Premier à ${fmtLocalHHmmFromISO(firstISO)}.`,
          })
        : i18n.t('defi.create.verify.okNoTime', {
            count,
            defaultValue: `${count} matchs trouvés.`,
          });

      setVerifyStatus('ok');
      setVerifyMsg(timeMsg);
    } catch (e) {
      setVerifyStatus('error');
      setVerifyMsg(
        i18n.t('defi.create.verify.error', {
          message: String(e?.message || e),
          defaultValue: `Erreur: ${String(e?.message || e)}`,
        })
      );
      setVerifyCount(0);
      setVerifyFirstISO(null);
    } finally {
      setVerifying(false);
    }
  }, [gameDateYmd]);

  useEffect(() => {
    if (visible) verifyDate();
  }, [visible, verifyDate]);

  useEffect(() => {
    if (visible) verifyDate();
  }, [gameDateYmd, visible, verifyDate]);

  async function handleCreate() {
    if (!user?.uid) return;
    if (!selectedGroupId) return;

    if (isSpecial67 && !isSatForSelectedDate) {
      Alert.alert(
        i18n.t('defi.create.alert.saturdayOnly.title', { defaultValue: 'Disponible le samedi seulement' }),
        i18n.t('defi.create.alert.saturdayOnly.body', {
          defaultValue: 'Le défi 6x7 est un événement spécial et ne peut être créé que le samedi.',
        })
      );
      return;
    }

    if (!verifyCount) {
      Alert.alert(
        i18n.t('defi.create.alert.noGames.title', { defaultValue: 'Aucun match NHL' }),
        i18n.t('defi.create.alert.noGames.body', {
          date: gameDateYmd,
          defaultValue: `Aucun match NHL pour ${gameDateYmd}.`,
        })
      );
      return;
    }

    setCreating(true);
    try {
      let firstISO = verifyFirstISO;
      if (!firstISO) {
        const { count, firstISO: fromApi } = await fetchNhlDaySummary(gameDateYmd);
        if (!count) {
          Alert.alert(
            i18n.t('defi.create.alert.noGames.title', { defaultValue: 'Aucun match NHL' }),
            i18n.t('defi.create.alert.noGames.body', {
              date: gameDateYmd,
              defaultValue: `Aucun match NHL pour ${gameDateYmd}.`,
            })
          );
          return;
        }
        firstISO = fromApi;
      }

      const firstGameDate = new Date(firstISO);
      const signupDeadline = signupDeadlineLocal || new Date(firstGameDate.getTime() - 60 * 60 * 1000);

      const now = new Date();
      if (now >= signupDeadline) {
        const hh = pad2(signupDeadline.getHours());
        const mm = pad2(signupDeadline.getMinutes());

        Alert.alert(
          i18n.t('defi.create.alert.deadlinePassed.title', { defaultValue: 'Date limite dépassée' }),
          i18n.t('defi.create.alert.deadlinePassed.body', {
            date: gameDateYmd,
            time: `${hh}:${mm}`,
            defaultValue: `La date limite est passée (${gameDateYmd} à ${hh}:${mm}).`,
          })
        );
        return;
      }

      const payloadBase = {
        groupId: selectedGroupId,
        title: computedTitle,
        type: nType,
        gameDate: gameDateYmd,
        createdBy: user.uid,
        participationCost,
        status: 'open',
        pot: 0,
        firstGameUTC: firstGameDate,
        signupDeadline,
        ...(__DEV__ ? { debugNotifyCreator: true } : {}),
      };

      const payload = isSpecial67
        ? {
            ...payloadBase,
            format: { picks: 6, pool: 7 },
            availability: { days: ['SATURDAY'], timezone: APP_TZ },
            bonusReward: { type: 'random', values: [6, 7] },
            isSpecial: true,
            specialKey: 'six_by_seven',
          }
        : payloadBase;

      const res = await createDefi(payload);

      // reset local
      setSize('1x1');
      setGameDateYmd(ymdFromLocalDate(new Date()));
      setVerifyStatus('idle');
      setVerifyMsg('');
      setVerifyCount(null);
      setVerifyFirstISO(null);

      onCreated?.({ defiId: res?.id || null, groupId: selectedGroupId });
      onClose?.();
    } catch (e) {
      Alert.alert(
        i18n.t('defi.create.alert.error.title', { defaultValue: 'Erreur' }),
        i18n.t('defi.create.alert.error.body', {
          message: String(e?.message || e),
          defaultValue: String(e?.message || e),
        })
      );
    } finally {
      setCreating(false);
    }
  }

  const selectedGroup = useMemo(
    () => selectableGroups.find((g) => g.id === selectedGroupId) || null,
    [selectableGroups, selectedGroupId]
  );

  if (!visible) return null;

  const noGroupAvailable = selectableGroups.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
            {i18n.t('defi.create.title', { defaultValue: 'Créer un défi' })}
          </Text>

          {/* Choix du groupe */}
          {noGroupAvailable ? (
            <View
              style={{
                marginTop: 4,
                marginBottom: 8,
                padding: 10,
                borderWidth: 1,
                borderRadius: 10,
                borderColor: colors.border,
                backgroundColor: colors.card2,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.subtext }}>
                {i18n.t('defi.create.group.noneHint', { defaultValue: 'Aucun groupe disponible' })}
              </Text>
              <Text style={{ marginTop: 4, color: colors.text }}>
                {i18n.t('defi.create.group.noneBody', {
                  defaultValue: 'Crée un groupe pour pouvoir créer un défi.',
                })}
              </Text>
            </View>
          ) : selectableGroups.length <= 1 && selectedGroup ? (
            <View
              style={{
                marginTop: 4,
                marginBottom: 8,
                padding: 10,
                borderWidth: 1,
                borderRadius: 10,
                borderColor: colors.border,
                backgroundColor: colors.card2,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.subtext }}>
                {i18n.t('defi.create.group.label', { defaultValue: 'Groupe' })}
              </Text>
              <Text style={{ fontWeight: '800', fontSize: 16, marginTop: 2, color: colors.text }}>
                {selectedGroup.name || selectedGroup.id}
              </Text>
            </View>
          ) : (
            <View
              style={{
                marginTop: 4,
                marginBottom: 8,
                padding: 10,
                borderWidth: 1,
                borderRadius: 10,
                borderColor: colors.border,
                backgroundColor: colors.card2,
              }}
            >
              <Text style={{ fontSize: 12, color: colors.subtext }}>
                {i18n.t('defi.create.group.choose', { defaultValue: 'Choisir un groupe' })}
              </Text>
              {selectableGroups.map((g) => {
                const active = g.id === selectedGroupId;
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setSelectedGroupId(g.id)}
                    style={{
                      marginTop: 6,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.card,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>
                      {g.name || g.id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Format du défi */}
          <Text style={{ fontWeight: '600', color: colors.text }}>
            {i18n.t('defi.create.formatLabel', { defaultValue: 'Format' })}
          </Text>

          {/* Ligne 1 */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {SIZES.filter((s) => s !== '6x7').map((s) => {
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(s)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderWidth: 2,
                    borderRadius: 14,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.card,
                  }}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '800', fontSize: 14 }}>
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ligne 2: 6x7 */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            {(() => {
              const s = '6x7';
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(s)}
                  style={{
                    minWidth: 220,
                    width: '70%',
                    maxWidth: 360,
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderWidth: 2,
                    borderRadius: 16,
                    borderColor: '#f59e0b',
                    backgroundColor: active ? '#f59e0b' : '#fffbeb',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: active ? '#111827' : '#92400e', fontWeight: '900', fontSize: 16 }}>
                    {s} 🔥
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </View>

          {/* Bloc spécial 6x7 */}
          {isSpecial67 && (
            <View
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 10,
                backgroundColor: '#fffbeb',
                borderWidth: 1,
                borderColor: '#f59e0b',
              }}
            >
              <Text style={{ fontWeight: '800', color: '#92400e' }}>
                🎯 6x7 —{' '}
                {i18n.t('defi.create.special67.saturdayOnly', { defaultValue: 'Samedi seulement' })}
              </Text>

              <Text style={{ marginTop: 4, color: '#92400e', fontSize: 12 }}>
                {i18n.t('defi.create.special67.body', {
                  defaultValue:
                    'Événement spécial Prophetik. Disponible uniquement le samedi (grosse journée NHL).',
                })}
              </Text>

              <Text style={{ marginTop: 4, color: '#92400e', fontSize: 12 }}>
                {i18n.t('defi.create.special67.bonusLine', {
                  defaultValue: '🎁 Bonus au gagnant: 6 ou 7 crédits (aléatoire).',
                })}
              </Text>

              {!isSatForSelectedDate ? (
                <Text style={{ marginTop: 6, color: '#b45309', fontSize: 12, fontWeight: '700' }}>
                  {i18n.t('defi.create.special67.notSaturdayHint', {
                    defaultValue: 'Choisis une date de samedi pour activer la création.',
                  })}
                </Text>
              ) : null}
            </View>
          )}

          {/* Récap */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderRadius: 10,
              gap: 6,
              backgroundColor: colors.card2,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ width: 160, fontWeight: '600', color: colors.text }}>
                {i18n.t('defi.create.summary.titleLabel', { defaultValue: 'Titre' })}
              </Text>
              <Text style={{ color: colors.text }}>{computedTitle}</Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <Text style={{ width: 160, fontWeight: '600', color: colors.text }}>
                {i18n.t('defi.create.summary.costLabel', { defaultValue: 'Coût' })}
              </Text>
              <Text style={{ color: colors.text }}>
                {i18n.t('defi.create.summary.costValue', {
                  credits: participationCost,
                  defaultValue: '{{credits}} crédits',
                })}
              </Text>
            </View>

            {isSpecial67 && (
              <Text style={{ color: '#f59e0b', fontWeight: '800' }}>
                ⭐ {i18n.t('defi.create.special67.badge', { defaultValue: 'Événement spécial' })}
              </Text>
            )}
          </View>

          {/* Date NHL + infos */}
          <Text style={{ fontWeight: '600', color: colors.text }}>
            {i18n.t('defi.create.date.labelBase', {
              meta:
                verifyCount != null
                  ? ` (${verifyCount} ${i18n.t('defi.create.date.matchesShort', { defaultValue: 'match(s)' })}${
                      verifyFirstISO
                        ? ` – ${i18n.t('defi.create.date.firstAt', {
                            time: fmtLocalHHmmFromISO(verifyFirstISO),
                            defaultValue: `1er à ${fmtLocalHHmmFromISO(verifyFirstISO)}`,
                          })}`
                        : ''
                    }${
                      signupDeadlineLocal
                        ? ` – ${i18n.t('defi.create.date.deadlineAt', {
                            time: `${pad2(signupDeadlineLocal.getHours())}:${pad2(
                              signupDeadlineLocal.getMinutes()
                            )}`,
                            defaultValue: `limite ${pad2(signupDeadlineLocal.getHours())}:${pad2(
                              signupDeadlineLocal.getMinutes()
                            )}`,
                          })}`
                        : ''
                    })`
                  : '',
              defaultValue: 'Date NHL{{meta}}',
            })}
          </Text>

          {verifyMsg ? (
            <Text
              style={{
                fontSize: 12,
                marginTop: 4,
                color:
                  verifyStatus === 'ok'
                    ? '#0a7'
                    : verifyStatus === 'none' || verifyStatus === 'error'
                    ? '#b00020'
                    : colors.subtext,
              }}
            >
              {verifying ? i18n.t('defi.create.verify.loading', { defaultValue: 'Vérification…' }) : verifyMsg}
            </Text>
          ) : null}

          {/* Sélecteur de date */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                flex: 1,
                padding: 12,
                borderWidth: 1,
                borderRadius: 10,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontWeight: '600', color: colors.text }}>{gameDateYmd}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowDayPicker(true)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>
                {i18n.t('defi.create.date.change', { defaultValue: 'Changer' })}
              </Text>
            </TouchableOpacity>
          </View>

          {showDayPicker && (
            <DateTimePicker
              value={dateForPickerFromYmd(gameDateYmd)}
              mode="date"
              onChange={(e, d) => {
                setShowDayPicker(false);
                if (d) setGameDateYmd(ymdFromPickerDate(d)); // ✅ fix Android ici
              }}
            />
          )}

          {/* Boutons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                alignItems: 'center',
                borderColor: colors.border,
              }}
              disabled={creating}
            >
              <Text style={{ color: colors.text }}>
                {i18n.t('common.cancel', { defaultValue: 'Annuler' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={creating || !canCreate}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: creating || !canCreate ? colors.subtext : '#b91c1c',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {creating
                  ? i18n.t('defi.create.actions.creating', { defaultValue: 'Création…' })
                  : i18n.t('defi.create.actions.create', { defaultValue: 'Créer' })}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 8 }}>
            {i18n.t('defi.create.hint.signupDeadline', {
              defaultValue: "Tu peux t'inscrire jusqu'à 1h avant le premier match.",
            })}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}