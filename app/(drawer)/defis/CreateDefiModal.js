// src/defis/CreateDefiModal.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';
import { createDefi } from '@src/defis/api';

// ---- Helpers NHL (copiés depuis GroupDetailScreen) ----


 async function fetchNhlDaySummary(gameDate) {
  if (!gameDate) return { count: 0, firstISO: null };

  const safeToInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  try {
    const res = await fetch(
      `https://api-web.nhle.com/v1/schedule/${encodeURIComponent(gameDate)}`
    );

    if (!res.ok) {
      return { count: 0, firstISO: null };
    }

    const data = await res.json();

    // 1) Nouveau format api-web.nhle.com
    //    -> soit data.gameWeek[...].games
    //    -> soit data.games (fallback)
    const day = Array.isArray(data?.gameWeek)
      ? data.gameWeek.find((d) => d?.date === gameDate)
      : null;

    let games = [];
    if (day) {
      games = Array.isArray(day.games) ? day.games : [];
    } else if (Array.isArray(data?.games)) {
      games = data.games;
    }

    // parfois il y a aussi numberOfGames / totalGames
    const directCount =
      safeToInt(day?.numberOfGames) ??
      safeToInt(day?.totalGames) ??
      safeToInt(data?.numberOfGames) ??
      safeToInt(data?.totalGames);

    const count = directCount ?? games.length ?? 0;
    if (!count || games.length === 0) {
      return { count: 0, firstISO: null };
    }

    // 2) Récupérer la première heure de match
    // champs typiques: startTimeUTC / startTimeUTCDate / gameDate
    const isoList = games
      .map(
        (g) =>
          g?.startTimeUTC ||
          g?.startTimeUTCDate ||
          g?.gameDate ||
          null
      )
      .filter(Boolean)
      .sort(); // tri lexicographique OK pour ISO

    const firstISO = isoList[0] ?? null;

    return { count, firstISO };
  } catch (e) {
    // En cas d’erreur réseau, on retourne "aucun match"
    return { count: 0, firstISO: null };
  }
}

