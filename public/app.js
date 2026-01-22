const state = {
  token: localStorage.getItem("fitHubToken"),
  actor: localStorage.getItem("fitHubActor") || "Braxton",
  teamId: "braxton",
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
};

const elements = {
  teamSelect: document.getElementById("team-select"),
  isoWeek: document.getElementById("iso-week"),
  rosterList: document.getElementById("roster-list"),
  newMemberName: document.getElementById("new-member-name"),
  newMemberEmail: document.getElementById("new-member-email"),
  newMemberPhone: document.getElementById("new-member-phone"),
  addMember: document.getElementById("add-member"),
  saveRoster: document.getElementById("save-roster"),
  membersPanel: document.getElementById("members-panel"),
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

const apiFetch = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set("x-admin-token", state.token || "");
  headers.set("x-actor", state.actor || "Unknown");
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    alert("Invalid or missing admin token. Please re-enter.");
    localStorage.removeItem("fitHubToken");
    window.location.href = "/index.html";
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
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
  const data = await apiFetch("teams-list");
  state.teams = data.teams || [];
  elements.teamSelect.innerHTML = "";
  state.teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    elements.teamSelect.append(option);
  });
};

const loadRoster = async () => {
  const data = await apiFetch(`roster-get?teamId=${state.teamId}`);
  state.roster = data.members || [];
};

const loadWeek = async () => {
  const data = await apiFetch(
    `week-get?teamId=${state.teamId}&isoWeek=${state.isoWeek}`
  );
  state.weekData = {
    states: data.states || {},
    roleplays: data.roleplays || {},
    weekTasks: data.weekTasks || [],
    taskAttendance: data.taskAttendance || {},
  };
  if (Array.isArray(data.members)) {
    state.roster = data.members;
  }
  state.roster.forEach((member) => ensureMemberData(member.id));
  ensureWeekTaskData();
};

const loadWeeksList = async () => {
  const data = await apiFetch(`weeks-list?teamId=${state.teamId}`);
  state.weeksList = data.weeks || [];
};

const renderRoster = () => {
  elements.rosterList.innerHTML = "";
  if (state.roster.length === 0) {
    elements.rosterList.textContent = "No members yet.";
    return;
  }

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

    row.append(nameInput, emailInput, phoneInput, activeToggle);
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
  const roleplays = state.weekData.roleplays[member.id];

  const card = document.createElement("div");
  card.className = "member-card";

  const title = document.createElement("h3");
  title.textContent = member.name;

  const checklist = document.createElement("div");
  checklist.className = "checklist";

  const weeklyFocus = document.createElement("label");
  const weeklyFocusInput = document.createElement("input");
  weeklyFocusInput.type = "checkbox";
  weeklyFocusInput.checked = data.weeklyFocusSet;
  weeklyFocusInput.addEventListener("change", (event) => {
    data.weeklyFocusSet = event.target.checked;
  });
  weeklyFocus.append(weeklyFocusInput, "Weekly focus set");

  const roleplayDone = document.createElement("label");
  const roleplayInput = document.createElement("input");
  roleplayInput.type = "checkbox";
  roleplayInput.checked = data.roleplayDone;
  roleplayInput.addEventListener("change", (event) => {
    data.roleplayDone = event.target.checked;
  });
  roleplayDone.append(roleplayInput, "Roleplay done");

  checklist.append(weeklyFocus, roleplayDone);

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

  counters.append(
    buildCounter("First meetings", "firstMeetings"),
    buildCounter("Signed recruits", "signedRecruits")
  );

  const roleplaySection = document.createElement("div");
  roleplaySection.className = "stack";
  const roleplayTitle = document.createElement("strong");
  roleplayTitle.textContent = "Roleplay logs";

  const roleplayList = document.createElement("div");
  roleplayList.className = "stack";

  const renderRoleplays = () => {
    roleplayList.innerHTML = "";
    roleplays.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "roleplay-item";
      const type = document.createElement("input");
      type.value = entry.type;
      type.addEventListener("input", (event) => {
        entry.type = event.target.value;
      });
      const note = document.createElement("input");
      note.value = entry.note || "";
      note.addEventListener("input", (event) => {
        entry.note = event.target.value;
      });
      const timestamp = document.createElement("span");
      timestamp.className = "muted";
      timestamp.textContent = new Date(entry.timestamp).toLocaleString();
      const remove = document.createElement("button");
      remove.className = "danger";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        state.weekData.roleplays[member.id] = roleplays.filter(
          (r) => r.id !== entry.id
        );
        renderRoleplays();
      });
      row.append(type, note, timestamp, remove);
      roleplayList.append(row);
    });
  };

  const roleplayControls = document.createElement("div");
  roleplayControls.className = "inline";
  const roleplayType = document.createElement("input");
  roleplayType.placeholder = "Type (pitch, objection, close)";
  const roleplayNote = document.createElement("input");
  roleplayNote.placeholder = "Notes";
  const addRoleplay = document.createElement("button");
  addRoleplay.className = "secondary";
  addRoleplay.textContent = "Add";
  addRoleplay.addEventListener("click", () => {
    if (!roleplayType.value.trim()) return;
    roleplays.push({
      id: crypto.randomUUID(),
      type: roleplayType.value.trim(),
      note: roleplayNote.value.trim(),
      timestamp: new Date().toISOString(),
    });
    roleplayType.value = "";
    roleplayNote.value = "";
    renderRoleplays();
  });
  roleplayControls.append(roleplayType, roleplayNote, addRoleplay);

  roleplaySection.append(roleplayTitle, roleplayList, roleplayControls);
  renderRoleplays();

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

  card.append(title, checklist, counters, roleplaySection, notesField);
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

  const controls = document.createElement("div");
  controls.className = "weekly-task-controls";
  const taskInput = document.createElement("input");
  taskInput.placeholder = "New weekly task name";
  const addTask = document.createElement("button");
  addTask.className = "secondary";
  addTask.type = "button";
  addTask.textContent = "Add task";
  const addTaskHandler = () => {
    const label = taskInput.value.trim();
    if (!label) return;
    const id = crypto.randomUUID();
    state.weekData.weekTasks.push({ id, label });
    state.weekData.taskAttendance[id] = {};
    state.roster.forEach((member) => {
      state.weekData.taskAttendance[id][member.id] = false;
    });
    taskInput.value = "";
    renderTaskRows();
  };
  addTask.addEventListener("click", addTaskHandler);
  taskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTaskHandler();
    }
  });
  controls.append(taskInput, addTask);

  const list = document.createElement("div");
  list.className = "stack";

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

      header.append(labelInput, summary);

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
          });
          const name = document.createElement("span");
          name.textContent = member.name;
          toggle.append(checkbox, name);
          attendanceList.append(toggle);
        });
      }

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const markAll = document.createElement("button");
      markAll.type = "button";
      markAll.className = "secondary";
      markAll.textContent = "Mark all";
      markAll.addEventListener("click", () => {
        if (!state.weekData.taskAttendance[task.id]) {
          state.weekData.taskAttendance[task.id] = {};
        }
        activeMembers.forEach((member) => {
          state.weekData.taskAttendance[task.id][member.id] = true;
        });
        renderTaskRows();
      });

      const clearAll = document.createElement("button");
      clearAll.type = "button";
      clearAll.className = "secondary";
      clearAll.textContent = "Clear all";
      clearAll.addEventListener("click", () => {
        if (!state.weekData.taskAttendance[task.id]) {
          state.weekData.taskAttendance[task.id] = {};
        }
        activeMembers.forEach((member) => {
          state.weekData.taskAttendance[task.id][member.id] = false;
        });
        renderTaskRows();
      });

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

      actions.append(markAll, clearAll, remove);

      updateSummary();
      row.append(header, attendanceList, actions);
      list.append(row);
    });
  };

  section.append(heading, note, controls, list);
  elements.weeklyTasks.append(section);
  renderTaskRows();
};

