import { supabaseAnonKey, supabaseUrl } from "./supabase-config.js";

const leaderSessionKey = "roundsquare-baraza-leader-session";
const discussionSection = document.querySelector(".discussion-planner-view");
const editor = document.querySelector("[data-discussion-editor]");
const liveView = document.querySelector("[data-discussion-live]");
const listPanel = document.querySelector("[data-discussion-list-panel]");
const form = document.querySelector("[data-discussion-form]");
const speakerList = document.querySelector("[data-speaker-editor-list]");
const plannerStatus = document.querySelector("[data-planner-status]");
const statusBadge = document.querySelector("[data-discussion-status]");
const MAX_DURATION_SECONDS = 7200;
let currentRecord;
let currentDiscussion = null;
let timerStages = [];
let timerState = null;
let timerInterval;
let timerSaveQueue = Promise.resolve();
let discussionSaving = false;

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const setPlannerMessage = (message, isError = false) => {
  plannerStatus.textContent = message;
  plannerStatus.classList.toggle("is-error", isError);
};

const setDiscussionSaving = (saving) => {
  discussionSaving = saving;
  const isReadOnly = currentDiscussion?.status === "Completed" || currentDiscussion?.status === "In Progress";
  ["[data-save-draft]", "[data-start-discussion]"].forEach((selector) => {
    const button = document.querySelector(selector);
    button.disabled = saving || isReadOnly;
    if (saving) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
};

const setStatus = (status) => {
  statusBadge.textContent = status;
  statusBadge.className = `discussion-status-badge${status === "In Progress" ? " is-in-progress" : ""}${status === "Completed" ? " is-completed" : ""}`;
};

const request = async (action, payload = {}) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/baraza-leader-auth`, {
    method: "POST",
    headers: { apikey: supabaseAnonKey, "content-type": "application/json" },
    body: JSON.stringify({
      action: `discussions.${action}`,
      token: window.sessionStorage.getItem(leaderSessionKey),
      ...payload,
    }),
  });
  let result;
  try {
    result = await response.json();
  } catch (error) {
    console.error("The discussion service returned an unreadable response.", error);
    throw new Error("The discussion service is temporarily unavailable. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401) {
      window.sessionStorage.removeItem(leaderSessionKey);
      window.location.replace("signin.html");
    }
    throw new Error(typeof result.error === "string"
      ? result.error
      : "The discussion service is temporarily unavailable. Please try again.");
  }
  return result;
};

const makeDurationInput = (label, value, max, className) => {
  const wrapper = document.createElement("label");
  wrapper.className = className;
  wrapper.append(document.createTextNode(label));
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = String(max);
  input.step = "1";
  input.value = String(value);
  input.setAttribute("aria-label", label);
  wrapper.append(input);
  return { wrapper, input };
};

const makeSpeakerRow = (speaker = {}) => {
  const row = document.createElement("article");
  row.className = "speaker-editor-row";
  const order = document.createElement("span");
  order.className = "speaker-order";
  order.setAttribute("aria-hidden", "true");
  const nameLabel = document.createElement("label");
  nameLabel.className = "speaker-name-field";
  nameLabel.append(document.createTextNode("Speaker name"));
  const name = document.createElement("input");
  name.type = "text";
  name.maxLength = 120;
  name.placeholder = "Enter speaker's name";
  name.value = typeof speaker.name === "string" ? speaker.name : "";
  name.setAttribute("aria-label", "Speaker name");
  nameLabel.append(name);

  const duration = document.createElement("div");
  duration.className = "speaker-duration";
  duration.setAttribute("aria-label", "Speaker duration");
  const minutes = makeDurationInput("Minutes", Math.floor((speaker.durationSeconds || 0) / 60), 120, "speaker-time-field");
  const seconds = makeDurationInput("Seconds", (speaker.durationSeconds || 0) % 60, 59, "speaker-time-field");
  duration.append(minutes.wrapper, seconds.wrapper);

  const controls = document.createElement("div");
  controls.className = "speaker-row-controls";
  const makeControl = (icon, label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "speaker-icon-button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
    button.addEventListener("click", action);
    return button;
  };
  controls.append(
    makeControl("fa-arrow-up", "Move speaker up", () => {
      const previous = row.previousElementSibling;
      if (previous) speakerList.insertBefore(row, previous);
      updateSpeakerRows();
    }),
    makeControl("fa-arrow-down", "Move speaker down", () => {
      const next = row.nextElementSibling;
      if (next) speakerList.insertBefore(next, row);
      updateSpeakerRows();
    }),
    makeControl("fa-trash-can", "Remove speaker", () => {
      row.remove();
      updateSpeakerRows();
    }),
  );

  row.append(order, nameLabel, duration, controls);
  return row;
};

const updateSpeakerRows = () => {
  const rows = [...speakerList.children];
  document.querySelector("[data-speaker-count]").textContent = `${rows.length} ${rows.length === 1 ? "speaker" : "speakers"} · Set each speaker's individual time allowance.`;
  rows.forEach((row, index) => {
    row.querySelector(".speaker-order").textContent = String(index + 1);
    const [upButton, downButton, removeButton] = row.querySelectorAll("button");
    const isReadOnly = currentDiscussion?.status === "Completed" || currentDiscussion?.status === "In Progress";
    upButton.disabled = isReadOnly || index === 0;
    downButton.disabled = isReadOnly || index === rows.length - 1;
    removeButton.disabled = isReadOnly || rows.length === 1;
  });
  updateTotals();
};

const getConfiguration = () => {
  const speakerRows = [...speakerList.querySelectorAll(".speaker-editor-row")];
  let speakerDurationsValid = true;
  const speakers = speakerRows.map((row) => {
    const inputs = row.querySelectorAll("input");
    const minutes = Number(inputs[1].value);
    const seconds = Number(inputs[2].value);
    if (inputs[1].value === "" || inputs[2].value === ""
      || !Number.isInteger(minutes) || minutes < 0 || minutes > 120
      || !Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
      speakerDurationsValid = false;
    }
    return {
      name: inputs[0].value.trim(),
      durationSeconds: Number.isInteger(minutes) && Number.isInteger(seconds)
        ? minutes * 60 + seconds
        : 0,
    };
  });
  return {
    valid: speakers.length <= 30
      && speakerDurationsValid
      && speakers.every(({ durationSeconds }) => Number.isInteger(durationSeconds)
        && durationSeconds >= 0 && durationSeconds <= MAX_DURATION_SECONDS),
    configuration: { speakers },
  };
};

const getDiscussionPayload = () => {
  const config = getConfiguration();
  return {
    valid: config.valid,
    discussion: {
      title: form.elements.namedItem("title").value.trim(),
      topic: form.elements.namedItem("topic").value.trim(),
      configuration: config.configuration,
    },
  };
};

const isReady = (discussion) => Boolean(discussion.title && discussion.topic
  && discussion.configuration.speakers.length > 0
  && discussion.configuration.speakers.every((speaker) => speaker.name && speaker.durationSeconds > 0));

const updateTotals = () => {
  const result = getDiscussionPayload();
  const configuration = result.discussion.configuration;
  const speakerSeconds = configuration.speakers.reduce((total, speaker) => total + speaker.durationSeconds, 0);
  const total = speakerSeconds;
  document.querySelector("[data-planned-duration]").textContent = formatDuration(total);
  const hasUnassignedDuration = configuration.speakers.some((speaker) => speaker.durationSeconds === 0);
  document.querySelector("[data-speaker-duration-warning]").hidden = !hasUnassignedDuration;
  if (currentDiscussion?.status === "Completed") {
    setStatus("Completed");
  } else if (currentDiscussion?.status === "In Progress") {
    setStatus("In Progress");
  } else {
    setStatus(isReady(result.discussion) && result.valid ? "Ready" : "Draft");
  }
};

const fillForm = (discussion) => {
  const isReadOnly = discussion?.status === "Completed" || discussion?.status === "In Progress";
  form.elements.namedItem("discussionId").value = discussion?.id || "";
  form.elements.namedItem("title").value = discussion?.title === "Untitled discussion" ? "" : discussion?.title || "";
  form.elements.namedItem("topic").value = discussion?.topic || "";
  const configuration = discussion?.configuration || {};
  speakerList.replaceChildren();
  (configuration.speakers?.length ? configuration.speakers : [{}]).forEach((speaker) => {
    speakerList.append(makeSpeakerRow(speaker));
  });
  [...form.querySelectorAll("input, textarea, button[data-save-draft], button[data-start-discussion], .speaker-icon-button")].forEach((control) => {
    control.disabled = isReadOnly;
  });
  document.querySelector("[data-add-speaker]").disabled = isReadOnly;
  updateSpeakerRows();
};

const setPlannerView = (view) => {
  editor.hidden = view !== "editor";
  liveView.hidden = view !== "live";
  listPanel.hidden = view !== "list";
};

const saveDiscussion = async () => {
  const payload = getDiscussionPayload();
  if (!payload.valid) throw new Error("Use non-negative whole numbers for each duration; seconds must be between 0 and 59.");
  const result = await request("save", {
    id: form.elements.namedItem("discussionId").value || undefined,
    discussion: payload.discussion,
  });
  currentDiscussion = result.discussion;
  form.elements.namedItem("discussionId").value = currentDiscussion.id;
  updateTotals();
  return currentDiscussion;
};

const createDiscussion = () => {
  currentDiscussion = null;
  fillForm(null);
  setPlannerView("editor");
  setStatus("Draft");
  setPlannerMessage("New discussion plan ready.");
};

const buildTimerStages = (discussion) => {
  const configuration = discussion.configuration;
  return configuration.speakers.map((speaker, index) => ({
    label: `Speaker ${index + 1}`,
    speaker: speaker.name,
    duration: speaker.durationSeconds,
    type: "speaker",
  }));
};

const persistTimer = async () => {
  if (!currentDiscussion || !timerState) return;
  const discussionId = currentDiscussion.id;
  const savedState = { ...timerState };
  const stageCount = timerStages.length;
  timerSaveQueue = timerSaveQueue.then(async () => {
    try {
      await request("timer", { id: discussionId, stageCount, timerState: savedState });
    } catch (error) {
      console.error("Unable to save Baraza timer progress.", error);
      setPlannerMessage(error.message, true);
    }
  });
  await timerSaveQueue;
};

const remainingSeconds = () => {
  if (timerState.status !== "running" || !timerState.runningSince) return timerState.remainingSeconds;
  return Math.max(0, timerState.remainingSeconds
    - Math.ceil((Date.now() - Date.parse(timerState.runningSince)) / 1000));
};

const elapsedSeconds = () => timerState.elapsedSeconds
  + (timerState.status === "running" && timerState.runningSince
    ? Math.max(0, Math.floor((Date.now() - Date.parse(timerState.runningSince)) / 1000))
    : 0);

const renderTimer = () => {
  if (!timerState || !timerStages.length) return;
  const stage = timerStages[timerState.stageIndex];
  if (!stage) return;
  const remaining = remainingSeconds();
  if (timerState.status === "running" && remaining === 0) {
    timerState = {
      ...timerState,
      elapsedSeconds: elapsedSeconds(),
      remainingSeconds: 0,
      runningSince: null,
      status: "expired",
    };
    persistTimer();
  }
  const effectiveStatus = remaining === 0 ? "expired" : timerState.status;
  const nextStage = timerStages[timerState.stageIndex + 1];
  const nextSpeaker = nextStage?.speaker || "Discussion complete";
  const stageRemaining = effectiveStatus === "running" ? remaining : timerState.remainingSeconds;
  const elapsed = elapsedSeconds();
  const progress = stage.duration > 0
    ? Math.max(0, Math.min(100, ((stage.duration - stageRemaining) / stage.duration) * 100))
    : 100;
  const progressValue = ((timerState.stageIndex + progress / 100) / timerStages.length) * 100;

  document.querySelector("[data-live-stage]").textContent = stage.label;
  document.querySelector("[data-live-speaker]").textContent = stage.speaker;
  document.querySelector("[data-live-clock]").textContent = formatDuration(remaining);
  document.querySelector("[data-live-next]").textContent = nextSpeaker;
  document.querySelector("[data-live-elapsed]").textContent = formatDuration(elapsed);
  document.querySelector("[data-live-stage-count]").textContent = `${timerState.stageIndex + 1} of ${timerStages.length}`;
  document.querySelector("[data-live-progress]").style.width = `${progressValue}%`;
  const progressBar = document.querySelector(".live-progress-track");
  progressBar.setAttribute("aria-valuenow", String(Math.round(progressValue)));

  const timerCard = document.querySelector("[data-live-timer-card]");
  timerCard.classList.toggle("is-warning", effectiveStatus === "running" && remaining <= 30 && remaining > 0);
  timerCard.classList.toggle("is-expired", effectiveStatus === "expired");
  document.querySelector("[data-live-alert]").hidden = effectiveStatus !== "expired";
  document.querySelector("[data-live-state]").textContent = effectiveStatus === "expired"
    ? "Time expired"
    : effectiveStatus === "running"
      ? remaining <= 30 ? "Warning: 30 seconds or less remaining" : "Timer running"
      : "Paused";
  document.querySelector("[data-timer-start]").hidden = timerState.status !== "paused" || timerState.remainingSeconds !== stage.duration;
  document.querySelector("[data-timer-pause]").hidden = timerState.status !== "running";
  document.querySelector("[data-timer-resume]").hidden = timerState.status !== "paused" || timerState.remainingSeconds === stage.duration;
  document.querySelector("[data-timer-add]").disabled = remaining >= 86400;
};

const openTimer = async (discussion) => {
  currentDiscussion = discussion;
  timerStages = buildTimerStages(discussion);
  if (!timerStages.length) throw new Error("This discussion has no timed stages.");
  timerState = discussion.timer_state;
  if (!timerState || !Number.isInteger(timerState.stageIndex) || !timerStages[timerState.stageIndex]) {
    timerState = {
      stageIndex: 0,
      remainingSeconds: timerStages[0].duration,
      elapsedSeconds: 0,
      runningSince: null,
      status: "paused",
    };
    await persistTimer();
  }
  document.querySelector("[data-live-title]").textContent = discussion.title;
  document.querySelector("[data-live-topic]").textContent = discussion.topic;
  document.querySelector("[data-live-meta]").textContent = currentRecord?.happiness || "Baraza";
  document.querySelector(".live-controls").hidden = false;
  setPlannerView("live");
  setStatus("In Progress");
  renderTimer();
  window.clearInterval(timerInterval);
  timerInterval = window.setInterval(renderTimer, 250);
};

const updateTimer = async (nextState) => {
  timerState = nextState;
  renderTimer();
  await persistTimer();
};

const renderDiscussionList = (discussions) => {
  const list = document.querySelector("[data-discussion-list]");
  list.replaceChildren();
  if (!discussions.length) {
    const empty = document.createElement("p");
    empty.className = "planner-empty";
    empty.textContent = "No previous discussions yet. Create a discussion plan to get started.";
    list.append(empty);
    return;
  }

  discussions.forEach((discussion) => {
    const item = document.createElement("article");
    item.className = "discussion-list-card";
    const info = document.createElement("div");
    info.className = "discussion-list-info";
    const title = document.createElement("h3");
    title.textContent = discussion.title;
    const topic = document.createElement("p");
    topic.textContent = discussion.topic || "Topic not set";
    const details = document.createElement("small");
    details.textContent = `${discussion.configuration.speakers.length} ${discussion.configuration.speakers.length === 1 ? "speaker" : "speakers"}`;
    info.append(title, topic, details);
    const actions = document.createElement("div");
    actions.className = "discussion-list-actions";
    const badge = document.createElement("span");
    badge.className = `discussion-status-badge${discussion.status === "In Progress" ? " is-in-progress" : ""}${discussion.status === "Completed" ? " is-completed" : ""}`;
    badge.textContent = discussion.status;
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "planner-button planner-button-secondary";
    openButton.textContent = discussion.status === "In Progress" ? "Resume timer" : "Open plan";
    openButton.addEventListener("click", async () => {
      setPlannerMessage("");
      try {
        if (discussion.status === "In Progress") {
          await openTimer(discussion);
        } else {
          currentDiscussion = discussion;
          fillForm(discussion);
          setStatus(discussion.status);
          setPlannerView("editor");
        }
      } catch (error) {
        setPlannerMessage(error.message, true);
      }
    });
    actions.append(badge, openButton);
    if (discussion.status !== "In Progress") {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "planner-button planner-button-delete";
      deleteButton.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i> Delete';
      deleteButton.setAttribute("aria-label", `Delete discussion: ${discussion.title}`);
      deleteButton.addEventListener("click", async () => {
        if (!window.confirm(`Delete "${discussion.title}"? This cannot be undone.`)) return;
        deleteButton.disabled = true;
        deleteButton.setAttribute("aria-busy", "true");
        setPlannerMessage(`Deleting "${discussion.title}"...`);
        try {
          await request("delete", { id: discussion.id });
          const discussions = await loadDiscussions();
          renderDiscussionList(discussions);
          setPlannerMessage("Discussion deleted.");
        } catch (error) {
          deleteButton.disabled = false;
          deleteButton.removeAttribute("aria-busy");
          setPlannerMessage(error.message, true);
        }
      });
      actions.append(deleteButton);
    }
    item.append(info, actions);
    list.append(item);
  });
};

const loadDiscussions = async () => {
  const result = await request("list");
  return result.discussions;
};

const saveTimerBeforeLeaving = async () => {
  if (timerState?.status === "running") {
    const now = Date.now();
    const elapsedDuringRun = Math.max(0, Math.floor((now - Date.parse(timerState.runningSince)) / 1000));
    timerState = {
      ...timerState,
      elapsedSeconds: timerState.elapsedSeconds + elapsedDuringRun,
      remainingSeconds: Math.max(0, timerState.remainingSeconds - Math.ceil((now - Date.parse(timerState.runningSince)) / 1000)),
      runningSince: null,
      status: "paused",
    };
    await persistTimer();
  }
};

export const initializeDiscussionPlanner = (record) => {
  if (!discussionSection || !form) {
    console.error("The Baraza discussion planner markup is missing.");
    return;
  }
  currentRecord = record;
  document.querySelector("[data-baraza-name]").textContent = record.happiness;
  fillForm(null);

  const profileLink = document.querySelector(".leader-profile-link");
  const plannerLink = document.querySelector(".leader-planner-link");
  const showProfile = async () => {
    await saveTimerBeforeLeaving();
    window.clearInterval(timerInterval);
    document.querySelector(".baraza-profile-view").hidden = false;
    discussionSection.hidden = true;
    profileLink.classList.add("is-active");
    plannerLink.classList.remove("is-active");
    window.location.hash = "leader-profile";
  };
  const showPlanner = () => {
    document.querySelector(".baraza-profile-view").hidden = true;
    discussionSection.hidden = false;
    profileLink.classList.remove("is-active");
    plannerLink.classList.add("is-active");
    window.location.hash = "discussion-planner";
  };
  if (window.location.hash === "#discussion-planner") {
    showPlanner();
  }
  profileLink.addEventListener("click", (event) => {
    event.preventDefault();
    showProfile();
  });
  plannerLink.addEventListener("click", (event) => {
    event.preventDefault();
    showPlanner();
  });
  document.querySelector("[data-create-discussion]").addEventListener("click", async () => {
    await saveTimerBeforeLeaving();
    window.clearInterval(timerInterval);
    timerState = null;
    createDiscussion();
  });
  document.querySelector("[data-add-speaker]").addEventListener("click", () => {
    if (speakerList.children.length >= 30) {
      setPlannerMessage("A discussion can have up to 30 speakers.", true);
      return;
    }
    speakerList.append(makeSpeakerRow());
    updateSpeakerRows();
  });
  document.querySelector("[data-save-draft]").addEventListener("click", async () => {
    if (discussionSaving) return;
    setDiscussionSaving(true);
    try {
      setPlannerMessage("Saving discussion...");
      await saveDiscussion();
      setPlannerMessage(currentDiscussion.status === "Ready"
        ? "Discussion saved and ready to start."
        : "Draft saved.");
    } catch (error) {
      setPlannerMessage(error.message, true);
    } finally {
      setDiscussionSaving(false);
    }
  });
  document.querySelector("[data-start-discussion]").addEventListener("click", async () => {
    if (discussionSaving) return;
    const payload = getDiscussionPayload();
    if (!payload.valid) {
      setPlannerMessage("Check the duration fields. Minutes must be 0–120 and seconds 0–59.", true);
      return;
    }
    if (!isReady(payload.discussion)) {
      setPlannerMessage("Add a discussion title and topic, then give every speaker a name and duration.", true);
      return;
    }
    setDiscussionSaving(true);
    try {
      setPlannerMessage("Saving plan and preparing the live timer...");
      await saveDiscussion();
      const result = await request("start", { id: currentDiscussion.id });
      currentDiscussion = result.discussion;
      await openTimer(result.discussion);
      setPlannerMessage("");
    } catch (error) {
      setPlannerMessage(error.message, true);
    } finally {
      setDiscussionSaving(false);
    }
  });
  document.querySelector("[data-view-discussions]").addEventListener("click", async () => {
    try {
      await saveTimerBeforeLeaving();
      window.clearInterval(timerInterval);
      setPlannerMessage("Loading previous discussions...");
      const discussions = await loadDiscussions();
      renderDiscussionList(discussions);
      setPlannerView("list");
      setPlannerMessage("");
    } catch (error) {
      setPlannerMessage(error.message, true);
    }
  });
  document.querySelector("[data-back-to-editor]").addEventListener("click", () => {
    setPlannerView("editor");
  });
  document.querySelector("[data-timer-start]").addEventListener("click", () => {
    updateTimer({ ...timerState, status: "running", runningSince: new Date().toISOString() });
  });
  document.querySelector("[data-timer-resume]").addEventListener("click", () => {
    updateTimer({ ...timerState, status: "running", runningSince: new Date().toISOString() });
  });
  document.querySelector("[data-timer-pause]").addEventListener("click", () => {
    updateTimer({
      ...timerState,
      elapsedSeconds: elapsedSeconds(),
      remainingSeconds: remainingSeconds(),
      runningSince: null,
      status: "paused",
    });
  });
  document.querySelector("[data-timer-reset]").addEventListener("click", () => {
    if (!window.confirm("Reset this stage to its original duration?")) return;
    updateTimer({
      ...timerState,
      elapsedSeconds: elapsedSeconds(),
      remainingSeconds: timerStages[timerState.stageIndex].duration,
      runningSince: null,
      status: "paused",
    });
  });
  document.querySelector("[data-timer-add]").addEventListener("click", () => {
    if (remainingSeconds() >= 86400) {
      setPlannerMessage("The timer cannot be extended beyond 24 hours.", true);
      return;
    }
    const currentlyRunning = timerState.status === "running";
    updateTimer({
      ...timerState,
      elapsedSeconds: elapsedSeconds(),
      remainingSeconds: remainingSeconds() + 30,
      runningSince: currentlyRunning ? new Date().toISOString() : null,
      status: currentlyRunning ? "running" : "paused",
    });
  });
  document.querySelector("[data-timer-skip]").addEventListener("click", async () => {
    const elapsed = elapsedSeconds();
    const nextIndex = timerState.stageIndex + 1;
    if (nextIndex >= timerStages.length) {
      try {
        await request("complete", { id: currentDiscussion.id });
        currentDiscussion.status = "Completed";
        setStatus("Completed");
        window.clearInterval(timerInterval);
        document.querySelector("[data-live-stage]").textContent = "Discussion completed";
        document.querySelector("[data-live-speaker]").textContent = "Thank you for leading the conversation.";
        document.querySelector("[data-live-clock]").textContent = "00:00";
        document.querySelector("[data-live-state]").textContent = "Completed";
        document.querySelector("[data-live-alert]").hidden = true;
        document.querySelector(".live-controls").hidden = true;
      } catch (error) {
        setPlannerMessage(error.message, true);
      }
      return;
    }
    updateTimer({
      stageIndex: nextIndex,
      remainingSeconds: timerStages[nextIndex].duration,
      elapsedSeconds: elapsed,
      runningSince: null,
      status: "paused",
    });
  });
  document.querySelector("[data-timer-back]").addEventListener("click", () => {
    saveTimerBeforeLeaving().then(() => {
      window.clearInterval(timerInterval);
      currentDiscussion = { ...currentDiscussion, timer_state: timerState };
      fillForm(currentDiscussion);
      setPlannerView("editor");
      setStatus("In Progress");
    }).catch((error) => {
      setPlannerMessage(error.message, true);
    });
  });
  form.addEventListener("input", updateTotals);
  form.addEventListener("change", updateTotals);
  updateTotals();
};
