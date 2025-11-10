// app/defis/[defiId]/FinalRevealModal.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ===== Simple AnimatedNumber (entier) =====
function useCountUp(duration = 800) {
  const v = useSharedValue(0);
  const [num, setNum] = useState(0);
  useEffect(() => {
    let id = null;
    // “subscribe” value → state
    const raf = () => { setNum(Math.round(v.value)); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => id && cancelAnimationFrame(id);
  }, []);
  const to = (target, d = duration) => { v.value = withTiming(target, { duration: d, easing: Easing.out(Easing.cubic) }); };
  const reset = () => { v.value = 0; };
  return { num, to, reset };
}

function Row({ i, finalist, avatarUri, active, phase }) {
  // phase: 0=idle, 1=goals, 2=assists, 3=points(reveal)
  const goals = useCountUp(700);
  const assists = useCountUp(700);
  const points = useCountUp(900);

  // lance/avance suivant phase
  useEffect(() => {
    if (phase >= 1) goals.to(finalist.goals ?? 0);
    if (phase >= 2) assists.to(finalist.assists ?? 0);
    if (phase >= 3) points.to((finalist.goals ?? 0) + (finalist.assists ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: active ? '#FFFBEB' : '#FFFFFF',
        borderWidth: 1,
        borderColor: active ? '#F59E0B' : '#E5E7EB',
        marginBottom: 10,
      }}
    >
      <View style={{
        width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? '#F59E0B' : '#D1D5DB', marginRight: 10
      }}>
        <Text style={{ color: '#fff', fontWeight: '900' }}>{i + 1}</Text>
      </View>
      <Image
        source={avatarUri ? { uri: avatarUri } : require('@src/assets/avatar-placeholder.png')}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontWeight: '800' }}>
          {finalist.displayName || finalist.uid}
        </Text>
        <Text style={{ color: '#6B7280', fontSize: 12 }}>Buts – Passes = Points</Text>
      </View>

      {/* Scores live */}
      <View style={{ width: 120, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ width: 28, textAlign: 'center', fontWeight: '800' }}>{goals.num}</Text>
        <Text style={{ width: 28, textAlign: 'center', fontWeight: '800' }}>{assists.num}</Text>
        <Text style={{ width: 36, textAlign: 'center', fontWeight: '900' }}>{points.num}</Text>
      </View>
    </View>
  );
}

/**
 * finalists: [{ uid, displayName, avatarUrl, goals, assists, points }]
 * pot: nombre de crédits dans la cagnotte (ex: 25)
 * visible: bool
 * currentUid: uid viewer
 * onClose: () => void
 * celebrate: (winnerUid) => void  (callback pour lancer WinnerSurprise déjà codé)
 * creditDelta: nombre à afficher (+X crédits)
 * currentCredits: crédits actuels du user (pour animer l’affichage local)
 * splitRule: "winner_takes_all" | "split_ties"
 */
