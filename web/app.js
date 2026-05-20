const THEME_URL = "../pets/codex_kitty/states.json";
const STATE_URL = "../state/current_state.json";
const POMODORO_URL = "../state/pomodoro_state.json";
const SUPPORTED_STATES = [
  "idle",
  "running",
  "waiting",
  "done",
  "error",
  "research",
  "break",
  "longbreak"
];

const fallbackTheme = {
  theme_name: "Codex-Kitty",
  default_pet_name: "Codex-Kitty",
  user_pet_name: null,
  default_skin: "yellow",
  skins: {
    yellow: {
      display_name: "Yellow",
      preview_image: "references/01_base_yellow.png",
      asset_dir: "assets/yellow"
    }
  },
  states: {
    idle: {
      display_name: "Idle",
      mood: "sleepy",
      short_message: "Idle",
      message: "Codex-Kitty is resting between turns.",
      icon: "Zz",
      animation: "sleep",
      sprite: "idle.png",
      background: "bg_day.png",
      ground: "ground_patch.png",
      house: "house_idle.png",
      prop: null,
      overlay: null,
      color: "#9AA0A6",
      requires_action: false
    }
  },
  state_aliases: {
    "agent-turn-complete": "done",
    focus: "research"
  }
};

const nodes = {
  themeName: document.querySelector("#themeName"),
  petName: document.querySelector("#petName"),
  actionPill: document.querySelector("#actionPill"),
  petReference: document.querySelector("#petReference"),
  sceneStage: document.querySelector("#sceneStage"),
  sceneBackground: document.querySelector("#sceneBackground"),
  sceneGround: document.querySelector("#sceneGround"),
  sceneHouse: document.querySelector("#sceneHouse"),
  stateIcon: document.querySelector("#stateIcon"),
  stateName: document.querySelector("#stateName"),
  mood: document.querySelector("#mood"),
  message: document.querySelector("#message"),
  skinSelect: document.querySelector("#skinSelect"),
  stateSelect: document.querySelector("#stateSelect"),
  pomodoroPanel: document.querySelector("#pomodoroPanel"),
  pomodoroTime: document.querySelector("#pomodoroTime"),
  pomodoroMode: document.querySelector("#pomodoroMode"),
  pomodoroCycle: document.querySelector("#pomodoroCycle"),
  pomodoroLine: document.querySelector("#pomodoroLine"),
  pomodoroButtons: document.querySelectorAll("[data-pomodoro-action]")
};

let theme = fallbackTheme;
let agentStateId = "idle";
let currentPomodoro = null;
let browserPomodoroOverride = false;
const failedSceneSources = new Set();
const previewStateId = new URLSearchParams(window.location.search).get("state");

async function loadJson(url, fallback = null) {
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    return fallback;
  }
}

function displayPetName(config) {
  const customName = typeof config.user_pet_name === "string" ? config.user_pet_name.trim() : "";
  return customName || config.default_pet_name || config.theme_name || "Codex-Kitty";
}

function normalizeStateId(rawState, config) {
  const aliases = config.state_aliases || {};
  const candidate = rawState || "idle";
  const replacement = aliases[candidate] || candidate;
  if (SUPPORTED_STATES.includes(replacement) && config.states[replacement]) {
    return replacement;
  }
  return "idle";
}

function previewStateFor(config) {
  return previewStateId ? normalizeStateId(previewStateId, config) : null;
}

function defaultPomodoroState() {
  return {
    enabled: false,
    mode: "focus",
    duration_seconds: 25 * 60,
    remaining_seconds: 25 * 60,
    is_running: false,
    cycle_index: 0,
    focus_minutes: 25,
    short_break_minutes: 5,
    long_break_minutes: 15,
    long_break_every: 4,
    updated_at: new Date().toISOString()
  };
}

function populateControls(config) {
  if (!nodes.skinSelect || !nodes.stateSelect) {
    return;
  }

  nodes.skinSelect.innerHTML = "";
  for (const [skinId, skin] of Object.entries(config.skins || {})) {
    const option = document.createElement("option");
    option.value = skinId;
    option.textContent = skin.display_name || skinId;
    nodes.skinSelect.append(option);
  }
  nodes.skinSelect.value = config.default_skin || "yellow";

  nodes.stateSelect.innerHTML = "";
  for (const stateId of SUPPORTED_STATES) {
    const state = config.states[stateId];
    if (!state) {
      continue;
    }
    const option = document.createElement("option");
    option.value = stateId;
    option.textContent = state.display_name || stateId;
    nodes.stateSelect.append(option);
  }
}

