const THEME_URL = "../pets/codex_kitty/states.json";
const STATE_URL = "../state/current_state.json";
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
      reference_image: "references/01_base_yellow.png"
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
      sprite: "idle",
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
  stateIcon: document.querySelector("#stateIcon"),
  stateName: document.querySelector("#stateName"),
  mood: document.querySelector("#mood"),
  message: document.querySelector("#message"),
  skinSelect: document.querySelector("#skinSelect"),
  stateSelect: document.querySelector("#stateSelect")
};

let theme = fallbackTheme;
let currentStateId = "idle";

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

function populateControls(config) {
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

function render(config, stateId) {
  const state = config.states[stateId] || config.states.idle || fallbackTheme.states.idle;
  const skinId = nodes.skinSelect.value || config.default_skin || "yellow";
  const skin = (config.skins || {})[skinId] || {};
  const referenceImage = skin.reference_image
    ? `../pets/codex_kitty/${skin.reference_image}`
    : "../pets/codex_kitty/references/01_base_yellow.png";

  nodes.themeName.textContent = config.theme_name || "Codex-Kitty";
  nodes.petName.textContent = displayPetName(config);
  nodes.petReference.src = referenceImage;
  nodes.petReference.alt = `${config.theme_name || "Codex-Kitty"} ${skin.display_name || skinId} reference sheet`;
  nodes.stateIcon.textContent = state.icon || "";
  nodes.stateName.textContent = state.display_name || stateId;
  nodes.mood.textContent = state.mood || "";
  nodes.message.textContent = state.message || "";
  nodes.actionPill.textContent = state.requires_action ? "action" : "ready";
  nodes.actionPill.style.borderColor = state.color || "#38F7FF";
  nodes.actionPill.style.color = state.color || "#38F7FF";
  nodes.stateSelect.value = stateId;
}

async function refreshStateFromFile() {
  const stateFile = await loadJson(STATE_URL, null);
  if (!stateFile) {
    return;
  }
  const rawState = stateFile.state || stateFile.event_type;
  currentStateId = normalizeStateId(rawState, theme);
  render(theme, currentStateId);
}

async function boot() {
  theme = await loadJson(THEME_URL, fallbackTheme);
  populateControls(theme);
  currentStateId = normalizeStateId("idle", theme);
  render(theme, currentStateId);
  await refreshStateFromFile();

  nodes.skinSelect.addEventListener("change", () => render(theme, currentStateId));
  nodes.stateSelect.addEventListener("change", (event) => {
    currentStateId = normalizeStateId(event.target.value, theme);
    render(theme, currentStateId);
  });

  window.setInterval(refreshStateFromFile, 2500);
}

boot();