export default function FinalRevealModal({
  finalists = [],
  pot = 0,
  visible,
  currentUid,
  onClose,
  celebrate,
  creditDelta = 0,
  currentCredits = null,
  splitRule = 'winner_takes_all',
}) {
  const [phase, setPhase] = useState(0);      // 0 idle, 1 goals, 2 assists, 3 points(reveal), 4 pot
  const [order, setOrder] = useState([]);     // randomized order of finalists (length 3)
  const [winnerUids, setWinnerUids] = useState([]);
  const [creditsAnim, setCreditsAnim] = useState(null); // {from, to, now}

  // randomize top3 (protect if less than 3)
  const top3 = useMemo(() => {
    const copy = [...finalists].sort((a,b)=> (b.points??0)-(a.points??0)).slice(0,3);
    return copy;
  }, [finalists]);

  useEffect(() => {
    if (!visible) return;
    // shuffle
    const idxs = top3.map((_,i)=>i);
    for (let i=idxs.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [idxs[i],idxs[j]]=[idxs[j],idxs[i]]; }
    setOrder(idxs);
    setPhase(0);
    setWinnerUids([]);
    setCreditsAnim(null);

    // séquence
    let t1, t2, t3, t4;
    // petit suspense de départ
    t1 = setTimeout(async () => {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      setPhase(1); // Goals
    }, 450);
    t2 = setTimeout(async () => {
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      setPhase(2); // Assists
    }, 450 + 1200);
    t3 = setTimeout(async () => {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setPhase(3); // Points (reveal)
      // compute winners
      const sorted = [...top3].sort((a,b)=> (b.points??0)-(a.points??0));
      const best = sorted[0]?.points ?? 0;
      const winners = sorted.filter(x => (x.points ?? 0) === best).map(x => x.uid);
      setWinnerUids(winners);

      if (winners.includes(currentUid)) {
        celebrate?.(currentUid); // lance confettis/couronne via callback parent (WinnerSurprise)
      }
    }, 450 + 1200 + 1300);
    t4 = setTimeout(() => {
      setPhase(4); // pot/credits
      if (typeof currentCredits === 'number' && creditDelta > 0) {
        const from = currentCredits;
        const to = currentCredits + creditDelta;
        setCreditsAnim({ from, to, now: from });
        // petit count-up local
        let steps = 24, c = 0;
        const step = Math.max(1, Math.round((to - from)/steps));
        const id = setInterval(() => {
          c++;
          setCreditsAnim(s => {
            if (!s) return s;
            const nxt = Math.min(to, s.now + step);
            return { ...s, now: nxt };
          });
          if (c >= steps) clearInterval(id);
        }, 30);
      }
    }, 450 + 1200 + 1300 + 900);

    return () => {
      [t1,t2,t3,t4].forEach(t => t && clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const rows = order.map(i => top3[i]).filter(Boolean);
  const leaderUid = useMemo(() => {
    const best = Math.max(...top3.map(x => x.points ?? 0));
    const bestRow = rows.find(r => (r.points ?? 0) === best);
    return bestRow?.uid;
  }, [rows, top3]);

  const youWon = winnerUids.includes(currentUid);
  const awardText = youWon
    ? (creditDelta > 0 ? `+${creditDelta} crédits` : '🎉 Champion !')
    : (winnerUids.length > 1 ? 'Égalité en tête' : 'Résultats');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' }}>
        <View style={{
          backgroundColor:'#fff',
          borderTopLeftRadius:18,
          borderTopRightRadius:18,
          padding:16,
          paddingBottom: 12 + 8,
          shadowColor:'#000', shadowOpacity:0.15, shadowRadius:12, elevation:12,
          maxHeight:'88%'
        }}>
          <View style={{ alignItems:'center', marginBottom: 8 }}>
            <View style={{ width:44, height:4, backgroundColor:'#E5E7EB', borderRadius:2, marginBottom:8 }} />
            <Text style={{ fontWeight:'900', fontSize:18 }}>Finale — Dévoilement</Text>
            <Text style={{ color:'#6B7280', marginTop:4 }}>Buts → Passes → Points</Text>
          </View>

          {/* Lignes finalistes */}
          <View style={{ marginTop: 8 }}>
            {rows.map((f, idx) => {
              const active = phase >= 3 && f.uid === leaderUid;
              return (
                <Row
                  key={f.uid}
                  i={idx}
                  finalist={f}
                  avatarUri={f.avatarUrl}
                  active={active}
                  phase={phase}
                />
              );
            })}
          </View>

          {/* Bandeau gagnant + cagnotte */}
          <View style={{
            marginTop: 6, marginBottom: 10, padding: 12, borderRadius: 12,
            backgroundColor: '#0EA5E9'
          }}>
            <Text style={{ color:'#fff', fontWeight:'900', textAlign:'center' }}>
              {phase < 3 ? 'Suspense…' :
               (youWon ? '🥇 Tu remportes le défi !' :
                (winnerUids.length > 1 ? '🥇 Égalité au sommet' : '🥇 Et le gagnant est…'))}
            </Text>
            {phase >= 4 && (
              <Text style={{ color:'#E0F2FE', marginTop: 4, textAlign:'center' }}>
                {youWon ? `Cagnotte: ${pot} crédits • ${awardText}` : `Cagnotte totale: ${pot} crédits`}
              </Text>
            )}
          </View>

          {/* Affichage crédits côté client (visuel) */}
          {phase >= 4 && typeof currentCredits === 'number' && (
            <View style={{ alignItems:'center', marginBottom: 10 }}>
              <Text style={{ color:'#374151' }}>
                Tes crédits: {creditsAnim ? Math.round(creditsAnim.now) : currentCredits}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={{ flexDirection:'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex:1, paddingVertical:12, borderRadius:12, borderWidth:1, borderColor:'#111', alignItems:'center' }}
            >
              <Text style={{ fontWeight:'800' }}>Fermer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex:1, paddingVertical:12, borderRadius:12, alignItems:'center', backgroundColor:'#111' }}
            >
              <Text style={{ color:'#fff', fontWeight:'800' }}>
                Continuer
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: Platform.OS === 'ios' ? 6 : 0 }} />
        </View>
      </View>
    </Modal>
  );
}