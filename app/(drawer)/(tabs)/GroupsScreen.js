// app/(tabs)/GroupsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { snapshotExists, snapshotData, snapshotId } from "@src/lib/safeSnapshot";
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@src/auth/SafeAuthProvider';
import { useTheme } from '@src/theme/ThemeProvider';
import i18n from '@src/i18n/i18n'; // 👈 i18n
import GroupAvatar from '@src/groups/components/GroupAvatar';
import GroupAutopilotModeBadge from '@src/groups/components/GroupAutopilotModeBadge';
import { useMyGroups } from '@src/groups/MyGroupsProvider';
import { isGroupOwner } from '@src/groups/groupOwnership';
import { PARTICIPATION } from '@src/groups/participationUtils';
import { setMembershipParticipationService } from '@src/groups/setMembershipParticipationService';
import usePlanUsage from '@src/subscriptions/usePlanUsage';

/* ----------------------------------------------------
   Firestore helpers (RNFirebase natif / Web SDK)
---------------------------------------------------- */
const isWeb = Platform.OS === 'web';

// Snap helpers (compatibles web & RNFirebase)
const snapExists = (s) => (typeof s?.exists === 'function' ? s.exists() : !!s?.exists);
const snapData   = (s) => (typeof s?.data   === 'function' ? s.data()   : s?.data);

function fw() {
  if (isWeb) {
    const web = require('firebase/firestore');
    const { app } = require('@src/lib/firebase'); // côté web, ton wrapper exporte app
    const db = web.getFirestore(app);
    return {
      mode: 'web',
      db,
      doc: web.doc,
      collection: web.collection,
      query: web.query,
      where: web.where,
      onSnapshot: web.onSnapshot,
      getDoc: web.getDoc,
      setDoc: web.setDoc,
      updateDoc: web.updateDoc,
      serverTimestamp: web.serverTimestamp,
      deleteField: web.deleteField,
    };
  }
  const rn = require('@react-native-firebase/firestore').default;
  const FieldValue = rn.FieldValue;
  return {
    mode: 'native',
    rn,
    serverTimestamp: () => FieldValue.serverTimestamp(),
    deleteField: () => FieldValue.delete(),
  };
}

function subParticipant(uid, onNext, onError) {
  if (!uid) return () => {};
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.onSnapshot(ref, onNext, onError);
  }
  return w.rn().collection('participants').doc(uid).onSnapshot(onNext, onError);
}

async function readParticipant(uid) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.getDoc(ref);
  }
  return w.rn().collection('participants').doc(uid).get();
}

async function updParticipant(uid, patch) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.updateDoc(ref, patch);
  }
  return w.rn().collection('participants').doc(uid).update(patch);
}

async function setParticipant(uid, data, merge = true) {
  const w = fw();
  if (w.mode === 'web') {
    const ref = w.doc(w.db, 'participants', uid);
    return w.setDoc(ref, data, { merge });
  }
  return w.rn().collection('participants').doc(uid).set(data, { merge });
}

/* ----------------------------------------------------
   Utils
---------------------------------------------------- */
const RED = "#b91c1c";

function cardShadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 }, // iOS
    elevation: 4, // Android
  };
}

function prophetikCardStyle(colors, accent = RED) {
  return {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    padding: 14,

    // signature
    borderLeftWidth: 4,
    borderLeftColor: accent,
    borderBottomWidth: 2,
    borderBottomColor: accent,
  };
}

