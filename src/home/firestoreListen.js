// src/home/firestoreListen.js
export function listenRNFB(refOrQuery, onNext, tag, onError) {
  return refOrQuery.onSnapshot(
    onNext,
    (e) => {
      console.log(`[FS:${tag}]`, e?.code, e?.message);
      onError?.(e);
    }
  );
}