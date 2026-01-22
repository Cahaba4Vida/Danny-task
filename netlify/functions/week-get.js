const { jsonResponse, requireAdmin } = require("./lib/auth");
const { withClient } = require("./lib/db");

const buildDefaultState = () => ({
  weeklyFocusSet: false,
  roleplayDone: false,
  firstMeetings: 0,
  signedRecruits: 0,
  notes: "",
});

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  const teamId = event.queryStringParameters?.teamId;
  const isoWeek = event.queryStringParameters?.isoWeek;

  if (!teamId || !isoWeek) {
    return jsonResponse(400, {
      ok: false,
      error: "teamId and isoWeek are required",
    });
  }

  try {
    const payload = await withClient(async (client) => {
      const weekResult = await client.query(
        `INSERT INTO weeks (team_id, iso_week)
         VALUES ($1, $2)
         ON CONFLICT (team_id, iso_week)
         DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [teamId, isoWeek]
      );

      const weekId = weekResult.rows[0].id;

      const membersResult = await client.query(
        `SELECT id, name, active, email, phone
         FROM members
         WHERE team_id = $1
         ORDER BY created_at ASC`,
        [teamId]
      );

      const stateResult = await client.query(
        `SELECT member_id, weekly_focus_set, roleplay_done, first_meetings, signed_recruits, notes, updated_at
         FROM member_week_state
         WHERE week_id = $1`,
        [weekId]
      );

      const taskResult = await client.query(
        `SELECT id, member_id, label, done, created_at, updated_at
         FROM custom_tasks
         WHERE week_id = $1
         ORDER BY created_at ASC`,
        [weekId]
      );

      const roleplayResult = await client.query(
        `SELECT id, member_id, type, note, timestamp, created_at
         FROM roleplays
         WHERE week_id = $1
         ORDER BY timestamp ASC`,
        [weekId]
      );

      const states = {};
      stateResult.rows.forEach((row) => {
        states[row.member_id] = {
          weeklyFocusSet: row.weekly_focus_set,
          roleplayDone: row.roleplay_done,
          firstMeetings: row.first_meetings,
          signedRecruits: row.signed_recruits,
          notes: row.notes || "",
          updatedAt: row.updated_at,
        };
      });

      const tasks = {};
      taskResult.rows.forEach((row) => {
        if (!tasks[row.member_id]) tasks[row.member_id] = [];
        tasks[row.member_id].push({
          id: row.id,
          label: row.label,
          done: row.done,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      });

      const roleplays = {};
      roleplayResult.rows.forEach((row) => {
        if (!roleplays[row.member_id]) roleplays[row.member_id] = [];
        roleplays[row.member_id].push({
          id: row.id,
          type: row.type,
          note: row.note,
          timestamp: row.timestamp,
          createdAt: row.created_at,
        });
      });

      membersResult.rows.forEach((member) => {
        if (!states[member.id]) {
          states[member.id] = buildDefaultState();
        }
        if (!tasks[member.id]) {
          tasks[member.id] = [];
        }
        if (!roleplays[member.id]) {
          roleplays[member.id] = [];
        }
      });

      return {
        weekId,
        teamId,
        isoWeek,
        members: membersResult.rows,
        states,
        tasks,
        roleplays,
      };
    });

    return jsonResponse(200, { ok: true, ...payload });
  } catch (error) {
    return jsonResponse(500, { ok: false, error: error.message });
  }
};