function themeImagePath(relativePath) {
  return `../pets/codex_kitty/${relativePath}`;
}

function previewImageForSkin(skin) {
  return themeImagePath(skin.preview_image || skin.reference_image || "references/01_base_yellow.png");
}

function stateImageForSkin(skin, state) {
  const petDir = skin.pet_dir || skin.asset_dir;
  if (skin.asset_dir && state.sprite) {
    return [
      petDir ? themeImagePath(`${petDir}/transparent/${state.sprite}`) : null,
      petDir ? themeImagePath(`${petDir}/${state.sprite}`) : null,
      themeImagePath(`${skin.asset_dir}/processed/${state.sprite}`),
      themeImagePath(`${skin.asset_dir}/${state.sprite}`),
      previewImageForSkin(skin)
    ].filter(Boolean);
  }
  return [previewImageForSkin(skin)];
}

function setImageWithFallbacks(imageNode, sources) {
  let index = 0;
  imageNode.onerror = () => {
    index += 1;
    if (index >= sources.length) {
      imageNode.onerror = null;
      return;
    }
    imageNode.src = sources[index];
  };
  if (imageNode.getAttribute("src") !== sources[index]) {
    imageNode.src = sources[index];
  }
}

function sceneImagePath(skin, fileName) {
  if (!fileName) {
    return null;
  }
  const sceneDir = skin.scene_dir || (skin.asset_dir ? `${skin.asset_dir}/scene` : null);
  return sceneDir ? themeImagePath(`${sceneDir}/${fileName}`) : null;
}

function sceneImageSources(skin, fileName) {
  if (!fileName) {
    return [];
  }
  const sceneDir = skin.scene_dir || (skin.asset_dir ? `${skin.asset_dir}/scene` : null);
  return sceneDir
    ? [
        themeImagePath(`${sceneDir}/transparent/${fileName}`),
        themeImagePath(`${sceneDir}/${fileName}`)
      ]
    : [];
}

function sceneGroundSources(skin, fileName) {
  const sources = sceneImageSources(skin, fileName);
  const sceneDir = skin.scene_dir || (skin.asset_dir ? `${skin.asset_dir}/scene` : null);
  if (!sceneDir || !document.body.classList.contains("stickc-page")) {
    return sources;
  }
  const stripFile = "ground_strip.png";
  if (fileName === stripFile) {
    return sources;
  }
  return [
    themeImagePath(`${sceneDir}/transparent/${stripFile}`),
    themeImagePath(`${sceneDir}/${stripFile}`),
    ...sources
  ];
}

function setOptionalImage(imageNode, sources) {
  if (!imageNode) {
    return;
  }
  const availableSources = (Array.isArray(sources) ? sources : [sources]).filter(
    (source) => source && !failedSceneSources.has(source)
  );
  if (availableSources.length === 0) {
    imageNode.removeAttribute("src");
    imageNode.hidden = true;
    if (imageNode === nodes.sceneGround && nodes.sceneStage) {
      nodes.sceneStage.classList.remove("has-ground-image");
    }
    return;
  }
  imageNode.hidden = false;
  imageNode.onload = () => {
    if (imageNode === nodes.sceneGround && nodes.sceneStage) {
      nodes.sceneStage.classList.add("has-ground-image");
    }
  };
  let index = 0;
  imageNode.onerror = () => {
    failedSceneSources.add(availableSources[index]);
    index += 1;
    if (index >= availableSources.length) {
      imageNode.hidden = true;
      imageNode.removeAttribute("src");
      if (imageNode === nodes.sceneGround && nodes.sceneStage) {
        nodes.sceneStage.classList.remove("has-ground-image");
      }
      return;
    }
    imageNode.src = availableSources[index];
  };
  if (imageNode.getAttribute("src") !== availableSources[index]) {
    imageNode.src = availableSources[index];
  }
}

