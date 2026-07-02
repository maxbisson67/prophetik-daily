/**
 * Chemin Firestore canonique pour la KB Nova.
 * Structure: nova_knowledge/_meta/articles/{articleId}
 * (articleId = champ `key` de la fiche)
 */
export const NOVA_KB_META_DOC = "_meta";

export function novaArticlesCollection(db) {
  return db.collection("nova_knowledge").doc(NOVA_KB_META_DOC).collection("articles");
}
