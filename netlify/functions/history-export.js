const { jsonResponse, requireAdmin } = require("./lib/auth");
const { readJson } = require("./lib/blobStore");
const { teams } = require("./lib/constants");

const getTeamWeeks = async (teamId) => {
  const weeks = (await readJson(`weeks-index/${teamId}.json`)) || [];
  const ordered = weeks.slice().sort();
  const entries = [];

  for (const isoWeek of ordered) {
    const week = await readJson(`weeks/${teamId}/${isoWeek}.json`);
    if (week) {
      entries.push(week);
    }
  }

  return entries;
};

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  const allTeams = event.queryStringParameters?.allTeams === "1";

  if (teamId) {
    const data = await getTeamWeeks(teamId);
    return jsonResponse(200, data);
  }

  if (allTeams) {
    const combined = [];
    for (const team of teams) {
      const data = await getTeamWeeks(team.id);
      data.forEach((week) => {
        combined.push({
          teamId: team.id,
          isoWeek: week.isoWeek,
          data: week,
        });
      });
    }
    combined.sort((a, b) => a.isoWeek.localeCompare(b.isoWeek));
    return jsonResponse(200, combined);
  }

  return jsonResponse(400, { ok: false, error: "teamId or allTeams=1 required" });
};
