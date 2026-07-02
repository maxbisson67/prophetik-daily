const SYSTEM_COACH = `Tu es Nova, la coach sportive personnelle de Prophetik (NHL/MLB).
Tu accompagnes le participant dans son apprentissage et sa réflexion.
Tu expliques, compares et fais réfléchir — tu ne garantis jamais un résultat.
Tu ne remplaces pas la décision du participant.
Réponds UNIQUEMENT en JSON valide selon le schéma demandé.
Dans les textes utilisateur: n'utilise jamais les acronymes internes FGC, TP, TS — utilise les noms affichés dans l'app.
Reste concise: summary max 120 mots.`;

const SYSTEM_EXPLAIN = `Tu es Nova, coach éducative Prophetik.
Tu expliques des notions sportives ou Prophetik de façon claire.
Tu ne garantis jamais un résultat de jeu.
Réponds UNIQUEMENT en JSON valide selon le schéma demandé.
N'utilise pas FGC, TP, TS dans les textes utilisateur — utilise les noms du produit.
Reste concise.`;

const COACH_SCHEMA = `{
  "capability": "coach",
  "tone": "encouraging|neutral|analytical",
  "learning": { "concept": "string|null", "hint": "string|null" },
  "observation": "string",
  "comparison": { "favoredPlayerId": "string|null", "alternativePlayerIds": ["string"], "dimensions": ["string"] },
  "risks": ["string"],
  "reflection": "string",
  "confidence": "low|medium|high",
  "disclaimer": "string",
  "followUpSuggestions": ["string"]
}`;

const TP_COACH_SCHEMA = `{
  "capability": "coach",
  "tone": "encouraging|neutral|analytical",
  "learning": { "concept": "string|null", "hint": "string|null" },
  "teamFormFactors": {
    "away": {
      "abbr": "string",
      "seasonRecord": "string (W-L + %)",
      "streak": "string (ex. W3 ou L2)",
      "lastTen": "string (ex. 7-3)",
      "split": "string (fiche à l'extérieur)",
      "offenseDefense": "string (runs marqués/accordés par match)"
    },
    "home": {
      "abbr": "string",
      "seasonRecord": "string",
      "streak": "string",
      "lastTen": "string",
      "split": "string (fiche à domicile)",
      "offenseDefense": "string"
    }
  },
  "observation": "string — synthèse des teamFormFactors pour LES DEUX équipes AVANT le lanceur; mentionne explicitement fiche, série, 10 derniers matchs et split domicile/visite",
  "comparison": {
    "favoredTeamAbbr": "string|null",
    "dimensions": ["string — au moins 3 dimensions ÉQUIPE, ex. fiche saison, forme récente, split domicile/visite"],
    "pitchingNote": "string|null — ERA/lanceurs en une phrase, pas le cœur de l'analyse"
  },
  "risks": ["string"],
  "reflection": "string",
  "confidence": "low|medium|high",
  "disclaimer": "string",
  "followUpSuggestions": ["string"]
}`;

const EXPLAIN_SCHEMA = `{
  "capability": "explain",
  "source": "llm",
  "title": "string",
  "summary": "string",
  "body": "string",
  "prophetikUse": "string|null",
  "examples": ["string"],
  "relatedTopics": ["string"],
  "disclaimer": "string"
}`;