/* ----------------------------------------------------
   Écran
---------------------------------------------------- */
export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { userGroups, loading: loadingGroups } = useMyGroups();
  const planUsage = usePlanUsage(user?.uid);
  const [activatingGroupId, setActivatingGroupId] = useState(null);

  // Création → écran dédié (évite Modal iOS + picker d'équipe)
  function openCreateGroup() {
    router.push('/(drawer)/groups/create');
  }

  // Favori
  const [favoriteGroupId, setFavoriteGroupId] = useState(null);
  const [loadingFavorite, setLoadingFavorite] = useState(!!user?.uid);

  /* -------------------------
     Favori live (participants/{uid})
  ------------------------- */
  useEffect(() => {
    if (!user?.uid) { setFavoriteGroupId(null); setLoadingFavorite(false); return; }
    setLoadingFavorite(true);
    const unsub = subParticipant(
      user.uid,
      (snap) => {
        const d = snapExists(snap) ? (snapData(snap) || {}) : {};
        setFavoriteGroupId(d.favoriteGroupId || null);
        setLoadingFavorite(false);
      },
      (err) => {
        console.log('participants onSnapshot error:', err?.code, err?.message || String(err));
        setLoadingFavorite(false);
        Alert.alert(i18n.t('groups.alertFavoriteReadTitle'), String(err?.message || err));
      }
    );
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  /* -------------------------
     Partition owner / member (même source que Aujourd'hui)
  ------------------------- */
  const allGroups = useMemo(
    () =>
      userGroups.map((g) => ({
        ...g,
        role: isGroupOwner(g, user?.uid) ? 'owner' : 'member',
      })),
    [userGroups, user?.uid]
  );

  const myOwnerGroups = useMemo(() => allGroups.filter((g) => g.role === 'owner'), [allGroups]);
  const myMemberGroups = useMemo(() => allGroups.filter((g) => g.role !== 'owner'), [allGroups]);

  const ownedEmpty = myOwnerGroups.length === 0;
  const memberEmpty = myMemberGroups.length === 0;
  const allEmpty = ownedEmpty && memberEmpty;

  /* -------------------------
     Actions
  ------------------------- */
  function openGroup(g) {
    router.push({ pathname: `/(drawer)/groups/${encodeURIComponent(String(g.id))}`, params: { initial: JSON.stringify(g) } });
  }

  async function activateParticipation(groupId, { switchMode = false } = {}) {
    if (!user?.uid || !groupId) return;
    setActivatingGroupId(groupId);
    try {
      await setMembershipParticipationService({
        groupId,
        participation: PARTICIPATION.ACTIVE,
      });
      Alert.alert(
        i18n.t('groups.participation.activateSuccessTitle', {
          defaultValue: 'Participation activée',
        }),
        switchMode
          ? i18n.t('groups.participation.switchSuccessMessage', {
              defaultValue: 'Tu participes maintenant aux défis de ce groupe.',
            })
          : i18n.t('groups.participation.activateSuccessMessage', {
              defaultValue: 'Tu peux à nouveau jouer les défis de ce groupe.',
            })
      );
    } catch (e) {
      const code = String(e?.code || e?.message || e || '').toLowerCase();
      const details = e?.details || {};
      if (code.includes('active_group_limit_reached')) {
        Alert.alert(
          i18n.t('groups.participation.activateLimitTitle', {
            defaultValue: 'Limite atteinte',
          }),
          i18n.t('groups.participation.activateLimitMessage', {
            defaultValue:
              'Ton forfait {{tier}} permet {{max}} groupe(s) actif(s). Passe à un forfait supérieur ou désactive un autre groupe.',
            tier: String(details.tier || planUsage.tier || 'free').toUpperCase(),
            max: details.max ?? planUsage.limits.activeGroupsLimit,
          })
        );
      } else {
        Alert.alert(
          i18n.t('groups.alertErrorTitle', { defaultValue: 'Erreur' }),
          String(e?.message || e)
        );
      }
    } finally {
      setActivatingGroupId(null);
    }
  }

  async function toggleFavorite(gid) {
    if (!user?.uid) return;
    const w = fw();

    try {
      const snap = await readParticipant(user.uid);
      const exists = snapshotExists(snap);
      const data = exists ? snapshotData(snap, {}) : {};

      const current = data?.favoriteGroupId || null;

      if (current === gid) {
        // UNFAVORITE
        try {
          await updParticipant(user.uid, {
            favoriteGroupId: w.deleteField(),
            favoriteGroupAt: w.deleteField(),
            updatedAt: w.serverTimestamp(),
          });
        } catch (e) {
          const msg = String(e?.message || e).toLowerCase();
          if (msg.includes('no document to update')) {
            await setParticipant(user.uid, { updatedAt: w.serverTimestamp() }, true);
            await updParticipant(user.uid, {
              favoriteGroupId: w.deleteField(),
              favoriteGroupAt: w.deleteField(),
              updatedAt: w.serverTimestamp(),
            });
          } else {
            throw e;
          }
        }
        setFavoriteGroupId(null);
        return;
      }

      // SET FAVORITE
      await setParticipant(
        user.uid,
        {
          favoriteGroupId: gid,
          favoriteGroupAt: w.serverTimestamp(),
          updatedAt: w.serverTimestamp(),
        },
        true
      );

      setFavoriteGroupId(gid);
    } catch (e) {
      console.log('toggleFavorite error:', e);
      Alert.alert(
        i18n.t('groups.alertFavoriteTitle'),
        `${i18n.t('groups.alertFavoriteMessage')} ${String(e?.message || e)}`
      );
    }
  }

  /* -------------------------
     UI
  ------------------------- */
  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          gap: 12,
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.text }}>
          {i18n.t('groups.loginToSeeGroups')}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(auth)/auth-choice')}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>
            {i18n.t('groups.login')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLoading = loadingGroups || loadingFavorite;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={openCreateGroup}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              {i18n.t('groups.btnCreate')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/groups/join')}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: '600', color: colors.primary }}>
              {i18n.t('groups.btnJoin')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bandeau bienvenue */}
      {allEmpty && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {i18n.t('groups.welcomeTitle')}
          </Text>
          <Text style={{ color: colors.subtext, marginTop: 4 }}>
            {i18n.t('groups.welcomeText')}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 8, color: colors.subtext }}>
            {i18n.t('groups.loading')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={[
            {
              header: true,
              title: i18n.t('groups.headerMine'),
              subtitle: ownedEmpty ? i18n.t('groups.headerMineEmpty') : null,
            },
            ...myOwnerGroups,
            {
              header: true,
              title: i18n.t('groups.headerMember'),
              subtitle: memberEmpty ? i18n.t('groups.headerMemberEmpty') : null,
            },
            ...myMemberGroups,
          ]}
          keyExtractor={(item, idx) => (item.header ? `h-${idx}` : String(item.id))}
          renderItem={({ item }) =>
            item.header ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: '700', color: colors.text }}
                >
                  {item.title}
                </Text>
                {!!item.subtitle && (
                  <Text
                    style={{
                      marginTop: 2,
                      fontStyle: 'italic',
                      color: colors.subtext,
                    }}
                  >
                    {item.subtitle}
                  </Text>
                )}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => openGroup(item)}
                style={[
                  { marginHorizontal: 16, marginVertical: 6, position: "relative" },
                  cardShadow(),
                  prophetikCardStyle(colors),
                ]}
              >
                {/* Favori */}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.id);
                  }}
                  hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={favoriteGroupId === item.id ? 'star' : 'star-outline'}
                    size={22}
                    color={favoriteGroupId === item.id ? colors.primary : colors.subtext}
                  />
                </TouchableOpacity>

                <View
                  style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 28 }}
                >
                  <GroupAvatar
                    group={item}
                    size={40}
                    colors={colors}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: colors.text,
                      }}
                    >
                      {item.name || item.id}
                    </Text>
                    {!!item.description && (
                      <Text
                        style={{ marginTop: 2, color: colors.subtext }}
                        numberOfLines={1}
                      >
                        {item.description}
                      </Text>
                    )}

                    <Text style={{ marginTop: 4, color: colors.subtext, fontSize: 12, fontWeight: '800' }}>
                      {(item.sport || 'NHL').toUpperCase() === 'MLB' ? '⚾ MLB' : '🏒 NHL'}
                    </Text>

                    {item.role === 'owner' ? (
                      <GroupAutopilotModeBadge
                        autopilotEnabled={item.autopilotEnabled}
                        colors={colors}
                      />
                    ) : null}

                    <View style={{ marginTop: 6 }}>
                      <Text style={{ color: colors.subtext, fontSize: 12 }}>
                        {i18n.t('groups.participation.label', {
                          defaultValue: 'Participation aux défis',
                        })}
                        {': '}
                        <Text
                          style={{
                            fontWeight: '800',
                            color: item.canParticipateInChallenges
                              ? colors.primary
                              : colors.subtext,
                          }}
                        >
                          {item.canParticipateInChallenges
                            ? i18n.t('groups.participation.enabled', {
                                defaultValue: 'activée',
                              })
                            : i18n.t('groups.participation.disabled', {
                                defaultValue: 'désactivée',
                              })}
                        </Text>
                      </Text>
                      {!item.canParticipateInChallenges ? (
                        (() => {
                          const slotsAvailable =
                            planUsage.usage.activeParticipationsCount <
                            planUsage.limits.activeGroupsLimit;
                          const canActivate = slotsAvailable;
                          const canSwitch =
                            !slotsAvailable && planUsage.limits.activeGroupsLimit <= 1;
                          const isActivating = activatingGroupId === item.id;

                          if (canActivate || canSwitch) {
                            return (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  activateParticipation(item.id, { switchMode: canSwitch });
                                }}
                                disabled={isActivating}
                                hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
                              >
                                <Text
                                  style={{
                                    color: colors.primary,
                                    fontSize: 12,
                                    fontWeight: '700',
                                    marginTop: 2,
                                    opacity: isActivating ? 0.6 : 1,
                                  }}
                                >
                                  {isActivating
                                    ? i18n.t('groups.participation.activating', {
                                        defaultValue: 'Activation…',
                                      })
                                    : canSwitch
                                      ? i18n.t('groups.participation.switchGroup', {
                                          defaultValue: 'Jouer dans ce groupe',
                                        })
                                      : i18n.t('groups.participation.activate', {
                                          defaultValue: 'Activer la participation',
                                        })}
                                </Text>
                              </TouchableOpacity>
                            );
                          }

                          return (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                router.push('/(drawer)/subscriptions');
                              }}
                              hitSlop={{ top: 6, left: 6, right: 6, bottom: 6 }}
                            >
                              <Text
                                style={{
                                  color: colors.primary,
                                  fontSize: 12,
                                  fontWeight: '700',
                                  marginTop: 2,
                                }}
                              >
                                {item.participation === PARTICIPATION.ADMIN_ONLY
                                  ? i18n.t('groups.participation.managePlanAdmin', {
                                      defaultValue: 'Activer la participation → Forfaits',
                                    })
                                  : i18n.t('groups.participation.managePlan', {
                                      defaultValue: 'Gérer mon forfait →',
                                    })}
                              </Text>
                            </TouchableOpacity>
                          );
                        })()
                      ) : null}
                    </View>
                  </View>
                </View>



                <View
                  style={{
                    marginTop: 8,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.subtext }}>
                    {i18n.t('groups.invitationCode')}: {item.codeInvitation || '—'}
                  </Text>
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {item.role === 'owner'
                      ? i18n.t('groups.roleOwner')
                      : i18n.t('groups.roleMember')}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          }
          ListEmptyComponent={() => (
            <View
              style={{
                alignItems: 'center',
                marginTop: 48,
                paddingHorizontal: 24,
              }}
            >
              <Image
                source={require('@src/assets/group-placeholder.png')}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  opacity: 0.9,
                  marginBottom: 14,
                  backgroundColor: colors.card,
                }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  textAlign: 'center',
                  color: colors.text,
                }}
              >
                {i18n.t('groups.emptyTitle')}
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  color: colors.subtext,
                  textAlign: 'center',
                }}
              >
                {i18n.t('groups.emptyText')}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={openCreateGroup}
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{ color: 'white', fontWeight: '700' }}
                  >
                    {i18n.t('groups.emptyCreate')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/groups/join')}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{ fontWeight: '700', color: colors.primary }}
                  >
                    {i18n.t('groups.emptyJoin')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: colors.subtext,
                }}
              >
                {i18n.t('groups.emptyHint')}
              </Text>
            </View>
          )}
        />
      )}

    </View>
  );
}