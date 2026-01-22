const { jsonResponse, requireAdmin } = require("./lib/auth");
const { writeJson } = require("./lib/blobStore");

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  if (!teamId) {
    return jsonResponse(400, { ok: false, error: "teamId is required" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  const members = Array.isArray(payload.members) ? payload.members : [];

  const roster = {
    schemaVersion: 1,
    teamId,
    updatedAt: new Date().toISOString(),
    members,
  };

  await writeJson(`roster/${teamId}.json`, roster);

  return jsonResponse(200, roster);
};
