import { neon, neonConfig } from "https://esm.sh/@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

const state = {
  databaseUrl: localStorage.getItem("fitHubDatabaseUrl"),
  actor: localStorage.getItem("fitHubActor") || "Braxton",
  teamId: "all",
  isoWeek: "",
  teams: [],
  roster: [],
  weekData: {
    states: {},
    roleplays: {},
    weekTasks: [],
    taskAttendance: {},
  },
  weeksList: [],
  membersExpanded: false,
};

let sqlClient = null;
let sqlClientUrl = null;

const getSql = () => {
  if (!state.databaseUrl) {
    throw new Error("Database URL missing. Please re-enter it.");
  }
  if (!sqlClient || sqlClientUrl !== state.databaseUrl) {
    sqlClient = neon(state.databaseUrl);
    sqlClientUrl = state.databaseUrl;
  }
  return sqlClient;
};

const elements = {
  teamSelect: document.getElementById("team-select"),
  isoWeek: document.getElementById("iso-week"),
  rosterList: document.getElementById("roster-list"),
  newMemberName: document.getElementById("new-member-name"),
  newMemberEmail: document.getElementById("new-member-email"),
  newMemberPhone: document.getElementById("new-member-phone"),
  newMemberTeam: document.getElementById("new-member-team"),
  addMember: document.getElementById("add-member"),
  saveRoster: document.getElementById("save-roster"),
  membersPanel: document.getElementById("members-panel"),
  toggleMembers: document.getElementById("toggle-members"),
  weeksList: document.getElementById("weeks-list"),
  weekStatus: document.getElementById("week-status"),
  weeklyTasks: document.getElementById("weekly-tasks"),
  saveWeek: document.getElementById("save-week"),
  exportTeam: document.getElementById("export-team"),
  exportAll: document.getElementById("export-all"),
  exportStatus: document.getElementById("export-status"),
  clearToken: document.getElementById("clear-token"),
  actorSelect: document.getElementById("actor-select"),
  toast: document.getElementById("toast"),
};

const showToast = (message) => {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(elements.toast.dataset.timeoutId);
  const timeoutId = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 3000);
  elements.toast.dataset.timeoutId = timeoutId;
};

