const { randomUUID } = require("crypto");
const { getHeader, jsonResponse, requireAdmin } = require("./lib/auth");
const { readJson } = require("./lib/blobStore");
const {
  appendAuditEvent,
  buildDefaultWeek,
  buildEmptyMemberState,
  ensureWeekIndex,
  mergeMemberPatch,
  readWeek,
  writeWeek,
} = require("./lib/weekHelpers");

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  const isoWeek = event.queryStringParameters?.isoWeek;
  if (!teamId || !isoWeek) {
    return jsonResponse(400, { ok: false, error: "teamId and isoWeek are required" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  let week = await readWeek(teamId, isoWeek);
  if (!week) {
    const roster = await readJson(`roster/${teamId}.json`);
    week = buildDefaultWeek(teamId, isoWeek, roster);
  }

  const patchMembers = payload.members || {};
  const updatedMembers = { ...week.members };

  Object.entries(patchMembers).forEach(([memberId, memberPatch]) => {
    const current = updatedMembers[memberId] || buildEmptyMemberState();
    updatedMembers[memberId] = mergeMemberPatch(current, memberPatch || {});
  });

  week = {
    ...week,
    members: updatedMembers,
    updatedAt: new Date().toISOString(),
  };

  await writeWeek(teamId, isoWeek, week);
  await ensureWeekIndex(teamId, isoWeek);

  const actor = getHeader(event.headers, "x-actor") || "Unknown";
  const summary = payload.summary || "Updated week data";

  await appendAuditEvent(teamId, isoWeek, {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    actor,
    action: "week-patch",
    summary,
  });

  return jsonResponse(200, week);
};