function formatTeamFormBlock(facts, abbr, side, lang) {
  const isFr = lang !== "en";
  const sideLabel = isFr
    ? side === "home"
      ? "à domicile"
      : "à l'extérieur"
    : side === "home"
      ? "at home"
      : "on the road";

  if (!facts) {
    return isFr
      ? `${abbr} (${sideLabel}) : fiche non disponible`
      : `${abbr} (${sideLabel}): team record unavailable`;
  }

  const lines = [`${abbr} (${sideLabel})`];
  const pct = facts.winningPct ? ` (${facts.winningPct})` : "";
  lines.push(
    isFr
      ? `- Fiche saison : ${facts.seasonRecord}${pct}`
      : `- Season record: ${facts.seasonRecord}${pct}`
  );

  if (facts.streak) {
    lines.push(isFr ? `- Série : ${facts.streak}` : `- Streak: ${facts.streak}`);
  }
  if (facts.lastTen && facts.lastTen !== "0-0") {
    const ltPct = facts.lastTenPct ? ` (${facts.lastTenPct})` : "";
    lines.push(
      isFr
        ? `- 10 derniers matchs : ${facts.lastTen}${ltPct}`
        : `- Last 10 games: ${facts.lastTen}${ltPct}`
    );
  }
  if (facts.splitRecord && facts.splitRecord !== "0-0") {
    lines.push(
      isFr
        ? `- Split ${sideLabel} : ${facts.splitRecord}${facts.splitPct ? ` (${facts.splitPct})` : ""}`
        : `- ${sideLabel} split: ${facts.splitRecord}${facts.splitPct ? ` (${facts.splitPct})` : ""}`
    );
  }
  if (facts.runsScoredPerGame != null || facts.runsAllowedPerGame != null) {
    lines.push(
      isFr
        ? `- Production : ${facts.runsScoredPerGame ?? "?"} runs marqués/match, ${facts.runsAllowedPerGame ?? "?"} accordés/match`
        : `- Offense/defense: ${facts.runsScoredPerGame ?? "?"} runs scored/game, ${facts.runsAllowedPerGame ?? "?"} allowed/game`
    );
  }

  return lines.join("\n");
}

function buildTpCoachingBrief(verifiedContext, lang) {
  const game = verifiedContext?.focusedGame || verifiedContext?.games?.[0];
  if (!game) return null;

  const isFr = lang !== "en";
  const slot = game.slot ?? "?";
  const header = isFr
    ? `Match ${slot} — ${game.awayAbbr} (visiteur) @ ${game.homeAbbr} (domicile)`
    : `Game ${slot} — ${game.awayAbbr} (away) @ ${game.homeAbbr} (home)`;

  const awayBlock = formatTeamFormBlock(game.teamForm?.away, game.awayAbbr, "away", lang);
  const homeBlock = formatTeamFormBlock(game.teamForm?.home, game.homeAbbr, "home", lang);

  const awayP = game.awayPitcher?.name
    ? `${game.awayPitcher.name} (ERA ${game.awayPitcher.era ?? "?"}, ${game.awayPitcher.wins ?? "?"}-${game.awayPitcher.losses ?? "?"})`
    : isFr
      ? "non annoncé"
      : "TBD";
  const homeP = game.homePitcher?.name
    ? `${game.homePitcher.name} (ERA ${game.homePitcher.era ?? "?"}, ${game.homePitcher.wins ?? "?"}-${game.homePitcher.losses ?? "?"})`
    : isFr
      ? "non annoncé"
      : "TBD";

  const pitching = isFr
    ? `Lanceurs probables (facteur pitching, à mentionner APRÈS la forme équipe) :\n- ${game.awayAbbr} : ${awayP}\n- ${game.homeAbbr} : ${homeP}`
    : `Probable starters (pitching factor — mention AFTER team form):\n- ${game.awayAbbr}: ${awayP}\n- ${game.homeAbbr}: ${homeP}`;

  return [header, "", awayBlock, "", homeBlock, "", pitching].join("\n");
}

