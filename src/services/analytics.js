// src/services/analytics.js
import analytics from "@react-native-firebase/analytics";

function cleanParams(params = {}) {
  const out = {};

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
      return;
    }

    out[key] = String(value);
  });

  return out;
}

async function logEvent(name, params = {}) {
  try {
    await analytics().logEvent(name, cleanParams(params));
  } catch (e) {
    console.log("[analytics] logEvent error", name, e?.message || e);
  }
}

async function logScreen(screenName, screenClass = screenName) {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass,
    });
  } catch (e) {
    console.log("[analytics] logScreen error", screenName, e?.message || e);
  }
}

async function setUserId(userId) {
  try {
    await analytics().setUserId(userId ? String(userId) : null);
  } catch (e) {
    console.log("[analytics] setUserId error", e?.message || e);
  }
}

async function setUserProperty(name, value) {
  try {
    await analytics().setUserProperty(name, value == null ? null : String(value));
  } catch (e) {
    console.log("[analytics] setUserProperty error", name, e?.message || e);
  }
}

export const Analytics = {
  logEvent,
  logScreen,
  setUserId,
  setUserProperty,

  authStart(method) {
    return logEvent("auth_start", { method });
  },

  authSuccess(method) {
    return logEvent("auth_success", { method });
  },

  appOpen() {
    return logEvent("app_open");
  },

  createGroup({ groupType = "unknown", source = "unknown" } = {}) {
    return logEvent("create_group", {
      group_type: groupType,
      source,
    });
  },

  joinGroup({ method = "unknown", groupId = "", groupSize = 0 } = {}) {
    return logEvent("join_group", {
      method,
      group_id: String(groupId || ""),
      group_size: Number(groupSize || 0),
    });
  },

  createChallenge({
    type = "unknown",
    groupId = "",
    gameId = "",
  } = {}) {
    return logEvent("create_challenge", {
      type,
      group_id: String(groupId || ""),
      game_id: String(gameId || ""),
    });
  },

  submitPick({
    challengeType = "unknown",
    challengeId = "",
    gameId = "",
    groupId = "",
  } = {}) {
    return logEvent("submit_pick", {
      challenge_type: challengeType,
      challenge_id: String(challengeId || ""),
      game_id: String(gameId || ""),
      group_id: String(groupId || ""),
    });
  },

  leaderboardView({ groupId = "", groupSize = 0 } = {}) {
    return logEvent("leaderboard_view", {
        group_id: String(groupId || ""),
        group_size: Number(groupSize || 0),
    });
  },

  viewChallengeResult({
    challengeType = "unknown",
    challengeId = "",
    groupId = "",
  } = {}) {
    return logEvent("view_challenge_result", {
      challenge_type: challengeType,
      challenge_id: String(challengeId || ""),
      group_id: String(groupId || ""),
    });
  },

    matchLiveView: async ({ date, gamesCount, from }) => {
    return logEvent("match_live_view", {
        date,
        games_count: gamesCount,
        from,
    });
    },

    matchLiveGameOpen: async ({ gameId, homeAbbr, awayAbbr, status }) => {
    return logEvent("match_live_game_open", {
        game_id: gameId,
        home_abbr: homeAbbr,
        away_abbr: awayAbbr,
        status,
    });
    },

    matchLiveFgcOpen: async ({ challengeId, challengeStatus, groupId, gameId }) => {
    return logEvent("match_live_fgc_open", {
        challenge_id: challengeId,
        challenge_status: challengeStatus,
        group_id: groupId,
        game_id: gameId,
    });
    },

  nhlStandingsView: async ({ mode, teamsCount }) => {
  return logEvent("nhl_standings_view", {
    mode: String(mode || ""),
    teams_count: Number(teamsCount || 0),
  });
},

    nhlStandingsModeChanged: async ({ mode }) => {
    return logEvent("nhl_standings_mode_changed", {
        mode: String(mode || ""),
    });
    },  

    nhlScheduleView: async ({ selectedDate, visibleMonth, gamesCount }) => {
  return logEvent("nhl_schedule_view", {
    selected_date: selectedDate,
    visible_month: visibleMonth,
    games_count: Number(gamesCount || 0),
  });
},

nhlScheduleDateChanged: async ({ selectedDate, gamesCount }) => {
  return logEvent("nhl_schedule_date_changed", {
    selected_date: selectedDate,
    games_count: Number(gamesCount || 0),
  });
},

nhlScheduleMonthChanged: async ({ visibleMonth, markedDaysCount }) => {
  return  logEvent("nhl_schedule_month_changed", {
    visible_month: visibleMonth,
    marked_days_count: Number(markedDaysCount || 0),
  });
},



  shareInviteLink({ groupId = "", method = "unknown" } = {}) {
    return logEvent("share_invite_link", {
      group_id: String(groupId || ""),
      method,
    });
  },
};

export default Analytics;