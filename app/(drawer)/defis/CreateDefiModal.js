// src/defis/CreateDefiModal.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';
import { createDefi } from '@src/defis/api';
import i18n from '@src/i18n/i18n';

// ---- Helpers NHL (copiés depuis GroupDetailScreen) ----

async function fetchNhlDaySummary(gameDate) {
  if (!gameDate) return { count: 0, firstISO: null };

  const safeToInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/schedule/${encodeURIComponent(
        gameDate
      )}`
    );

    if (!res.ok) {
      return { count: 0, firstISO: null };
    }

    const data = await res.json();

    // 1) Nouveau format api-web.nhle.com
    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find((d) => d?.date === gameDate)
      : null;

    let games = [];
    if (day) {
      games = Array.isArray(day.games) ? day.games : [];
    } else if (Array.isArray(data?.games)) {
      games = data.games;
    }

    const directCount =
      safeToInt(day?.numberOfGames) ??
      safeToInt(day?.totalGames) ??
      safeToInt(data?.numberOfGames) ??
      safeToInt(data?.totalGames);

    const count = directCount ?? games.length ?? 0;
    if (!count || games.length === 0) {
      return { count: 0, firstISO: null };
    }

    // 2) Première heure de match
    const isoList = games
      .map(
        (g) =>
          g?.startTimeUTC ||
          g?.startTimeUTCDate ||
          g?.gameDate ||
          null
      )
      .filter(Boolean)
      .sort();

    const firstISO = isoList[0] ?? null;

    return { count, firstISO };
  } catch {
    // En cas d’erreur réseau, on retourne "aucun match"
    return { count: 0, firstISO: null };
  }
}

function fmtLocalDate(d) {
  if (!(d instanceof Date)) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(
    d.getMonth() + 1
  )}-${pad(d.getDate())}`;
}
function fmtLocalHHmmFromISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * props:
 *  - visible: bool
 *  - onClose: () => void
 *  - groups: [{ id, name, status?, avatarUrl?, isFavorite? }]
 *  - initialGroupId?: string | null
 *  - onCreated?: ({ defiId, groupId }) => void
 */
