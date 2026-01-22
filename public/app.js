const state = {
  token: localStorage.getItem("fitHubToken"),
  actor: localStorage.getItem("fitHubActor") || "Braxton",
  teamId: "braxton",
  isoWeek: "",
  roster: null,
  week: null,
  weeksList: [],
};

const elements = {
  teamSelect: document.getElementById("team-select"),
  isoWeek: document.getElementById("iso-week"),
  rosterList: document.getElementById("roster-list"),
  newMemberName: document.getElementById("new-member-name"),
  addMember: document.getElementById("add-member"),
  saveRoster: document.getElementById("save-roster"),
  membersPanel: document.getElementById("members-panel"),
  weeksList: document.getElementById("weeks-list"),
  weekStatus: document.getElementById("week-status"),
  saveWeek: document.getElementById("save-week"),
  exportTeam: document.getElementById("export-team"),
  exportAll: document.getElementById("export-all"),
  exportStatus: document.getElementById("export-status"),
  clearToken: document.getElementById("clear-token"),
  actorSelect: document.getElementById("actor-select"),
};

const apiFetch = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  headers.set("x-admin-token", state.token || "");
  headers.set("x-actor", state.actor || "Unknown");

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

const buildEmptyMemberState = () => ({
  checklist: { weeklyFocusSet: false, roleplayDone: false },
  counters: { firstMeetings: 0, signedRecruits: 0 },
  customTasks: [],
  roleplays: [],
  notes: "",
});

const ensureMemberState = (memberId) => {
  if (!state.week.members[memberId]) {
    state.week.members[memberId] = buildEmptyMemberState();
  }
};

const loadRoster = async () => {
  state.roster = await apiFetch(`roster-get?teamId=${state.teamId}`);
};