const renderMembers = () => {
  elements.membersPanel.innerHTML = "";
  const activeMembers = state.roster.filter((member) => member.active);
  renderWeeklyTasks(activeMembers);
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
  const data = await apiFetch(`history-export?${query}`);
  const json = JSON.stringify(data, null, 2);
  await navigator.clipboard.writeText(json);
  const prompt = `${label} copied. Analyze weekly trends and highlight wins, risks, and coaching actions.`;
  const urlPrompt = encodeURIComponent(prompt);
  window.open(`https://chatgpt.com/?q=${urlPrompt}`, "_blank", "noopener");
  elements.exportStatus.textContent = "JSON copied. Paste into ChatGPT.";
  showToast("JSON copied. Paste into ChatGPT.");
};

const saveRoster = async () => {
  for (const member of state.roster) {
    await apiFetch("roster-update", {
      method: "PUT",
      body: JSON.stringify({
        memberId: member.id,
        name: member.name,
        active: member.active,
        email: member.email,
        phone: member.phone,
      }),
    });
  }
};

const saveWeek = async () => {
  elements.weekStatus.textContent = "Saving...";
  let tasksSaved = false;
  for (const member of state.roster) {
    ensureMemberData(member.id);
    const payload = {
      memberId: member.id,
      state: state.weekData.states[member.id],
      roleplays: state.weekData.roleplays[member.id],
    };
    if (!tasksSaved) {
      payload.weekTasks = state.weekData.weekTasks;
      payload.taskAttendance = state.weekData.taskAttendance;
      tasksSaved = true;
    }
    await apiFetch(`week-patch?teamId=${state.teamId}&isoWeek=${state.isoWeek}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }
  elements.weekStatus.textContent = `Saved ${state.isoWeek}.`;
  await loadWeeksList();
  renderWeeksList();
};

const initialize = async () => {
  if (!state.token) {
    window.location.href = "/index.html";
    return;
  }

  elements.actorSelect.value = state.actor;

  await loadTeams();
  if (state.teams.length > 0) {
    state.teamId = state.teams[0].id;
    elements.teamSelect.value = state.teamId;
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

if (!state.token) {
  window.location.href = "/index.html";
}

elements.teamSelect.addEventListener("change", async (event) => {
  state.teamId = event.target.value;
  state.isoWeek = getIsoWeekString(getDenverNow());
  elements.isoWeek.value = state.isoWeek;
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
  const data = await apiFetch(`roster-save?teamId=${state.teamId}`, {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      phone,
      active: true,
    }),
  });
  if (data?.member) {
    state.roster.push(data.member);
    ensureMemberData(data.member.id);
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
  localStorage.removeItem("fitHubToken");
  window.location.href = "/index.html";
});

elements.actorSelect.addEventListener("change", (event) => {
  state.actor = event.target.value;
  localStorage.setItem("fitHubActor", state.actor);
});

initialize().catch((error) => {
  console.error(error);
  elements.weekStatus.textContent = error.message;
});
