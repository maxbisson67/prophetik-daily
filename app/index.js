// app/index.js
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@src/auth/AuthProvider';

export default function Index() {
  const router = useRouter();
  const { user, booting } = useAuth(); // ne crashe plus si Provider OK

  useEffect(() => {
    if (booting) return;
    if (user) {
      router.replace('/(tabs)/GroupsScreen');
    } else {
      router.replace('/(auth)/sign-up'); // ou '/(auth)/sign-in'
    }
  }, [booting, user]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator />
    </View>
  );
}