const ensureWeekId = async (teamId, isoWeek) => {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO weeks (team_id, iso_week)
    VALUES (${teamId}, ${isoWeek})
    ON CONFLICT (team_id, iso_week)
    DO UPDATE SET updated_at = NOW()
    RETURNING id
  `;
  return rows[0]?.id;
};

const getDenverNow = () => {
  const localeString = new Date().toLocaleString("en-US", {
    timeZone: "America/Denver",
  });
  return new Date(localeString);
};

const getIsoWeekString = (date) => {
  const target = new Date(date.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const weekNumber =
    1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
};

const buildDefaultState = () => ({
  weeklyFocusSet: false,
  roleplayDone: false,
  firstMeetings: 0,
  signedRecruits: 0,
  goals: "",
  notes: "",
});

const ensureMemberData = (memberId) => {
  if (!state.weekData.states[memberId]) {
    state.weekData.states[memberId] = buildDefaultState();
  }
  if (!state.weekData.roleplays[memberId]) {
    state.weekData.roleplays[memberId] = [];
  }
};

const ensureWeekTaskData = () => {
  if (!Array.isArray(state.weekData.weekTasks)) {
    state.weekData.weekTasks = [];
  }
  if (!state.weekData.taskAttendance) {
    state.weekData.taskAttendance = {};
  }
  state.weekData.weekTasks.forEach((task) => {
    if (!state.weekData.taskAttendance[task.id]) {
      state.weekData.taskAttendance[task.id] = {};
    }
    state.roster.forEach((member) => {
      if (state.weekData.taskAttendance[task.id][member.id] === undefined) {
        state.weekData.taskAttendance[task.id][member.id] = false;
      }
    });
  });
};

const loadTeams = async () => {
  const sql = getSql();
  const rows = await sql`SELECT id, name FROM teams ORDER BY name ASC`;
  state.teams = rows || [];
  elements.teamSelect.innerHTML = "";
  state.teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.id === "all" ? "All Teams" : team.name;
    elements.teamSelect.append(option);
  });
  const assignableTeams = state.teams.filter((team) => team.id !== "all");
  elements.newMemberTeam.innerHTML = "";
  assignableTeams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    elements.newMemberTeam.append(option);
  });
};

const loadRoster = async () => {
  const sql = getSql();
  const rows =
    state.teamId === "all"
      ? await sql`
          SELECT id, name, active, email, phone, team_id
          FROM members
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT id, name, active, email, phone, team_id
          FROM members
          WHERE team_id = ${state.teamId}
          ORDER BY created_at ASC
        `;
  state.roster = rows || [];
};

const loadWeek = async () => {
  const sql = getSql();
  const weekId = await ensureWeekId(state.teamId, state.isoWeek);
  const members =
    state.teamId === "all"
      ? await sql`
          SELECT id, name, active, email, phone, team_id
          FROM members
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT id, name, active, email, phone, team_id
          FROM members
          WHERE team_id = ${state.teamId}
          ORDER BY created_at ASC
        `;
  const stateRows = await sql`
    SELECT member_id, weekly_focus_set, roleplay_done, first_meetings, signed_recruits, goals, notes, updated_at
    FROM member_week_state
    WHERE week_id = ${weekId}
  `;
  const taskRows = await sql`
    SELECT id, label, created_at, updated_at
    FROM weekly_tasks
    WHERE week_id = ${weekId}
    ORDER BY created_at ASC
  `;
  const attendanceRows = await sql`
    SELECT task_id, member_id, attended, updated_at
    FROM task_attendance
    WHERE task_id IN (SELECT id FROM weekly_tasks WHERE week_id = ${weekId})
  `;
  const roleplayRows = await sql`
    SELECT id, member_id, type, note, timestamp, created_at
    FROM roleplays
    WHERE week_id = ${weekId}
    ORDER BY timestamp ASC
  `;

  const states = {};
  stateRows.forEach((row) => {
    states[row.member_id] = {
      weeklyFocusSet: row.weekly_focus_set,
      roleplayDone: row.roleplay_done,
      firstMeetings: row.first_meetings,
      signedRecruits: row.signed_recruits,
      goals: row.goals || "",
      notes: row.notes || "",
      updatedAt: row.updated_at,
    };
  });

  const weekTasks = taskRows.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const taskAttendance = {};
  attendanceRows.forEach((row) => {
    if (!taskAttendance[row.task_id]) {
      taskAttendance[row.task_id] = {};
    }
    taskAttendance[row.task_id][row.member_id] = row.attended;
  });

  const roleplays = {};
  roleplayRows.forEach((row) => {
    if (!roleplays[row.member_id]) roleplays[row.member_id] = [];
    roleplays[row.member_id].push({
      id: row.id,
      type: row.type,
      note: row.note,
      timestamp: row.timestamp,
      createdAt: row.created_at,
    });
  });

  (members || []).forEach((member) => {
    if (!states[member.id]) {
      states[member.id] = buildDefaultState();
    }
    if (!roleplays[member.id]) {
      roleplays[member.id] = [];
    }
  });

  state.weekData = {
    states,
    roleplays,
    weekTasks,
    taskAttendance,
  };
  if (Array.isArray(members)) {
    state.roster = members;
  }
  state.roster.forEach((member) => ensureMemberData(member.id));
  ensureWeekTaskData();
};

const loadWeeksList = async () => {
  const sql = getSql();
  const rows = await sql`
    SELECT iso_week
    FROM weeks
    WHERE team_id = ${state.teamId}
    ORDER BY iso_week DESC
  `;
  state.weeksList = (rows || []).map((row) => row.iso_week);
};

const renderRoster = () => {
  elements.rosterList.innerHTML = "";
  if (state.roster.length === 0) {
    elements.rosterList.textContent = "No members yet.";
    return;
  }
  const assignableTeams = state.teams.filter((team) => team.id !== "all");

  state.roster.forEach((member) => {
    const row = document.createElement("div");
    row.className = "roster-row";

    const nameInput = document.createElement("input");
    nameInput.value = member.name;
    nameInput.placeholder = "Name";
    nameInput.addEventListener("input", (event) => {
      member.name = event.target.value;
    });

    const emailInput = document.createElement("input");
    emailInput.value = member.email || "";
    emailInput.placeholder = "Email (optional)";
    emailInput.addEventListener("input", (event) => {
      member.email = event.target.value;
    });

    const phoneInput = document.createElement("input");
    phoneInput.value = member.phone || "";
    phoneInput.placeholder = "Phone (optional)";
    phoneInput.addEventListener("input", (event) => {
      member.phone = event.target.value;
    });

    const activeToggle = document.createElement("select");
    activeToggle.innerHTML = `
      <option value="true">Active</option>
      <option value="false">Inactive</option>
    `;
    activeToggle.value = String(member.active);
    activeToggle.addEventListener("change", (event) => {
      member.active = event.target.value === "true";
      renderMembers();
    });

    const teamSelect = document.createElement("select");
    assignableTeams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name;
      teamSelect.append(option);
    });
    teamSelect.value = member.team_id || state.teamId;
    teamSelect.addEventListener("change", (event) => {
      member.team_id = event.target.value;
    });

    row.append(nameInput, emailInput, phoneInput, teamSelect, activeToggle);
    elements.rosterList.append(row);
  });
};

const renderWeeksList = () => {
  elements.weeksList.innerHTML = "";
  if (state.weeksList.length === 0) {
    elements.weeksList.textContent = "No history yet.";
    return;
  }

  state.weeksList.forEach((week) => {
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = week;
    if (week === state.isoWeek) {
      button.classList.add("active");
    }
    button.addEventListener("click", async () => {
      state.isoWeek = week;
      elements.isoWeek.value = week;
      await loadWeek();
      renderMembers();
      renderWeeksList();
    });
    elements.weeksList.append(button);
  });
};

const renderMemberCard = (member) => {
  ensureMemberData(member.id);
  const data = state.weekData.states[member.id];

  const card = document.createElement("div");
  card.className = "member-card";

  const title = document.createElement("h3");
  title.textContent = member.name;

  const counters = document.createElement("div");
  counters.className = "stack";

  const buildCounter = (label, key) => {
    const wrapper = document.createElement("div");
    wrapper.className = "counter";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    minus.addEventListener("click", () => {
      data[key] = Math.max(0, data[key] - 1);
      value.textContent = data[key];
    });

    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      data[key] += 1;
      value.textContent = data[key];
    });

    const value = document.createElement("span");
    value.textContent = data[key];

    const labelEl = document.createElement("strong");
    labelEl.textContent = label;

    wrapper.append(labelEl, minus, value, plus);
    return wrapper;
  };

  counters.append(buildCounter("Recruits", "signedRecruits"));

  const goalsField = document.createElement("label");
  goalsField.className = "field";
  const goalsLabel = document.createElement("span");
  goalsLabel.textContent = "Goals";
  const goalsInput = document.createElement("textarea");
  goalsInput.value = data.goals || "";
  goalsInput.addEventListener("input", (event) => {
    data.goals = event.target.value;
  });
  goalsField.append(goalsLabel, goalsInput);

  const notesField = document.createElement("label");
  notesField.className = "field";
  const notesLabel = document.createElement("span");
  notesLabel.textContent = "Notes";
  const notesInput = document.createElement("textarea");
  notesInput.value = data.notes;
  notesInput.addEventListener("input", (event) => {
    data.notes = event.target.value;
  });
  notesField.append(notesLabel, notesInput);

  card.append(title, counters, goalsField, notesField);
  return card;
};

const renderWeeklyTasks = (activeMembers) => {
  if (!elements.weeklyTasks) return;
  elements.weeklyTasks.innerHTML = "";

  const section = document.createElement("div");
  section.className = "weekly-tasks stack";

  const heading = document.createElement("div");
  heading.className = "panel-header";
  const title = document.createElement("h3");
  title.textContent = "Weekly tasks & attendance";
  heading.append(title);

  const note = document.createElement("p");
  note.className = "muted";
  note.textContent =
    "Add shared tasks for the week and mark attendance for each active teammate.";

  const list = document.createElement("div");
  list.className = "stack";
  let pendingFocusTaskId = null;

  const renderTaskRows = () => {
    list.innerHTML = "";
    ensureWeekTaskData();

    if (state.weekData.weekTasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No weekly tasks yet.";
      list.append(empty);
      return;
    }

    state.weekData.weekTasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "weekly-task-row";

      const header = document.createElement("div");
      header.className = "weekly-task-header";

      const labelInput = document.createElement("input");
      labelInput.value = task.label;
      labelInput.placeholder = "Task name";
      labelInput.addEventListener("input", (event) => {
        task.label = event.target.value;
      });
      if (pendingFocusTaskId === task.id) {
        requestAnimationFrame(() => {
          labelInput.focus();
          labelInput.select();
        });
        pendingFocusTaskId = null;
      }

      const summary = document.createElement("span");
      summary.className = "attendance-summary muted";

      const updateSummary = () => {
        const total = activeMembers.length;
        const present = activeMembers.filter(
          (member) => state.weekData.taskAttendance?.[task.id]?.[member.id]
        ).length;
        summary.textContent =
          total > 0 ? `${present}/${total} marked` : "No active members";
      };

      const checkAllLabel = document.createElement("label");
      checkAllLabel.className = "attendance-toggle attendance-toggle--all";
      const checkAllInput = document.createElement("input");
      checkAllInput.type = "checkbox";
      const checkAllText = document.createElement("span");
      checkAllText.textContent = "Check all";

      const updateCheckAll = () => {
        const allChecked =
          activeMembers.length > 0 &&
          activeMembers.every(
            (member) =>
              state.weekData.taskAttendance?.[task.id]?.[member.id] === true
          );
        checkAllInput.checked = allChecked;
        checkAllInput.disabled = activeMembers.length === 0;
      };

      checkAllInput.addEventListener("change", (event) => {
        if (!state.weekData.taskAttendance[task.id]) {
          state.weekData.taskAttendance[task.id] = {};
        }
        activeMembers.forEach((member) => {
          state.weekData.taskAttendance[task.id][member.id] =
            event.target.checked;
        });
        renderTaskRows();
      });

      checkAllLabel.append(checkAllInput, checkAllText);

      header.append(labelInput, summary, checkAllLabel);

      const attendanceList = document.createElement("div");
      attendanceList.className = "attendance-list";

      if (activeMembers.length === 0) {
        const emptyMembers = document.createElement("span");
        emptyMembers.className = "muted";
        emptyMembers.textContent = "Add active members to mark attendance.";
        attendanceList.append(emptyMembers);
      } else {
        activeMembers.forEach((member) => {
          const toggle = document.createElement("label");
          toggle.className = "attendance-toggle";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = Boolean(
            state.weekData.taskAttendance?.[task.id]?.[member.id]
          );
          checkbox.addEventListener("change", (event) => {
            if (!state.weekData.taskAttendance[task.id]) {
              state.weekData.taskAttendance[task.id] = {};
            }
            state.weekData.taskAttendance[task.id][member.id] =
              event.target.checked;
            updateSummary();
            updateCheckAll();
          });
          const name = document.createElement("span");
          name.textContent = member.name;
          toggle.append(checkbox, name);
          attendanceList.append(toggle);
        });
      }

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const remove = document.createElement("button");
      remove.className = "danger";
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        state.weekData.weekTasks = state.weekData.weekTasks.filter(
          (entry) => entry.id !== task.id
        );
        delete state.weekData.taskAttendance[task.id];
        renderTaskRows();
      });

      actions.append(remove);

      updateSummary();
      updateCheckAll();
      row.append(header, attendanceList, actions);
      list.append(row);
    });
  };

  const controls = document.createElement("div");
  controls.className = "inline";

  const addTask = document.createElement("button");
  addTask.className = "secondary";
  addTask.type = "button";
  addTask.textContent = "Add task";
  addTask.addEventListener("click", () => {
    const id = crypto.randomUUID();
    state.weekData.weekTasks.push({ id, label: "" });
    state.weekData.taskAttendance[id] = {};
    state.roster.forEach((member) => {
      state.weekData.taskAttendance[id][member.id] = false;
    });
    pendingFocusTaskId = id;
    renderTaskRows();
  });
  controls.append(addTask);

  heading.append(controls);

  section.append(heading, note, list);
  elements.weeklyTasks.append(section);
  renderTaskRows();
};

const renderMembers = () => {
  elements.membersPanel.innerHTML = "";
  const activeMembers = state.roster.filter((member) => member.active);
  renderWeeklyTasks(activeMembers);
  if (elements.toggleMembers) {
    elements.toggleMembers.textContent = state.membersExpanded
      ? "Hide individuals"
      : "Edit individuals";
  }
  if (!state.membersExpanded) {
    elements.membersPanel.classList.add("hidden");
    return;
  }
  elements.membersPanel.classList.remove("hidden");
  if (activeMembers.length === 0) {
    elements.membersPanel.textContent = "No active members yet.";
    return;
  }
  activeMembers.forEach((member) => {
    elements.membersPanel.append(renderMemberCard(member));
  });
};

const exportHistory = async (query, label) => {
  elements.exportStatus.textContent = "Preparing export...";
  const sql = getSql();
  const params = new URLSearchParams(query);
  const allTeams = params.get("allTeams") === "1";
  const teamId = params.get("teamId");
  if (!teamId && !allTeams) {
    throw new Error("teamId or allTeams=1 is required");
  }

  const weekRows = allTeams
    ? await sql`
        SELECT id, team_id, iso_week
        FROM weeks
        ORDER BY team_id ASC, iso_week ASC
      `
    : await sql`
        SELECT id, team_id, iso_week
        FROM weeks
        WHERE team_id = ${teamId}
        ORDER BY iso_week ASC
      `;

  const history = [];

  for (const week of weekRows) {
    const members = await sql`
      SELECT id, name, active, email, phone
      FROM members
      WHERE team_id = ${week.team_id}
      ORDER BY created_at ASC
    `;

    const memberMap = new Map();
    members.forEach((member) => {
      memberMap.set(member.id, {
        memberId: member.id,
        name: member.name,
        active: member.active,
        email: member.email,
        phone: member.phone,
        state: buildDefaultState(),
        roleplays: [],
      });
    });

    const stateRows = await sql`
      SELECT member_id, weekly_focus_set, roleplay_done, first_meetings, signed_recruits, goals, notes
      FROM member_week_state
      WHERE week_id = ${week.id}
    `;

    stateRows.forEach((row) => {
      const entry = memberMap.get(row.member_id);
      if (!entry) return;
      entry.state = {
        weeklyFocusSet: row.weekly_focus_set,
        roleplayDone: row.roleplay_done,
        firstMeetings: row.first_meetings,
        signedRecruits: row.signed_recruits,
        goals: row.goals || "",
        notes: row.notes || "",
      };
    });

    const taskRows = await sql`
      SELECT id, label
      FROM weekly_tasks
      WHERE week_id = ${week.id}
      ORDER BY created_at ASC
    `;

    const attendanceRows = await sql`
      SELECT task_id, member_id, attended
      FROM task_attendance
      WHERE task_id IN (SELECT id FROM weekly_tasks WHERE week_id = ${week.id})
    `;

    const taskAttendance = {};
    attendanceRows.forEach((row) => {
      if (!taskAttendance[row.task_id]) {
        taskAttendance[row.task_id] = {};
      }
      taskAttendance[row.task_id][row.member_id] = row.attended;
    });

    const roleplayRows = await sql`
      SELECT id, member_id, type, note, timestamp
      FROM roleplays
      WHERE week_id = ${week.id}
      ORDER BY timestamp ASC
    `;

    roleplayRows.forEach((row) => {
      const entry = memberMap.get(row.member_id);
      if (!entry) return;
      entry.roleplays.push({
        id: row.id,
        type: row.type,
        note: row.note,
        timestamp: row.timestamp,
      });
    });

    history.push({
      teamId: week.team_id,
      isoWeek: week.iso_week,
      weekTasks: taskRows.map((row) => ({
        id: row.id,
        label: row.label,
        attendance: taskAttendance[row.id] || {},
      })),
      members: Array.from(memberMap.values()),
    });
  }

  const json = JSON.stringify(history, null, 2);
  await navigator.clipboard.writeText(json);
  const prompt = `${label} copied. Analyze weekly trends and highlight wins, risks, and coaching actions.`;
  const urlPrompt = encodeURIComponent(prompt);
  window.open(`https://chatgpt.com/?q=${urlPrompt}`, "_blank", "noopener");
  elements.exportStatus.textContent = "JSON copied. Paste into ChatGPT.";
  showToast("JSON copied. Paste into ChatGPT.");
};

