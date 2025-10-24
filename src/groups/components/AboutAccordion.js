import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function AboutAccordion({ title = 'À propos', rows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ borderWidth:1, borderColor:'#eee', borderRadius:12, backgroundColor:'#fafafa' }}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={{ padding:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
        <Text style={{ fontWeight:'700' }}>{title}</Text>
        <Text>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ paddingHorizontal:12, paddingBottom:12 }}>
          {rows
            .filter(([_, v]) => v != null && v !== '')
            .map(([k, v]) => (
              <View key={k} style={{ flexDirection:'row', marginTop:6 }}>
                <Text style={{ width:130, fontWeight:'600' }}>{k}</Text>
                <Text style={{ flex:1 }}>{v}</Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}