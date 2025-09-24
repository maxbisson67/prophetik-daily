import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

export default function GroupLobby() {
  const { groupId } = useLocalSearchParams();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Groupe: {groupId}</Text>
      <Text style={{ marginTop: 8 }}>Écran lobby à venir…</Text>
    </View>
  );
}