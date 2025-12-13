// app/(auth)/SignUpScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import RNFBAuth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// i18n
import i18n from '@src/i18n/i18n';

// Création / mise à jour du participant (côté client, sans toucher credits/balance)
async function ensureParticipantDoc(displayName) {
  const user = RNFBAuth().currentUser;
  if (!user) {
    throw new Error(
      i18n.t('auth.signup.errors.notAuthenticated', {
        defaultValue: 'User is not authenticated.',
      })
    );
  }

  const uid = user.uid;
  const now = firestore.FieldValue.serverTimestamp();

  // Évite les "Unsupported field value undefined"
  const data = {
    displayName: (displayName ?? user.displayName ?? null) || null,
    email: user.email ?? null,
    phoneNumber: user.phoneNumber ?? null,
    photoURL: user.photoURL ?? null,
    betaEligible: true,
    updatedAt: now,
  };

  // createdAt seulement à la création
  await firestore()
    .collection('participants')
    .doc(uid)
    .set({ ...data, createdAt: now }, { merge: true });
}

export default function SignUpScreen() {
  const r = useRouter();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const onSignUp = async () => {
    try {
      if (!displayName.trim() || !email.trim() || !pwd || !pwd2) {
        Alert.alert(
          i18n.t('auth.signup.errors.requiredTitle', {
            defaultValue: 'Required fields',
          }),
          i18n.t('auth.signup.errors.requiredBody', {
            defaultValue: 'Name, email, and password are required.',
          })
        );
        return;
      }

      if (pwd.length < 6) {
        Alert.alert(
          i18n.t('auth.signup.errors.passwordTooShortTitle', {
            defaultValue: 'Password too short',
          }),
          i18n.t('auth.signup.errors.passwordTooShortBody', {
            defaultValue: 'Minimum 6 characters.',
          })
        );
        return;
      }

      if (pwd !== pwd2) {
        Alert.alert(
          i18n.t('auth.signup.errors.passwordMismatchTitle', {
            defaultValue: 'Mismatch',
          }),
          i18n.t('auth.signup.errors.passwordMismatchBody', {
            defaultValue: 'Passwords do not match.',
          })
        );
        return;
      }

      setBusy(true);

      // 1) Création du compte (RNFirebase)
      await RNFBAuth().createUserWithEmailAndPassword(email.trim(), pwd);

      // 2) Update profil Auth (displayName)
      const user = RNFBAuth().currentUser;
      await user?.updateProfile({ displayName: displayName.trim() });
      await user?.reload().catch(() => {}); // parfois nécessaire sous Android

      // 3) participants/{uid}
      await ensureParticipantDoc(displayName.trim());

      Alert.alert(
        i18n.t('auth.signup.success.title', {
          defaultValue: 'Account created',
        }),
        i18n.t('auth.signup.success.body', {
          defaultValue: 'Welcome!',
        })
      );

      r.replace('/(drawer)/(tabs)/AccueilScreen');
    } catch (e) {
      const msg = String(e?.message || e);

      // Map erreurs Firebase fréquentes
      const failedTitle = i18n.t('auth.signup.errors.failedTitle', {
        defaultValue: 'Sign up failed',
      });

      if (msg.includes('email-already-in-use')) {
        Alert.alert(
          failedTitle,
          i18n.t('auth.signup.errors.emailAlreadyInUse', {
            defaultValue: 'This email is already in use.',
          })
        );
      } else if (msg.includes('invalid-email')) {
        Alert.alert(
          failedTitle,
          i18n.t('auth.signup.errors.invalidEmail', {
            defaultValue: 'The email format is invalid.',
          })
        );
      } else if (msg.toLowerCase().includes('network')) {
        Alert.alert(
          failedTitle,
          i18n.t('auth.signup.errors.network', {
            defaultValue: 'Network error. Please try again.',
          })
        );
      } else {
        Alert.alert(failedTitle, msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        {i18n.t('auth.signup.title', { defaultValue: 'Create an account' })}
      </Text>

      {/* Nom */}
      <View style={{ gap: 6 }}>
        <Text>
          {i18n.t('auth.signup.displayNameLabel', {
            defaultValue: 'Display name',
          })}
        </Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={i18n.t('auth.signup.displayNamePlaceholder', {
            defaultValue: 'Your name',
          })}
          autoCapitalize="words"
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 10,
            padding: 12,
          }}
        />
      </View>

      {/* Email */}
      <View style={{ gap: 6 }}>
        <Text>
          {i18n.t('auth.signup.emailLabel', { defaultValue: 'Email' })}
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={i18n.t('auth.signup.emailPlaceholder', {
            defaultValue: 'you@example.com',
          })}
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 10,
            padding: 12,
          }}
        />
      </View>

      {/* Password */}
      <View style={{ gap: 6 }}>
        <Text>
          {i18n.t('auth.signup.passwordLabel', { defaultValue: 'Password' })}
        </Text>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          secureTextEntry
          placeholder={i18n.t('auth.signup.passwordPlaceholder', {
            defaultValue: '••••••••',
          })}
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 10,
            padding: 12,
          }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text>
          {i18n.t('auth.signup.confirmPasswordLabel', {
            defaultValue: 'Confirm password',
          })}
        </Text>
        <TextInput
          value={pwd2}
          onChangeText={setPwd2}
          secureTextEntry
          placeholder={i18n.t('auth.signup.confirmPasswordPlaceholder', {
            defaultValue: '••••••••',
          })}
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 10,
            padding: 12,
          }}
        />
      </View>

      <TouchableOpacity
        onPress={onSignUp}
        disabled={busy}
        style={{
          backgroundColor: '#111',
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            {i18n.t('auth.signup.ctaCreateAccount', {
              defaultValue: 'Create account',
            })}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}