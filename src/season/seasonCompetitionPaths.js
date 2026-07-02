import firestore from "@react-native-firebase/firestore";

/** Collection Firestore du catalogue de compétitions (racine). */
export const SEASON_COMPETITIONS_COLLECTION = "seasonCompetitions";

export const CURRENT_SEASON_DOC = "app_config/currentSeason";

export function seasonCompetitionCollection() {
  return firestore().collection(SEASON_COMPETITIONS_COLLECTION);
}

export function currentSeasonDocRef() {
  return firestore().doc(CURRENT_SEASON_DOC);
}
