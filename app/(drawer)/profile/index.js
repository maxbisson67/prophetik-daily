// app/profile/index.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Stack, useRouter } from 'expo-router';

// 🔁 RN Firebase Firestore
import firestore from '@react-native-firebase/firestore';

// Auth web (tu peux garder ton provider actuel)
import { signInAnonymously, updateProfile } from 'firebase/auth';

// Safe auth
import { useAuth } from '@src/auth/SafeAuthProvider';

// crédits
import CreditsWallet from '@src/credits/CreditsWallet';
import { useCredits } from '@src/credits/useCredits';

// Si tu utilises encore auth web dans ton SafeAuthProvider :
import { auth } from '@src/lib/firebase';

// Thème
import { useTheme } from '@src/theme/ThemeProvider';

// i18n (singleton)
import i18n from '@src/i18n/i18n';

export default function ProfileScreen() {
  const { user, authReady, signOut } = useAuth();
  const router = useRouter();
  const { loading: creditsLoading, topUpFree } = useCredits();
  const { colors } = useTheme();

  const isDark = colors.background === '#111827';

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [busy, setBusy] = useState(false);
  const [participant, setParticipant] = useState(null);

  const [participantLoaded, setParticipantLoaded] = useState(false);
  const didPatchOnboardingRef = useRef(false);

  // --- sync visuel sur changement d'UID
  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setPhotoURL(user?.photoURL ?? null);
  }, [user?.uid]);

  // --- fetch participant (RNFirebase)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setParticipantLoaded(false);

      if (!user?.uid) {
        setParticipant(null);
        setParticipantLoaded(true);
        return;
      }

      try {
        const snap = await firestore().doc(`participants/${user.uid}`).get();
        if (cancelled) return;

        if (snap.exists) {
          const p = snap.data() || {};
          setDisplayName(p?.displayName || user.displayName || '');
          setPhotoURL(p?.photoURL ?? p?.avatarUrl ?? user.photoURL ?? null);
          setParticipant({ id: snap.id, ...p });
        } else {
          setParticipant(null);
        }
      } finally {
        if (!cancelled) setParticipantLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const needsOnboardingFlag =
    !!user?.uid &&
    participantLoaded &&
    (!participant?.onboarding ||
      typeof participant?.onboarding?.welcomeSeen !== 'boolean');

  // --- patch onboarding (une seule fois)
  useEffect(() => {
    if (!user?.uid) return;
    if (!participantLoaded) return;
    if (!needsOnboardingFlag) return;
    if (didPatchOnboardingRef.current) return;

    didPatchOnboardingRef.current = true;

    firestore()
      .doc(`participants/${user.uid}`)
      .set({ onboarding: { welcomeSeen: false } }, { merge: true })
      .then(() => {
        setParticipant((prev) =>
          prev
            ? {
                ...prev,
                onboarding: {
                  ...(prev?.onboarding || {}),
                  welcomeSeen: false,
                },
              }
            : prev
        );
      })
      .catch(() => {});
  }, [user?.uid, participantLoaded, needsOnboardingFlag]);

  // --- helpers
  const ensureParticipantDoc = async (u) => {
    const ref = firestore().doc(`participants/${u.uid}`);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set(
        {
          displayName: u.displayName || null,
          email: u.email || null,
          photoURL: u.photoURL || null,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          credits: { balance: 0 },
          betaEligible: true,
          onboarding: { welcomeSeen: false },
        },
        { merge: true }
      );

      router.replace('/onboarding/welcome');
    }
  };

  const onSignIn = async () => {
    try {
      setBusy(true);

      const res = await signInAnonymously(auth);
      await ensureParticipantDoc(res.user);

      Alert.alert(
        i18n.t('profile.alert.connectedTitle', { defaultValue: 'Connected' }),
        i18n.t('profile.alert.connectedBody', { defaultValue: 'Welcome!' })
      );
    } catch (e) {
      Alert.alert(
        i18n.t('profile.alert.signInFailTitle', { defaultValue: 'Unable to sign in' }),
        String(e?.message || e)
      );
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    try {
      setBusy(true);
      await signOut();

      Alert.alert(
        i18n.t('profile.alert.signedOutTitle', { defaultValue: 'Signed out' })
      );
    } catch (e) {
      Alert.alert(
        i18n.t('profile.alert.signOutFailTitle', { defaultValue: 'Unable to sign out' }),
        String(e?.message || e)
      );
    } finally {
      setBusy(false);
    }
  };

  // === SAUVEGARDE (FireStore RNFirebase) ===
  const saveProfile = async () => {
    if (!user?.uid) {
      Alert.alert(
        i18n.t('profile.alert.notLoggedTitle', { defaultValue: 'Not logged in' }),
        i18n.t('profile.alert.notLoggedBody', { defaultValue: 'Please sign in first.' })
      );
      return;
    }

    try {
      setBusy(true);

      const newPhotoURL =
        photoURL ??
        participant?.photoURL ??
        participant?.avatarUrl ??
        user?.photoURL ??
        null;

      const isFirstSave = !participant;

      // MAJ profil auth
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: displayName || null,
          photoURL: newPhotoURL || null,
        });
      }

      const ref = firestore().doc(`participants/${user.uid}`);

      if (isFirstSave) {
        await ref.set(
          {
            displayName: displayName || null,
            email: user.email || null,
            credits: { balance: 0 },
            betaEligible: true,
            createdAt: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
            onboarding: { welcomeSeen: false },
            ...(newPhotoURL ? { photoURL: newPhotoURL, avatarUrl: newPhotoURL } : {}),
          },
          { merge: true }
        );

        router.replace('/onboarding/welcome');
        return;
      }

      const updatePayload = {
        displayName: displayName || null,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (newPhotoURL) {
        updatePayload.photoURL = newPhotoURL;
        updatePayload.avatarUrl = newPhotoURL;
      }

      await ref.update(updatePayload);

      if (needsOnboardingFlag && !didPatchOnboardingRef.current) {
        await ref.set({ onboarding: { welcomeSeen: false } }, { merge: true });
        didPatchOnboardingRef.current = true;
      }

      Alert.alert(
        i18n.t('profile.alert.savedTitle', { defaultValue: 'Profile updated' })
      );
    } catch (e) {
      Alert.alert(
        i18n.t('profile.alert.saveFailTitle', { defaultValue: 'Save failed' }),
        String(e?.message || e)
      );
    } finally {
      setBusy(false);
    }
  };

  if (!authReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 8 }}>
          {i18n.t('common.initializing', { defaultValue: 'Initializing…' })}
        </Text>
      </View>
    );
  }

  const creditsValue =
    typeof participant?.credits === 'number'
      ? participant.credits
      : typeof participant?.credits?.balance === 'number'
      ? participant.credits.balance
      : typeof participant?.balance === 'number'
      ? participant.balance
      : 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: i18n.t('profile.title', { defaultValue: 'Profile' }),
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.text,
        }}
      />

      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          paddingBottom: 80,
          backgroundColor: colors.background,
        }}
        enableOnAndroid
        enableAutomaticScroll
        extraScrollHeight={100}
        keyboardOpeningTime={0}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="always"
      >
        {/* Solde de crédits */}
        <CreditsWallet credits={creditsValue} />

        {/* Carte profil */}
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            elevation: 3,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            gap: 16,
          }}
        >
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Image
              source={
                photoURL
                  ? { uri: photoURL }
                  : require('@src/assets/avatar-placeholder.png')
              }
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.card2 || '#1f2937',
              }}
            />

            <TouchableOpacity
              onPress={() => router.push('/avatars/AvatarsScreen')}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: '#ef4444',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {i18n.t('profile.chooseAvatarCta', { defaultValue: '🎨 Choose an avatar' })}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontWeight: '600', color: colors.text }}>
              {i18n.t('profile.displayNameLabel', { defaultValue: 'Display name' })}
            </Text>

            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={i18n.t('profile.displayNamePlaceholder', { defaultValue: 'Your name' })}
              placeholderTextColor={colors.subtext}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: colors.card2 || colors.background,
              }}
            />
          </View>
        </View>

        {busy ? <ActivityIndicator color={colors.primary} /> : null}

        {user ? (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={saveProfile}
              style={{
                backgroundColor: '#111827',
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {i18n.t('profile.save', { defaultValue: 'Save' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSignOut}
              style={{
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                backgroundColor: isDark ? '#450a0a' : '#fff5f5',
                borderColor: isDark ? '#fecaca' : '#ffd6d6',
              }}
            >
              <Text
                style={{
                  color: isDark ? '#fecaca' : '#b00020',
                  fontWeight: '600',
                }}
              >
                {i18n.t('profile.signOut', { defaultValue: 'Sign out' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onSignIn}
            style={{
              backgroundColor: '#111827',
              padding: 14,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              {i18n.t('auth.login', { defaultValue: 'Log in' })}
            </Text>
          </TouchableOpacity>
        )}

        {user && !creditsLoading && creditsValue < 5 ? (
          <TouchableOpacity
            onPress={async () => {
              try {
                const res = await topUpFree();
                Alert.alert(
                  i18n.t('profile.topup.title', { defaultValue: 'Top-up' }),
                  i18n.t('profile.topup.body', {
                    defaultValue: 'New balance: {{credits}}',
                    credits: Number(res?.credits ?? 0),
                  })
                );
              } catch (e) {
                Alert.alert(
                  i18n.t('profile.topup.failTitle', { defaultValue: 'Top-up failed' }),
                  String(e?.message || e)
                );
              }
            }}
            style={{
              marginTop: 8,
              backgroundColor: '#111827',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              {i18n.t('profile.topup.betaCta', { defaultValue: '+25 free (beta)' })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </KeyboardAwareScrollView>
    </>
  );
}