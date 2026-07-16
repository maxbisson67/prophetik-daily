import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@src/auth/SafeAuthProvider";
import i18n from "@src/i18n/i18n";
import { deleteAccountCallable } from "@src/account/deleteAccountService";
import { unregisterDeviceToken } from "@src/lib/push/registerFcmToken";

export default function useDeleteAccount() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const runDeleteAccount = useCallback(async () => {
    if (!user?.uid || deleting) return;

    setDeleting(true);
    try {
      try {
        await unregisterDeviceToken(user.uid);
      } catch {}

      await deleteAccountCallable();
      await signOut().catch(() => {});
      router.replace("/(auth)/auth-choice");
    } catch (e) {
      Alert.alert(
        i18n.t("settings.deleteAccount.errorTitle", { defaultValue: "Suppression impossible" }),
        String(e?.message || e)
      );
    } finally {
      setDeleting(false);
    }
  }, [user?.uid, deleting, signOut, router]);

  const confirmDeleteAccount = useCallback(() => {
    if (!user?.uid || deleting) return;

    Alert.alert(
      i18n.t("settings.deleteAccount.confirmTitle", { defaultValue: "Supprimer ton compte ?" }),
      i18n.t("settings.deleteAccount.confirmBody", {
        defaultValue:
          "Cette action est définitive. Ton profil, tes préférences et tes données personnelles seront supprimés. Tes participations aux défis peuvent être anonymisées pour préserver les résultats des groupes.",
      }),
      [
        { text: i18n.t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
        {
          text: i18n.t("settings.deleteAccount.confirmCta", { defaultValue: "Supprimer" }),
          style: "destructive",
          onPress: () => {
            Alert.alert(
              i18n.t("settings.deleteAccount.finalTitle", { defaultValue: "Confirmation finale" }),
              i18n.t("settings.deleteAccount.finalBody", {
                defaultValue: "Veux-tu vraiment supprimer définitivement ton compte Prophetik ?",
              }),
              [
                { text: i18n.t("common.cancel", { defaultValue: "Annuler" }), style: "cancel" },
                {
                  text: i18n.t("settings.deleteAccount.finalCta", { defaultValue: "Oui, supprimer" }),
                  style: "destructive",
                  onPress: runDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  }, [user?.uid, deleting, runDeleteAccount]);

  return { deleting, confirmDeleteAccount };
}