function buildTpSlimContext(verifiedContext) {
  if (!verifiedContext) return null;

  const mapGame = (g) => ({
    slot: g.slot,
    gameId: g.gameId,
    matchup: `${g.awayAbbr} @ ${g.homeAbbr}`,
    teamForm: g.teamForm,
    pitching: {
      away: g.awayPitcher?.name
        ? { name: g.awayPitcher.name, era: g.awayPitcher.era, record: `${g.awayPitcher.wins ?? "?"}-${g.awayPitcher.losses ?? "?"}` }
        : null,
      home: g.homePitcher?.name
        ? { name: g.homePitcher.name, era: g.homePitcher.era, record: `${g.homePitcher.wins ?? "?"}-${g.homePitcher.losses ?? "?"}` }
        : null,
    },
    participantPick: g.participantPick,
  });

  const focus = verifiedContext.focusedGame || verifiedContext.games?.[0];

  return {
    bundle: verifiedContext.bundle,
    participant: {
      picksCompletedCount: verifiedContext.participant?.picksCompletedCount,
      picks: verifiedContext.participant?.picks,
    },
    focusedMatch: focus ? mapGame(focus) : null,
    otherMatches: (verifiedContext.games || [])
      .filter((g) => g.gameId !== focus?.gameId)
      .map(mapGame),
    teamFormChecklist: verifiedContext.teamFormChecklist,
  };
}

