const { readJson, writeJson } = require("./blobStore");

const buildEmptyMemberState = () => ({
  checklist: { weeklyFocusSet: false, roleplayDone: false },
  counters: { firstMeetings: 0, signedRecruits: 0 },
  customTasks: [],
  roleplays: [],
  notes: "",
});

const buildDefaultWeek = (teamId, isoWeek, roster) => {
  const members = {};
  if (roster?.members) {
    roster.members.forEach((member) => {
      members[member.id] = buildEmptyMemberState();
    });
  }

  return {
    schemaVersion: 1,
    teamId,
    isoWeek,
    updatedAt: new Date().toISOString(),
    members,
  };
};

const ensureWeekIndex = async (teamId, isoWeek) => {
  const indexKey = `weeks-index/${teamId}.json`;
  const list = (await readJson(indexKey)) || [];
  if (!list.includes(isoWeek)) {
    list.push(isoWeek);
    list.sort();
    await writeJson(indexKey, list);
  }
  return list;
};

const readWeek = async (teamId, isoWeek) => {
  return await readJson(`weeks/${teamId}/${isoWeek}.json`);
};

const writeWeek = async (teamId, isoWeek, week) => {
  return await writeJson(`weeks/${teamId}/${isoWeek}.json`, week);
};

const appendAuditEvent = async (teamId, isoWeek, event) => {
  const key = `audit/${teamId}/${isoWeek}.json`;
  const existing = (await readJson(key)) || {
    schemaVersion: 1,
    teamId,
    isoWeek,
    events: [],
  };

  existing.events.push(event);
  await writeJson(key, existing);
};

const mergeMemberPatch = (current, patch) => {
  const next = { ...current };
  if (patch.checklist) {
    next.checklist = { ...current.checklist, ...patch.checklist };
  }
  if (patch.counters) {
    next.counters = { ...current.counters, ...patch.counters };
  }
  if (Array.isArray(patch.customTasks)) {
    next.customTasks = patch.customTasks;
  }
  if (Array.isArray(patch.roleplays)) {
    next.roleplays = patch.roleplays;
  }
  if (typeof patch.notes === "string") {
    next.notes = patch.notes;
  }
  return next;
};

module.exports = {
  appendAuditEvent,
  buildDefaultWeek,
  buildEmptyMemberState,
  ensureWeekIndex,
  mergeMemberPatch,
  readWeek,
  writeWeek,
};