function effectiveVisualStateId(agentState, pomodoro, config) {
  if (!pomodoro?.enabled) {
    return agentState;
  }
  if (pomodoro.mode === "break") {
    return "break";
  }
  if (pomodoro.mode === "longbreak") {
    return "longbreak";
  }
  if (pomodoro.mode === "focus") {
    return config.states.research ? "research" : agentState;
  }
  return agentState;
}

function pomodoroDurationSeconds(pomodoro, mode) {
  if (!pomodoro) {
    return 25 * 60;
  }
  if (mode === "break") {
    return Number(pomodoro.short_break_minutes ?? 5) * 60;
  }
  if (mode === "longbreak") {
    return Number(pomodoro.long_break_minutes ?? 15) * 60;
  }
  return Number(pomodoro.focus_minutes ?? 25) * 60;
}

function setPomodoroMode(pomodoro, mode, isRunning = false) {
  const next = { ...defaultPomodoroState(), ...(pomodoro || {}) };
  next.enabled = true;
  next.mode = mode;
  next.duration_seconds = pomodoroDurationSeconds(next, mode);
  next.remaining_seconds = next.duration_seconds;
  next.is_running = isRunning;
  next.updated_at = new Date().toISOString();
  return next;
}

function applyPomodoroAction(action) {
  const current = { ...defaultPomodoroState(), ...(currentPomodoro || {}) };
  current.remaining_seconds = pomodoroRemainingSeconds(current);

  if (action === "start") {
    current.enabled = true;
    current.is_running = true;
    current.updated_at = new Date().toISOString();
    currentPomodoro = current;
  } else if (action === "pause") {
    current.enabled = true;
    current.is_running = false;
    current.updated_at = new Date().toISOString();
    currentPomodoro = current;
  } else if (action === "reset") {
    currentPomodoro = defaultPomodoroState();
  } else if (action === "next") {
    if (current.mode === "focus") {
      current.cycle_index = Number(current.cycle_index ?? 0) + 1;
      const every = Math.max(1, Number(current.long_break_every ?? 4));
      currentPomodoro = setPomodoroMode(
        current,
        current.cycle_index % every === 0 ? "longbreak" : "break",
        true
      );
    } else {
      currentPomodoro = setPomodoroMode(current, "focus", true);
    }
  } else if (["focus", "break", "longbreak"].includes(action)) {
    currentPomodoro = setPomodoroMode(current, action, false);
  }

  browserPomodoroOverride = true;
  render(
    theme,
    agentStateId,
    currentPomodoro,
    previewStateFor(theme) || effectiveVisualStateId(agentStateId, currentPomodoro, theme)
  );
}

