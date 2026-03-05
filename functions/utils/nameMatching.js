// functions/utils/nameMatching.js
import { logger } from "../utils.js";

/**
 * Normalise un nom pour la comparaison
 * - Enlève les accents
 * - Lowercase
 * - Enlève la ponctuation
 * - Normalise les espaces
 */
export function normalizeName(name) {
  if (!name) return "";
  
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD") // Décompose les caractères accentués (é -> e + ´)
    .replace(/[\u0300-\u036f]/g, "") // Enlève les accents
    .replace(/[^a-z0-9\s]/g, "") // Enlève la ponctuation
    .replace(/\s+/g, " ") // Normalise les espaces multiples
    .trim();
}

/**
 * Extrait prénom et nom de famille d'un nom complet
 * @param {string} fullName - Nom complet (ex: "Connor McDavid")
 * @returns {Object} { firstName, lastName }
 */
export function parseFullName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  
  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] };
  }
  
  // Le dernier mot est considéré comme le nom de famille
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  
  return { firstName, lastName };
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * (nombre minimum d'éditions pour transformer s1 en s2)
 */
function levenshteinDistance(s1, s2) {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = [];

  // Initialiser la matrice
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Remplir la matrice
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Suppression
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calcule un score de similarité entre deux noms (0-100)
 * 100 = match parfait
 * 0 = aucune similarité
 */
export function calculateNameSimilarity(name1, name2) {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // Cas 1: Match exact normalisé
  if (norm1 === norm2) {
    return 100;
  }
  
  // Cas 2: Un nom contient l'autre (ex: "Jack Eichel" vs "Eichel")
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 95;
  }
  
  // Cas 3: Comparaison prénom/nom séparément
  const { firstName: first1, lastName: last1 } = parseFullName(norm1);
  const { firstName: first2, lastName: last2 } = parseFullName(norm2);
  
  // Les noms de famille doivent matcher au minimum
  if (!last1 || !last2 || last1 !== last2) {
    // Si les noms de famille sont différents, score basé sur distance
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 0;
    
    const distance = levenshteinDistance(norm1, norm2);
    const similarity = Math.max(0, 100 - (distance / maxLen) * 100);
    
    return Math.round(similarity);
  }
  
  // Noms de famille identiques
  
  // Match exact prénom + nom
  if (first1 === first2) {
    return 100;
  }
  
  // Initiales du prénom correspondent
  if (first1.charAt(0) === first2.charAt(0)) {
    return 85;
  }
  
  // Un prénom est vide (ex: "Eichel" vs "Jack Eichel")
  if (!first1 || !first2) {
    return 80;
  }
  
  // Prénoms différents mais nom de famille identique
  return 70;
}

/**
 * Trouve le meilleur match pour un joueur NHL parmi les blessures SportsDB
 * @param {Object} nhlPlayer - Joueur NHL { firstName, lastName, teamAbbr, ... }
 * @param {Array} sportsDbInjuries - Liste des blessures de TheSportsDB
 * @param {number} minScore - Score minimum pour considérer un match (défaut: 80)
 * @returns {Object|null} { match, score, confidence } ou null
 */
export function findBestMatch(nhlPlayer, sportsDbInjuries, minScore = 80) {
  const nhlFullName = `${nhlPlayer.firstName || ""} ${nhlPlayer.lastName || ""}`.trim();
  const nhlTeam = nhlPlayer.teamAbbr || nhlPlayer.teamAbbrev;
  
  if (!nhlFullName) {
    return null;
  }
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const injury of sportsDbInjuries) {
    const sportsDbName = injury.strPlayer || injury.playerName || "";
    const sportsDbTeam = injury.teamAbbrev;
    
    if (!sportsDbName) continue;
    
    // Bonus si même équipe
    let teamBonus = 0;
    if (sportsDbTeam && nhlTeam && sportsDbTeam === nhlTeam) {
      teamBonus = 5;
    }
    
    // Calculer le score de similarité des noms
    const nameScore = calculateNameSimilarity(nhlFullName, sportsDbName);
    const totalScore = Math.min(100, nameScore + teamBonus);
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = injury;
    }
  }
  
  // Retourner seulement si le score est suffisant
  if (bestScore >= minScore) {
    // Déterminer le niveau de confiance
    let confidence;
    if (bestScore >= 95) {
      confidence = "high";
    } else if (bestScore >= 85) {
      confidence = "medium";
    } else {
      confidence = "low";
    }
    
    return {
      match: bestMatch,
      score: bestScore,
      confidence
    };
  }
  
  return null;
}