function fmtLocalDate(d) {
  if (!(d instanceof Date)) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
 *  - groups: [{ id, name, status?, avatarUrl? }]
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

  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
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
      // initialGroupId valide et non archivé
      setSelectedGroupId(initialGroupId);
    } else if (!selectedGroupId && selectableGroups.length === 1) {
      // un seul groupe dispo → auto-select
      setSelectedGroupId(selectableGroups[0].id);
    } else if (
      selectedGroupId &&
      !selectableGroups.some((g) => g.id === selectedGroupId)
    ) {
      // le groupe sélectionné a été archivé → fallback
      setSelectedGroupId(selectableGroups[0]?.id ?? null);
    }
  }, [initialGroupId, selectableGroups, selectedGroupId]);

  const SIZES = ['1x1', '2x2', '3x3', '4x4', '5x5'];
  const nType = useMemo(() => {
    const n = parseInt(String(size).split('x')[0], 10);
    return Number.isFinite(n) ? n : 0;
  }, [size]);
  const participationCost = nType;
  const computedTitle = `Défi ${size}`;
  const gameDateStr = useMemo(() => fmtLocalDate(gameDay), [gameDay]);

  // 👉 deadline locale (1h avant premier match NHL)
  const signupDeadlineLocal = useMemo(() => {
    if (!verifyFirstISO) return null;
    const first = new Date(verifyFirstISO);
    return new Date(first.getTime() - 60 * 60 * 1000);
  }, [verifyFirstISO]);

  // 👉 le bouton "Créer le défi" est désactivé si on a dépassé la limite
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
      const { count, firstISO } = await fetchNhlDaySummary(gameDateStr);
      setVerifyCount(count);
      setVerifyFirstISO(firstISO);

      if (!count) {
        setVerifyStatus('none');
        setVerifyMsg(`Aucun match NHL le ${gameDateStr}.`);
        return;
      }

      const timeMsg = firstISO
        ? ` Premier match à ${fmtLocalHHmmFromISO(firstISO)}.`
        : '';
      setVerifyStatus('ok');
      setVerifyMsg(`${count} match(s) trouvé(s).${timeMsg}`);
    } catch (e) {
      setVerifyStatus('error');
      setVerifyMsg(`Impossible de vérifier: ${String(e?.message || e)}`);
      setVerifyCount(0);
      setVerifyFirstISO(null);
    } finally {
      setVerifying(false);
    }
  }, [gameDateStr]);

  useEffect(() => {
    if (visible) {
      // Re-vérifier à l'ouverture
      verifyDate();
    }
  }, [visible, verifyDate]);

  useEffect(() => {
    if (visible) {
      verifyDate();
    }
  }, [gameDateStr, visible, verifyDate]);

  async function handleCreate() {
    if (!user?.uid) return;
    if (!selectedGroupId) return;

    if (!verifyCount) {
      alert(`Aucun match trouvé pour le ${gameDateStr}.`);
      return;
    }

    setCreating(true);
    try {
      let firstISO = verifyFirstISO;
      if (!firstISO) {
        const { count, firstISO: fromApi } = await fetchNhlDaySummary(
          gameDateStr
        );
        if (!count) {
          alert(`Aucun match trouvé pour le ${gameDateStr}.`);
          return;
        }
        firstISO = fromApi;
      }

      const firstGameDate = new Date(firstISO);

      // ✅ on réutilise la même logique que signupDeadlineLocal
      const signupDeadline =
        signupDeadlineLocal ||
        new Date(firstGameDate.getTime() - 60 * 60 * 1000);

      const now = new Date();
      if (now >= signupDeadline) {
        const hh = String(signupDeadline.getHours()).padStart(2, '0');
        const mm = String(signupDeadline.getMinutes()).padStart(2, '0');
        alert(
          `La limite d’inscription pour ${gameDateStr} était ${hh}:${mm}. Impossible de créer le défi.`
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

      // reset local state "light"
      setSize('1x1');
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      setGameDay(d);
      setVerifyStatus('idle');
      setVerifyMsg('');
      setVerifyCount(null);
      setVerifyFirstISO(null);

      if (onCreated) {
        onCreated({
          defiId: res?.id || null,
          groupId: selectedGroupId,
        });
      }
      onClose?.();
    } catch (e) {
      alert(`Création impossible: ${String(e?.message || e)}`);
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
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: colors.text,
              marginBottom: 4,
            }}
          >
            Nouveau défi NHL
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
                Aucun groupe disponible pour créer un défi.
              </Text>
              <Text style={{ marginTop: 4, color: colors.text }}>
                Les groupes archivés ne peuvent pas recevoir de nouveaux défis.
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
                Groupe
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
              <Text style={{ fontSize: 12, color: colors.subtext }}>
                Choisis un groupe
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
          <Text style={{ fontWeight: '600', color: colors.text }}>
            Format du défi
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
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
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.card,
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
                Titre
              </Text>
              <Text style={{ color: colors.text }}>{computedTitle}</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text
                style={{
                  width: 160,
                  fontWeight: '600',
                  color: colors.text,
                }}
              >
                Coût participation
              </Text>
              <Text style={{ color: colors.text }}>
                {participationCost} crédit(s)
              </Text>
            </View>
          </View>

          {/* Date NHL + infos */}
          <Text style={{ fontWeight: '600', color: colors.text }}>
            {`Date NHL${
              verifyCount != null
                ? ` (${verifyCount} match(s)${
                    verifyFirstISO
                      ? ` – 1er à ${fmtLocalHHmmFromISO(verifyFirstISO)}`
                      : ''
                  }${
                    signupDeadlineLocal
                      ? ` – Limite ${String(
                          signupDeadlineLocal.getHours()
                        ).padStart(2, '0')}:${String(
                          signupDeadlineLocal.getMinutes()
                        ).padStart(2, '0')}`
                      : ''
                  })`
                : ''
            }`}
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
              {verifyMsg}
            </Text>
          ) : null}

          {/* Sélecteur de date */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
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
              <Text style={{ fontWeight: '600', color: colors.text }}>
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
              <Text style={{ color: colors.text }}>Changer</Text>
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
              <Text style={{ color: colors.text }}>Annuler</Text>
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
                  creating || !canCreate ? colors.subtext : '#b91c1c', // rouge comme accueil
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {creating ? 'Création…' : 'Créer le défi'}
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
            La limite d’inscription est fixée à 1h avant le premier match (heure
            locale).
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}