const { jsonResponse, requireAdmin } = require("./lib/auth");
const { readJson } = require("./lib/blobStore");
const { buildDefaultWeek, ensureWeekIndex, readWeek, writeWeek } = require("./lib/weekHelpers");

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  const isoWeek = event.queryStringParameters?.isoWeek;
  if (!teamId || !isoWeek) {
    return jsonResponse(400, { ok: false, error: "teamId and isoWeek are required" });
  }

  let week = await readWeek(teamId, isoWeek);

  if (!week) {
    const roster = await readJson(`roster/${teamId}.json`);
    week = buildDefaultWeek(teamId, isoWeek, roster);
    await writeWeek(teamId, isoWeek, week);
  }

  await ensureWeekIndex(teamId, isoWeek);

  return jsonResponse(200, week);
};