function pomodoroRemainingSeconds(pomodoro) {
  if (!pomodoro) {
    return null;
  }
  let remaining = Number(pomodoro.remaining_seconds ?? 0);
  if (pomodoro.is_running && pomodoro.updated_at) {
    const updated = Date.parse(pomodoro.updated_at);
    if (!Number.isNaN(updated)) {
      remaining -= Math.floor((Date.now() - updated) / 1000);
    }
  }
  return Math.max(0, remaining);
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) {
    return "--:--";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function renderPomodoro(pomodoro) {
  const enabled = Boolean(pomodoro?.enabled);
  const remaining = enabled ? pomodoroRemainingSeconds(pomodoro) : null;
  const mode = enabled ? pomodoro.mode || "focus" : "off";
  const time = formatSeconds(remaining);
  const label = mode.charAt(0).toUpperCase() + mode.slice(1);
  const line = enabled ? `${time} ${label}` : "--:-- Off";

  document.body.classList.toggle("pomodoro-active", enabled);

  if (nodes.pomodoroTime) {
    nodes.pomodoroTime.textContent = time;
  }
  if (nodes.pomodoroMode) {
    nodes.pomodoroMode.textContent = enabled
      ? `${label} ${pomodoro.is_running ? "running" : "paused"}`
      : "Off";
  }
  if (nodes.pomodoroCycle) {
    nodes.pomodoroCycle.textContent = enabled ? `Cycle ${pomodoro.cycle_index ?? 0}` : "Cycle 0";
  }
  if (nodes.pomodoroLine) {
    nodes.pomodoroLine.textContent = line;
  }
}

function render(config, agentStateIdForRender, pomodoro = currentPomodoro, visualStateId = agentStateIdForRender) {
  const state = config.states[agentStateIdForRender] || config.states.idle || fallbackTheme.states.idle;
  const visualState = config.states[visualStateId] || state;
  const skinId = nodes.skinSelect?.value || config.default_skin || "yellow";
  const skin = (config.skins || {})[skinId] || fallbackTheme.skins.yellow;
  const stateImages = stateImageForSkin(skin, visualState);

  if (nodes.sceneStage) {
    nodes.sceneStage.dataset.background = (visualState.background || "").replace(".png", "") || "none";
  }
  setOptionalImage(nodes.sceneBackground, sceneImageSources(skin, visualState.background));
  setOptionalImage(nodes.sceneGround, sceneGroundSources(skin, visualState.ground));
  setOptionalImage(nodes.sceneHouse, sceneImageSources(skin, visualState.house));

  if (nodes.themeName) {
    nodes.themeName.textContent = config.theme_name || "Codex-Kitty";
  }
  nodes.petName.textContent = displayPetName(config);
  setImageWithFallbacks(nodes.petReference, stateImages);
  nodes.petReference.alt = `${config.theme_name || "Codex-Kitty"} ${skin.display_name || skinId} ${visualState.display_name || visualStateId}`;
  nodes.petReference.className = `scene-pet pet-sprite ${visualStateId}`;
  nodes.stateIcon.textContent = state.icon || "";
  nodes.stateName.textContent = state.display_name || agentStateIdForRender;
  if (nodes.mood) {
    nodes.mood.textContent = state.mood || "";
  }
  nodes.message.textContent = document.body.classList.contains("stickc-page")
    ? state.short_message || state.display_name || stateId
    : state.message || "";
  nodes.actionPill.textContent = state.requires_action ? "action" : "ready";
  nodes.actionPill.style.borderColor = state.color || "#38F7FF";
  nodes.actionPill.style.color = state.color || "#38F7FF";
  if (nodes.stateSelect) {
    nodes.stateSelect.value = agentStateIdForRender;
  }
  renderPomodoro(pomodoro);
}

async function refreshStateFromFile() {
  const previewState = previewStateFor(theme);
  if (previewState) {
    if (!browserPomodoroOverride) {
      currentPomodoro = await loadJson(POMODORO_URL, currentPomodoro);
    }
    render(theme, previewState, currentPomodoro, previewState);
    return;
  }
  const stateFile = await loadJson(STATE_URL, null);
  if (stateFile) {
    const rawState = stateFile.state || stateFile.event_type;
    agentStateId = normalizeStateId(rawState, theme);
  }
  if (!browserPomodoroOverride) {
    currentPomodoro = await loadJson(POMODORO_URL, currentPomodoro);
  }
  render(theme, agentStateId, currentPomodoro, effectiveVisualStateId(agentStateId, currentPomodoro, theme));
}

async function boot() {
  theme = await loadJson(THEME_URL, fallbackTheme);
  populateControls(theme);
  agentStateId = previewStateFor(theme) || normalizeStateId("idle", theme);
  currentPomodoro = await loadJson(POMODORO_URL, null);
  render(
    theme,
    agentStateId,
    currentPomodoro,
    previewStateFor(theme) || effectiveVisualStateId(agentStateId, currentPomodoro, theme)
  );
  await refreshStateFromFile();

  if (nodes.skinSelect) {
    nodes.skinSelect.addEventListener("change", () => {
      render(
        theme,
        agentStateId,
        currentPomodoro,
        previewStateFor(theme) || effectiveVisualStateId(agentStateId, currentPomodoro, theme)
      );
    });
  }
  if (nodes.stateSelect) {
    nodes.stateSelect.addEventListener("change", (event) => {
      agentStateId = normalizeStateId(event.target.value, theme);
      render(
        theme,
        agentStateId,
        currentPomodoro,
        previewStateFor(theme) || effectiveVisualStateId(agentStateId, currentPomodoro, theme)
      );
    });
  }
  for (const button of nodes.pomodoroButtons || []) {
    button.addEventListener("click", () => {
      applyPomodoroAction(button.dataset.pomodoroAction);
    });
  }

  window.setInterval(refreshStateFromFile, 1000);
}

boot();
