const { jsonResponse, requireAdmin } = require("./lib/auth");
const { readJson, writeJson } = require("./lib/blobStore");

const buildDefaultRoster = (teamId) => ({
  schemaVersion: 1,
  teamId,
  updatedAt: new Date().toISOString(),
  members: [],
});

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  if (!teamId) {
    return jsonResponse(400, { ok: false, error: "teamId is required" });
  }

  const key = `roster/${teamId}.json`;
  let roster = await readJson(key);

  if (!roster) {
    roster = buildDefaultRoster(teamId);
    await writeJson(key, roster);
  }

  return jsonResponse(200, roster);
};