const saveRoster = async () => {
  const sql = getSql();
  for (const member of state.roster) {
    const name = member.name?.trim() || "";
    const email = member.email?.trim() || null;
    const phone = member.phone?.trim() || null;
    const teamId = member.team_id || state.teamId;
    await sql`
      UPDATE members
      SET name = ${name},
          active = ${Boolean(member.active)},
          email = ${email},
          phone = ${phone},
          team_id = ${teamId},
          updated_at = NOW()
      WHERE id = ${member.id}
    `;
  }
};

const saveWeek = async () => {
  elements.weekStatus.textContent = "Saving...";
  const sql = getSql();
  const weekId = await ensureWeekId(state.teamId, state.isoWeek);

  for (const member of state.roster) {
    ensureMemberData(member.id);
    const memberState = state.weekData.states[member.id];
    await sql`
      INSERT INTO member_week_state
        (week_id, member_id, weekly_focus_set, roleplay_done, first_meetings, signed_recruits, goals, notes, updated_at)
      VALUES (
        ${weekId},
        ${member.id},
        ${Boolean(memberState.weeklyFocusSet)},
        ${Boolean(memberState.roleplayDone)},
        ${Number(memberState.firstMeetings) || 0},
        ${Number(memberState.signedRecruits) || 0},
        ${memberState.goals || ""},
        ${memberState.notes || ""},
        NOW()
      )
      ON CONFLICT (week_id, member_id)
      DO UPDATE SET
        weekly_focus_set = EXCLUDED.weekly_focus_set,
        roleplay_done = EXCLUDED.roleplay_done,
        first_meetings = EXCLUDED.first_meetings,
        signed_recruits = EXCLUDED.signed_recruits,
        goals = EXCLUDED.goals,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;

    const roleplays = state.weekData.roleplays[member.id] || [];
    await sql`
      DELETE FROM roleplays
      WHERE week_id = ${weekId} AND member_id = ${member.id}
    `;
    for (const entry of roleplays) {
      if (!entry.id || !entry.type?.trim()) continue;
      await sql`
        INSERT INTO roleplays (id, week_id, member_id, type, note, timestamp, created_at)
        VALUES (
          ${entry.id},
          ${weekId},
          ${member.id},
          ${entry.type.trim()},
          ${entry.note?.trim() || null},
          ${entry.timestamp ? new Date(entry.timestamp) : new Date()},
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET type = EXCLUDED.type, note = EXCLUDED.note, timestamp = EXCLUDED.timestamp
      `;
    }
  }

  await sql`
    DELETE FROM task_attendance
    WHERE task_id IN (SELECT id FROM weekly_tasks WHERE week_id = ${weekId})
  `;
  await sql`DELETE FROM weekly_tasks WHERE week_id = ${weekId}`;

  for (const task of state.weekData.weekTasks) {
    if (!task.id || !task.label?.trim()) continue;
    await sql`
      INSERT INTO weekly_tasks (id, week_id, label, updated_at)
      VALUES (${task.id}, ${weekId}, ${task.label.trim()}, NOW())
      ON CONFLICT (id)
      DO UPDATE SET label = EXCLUDED.label, updated_at = NOW()
    `;
  }

  if (state.weekData.taskAttendance) {
    for (const [taskId, attendanceMap] of Object.entries(
      state.weekData.taskAttendance
    )) {
      if (!taskId) continue;
      for (const [memberId, attended] of Object.entries(attendanceMap || {})) {
        if (!memberId) continue;
        await sql`
          INSERT INTO task_attendance (task_id, member_id, attended, updated_at)
          VALUES (${taskId}, ${memberId}, ${Boolean(attended)}, NOW())
          ON CONFLICT (task_id, member_id)
          DO UPDATE SET attended = EXCLUDED.attended, updated_at = NOW()
        `;
      }
    }
  }

  elements.weekStatus.textContent = `Saved ${state.isoWeek}.`;
  await loadWeeksList();
  renderWeeksList();
};

const initialize = async () => {
  if (!state.databaseUrl) {
    window.location.href = "/index.html";
    return;
  }

  elements.actorSelect.value = state.actor;

  await loadTeams();
  if (state.teams.length > 0) {
    const allTeam = state.teams.find((team) => team.id === "all");
    state.teamId = allTeam ? allTeam.id : state.teams[0].id;
    elements.teamSelect.value = state.teamId;
  }
  if (elements.newMemberTeam.options.length > 0) {
    elements.newMemberTeam.value =
      state.teamId === "all"
        ? elements.newMemberTeam.options[0].value
        : state.teamId;
  }

  state.isoWeek = getIsoWeekString(getDenverNow());
  elements.isoWeek.value = state.isoWeek;

  await loadRoster();
  await loadWeek();
  await loadWeeksList();

  renderRoster();
  renderMembers();
  renderWeeksList();
};

if (!state.databaseUrl) {
  window.location.href = "/index.html";
}

elements.teamSelect.addEventListener("change", async (event) => {
  state.teamId = event.target.value;
  state.isoWeek = getIsoWeekString(getDenverNow());
  elements.isoWeek.value = state.isoWeek;
  if (elements.newMemberTeam.options.length > 0) {
    elements.newMemberTeam.value =
      state.teamId === "all"
        ? elements.newMemberTeam.options[0].value
        : state.teamId;
  }
  await loadRoster();
  await loadWeek();
  await loadWeeksList();
  renderRoster();
  renderMembers();
  renderWeeksList();
});

elements.addMember.addEventListener("click", async () => {
  const name = elements.newMemberName.value.trim();
  if (!name) return;
  const email = elements.newMemberEmail.value.trim();
  const phone = elements.newMemberPhone.value.trim();
  const selectedTeam = elements.newMemberTeam.value || state.teamId;
  const sql = getSql();
  const rows = await sql`
    INSERT INTO members (team_id, name, active, email, phone)
    VALUES (${selectedTeam}, ${name}, true, ${email || null}, ${phone || null})
    RETURNING id, name, active, email, phone, team_id
  `;
  const member = rows[0];
  if (member) {
    state.roster.push(member);
    ensureMemberData(member.id);
  }
  elements.newMemberName.value = "";
  elements.newMemberEmail.value = "";
  elements.newMemberPhone.value = "";
  renderRoster();
  renderMembers();
});

elements.saveRoster.addEventListener("click", async () => {
  await saveRoster();
  elements.weekStatus.textContent = "Roster saved.";
});

elements.saveWeek.addEventListener("click", async () => {
  await saveWeek();
});

elements.exportTeam.addEventListener("click", async () => {
  await exportHistory(`teamId=${state.teamId}`, "Team history JSON");
});

elements.exportAll.addEventListener("click", async () => {
  await exportHistory("allTeams=1", "All teams history JSON");
});

elements.clearToken.addEventListener("click", () => {
  localStorage.removeItem("fitHubDatabaseUrl");
  window.location.href = "/index.html";
});

elements.actorSelect.addEventListener("change", (event) => {
  state.actor = event.target.value;
  localStorage.setItem("fitHubActor", state.actor);
});

elements.toggleMembers.addEventListener("click", () => {
  state.membersExpanded = !state.membersExpanded;
  renderMembers();
});

initialize().catch((error) => {
  console.error(error);
  elements.weekStatus.textContent = error.message;
});
