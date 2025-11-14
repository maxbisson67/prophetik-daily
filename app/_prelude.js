// app/_prelude.js
import { LogBox } from "react-native";

LogBox.ignoreLogs([
  /React Native Firebase namespaced API/,
  /migrating-to-v22/,
  /Method called was/,
  /Please use `getApp$begin:math:text$$end:math:text$` instead/,
]);

const IGNORES = [
  /React Native Firebase namespaced API/,
  /migrating-to-v22/,
  /Method called was/,
  /Please use `getApp$begin:math:text$$end:math:text$` instead/,
];

const _warn = console.warn;
console.warn = (...args) => {
  const msg = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  if (IGNORES.some(re => re.test(msg))) return;
  _warn(...args);
}; 