function buildFgcCoachingBrief(verifiedContext, lang) {
  const ch = verifiedContext?.challenge || {};
  const matchup = verifiedContext?.matchup || null;
  const pick = verifiedContext?.participant?.currentPick || null;
  const focusPlayer = (verifiedContext?.players || []).find((p) => p.playerId === pick?.playerId);
  if (!ch.homeAbbr || !ch.awayAbbr) return null;

  const isFr = lang !== "en";
  const header = isFr
    ? `Match — ${ch.awayAbbr} (visiteur) @ ${ch.homeAbbr} (domicile)`
    : `Game — ${ch.awayAbbr} (away) @ ${ch.homeAbbr} (home)`;

  const lines = [header, ""];

  if (pick?.playerName || pick?.playerId) {
    const sideLabel =
      pick.isAwayTeam === true
        ? isFr
          ? "visiteur (frappe en 1re manche — haut de la 1re)"
          : "away (bats first — top 1st)"
        : pick.isHomeTeam === true
          ? isFr
            ? "domicile (frappe en 2e — bas de la 1re)"
            : "home (bats second — bottom 1st)"
          : isFr
            ? "équipe inconnue"
            : "team unknown";

    lines.push(
      isFr
        ? `Joueur concerné : ${pick.playerName || pick.playerId} (${pick.teamAbbr || "?"}, ${sideLabel})`
        : `Player in focus: ${pick.playerName || pick.playerId} (${pick.teamAbbr || "?"}, ${sideLabel})`
    );

    if (pick.batSide) {
      lines.push(isFr ? `Main au bâton : ${pick.batSide}` : `Bats: ${pick.batSide}`);
    }

    const stats = focusPlayer?.seasonStats;
    if (stats) {
      const avg = stats.battingAverage ? `, AVG ${stats.battingAverage}` : "";
      lines.push(
        isFr
          ? `Production saison : ${stats.rbi} RBI, ${stats.homeRuns} HR, ${stats.hits} H${avg}`
          : `Season production: ${stats.rbi} RBI, ${stats.homeRuns} HR, ${stats.hits} H${avg}`
      );
    }

    if (pick.lineupSlot != null) {
      lines.push(
        isFr
          ? `Place dans l'ordre de frappe : ${pick.lineupSlot}e (confirmée)`
          : `Lineup spot: ${pick.lineupSlot} (confirmed)`
      );
      if (pick.lineupSlot > 1) {
        lines.push(
          isFr
            ? `Ce joueur n'est PAS le leadoff (1er frappeur).`
            : `This player is NOT the leadoff hitter (batting 1st).`
        );
      }
      const note = matchup?.firstInningRbiDynamics?.lineupNote;
      if (note) lines.push(note);
    } else {
      lines.push(
        isFr
          ? "Place dans l'ordre de frappe : non confirmée — ne pas supposer 1er frappeur (leadoff)."
          : "Lineup spot: unconfirmed — do not assume leadoff."
      );
    }
    lines.push("");
  }

  if (pick?.isAwayTeam === true) {
    lines.push(
      isFr
        ? "Dynamique haut de 1re (visiteur) : 1er frappeur → RBI surtout via circuit (bases vides) ; 2e → plus de chemins si leadoff sur les buts ; 3-4-5 → souvent les meilleurs profils si des coureurs sont en place."
        : "Top-1st dynamics (away): leadoff → RBI mostly via solo HR (empty bases); #2 → more paths if leadoff on base; 3–5 → often best profiles with runners on."
    );
    lines.push("");
  } else if (pick?.isHomeTeam === true) {
    lines.push(
      isFr
        ? "Dynamique domicile : le premier RBI peut déjà être produit par le visiteur en haut de 1re ; sinon, même logique d'ordre de frappe en bas de 1re (bases vides au premier passage)."
        : "Home dynamics: first RBI may already be driven in by the visitor in the top of the 1st; otherwise same lineup-spot logic in the bottom of the 1st (empty bases on first trip)."
    );
    lines.push("");
  }

  const awayBlock = formatTeamFormBlock(
    verifiedContext?.teamForm?.away,
    ch.awayAbbr,
    "away",
    lang
  );
  const homeBlock = formatTeamFormBlock(
    verifiedContext?.teamForm?.home,
    ch.homeAbbr,
    "home",
    lang
  );
  lines.push(awayBlock, "", homeBlock, "");

  const opp = matchup?.opposingPitcher;
  const oppForm = matchup?.opposingTeamForm;
  if (oppForm?.runsAllowedPerGame != null && matchup?.opposingTeamAbbr) {
    lines.push(
      isFr
        ? `Équipe adverse (${matchup.opposingTeamAbbr}) — runs accordés/match (saison) : ${oppForm.runsAllowedPerGame}`
        : `Opposing team (${matchup.opposingTeamAbbr}) — runs allowed/game (season): ${oppForm.runsAllowedPerGame}`
    );
    lines.push("");
  }

  if (opp?.name || matchup?.opposingTeamAbbr) {
    const hand = opp?.throwHand
      ? isFr
        ? `, ${opp.throwHand === "L" ? "gaucher" : opp.throwHand === "R" ? "droitier" : opp.throwHand}`
        : `, throws ${opp.throwHand}`
      : "";
    const era = opp?.era != null ? `ERA ${opp.era}` : isFr ? "ERA ?" : "ERA ?";
    lines.push(
      isFr
        ? `Lanceur adverse (${matchup?.opposingTeamAbbr || "?"}) : ${opp?.name || "non annoncé"} (${era}${hand})`
        : `Opposing starter (${matchup?.opposingTeamAbbr || "?"}): ${opp?.name || "TBD"} (${era}${hand})`
    );
  }

  const pp = verifiedContext?.probablePitchers;
  if (pp?.away?.name || pp?.home?.name) {
    lines.push("");
    lines.push(isFr ? "Lanceurs partants du match :" : "Game probable starters:");
    for (const [side, abbr] of [
      ["away", ch.awayAbbr],
      ["home", ch.homeAbbr],
    ]) {
      const p = pp?.[side];
      if (!p?.name) continue;
      const hand = p?.throwHand
        ? isFr
          ? `, ${p.throwHand === "L" ? "gaucher" : p.throwHand === "R" ? "droitier" : p.throwHand}`
          : `, throws ${p.throwHand}`
        : isFr
          ? ", main inconnue"
          : ", hand unknown";
      const era = p?.era != null ? `ERA ${p.era}` : isFr ? "ERA ?" : "ERA ?";
      const sideLabel = isFr
        ? side === "away"
          ? "visiteur"
          : "domicile"
        : side === "away"
          ? "away"
          : "home";
      lines.push(
        isFr
          ? `- ${abbr} (${sideLabel}) : ${p.name} (${era}${hand})`
          : `- ${abbr} (${sideLabel}): ${p.name} (${era}${hand})`
      );
    }
  }

  if (matchup?.platoon) {
    const p = matchup.platoon;
    const adv =
      p.typicalAdvantage === "favorable"
        ? isFr
          ? "matchup platoon généralement favorable"
          : "platoon matchup typically favorable"
        : p.typicalAdvantage === "unfavorable"
          ? isFr
            ? "matchup platoon généralement défavorable"
            : "platoon matchup typically unfavorable"
          : null;
    if (adv) lines.push(isFr ? `Platoon : ${adv}` : `Platoon: ${adv}`);
  }

  const bvp = matchup?.bvp;
  const bvpPa = Number(bvp?.pa) || 0;
  if (bvp?.hasSample && bvpPa > 9 && opp?.name) {
    lines.push(
      isFr
        ? `BvP carrière vs ${opp.name} (échantillon fiable, >9 PA) : ${bvp.pa} PA, ${bvp.hits} H, ${bvp.homeRuns} HR, ${bvp.rbi} RBI, OPS ${bvp.ops ?? "?"}`
        : `Career BvP vs ${opp.name} (reliable sample, >9 PA): ${bvp.pa} PA, ${bvp.hits} H, ${bvp.homeRuns} HR, ${bvp.rbi} RBI, OPS ${bvp.ops ?? "?"}`
    );
  } else if (bvpPa > 0 && bvpPa <= 9 && opp?.name) {
    lines.push(
      isFr
        ? `BvP vs ${opp.name} : ${bvpPa} PA — échantillon trop petit pour l'analyse (seuil > 9 PA)`
        : `BvP vs ${opp.name}: ${bvpPa} PA — sample too small for analysis (>9 PA threshold)`
    );
  } else if (opp?.name) {
    lines.push(
      isFr
        ? `BvP carrière vs ${opp.name} : aucune présence au bâton enregistrée`
        : `Career BvP vs ${opp.name}: no recorded plate appearances`
    );
  }

  return lines.filter(Boolean).join("\n");
}