/**
 * Trouve tous les matches possibles (pour debug/review)
 * @param {Array} nhlPlayers - Liste des joueurs NHL
 * @param {Array} sportsDbInjuries - Liste des blessures TheSportsDB
 * @param {number} minScore - Score minimum
 * @returns {Array} Liste des matches trouvés
 */
export function findAllMatches(nhlPlayers, sportsDbInjuries, minScore = 60) {
  const matches = [];
  
  for (const nhlPlayer of nhlPlayers) {
    const result = findBestMatch(nhlPlayer, sportsDbInjuries, minScore);
    
    if (result) {
      matches.push({
        nhlPlayerId: nhlPlayer.nhlPlayerId || nhlPlayer.playerId,
        nhlName: `${nhlPlayer.firstName || ""} ${nhlPlayer.lastName || ""}`.trim(),
        sportsDbName: result.match.strPlayer || result.match.playerName,
        teamAbbrev: nhlPlayer.teamAbbr || nhlPlayer.teamAbbrev,
        score: result.score,
        confidence: result.confidence,
        injury: result.match
      });
    }
  }
  
  return matches;
}

/**
 * Log les résultats de matching pour validation
 * @param {Array} matches - Liste des matches trouvés
 */
export function logMatchingResults(matches) {
  if (!matches || matches.length === 0) {
    logger.info("[NameMatching] No matches to log");
    return;
  }
  
  const stats = {
    total: matches.length,
    highConfidence: matches.filter(m => m.confidence === "high").length,
    mediumConfidence: matches.filter(m => m.confidence === "medium").length,
    lowConfidence: matches.filter(m => m.confidence === "low").length,
  };
  
  logger.info("[NameMatching] Matching results", stats);
  
  // Log quelques exemples pour validation
  const samples = matches.slice(0, 5);
  
  for (const match of samples) {
    logger.info("[NameMatching] Sample match", {
      nhlId: match.nhlPlayerId,
      nhlName: match.nhlName,
      sportsDbName: match.sportsDbName,
      team: match.teamAbbrev,
      score: match.score,
      confidence: match.confidence,
      injury: match.injury?.strInjury || match.injury?.injury,
      status: match.injury?.strStatus || match.injury?.status,
    });
  }
  
  // Log les matches avec faible confiance (pour review)
  const lowConfMatches = matches.filter(m => m.confidence === "low");
  if (lowConfMatches.length > 0) {
    logger.warn("[NameMatching] Low confidence matches need review", {
      count: lowConfMatches.length,
      examples: lowConfMatches.slice(0, 3).map(m => ({
        nhlName: m.nhlName,
        sportsDbName: m.sportsDbName,
        score: m.score,
      }))
    });
  }
}

/**
 * Teste le matching sur quelques exemples connus
 * Utile pour validation
 */
export function testNameMatching() {
  const testCases = [
    { name1: "Connor McDavid", name2: "Connor McDavid", expected: 100 },
    { name1: "Jack Eichel", name2: "Jack Eichel", expected: 100 },
    { name1: "Connor McDavid", name2: "C. McDavid", expected: 85 },
    { name1: "Nathan MacKinnon", name2: "Nathan Mackinnon", expected: 100 }, // accents
    { name1: "Jack Eichel", name2: "Eichel", expected: 80 },
    { name1: "Connor McDavid", name2: "Sidney Crosby", expected: 0 },
  ];
  
  logger.info("[NameMatching] Running tests...");
  
  for (const test of testCases) {
    const score = calculateNameSimilarity(test.name1, test.name2);
    const passed = score >= test.expected - 5 && score <= test.expected + 5;
    
    logger.info("[NameMatching] Test", {
      name1: test.name1,
      name2: test.name2,
      expectedScore: test.expected,
      actualScore: score,
      passed: passed ? "✅" : "❌"
    });
  }
}