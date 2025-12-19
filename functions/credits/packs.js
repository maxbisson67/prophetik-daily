// functions/credits/packs.js

export const PACKS = {
  credits_25:  { credits: 25,  bonus: 0 },
  credits_75: { credits: 75, bonus: 5 },
  credits_150: { credits: 150, bonus: 10 },
};

export function isValidPackKey(packKey) {
  return !!PACKS[String(packKey || "")];
}

export function getPack(packKey) {
  return PACKS[String(packKey || "")] || null;
}