function buildFgcSlimContext(verifiedContext) {
  if (!verifiedContext) return null;

  return {
    challenge: verifiedContext.challenge,
    participant: verifiedContext.participant,
    matchup: verifiedContext.matchup,
    players: (verifiedContext.players || []).map((p) => ({
      playerId: p.playerId,
      fullName: p.fullName,
      teamAbbr: p.teamAbbr,
      batSide: p.batSide,
      lineupSlot: p.lineupSlot ?? null,
      isAwayTeam: p.isAwayTeam,
      seasonStats: p.seasonStats,
      injury: p.injury,
      bvpVsOpposingStarter: p.bvpVsOpposingStarter ?? null,
    })),
    probablePitchers: verifiedContext.probablePitchers
      ? {
          away: verifiedContext.probablePitchers.away
            ? {
                ...verifiedContext.probablePitchers.away,
                throwHand: verifiedContext.probablePitchers.away.throwHand ?? null,
              }
            : null,
          home: verifiedContext.probablePitchers.home
            ? {
                ...verifiedContext.probablePitchers.home,
                throwHand: verifiedContext.probablePitchers.home.throwHand ?? null,
              }
            : null,
        }
      : null,
  };
}

export class PromptComposer {
  /**
   * @param {{ capability: string, lang: string, memoryBlock: object, verifiedContext?: object|null, knowledgeExcerpts?: object[], userMessage: string }}
   */
  compose({ capability, lang, memoryBlock, verifiedContext, knowledgeExcerpts = [], userMessage }) {
    const cap = String(capability || "coach").toLowerCase();
    const isExplain = cap === "explain";
    const isTpCoach = !isExplain && verifiedContext?.domain === "tp";
    const isFgcMlbCoach =
      !isExplain && verifiedContext?.domain === "fgc" && verifiedContext?.sport === "MLB";

    const system = isExplain ? SYSTEM_EXPLAIN : SYSTEM_COACH;
    const schema = isExplain ? EXPLAIN_SCHEMA : isTpCoach ? TP_COACH_SCHEMA : COACH_SCHEMA;

    const tpCoachingBrief = isTpCoach ? buildTpCoachingBrief(verifiedContext, lang) : null;
    const tpSlimContext = isTpCoach ? buildTpSlimContext(verifiedContext) : null;
    const fgcCoachingBrief = isFgcMlbCoach ? buildFgcCoachingBrief(verifiedContext, lang) : null;
    const fgcSlimContext = isFgcMlbCoach ? buildFgcSlimContext(verifiedContext) : null;

    const tpCoachHint = isTpCoach
      ? lang === "en"
        ? `Context: Predict the Game Outcome (team scores). Scoring: 3 pts correct winner + 3 pts exact score per game.

MANDATORY — fill teamFormFactors for BOTH teams by copying values from the verified brief below.
Never invent "unavailable" if the brief contains numbers.
Your observation MUST explicitly mention for each team: season W-L, current streak, last-10 record, and home/away split — BEFORE discussing pitchers.
Put pitching in comparison.pitchingNote (one sentence max). Do NOT anchor the analysis on ERA alone.
Use focusedMatch when the user asks about a specific game (e.g. match 1).
Suggest plausible score ranges and risks — never guarantee an outcome.`
        : `Contexte : Prédire l'issue du match (scores d'équipe). Barème : 3 pts bon vainqueur + 3 pts score exact par match.

OBLIGATOIRE — remplis teamFormFactors pour LES DEUX équipes en copiant les valeurs du brief vérifié ci-dessous.
N'invente jamais "unavailable" / "non disponible" si le brief contient des chiffres.
Ton observation DOIT mentionner explicitement pour chaque équipe : la fiche saison (W-L), la série en cours, les 10 derniers matchs et le split domicile/visite — AVANT de parler des lanceurs.
Le pitching va dans comparison.pitchingNote (une phrase max). N'ancre PAS l'analyse sur l'ERA seul.
Utilise focusedMatch quand l'utilisateur parle d'un match précis (ex. match 1).
Propose des fourchettes de score plausibles et des risques — ne garantis jamais un résultat.`
      : "";

    const fgcCoachHint = isFgcMlbCoach
      ? lang === "en"
        ? `Context: First Run Challenge (first RBI of the game). The participant picks ONE batter and wants ONE holistic advice.

Structure your JSON response as a single integrated analysis:
- observation: concise synthesis covering ALL available factors below (2–4 short paragraphs max in one string).
- comparison.pitchingNote: opposing starter ERA + throwHand + platoon vs batter batSide (one sentence).
- risks: 1–3 concrete risks for this first-RBI pick.
- reflection: one question to help the participant decide.

MANDATORY factors when present in the verified brief (skip only if truly missing):
1) Opposing starter: name, ERA, throwHand (L/R) — never invent handedness.
2) Lineup spot (lineupSlot) — cite exactly; never assume leadoff if unconfirmed.
3) Batter season RBI production (and HR if relevant).
4) Opposing team runs allowed per game (season).
5) Career BvP vs this starter ONLY if the brief shows >9 PA — cite PA, H, HR, RBI, OPS exactly. If ≤9 PA or no sample, do NOT use BvP; say history is insufficient or absent.

Do NOT infer OBP or on-base tendency of preceding batters in the lineup.
Away vs home first-inning dynamics apply (top 1st vs bottom 1st).
Never guarantee an outcome.`
        : `Contexte : Défi premier point produit (premier RBI du match). Le participant choisit UN frappeur et veut UN avis complet.

Structure ta réponse JSON comme une analyse intégrée :
- observation : synthèse concise couvrant TOUS les facteurs disponibles ci-dessous (2–4 paragraphes courts en une seule chaîne).
- comparison.pitchingNote : ERA + throwHand du lanceur adverse + platoon vs batSide du frappeur (une phrase).
- risks : 1–3 risques concrets pour ce choix premier RBI.
- reflection : une question pour aider le participant à trancher.

Facteurs OBLIGATOIRES quand présents dans le brief vérifié (saute seulement si vraiment absent) :
1) Lanceur adverse : nom, ERA, throwHand (G/D) — n'invente jamais la main.
2) Place dans l'ordre de frappe (lineupSlot) — cite exactement ; ne suppose jamais leadoff si non confirmé.
3) Production RBI saison du frappeur (et HR si pertinent).
4) Runs accordés/match par l'équipe adverse (saison).
5) BvP carrière vs ce lanceur UNIQUEMENT si le brief indique >9 PA — cite PA, H, HR, RBI, OPS exactement. Si ≤9 PA ou pas d'échantillon, n'utilise PAS le BvP ; dis que l'historique est insuffisant ou absent.

N'infère PAS l'OBP ou la tendance à monter sur les buts des frappeurs qui précèdent dans l'ordre.
Dynamique visiteur/domicile en 1re manche (haut vs bas de 1re).
Ne garantis jamais un résultat.`
      : "";

    const tpBriefBlock = tpCoachingBrief
      ? `=== BRIEF VÉRIFIÉ (source prioritaire pour teamFormFactors) ===\n${tpCoachingBrief}\n=== FIN DU BRIEF ===`
      : "";

    const fgcBriefBlock = fgcCoachingBrief
      ? `=== BRIEF VÉRIFIÉ FGC MLB ===\n${fgcCoachingBrief}\n=== FIN DU BRIEF ===`
      : "";

    const contextBlock = isTpCoach
      ? tpSlimContext
        ? `Verified Prophetik context (team form first; do not invent stats):\n${JSON.stringify(tpSlimContext, null, 2)}`
        : "No live challenge context."
      : isFgcMlbCoach
        ? fgcSlimContext
          ? `Verified Prophetik context (do not invent stats beyond this):\n${JSON.stringify(fgcSlimContext, null, 2)}`
          : "No live challenge context."
      : verifiedContext
        ? `Verified Prophetik context (do not invent stats beyond this):\n${JSON.stringify(verifiedContext, null, 2)}`
        : "No live challenge context.";

    const orderedKb = isTpCoach
      ? [...knowledgeExcerpts].sort((a, b) => {
          const order = { team_record: 0, tp_scoring: 1, era: 2, whip: 3, probable_pitcher: 4 };
          return (order[a.key] ?? 99) - (order[b.key] ?? 99);
        })
      : isFgcMlbCoach
        ? [...knowledgeExcerpts].sort((a, b) => {
            const order = {
              first_rbi: 0,
              fgc_away_first_inning: 1,
              platoon_advantage: 2,
              bvp: 3,
              rbi: 4,
              probable_pitcher: 5,
              era: 6,
              team_record: 7,
            };
            return (order[a.key] ?? 99) - (order[b.key] ?? 99);
          })
        : knowledgeExcerpts;

    const developerBlock = [
      `Capability: ${cap}`,
      `Language: ${lang === "en" ? "en" : "fr"}`,
      tpCoachHint,
      fgcCoachHint,
      tpBriefBlock,
      fgcBriefBlock,
      `Response JSON schema:\n${schema}`,
      `Participant memory:\n${JSON.stringify(memoryBlock, null, 2)}`,
      contextBlock,
      orderedKb.length
        ? `Knowledge excerpts (authoritative):\n${JSON.stringify(orderedKb, null, 2)}`
        : "No knowledge excerpts.",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      messages: [
        { role: "system", content: `${system}\n\n${developerBlock}` },
        {
          role: "user",
          content: String(userMessage || "").trim() || (isExplain ? "Explain." : "Coach me."),
        },
      ],
    };
  }
}