const saveRoster = async () => {
  const payload = {
    members: state.roster.members,
  };
  state.roster = await apiFetch(`roster-save?teamId=${state.teamId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

const loadWeek = async () => {
  state.week = await apiFetch(
    `week-get?teamId=${state.teamId}&isoWeek=${state.isoWeek}`
  );
};

const saveWeek = async () => {
  const payload = {
    members: state.week.members,
    summary: `Updated week ${state.isoWeek}`,
  };
  state.week = await apiFetch(
    `week-patch?teamId=${state.teamId}&isoWeek=${state.isoWeek}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
};

const loadWeeksList = async () => {
  const data = await apiFetch(`weeks-list?teamId=${state.teamId}`);
  state.weeksList = data.weeks || [];
};

const renderRoster = () => {
  elements.rosterList.innerHTML = "";
  state.roster.members.forEach((member) => {
    const row = document.createElement("div");
    row.className = "inline";

    const nameInput = document.createElement("input");
    nameInput.value = member.name;
    nameInput.addEventListener("input", (event) => {
      member.name = event.target.value;
    });

    const activeToggle = document.createElement("select");
    activeToggle.innerHTML = `
      <option value="true">Active</option>
      <option value="false">Inactive</option>
    `;
    activeToggle.value = String(member.active);
    activeToggle.addEventListener("change", (event) => {
      member.active = event.target.value === "true";
    });

    row.append(nameInput, activeToggle);
    elements.rosterList.append(row);
  });
};

const renderWeeksList = () => {
  elements.weeksList.innerHTML = "";
  if (state.weeksList.length === 0) {
    elements.weeksList.textContent = "No history yet.";
    return;
  }

  state.weeksList
    .slice()
    .sort()
    .forEach((week) => {
      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = week;
      button.addEventListener("click", async () => {
        state.isoWeek = week;
        elements.isoWeek.value = week;
        await loadWeek();
        renderMembers();
      });
      elements.weeksList.append(button);
    });
};

const renderMemberCard = (member) => {
  ensureMemberState(member.id);
  const data = state.week.members[member.id];

  const card = document.createElement("div");
  card.className = "member-card";

  const title = document.createElement("h3");
  title.textContent = member.name;

  const checklist = document.createElement("div");
  checklist.className = "checklist";

  const weeklyFocus = document.createElement("label");
  const weeklyFocusInput = document.createElement("input");
  weeklyFocusInput.type = "checkbox";
  weeklyFocusInput.checked = data.checklist.weeklyFocusSet;
  weeklyFocusInput.addEventListener("change", (event) => {
    data.checklist.weeklyFocusSet = event.target.checked;
  });
  weeklyFocus.append(weeklyFocusInput, "Weekly focus set");

  const roleplayDone = document.createElement("label");
  const roleplayInput = document.createElement("input");
  roleplayInput.type = "checkbox";
  roleplayInput.checked = data.checklist.roleplayDone;
  roleplayInput.addEventListener("change", (event) => {
    data.checklist.roleplayDone = event.target.checked;
  });
  roleplayDone.append(roleplayInput, "Roleplay done");

  checklist.append(weeklyFocus, roleplayDone);

  const counters = document.createElement("div");
  counters.className = "stack";

  const buildCounter = (label, key) => {
    const wrapper = document.createElement("div");
    wrapper.className = "counter";

    const minus = document.createElement("button");
    minus.textContent = "-";
    minus.addEventListener("click", () => {
      data.counters[key] = Math.max(0, data.counters[key] - 1);
      value.textContent = data.counters[key];
    });

    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.addEventListener("click", () => {
      data.counters[key] += 1;
      value.textContent = data.counters[key];
    });

    const value = document.createElement("span");
    value.textContent = data.counters[key];

    const labelEl = document.createElement("strong");
    labelEl.textContent = label;

    wrapper.append(labelEl, minus, value, plus);
    return wrapper;
  };

  counters.append(
    buildCounter("First meetings", "firstMeetings"),
    buildCounter("Signed recruits", "signedRecruits")
  );

  const taskSection = document.createElement("div");
  taskSection.className = "stack";
  const taskTitle = document.createElement("strong");
  taskTitle.textContent = "Custom tasks";

  const taskList = document.createElement("div");
  taskList.className = "stack";

  const renderTasks = () => {
    taskList.innerHTML = "";
    data.customTasks.forEach((task) => {
      const row = document.createElement("div");
      row.className = "task-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.addEventListener("change", (event) => {
        task.done = event.target.checked;
      });
      const label = document.createElement("input");
      label.value = task.label;
      label.addEventListener("input", (event) => {
        task.label = event.target.value;
      });
      const remove = document.createElement("button");
      remove.className = "danger";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        data.customTasks = data.customTasks.filter((t) => t.id !== task.id);
        renderTasks();
      });
      row.append(checkbox, label, remove);
      taskList.append(row);
    });
  };

  const taskControls = document.createElement("div");
  taskControls.className = "inline";
  const taskInput = document.createElement("input");
  taskInput.placeholder = "New task";
  const addTask = document.createElement("button");
  addTask.className = "secondary";
  addTask.textContent = "Add";
  addTask.addEventListener("click", () => {
    if (!taskInput.value.trim()) return;
    data.customTasks.push({
      id: crypto.randomUUID(),
      label: taskInput.value.trim(),
      done: false,
    });
    taskInput.value = "";
    renderTasks();
  });
  taskControls.append(taskInput, addTask);

  taskSection.append(taskTitle, taskList, taskControls);
  renderTasks();

  const roleplaySection = document.createElement("div");
  roleplaySection.className = "stack";
  const roleplayTitle = document.createElement("strong");
  roleplayTitle.textContent = "Roleplay logs";

  const roleplayList = document.createElement("div");
  roleplayList.className = "stack";

  const renderRoleplays = () => {
    roleplayList.innerHTML = "";
    data.roleplays.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "roleplay-item";
      const type = document.createElement("input");
      type.value = entry.type;
      type.addEventListener("input", (event) => {
        entry.type = event.target.value;
      });
      const note = document.createElement("input");
      note.value = entry.note;
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
        data.roleplays = data.roleplays.filter((r) => r.id !== entry.id);
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
    data.roleplays.push({
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

  card.append(title, checklist, counters, taskSection, roleplaySection, notesField);
  return card;
};

const renderMembers = () => {
  elements.membersPanel.innerHTML = "";
  const activeMembers = state.roster.members.filter((member) => member.active);
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
  const prompt = `${label} data copied to clipboard. Analyze weekly trends and highlight wins, risks, and coaching actions.`;
  const urlPrompt = encodeURIComponent(prompt);
  const chatUrl = `https://chat.openai.com/?q=${urlPrompt}`;
  window.open(chatUrl, "_blank", "noopener");
  elements.exportStatus.textContent = "Copied to clipboard. ChatGPT opened.";
};

const initialize = async () => {
  if (!state.token) {
    window.location.href = "/index.html";
    return;
  }

  elements.actorSelect.value = state.actor;
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
  state.roster.members.push({
    id: crypto.randomUUID(),
    name,
    active: true,
    meta: { phone: "", email: "" },
  });
  elements.newMemberName.value = "";
  renderRoster();
  renderMembers();
});

elements.saveRoster.addEventListener("click", async () => {
  await saveRoster();
  elements.weekStatus.textContent = "Roster saved.";
});

elements.saveWeek.addEventListener("click", async () => {
  await saveWeek();
  elements.weekStatus.textContent = `Saved ${state.isoWeek}.`;
  await loadWeeksList();
  renderWeeksList();
});

elements.exportTeam.addEventListener("click", async () => {
  await exportHistory(`teamId=${state.teamId}`, "Team history");
});

elements.exportAll.addEventListener("click", async () => {
  await exportHistory("allTeams=1", "All teams history");
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