export default function CreateDefiModal({
  visible,
  onClose,
  groups = [],
  initialGroupId = null,
  onCreated,
}) {
  const { user } = useAuth();
  const { colors } = useTheme();

  // 🔴 Filtrer les groupes archivés / supprimés
  const selectableGroups = useMemo(
    () =>
      (groups || []).filter((g) => {
        if (!g) return false;
        const st = String(g.status || '').toLowerCase();
        return !['archived', 'deleted'].includes(st);
      }),
    [groups]
  );

  const [selectedGroupId, setSelectedGroupId] =
    useState(initialGroupId);
  const [size, setSize] = useState('1x1');
  const [gameDay, setGameDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDayPicker, setShowDayPicker] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyCount, setVerifyCount] = useState(null);
  const [verifyFirstISO, setVerifyFirstISO] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState('idle');
  const [verifyMsg, setVerifyMsg] = useState('');

  const [creating, setCreating] = useState(false);

  // Si la liste de groupes change / initialGroupId change
  useEffect(() => {
    if (
      initialGroupId &&
      selectableGroups.some((g) => g.id === initialGroupId)
    ) {
      setSelectedGroupId(initialGroupId);
    } else if (!selectedGroupId && selectableGroups.length === 1) {
      setSelectedGroupId(selectableGroups[0].id);
    } else if (
      selectedGroupId &&
      !selectableGroups.some((g) => g.id === selectedGroupId)
    ) {
      setSelectedGroupId(selectableGroups[0]?.id ?? null);
    }
  }, [initialGroupId, selectableGroups, selectedGroupId]);

  const SIZES = ['1x1', '2x2', '3x3', '4x4', '5x5'];
  const nType = useMemo(() => {
    const n = parseInt(String(size).split('x')[0], 10);
    return Number.isFinite(n) ? n : 0;
  }, [size]);
  const participationCost = nType;
  const computedTitle = i18n.t('defi.create.autoTitle', {
    format: size,
  });
  const gameDateStr = useMemo(
    () => fmtLocalDate(gameDay),
    [gameDay]
  );

  // deadline locale (1h avant premier match NHL)
  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - 60 * 60 * 1000);
  }, [verifyFirstISO]);

  // bouton "Créer" désactivé si pas OK
  const canCreate = useMemo(() => {
    if (
      !selectedGroupId ||
      !verifyCount ||
      !signupDeadlineLocal ||
      selectableGroups.length === 0
    ) {
      return false;
    }
    const now = new Date();
    return now < signupDeadlineLocal;
  }, [
    selectedGroupId,
    verifyCount,
    signupDeadlineLocal,
    selectableGroups.length,
  ]);

  const verifyDate = useCallback(async () => {
    if (!gameDateStr) return;
    setVerifying(true);
    setVerifyStatus('idle');
    setVerifyMsg('');
    try {
      const { count, firstISO } =
        await fetchNhlDaySummary(gameDateStr);
      setVerifyCount(count);
      setVerifyFirstISO(firstISO);

      if (!count) {
        setVerifyStatus('none');
        setVerifyMsg(
          i18n.t('defi.create.verify.noGames', {
            date: gameDateStr,
          })
        );
        return;
      }

      const timeMsg = firstISO
        ? i18n.t('defi.create.verify.okWithTime', {
            count,
            time: fmtLocalHHmmFromISO(firstISO),
          })
        : i18n.t('defi.create.verify.okNoTime', { count });

      setVerifyStatus('ok');
      setVerifyMsg(timeMsg);
    } catch (e) {
      setVerifyStatus('error');
      setVerifyMsg(
        i18n.t('defi.create.verify.error', {
          message: String(e?.message || e),
        })
      );
      setVerifyCount(0);
      setVerifyFirstISO(null);
    } finally {
      setVerifying(false);
    }
  }, [gameDateStr]);

  // Vérifier à l'ouverture
  useEffect(() => {
    if (visible) verifyDate();
  }, [visible, verifyDate]);

  // Re-vérifier quand la date change
  useEffect(() => {
    if (visible) verifyDate();
  }, [gameDateStr, visible, verifyDate]);

  async function handleCreate() {
    if (!user?.uid) return;
    if (!selectedGroupId) return;

    if (!verifyCount) {
      Alert.alert(
        i18n.t('defi.create.alert.noGames.title'),
        i18n.t('defi.create.alert.noGames.body', {
          date: gameDateStr,
        })
      );
      return;
    }

    setCreating(true);
    try {
      let firstISO = verifyFirstISO;
      if (!firstISO) {
        const { count, firstISO: fromApi } =
          await fetchNhlDaySummary(gameDateStr);
        if (!count) {
          Alert.alert(
            i18n.t('defi.create.alert.noGames.title'),
            i18n.t('defi.create.alert.noGames.body', {
              date: gameDateStr,
            })
          );
          return;
        }
        firstISO = fromApi;
      }

      const firstGameDate = new Date(firstISO);

      const signupDeadline =
        signupDeadlineLocal ||
        new Date(firstGameDate.getTime() - 60 * 60 * 1000);

      const now = new Date();
      if (now >= signupDeadline) {
        const hh = String(signupDeadline.getHours()).padStart(
          2,
          '0'
        );
        const mm = String(
          signupDeadline.getMinutes()
        ).padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        Alert.alert(
          i18n.t('defi.create.alert.deadlinePassed.title'),
          i18n.t('defi.create.alert.deadlinePassed.body', {
            date: gameDateStr,
            time: timeStr,
          })
        );
        setCreating(false);
        return;
      }

      const res = await createDefi({
        groupId: selectedGroupId,
        title: computedTitle,
        type: nType,
        gameDate: gameDateStr,
        createdBy: user.uid,
        participationCost,
        status: 'open',
        pot: 0,
        firstGameUTC: firstGameDate,
        signupDeadline,
        ...(__DEV__ ? { debugNotifyCreator: true } : {}),
      });

      // reset local
      setSize('1x1');
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setGameDay(d);
      setVerifyStatus('idle');
      setVerifyMsg('');
      setVerifyCount(null);
      setVerifyFirstISO(null);

      onCreated?.({
        defiId: res?.id || null,
        groupId: selectedGroupId,
      });
      onClose?.();
    } catch (e) {
      Alert.alert(
        i18n.t('defi.create.alert.error.title'),
        i18n.t('defi.create.alert.error.body', {
          message: String(e?.message || e),
        })
      );
    } finally {
      setCreating(false);
    }
  }

  const selectedGroup = useMemo(
    () =>
      selectableGroups.find((g) => g.id === selectedGroupId) ||
      null,
    [selectableGroups, selectedGroupId]
  );

  if (!visible) return null;

  const noGroupAvailable = selectableGroups.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.text,
              marginBottom: 4,
            }}
          >
            {i18n.t('defi.create.title')}
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
              <Text
                style={{ fontSize: 12, color: colors.subtext }}
              >
                {i18n.t('defi.create.group.noneHint')}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  color: colors.text,
                }}
              >
                {i18n.t('defi.create.group.noneBody')}
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
              <Text
                style={{ fontSize: 12, color: colors.subtext }}
              >
                {i18n.t('defi.create.group.label')}
              </Text>
              <Text
                style={{
                  fontWeight: '800',
                  fontSize: 16,
                  marginTop: 2,
                  color: colors.text,
                }}
              >
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
              <Text
                style={{ fontSize: 12, color: colors.subtext }}
              >
                {i18n.t('defi.create.group.choose')}
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
                      borderColor: active
                        ? colors.primary
                        : colors.border,
                      backgroundColor: active
                        ? colors.primary
                        : colors.card,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? '#fff' : colors.text,
                        fontWeight: '600',
                      }}
                    >
                      {g.name || g.id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Format du défi */}
          <Text
            style={{ fontWeight: '600', color: colors.text }}
          >
            {i18n.t('defi.create.formatLabel')}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {SIZES.map((s) => {
              const active = s === size;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(s)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderRadius: 10,
                    borderColor: active
                      ? colors.primary
                      : colors.border,
                    backgroundColor: active
                      ? colors.primary
                      : colors.card,
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontWeight: '700',
                    }}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Récap titre / coût */}
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
              <Text
                style={{
                  width: 160,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                {i18n.t('defi.create.summary.titleLabel')}
              </Text>
              <Text style={{ color: colors.text }}>
                {computedTitle}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text
                style={{
                  width: 160,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                {i18n.t('defi.create.summary.costLabel')}
              </Text>
              <Text style={{ color: colors.text }}>
                {i18n.t('defi.create.summary.costValue', {
                  credits: participationCost,
                })}
              </Text>
            </View>
          </View>

          {/* Date NHL + infos */}
          <Text
            style={{ fontWeight: '600', color: colors.text }}
          >
            {i18n.t('defi.create.date.labelBase', {
              meta:
                verifyCount != null
                  ? ` (${verifyCount} ${
                      i18n.t('defi.create.date.matchesShort')
                    }${
                      verifyFirstISO
                        ? ` – ${i18n.t(
                            'defi.create.date.firstAt',
                            {
                              time: fmtLocalHHmmFromISO(
                                verifyFirstISO
                              ),
                            }
                          )}`
                        : ''
                    }${
                      signupDeadlineLocal
                        ? ` – ${i18n.t(
                            'defi.create.date.deadlineAt',
                            {
                              time: `${String(
                                signupDeadlineLocal.getHours()
                              ).padStart(2, '0')}:${String(
                                signupDeadlineLocal.getMinutes()
                              ).padStart(2, '0')
                              }`,
                            }
                          )}`
                        : ''
                    })`
                  : '',
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
                    : verifyStatus === 'none' ||
                      verifyStatus === 'error'
                    ? '#b00020'
                    : colors.subtext,
              }}
            >
              {verifying
                ? i18n.t('defi.create.verify.loading')
                : verifyMsg}
            </Text>
          ) : null}

          {/* Sélecteur de date */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                padding: 12,
                borderWidth: 1,
                borderRadius: 10,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                {gameDateStr}
              </Text>
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
                {i18n.t('defi.create.date.change')}
              </Text>
            </TouchableOpacity>
          </View>
          {showDayPicker && (
            <DateTimePicker
              value={gameDay}
              mode="date"
              onChange={(e, d) => {
                setShowDayPicker(false);
                if (d) {
                  const norm = new Date(d);
                  norm.setHours(0, 0, 0, 0);
                  setGameDay(norm);
                }
              }}
            />
          )}

          {/* Boutons */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 8,
            }}
          >
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
                {i18n.t('common.cancel')}
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
                backgroundColor:
                  creating || !canCreate
                    ? colors.subtext
                    : '#b91c1c', // rouge Prophetik
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontWeight: '700',
                }}
              >
                {creating
                  ? i18n.t('defi.create.actions.creating')
                  : i18n.t('defi.create.actions.create')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={{
              color: colors.subtext,
              fontSize: 12,
              marginTop: 8,
            }}
          >
            {i18n.t('defi.create.hint.signupDeadline')}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}