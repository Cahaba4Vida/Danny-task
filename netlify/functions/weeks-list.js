const { jsonResponse, requireAdmin } = require("./lib/auth");
const { readJson } = require("./lib/blobStore");

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  if (!teamId) {
    return jsonResponse(400, { ok: false, error: "teamId is required" });
  }

  const weeks = (await readJson(`weeks-index/${teamId}.json`)) || [];
  return jsonResponse(200, { teamId, weeks });
};
