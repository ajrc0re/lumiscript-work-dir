// @ls:reload-on-edit
const VERSION = "2026-06-30-persistent-auto-prompt";

const INJECTION_ID = "greeting-inspector-next-scene-note";
const DRAWER_TAB_ID = "greeting-inspector-status";
const STYLE_ID = "greeting-inspector-styles";
const FLOATING_REFRESH_ID = "greeting-inspector-floating-refresh";
const MODAL_STYLE_ID = "greeting-inspector-picker-styles";

const ACTIVE_INDEX_VAR = "GreetingInspectorActiveIndex";
const UPCOMING_INDEX_VAR = "GreetingInspectorUpcomingIndex";
const ACTIVE_SELECTION_VAR = "GreetingInspectorActiveSelection";
const UPCOMING_SELECTION_VAR = "GreetingInspectorUpcomingSelection";
const LAST_ADVANCED_EVENT_VAR = "GreetingInspectorLastAdvancedEvent";
const LAST_ADVANCED_SIGNATURE_VAR = "GreetingInspectorLastAdvancedSignature";
const ACTIVE_STATUS_VAR = "GreetingInspectorActive";
const CONTENT_VAR = "GreetingInspectorContent";
const AUTO_INJECT_VAR = "GreetingInspectorAutoInject";
const AUTO_INJECT_POSITION_VAR = "GreetingInspectorAutoInjectPosition";
const PROMPT_EXCLUDE_REGEX_VAR = "GreetingInspectorPromptExcludeRegex";
const ENABLED_VAR = "GreetingInspectorEnabled";
const DEBUG_VAR = "GreetingInspectorDebug";
const GROUP_CHARACTER_STATE_VAR = "GreetingInspectorGroupCharacterState";

const OLD_ACTIVE_INDEX_VAR = "greetingInspector.activeIndex";
const OLD_UPCOMING_INDEX_VAR = "greetingInspector.upcomingIndex";
const OLD_LAST_ADVANCED_EVENT_VAR = "greetingInspector.lastAdvancedEvent";
const OLD_LAST_ADVANCED_SIGNATURE_VAR =
  "greetingInspector.lastAdvancedSignature";
const OLD_STATUS_IN_DRAWER_VAR = "greetingInspector.statusInDrawer";
const OLD_CHAT_VARIABLE_KEYS = {
  [ACTIVE_INDEX_VAR]: OLD_ACTIVE_INDEX_VAR,
  [UPCOMING_INDEX_VAR]: OLD_UPCOMING_INDEX_VAR,
  [LAST_ADVANCED_EVENT_VAR]: OLD_LAST_ADVANCED_EVENT_VAR,
  [LAST_ADVANCED_SIGNATURE_VAR]: OLD_LAST_ADVANCED_SIGNATURE_VAR,
};

const HANDOFF_TAG_NAME = "inject-prewritten-content";
const USER_OVERRIDE_TAG_NAME = "o";
const HANDOFF_TAG = `<${HANDOFF_TAG_NAME} />`;
const USER_OVERRIDE_TAG = `--${USER_OVERRIDE_TAG_NAME}--`;
const HANDOFF_EXTRA_KEY = "greetingInspectorSceneHandoff";
const HANDOFF_CONTENT_PROCESSOR_ID = "greeting-inspector-scene-handoff-tags";
const HANDOFF_TAG_PATTERN =
  /<\s*inject-prewritten-content\b(?:[^>"']|"[^"]*"|'[^']*')*\/\s*>|<\s*inject-prewritten-content\b(?:[^>"']|"[^"]*"|'[^']*')*>([\s\S]*?)<\s*\/\s*inject-prewritten-content\s*>/gi;

function buildShapeSceneDirectionPrompt(prewrittenSceneExcerpt) {
  return `<shape_scene_direction>
- DIRECTION TARGET: Treat the upcoming prewritten scene as a long-term destination. Gradually shape the narrative's setting, character positions, emotional state, and momentum so the scene can begin naturally and immediately afterward. Do not force a fade-out or make the guidance visible.
- PACING AND HANDOFF: Reach the scene slowly over multiple turns. Continue the present narrative until its required conditions feel earned, rather than transitioning at the first plausible opportunity. Favor gradual progression toward the handoff point over immediate scene setup.
- NARRATIVE SPACING MINIMUMS: Avoid placing major transitions or prewritten handoffs on the same day or on consecutive days. Unless the next scene is explicitly required to occur that day, allow at least one or two in-story days to pass before guiding the narrative toward it. If a handoff has already occurred that day, continue the story naturally without setting up another.
- LATE HANDOFF POLICY: Continue the current narrative naturally until it reaches the doorstep of the upcoming prewritten scene. Move toward that point gradually across several turns without forcing a bridge or rushing the required setup. Trigger the handoff at the latest viable moment, ideally immediately before the scene begins. Do not hand off merely because of a calm pause, completed emotional beat, natural stopping point, fade-out, summary, chapter break, or other convenient ending.
- VALID HANDOFF THRESHOLD: Hand off only when the narrative has reached the immediate starting point of the upcoming prewritten scene. The next assistant reply must be able to begin that scene without additional setup, explanation, bridging, or character repositioning. If the current narrative can still progress naturally toward that point, continue instead. When uncertain, delay the handoff and move closer at a normal pace. Never use a large time skip solely to reach the threshold faster.
- USER INJECTION OVERRIDE TAG: If the user's latest reply contains ${USER_OVERRIDE_TAG}, override the normal pacing rules and use the next response to make a best-effort transition toward the handoff threshold. Force the narrative into the closest viable starting position for the upcoming prewritten scene, using only as much bridging, repositioning, or time progression as necessary. The following assistant response must include ${HANDOFF_TAG} exactly once, even if the threshold could not be reached perfectly.
- PREWRITTEN CONTENT INJECTION TAG: Once the handoff threshold is fully reached, include ${HANDOFF_TAG} exactly once on its own line. This hidden control tag exists only to trigger insertion of the upcoming prewritten content. Do not use it as a scene ending, chapter break, fade-out, or general transition marker. It may appear anywhere in the response and will be removed before the user sees it.
- PREWRITTEN SCENE PRIVACY: Use the upcoming prewritten scene only as a private directional reference for pacing and steering the current narrative.
- MANDATORY CONSTRAINT: Do not quote, summarize, paraphrase, adapt, preview, merge, or reproduce any part of the prewritten scene. Do not copy its wording, details, URLs, images, formatting, or headings. The scene will be inserted automatically after the handoff tag, so none of its content may appear beforehand.

UPCOMING PREWRITTEN SCENE — DIRECTION AND TIMING REFERENCE ONLY:
${prewrittenSceneExcerpt}
</shape_scene_direction>`;
}

const DRAWER_TAB_KEY = "__greetingInspectorDrawerTabV3";
const DRAWER_CLICK_UNSUB_KEY = "__greetingInspectorDrawerClickUnsubV3";
const DRAWER_CHANGE_UNSUB_KEY = "__greetingInspectorDrawerChangeUnsubV3";
const FLOATING_HANDLE_KEY = "__greetingInspectorFloatingHandleV3";
const FLOATING_CLICK_UNSUB_KEY = "__greetingInspectorFloatingClickUnsubV3";
const FLOATING_POINTER_UNSUB_KEY = "__greetingInspectorFloatingPointerUnsubV3";
const FLOATING_POINTER_START_KEY = "__greetingInspectorFloatingPointerStartV3";
const HANDOFF_PROCESSOR_HANDLE_KEY = "__greetingInspectorHandoffProcessorHandleV4";
const PENDING_HANDOFFS_KEY = "__greetingInspectorPendingHandoffsV4";
const BUSY_ACTION_KEY = "__greetingInspectorBusyActionV3";
const TRANSITION_IN_FLIGHT_KEY = "__greetingInspectorTransitionInFlightV3";
const DEBUG_LOG_KEY = "__greetingInspectorDebugLogV3";
const REFRESH_REVISION_KEY = "__greetingInspectorRefreshRevisionV3";
const STYLES_READY_KEY = "__greetingInspectorStylesReadyV3";
const RECENT_TRANSITIONS_KEY = "__greetingInspectorRecentTransitionsV3";

const MAX_DEBUG_LOG_LINES = 96;
const PREWRITTEN_SCENE_PROMPT_CHAR_LIMIT = 2000;
const CHAT_SWITCH_SETTLE_ATTEMPTS = 24;
const CHAT_SWITCH_SETTLE_DELAY_MS = 125;
const LATEST_MESSAGE_RETRY_ATTEMPTS = 10;
const LATEST_MESSAGE_RETRY_DELAY_MS = 150;
const MACRO_RACE_RETRY_ATTEMPTS = 5;
const MACRO_RACE_INITIAL_DELAY_MS = 15;
const DRAG_CLICK_DISTANCE_PX = 6;
const AUTO_INJECT_MIN_POSITION = 0;
const AUTO_INJECT_MAX_POSITION = 9999;

const CONTEXT_REFRESH_EVENTS = new Set([
  "ls:startup",
  "ls:reload",
  "CHAT_SWITCHED",
  "CHAT_CHANGED",
  "SETTINGS_UPDATED",
  "CHARACTER_EDITED",
  "CHARACTER_DELETED",
  "GENERATION_STARTED",
  "MESSAGE_SENT",
]);

const TRANSITION_EVENTS = new Set([
  "GENERATION_ENDED",
  "GENERATION_STOPPED",
  "MESSAGE_EDITED",
  "MESSAGE_SWIPED",
  "SWIPE_EDITED",
  "CHARACTER_MESSAGE_RENDERED",
]);

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function debugPreview(value, maxLength = 180) {
  const raw =
    typeof value === "string" ? value
    : value === undefined ? ""
    : JSON.stringify(value);
  const text = compactText(raw);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function logDebug(message, details = {}) {
  const entries =
    Array.isArray(globalThis[DEBUG_LOG_KEY]) ? globalThis[DEBUG_LOG_KEY] : [];
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${debugPreview(value, 140)}`)
    .join(" ");
  const line =
    detailText ?
      `${new Date().toLocaleTimeString()} ${message} ${detailText}`
    : `${new Date().toLocaleTimeString()} ${message}`;

  entries.push(line);
  while (entries.length > MAX_DEBUG_LOG_LINES) {
    entries.shift();
  }

  globalThis[DEBUG_LOG_KEY] = entries;

  try {
    console.log(`[Greeting Inspector] ${message}${detailText ? ` ${detailText}` : ""}`);
  } catch {
    // Console logging is diagnostic only.
  }
}

function debugLogText() {
  const entries =
    Array.isArray(globalThis[DEBUG_LOG_KEY]) ? globalThis[DEBUG_LOG_KEY] : [];
  return entries.length ? entries.join("\n") : "No debug events recorded yet.";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseIndex(value) {
  const number =
    typeof value === "number" ? value : Number.parseInt(asText(value), 10);

  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function clampIndex(value, maxIndex) {
  const index = parseIndex(value);
  if (maxIndex < 0 || index === null) {
    return 0;
  }

  return Math.max(0, Math.min(index, maxIndex));
}

function asBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return asText(value).toLowerCase() === "true";
}

function normalizeAutoInjectPosition(value) {
  const position = parseIndex(value);
  if (position === null) {
    return AUTO_INJECT_MIN_POSITION;
  }

  return Math.max(
    AUTO_INJECT_MIN_POSITION,
    Math.min(position, AUTO_INJECT_MAX_POSITION),
  );
}

function stripExtendedRegexSyntax(pattern) {
  let result = "";
  let escaped = false;
  let inCharacterClass = false;

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaped = true;
      continue;
    }

    if (character === "[" && !inCharacterClass) {
      inCharacterClass = true;
      result += character;
      continue;
    }

    if (character === "]" && inCharacterClass) {
      inCharacterClass = false;
      result += character;
      continue;
    }

    if (!inCharacterClass && character === "#") {
      while (index + 1 < pattern.length && !/[\r\n]/.test(pattern[index + 1])) {
        index += 1;
      }
      continue;
    }

    if (!inCharacterClass && /\s/.test(character)) {
      continue;
    }

    result += character;
  }

  return result;
}

function parseRegexLiteral(value) {
  const literal = asText(value);
  if (!literal) {
    return { literal: "", regex: null };
  }

  if (!literal.startsWith("/")) {
    throw new Error("Regex must start and end with / characters.");
  }

  let closingSlash = -1;
  let escaped = false;
  let inCharacterClass = false;

  for (let index = 1; index < literal.length; index += 1) {
    const character = literal[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "[" && !inCharacterClass) {
      inCharacterClass = true;
      continue;
    }

    if (character === "]" && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }

    if (character === "/" && !inCharacterClass) {
      closingSlash = index;
      break;
    }
  }

  if (closingSlash < 0) {
    throw new Error("Regex must start and end with / characters.");
  }

  const flags = literal.slice(closingSlash + 1);
  if (!/^[gmisx]*$/.test(flags)) {
    throw new Error("Regex flags may only contain g, m, i, s, or x.");
  }

  if (new Set(flags).size !== flags.length) {
    throw new Error("Regex flags cannot be repeated.");
  }

  const rawPattern = literal.slice(1, closingSlash);
  const pattern = flags.includes("x") ? stripExtendedRegexSyntax(rawPattern) : rawPattern;
  const nativeFlags = flags.replace(/x/g, "");

  try {
    return { literal, regex: new RegExp(pattern, nativeFlags) };
  } catch (error) {
    throw new Error(`Invalid regex: ${error.message || String(error)}`);
  }
}

function applyPromptExcludeRegex(content, literal) {
  const parsed = parseRegexLiteral(literal);
  return parsed.regex ? String(content ?? "").replace(parsed.regex, "") : String(content ?? "");
}

function greetingLabel(index) {
  return index === 0 ? "default greeting" : `alternate greeting ${index}`;
}

function displayGreeting(value) {
  return asText(value) || "(empty)";
}

function defaultUpcomingIndex(activeIndex, greetings) {
  const nextIndex = activeIndex + 1;
  return nextIndex < greetings.length ? nextIndex : null;
}

function normalizeUpcomingIndex(value, activeIndex, greetings) {
  const index = parseIndex(value);
  if (index === null || index <= activeIndex || index >= greetings.length) {
    return null;
  }

  return index;
}

function selectionPayload(characterId, index) {
  const id = asText(characterId);
  const parsedIndex = parseIndex(index);

  if (!id || parsedIndex === null) {
    return null;
  }

  return {
    characterId: id,
    index: parsedIndex,
  };
}

function selectionFromGreeting(greeting) {
  return greeting ? selectionPayload(greeting.characterId, greeting.index) : null;
}

function selectionKey(selection) {
  const normalized = selectionPayload(
    selection && selection.characterId,
    selection && selection.index,
  );

  return normalized ? `${normalized.characterId}::${normalized.index}` : "";
}

function sameSelection(left, right) {
  const leftKey = selectionKey(left);
  return Boolean(leftKey) && leftKey === selectionKey(right);
}

function parseSelectionValue(value) {
  if (value && typeof value === "object") {
    return selectionPayload(value.characterId, value.index);
  }

  const text = asText(value);
  if (!text) {
    return null;
  }

  const separator = text.lastIndexOf("::");
  if (separator > 0) {
    return selectionPayload(
      text.slice(0, separator),
      text.slice(separator + 2),
    );
  }

  return null;
}

function normalizeStoredSelection(value, context) {
  const selection = parseSelectionValue(value);
  if (!selection) {
    return null;
  }

  return context.greetingByKey[selectionKey(selection)] ?
      selection
    : null;
}

function normalizeUpcomingSelection(value, activeSelection, context) {
  const selection = normalizeStoredSelection(value, context);
  if (!selection || sameSelection(selection, activeSelection)) {
    return null;
  }

  if (!context.isGroupChat) {
    if (selection.characterId !== activeSelection.characterId) {
      return null;
    }

    if (selection.index <= activeSelection.index) {
      return null;
    }
  }

  return selection;
}

function defaultUpcomingSelection(activeSelection, context) {
  const active = selectionPayload(
    activeSelection && activeSelection.characterId,
    activeSelection && activeSelection.index,
  );

  if (!active) {
    return null;
  }

  const greetings = context.greetingsByCharacter[active.characterId] || [];
  const nextGreeting = greetings.find((greeting) => greeting.index > active.index);
  return selectionFromGreeting(nextGreeting);
}

function getGreetingBySelection(context, selection) {
  return context.greetingByKey[selectionKey(selection)] || null;
}

function selectedCharacterState(context, selection) {
  const normalized = selectionPayload(
    selection && selection.characterId,
    selection && selection.index,
  );

  return normalized ? context.characterById[normalized.characterId] || null : null;
}

function greetingOptionValue(greeting) {
  return `${greeting.characterId}::${greeting.index}`;
}

function getEventName() {
  const explicit = asText(data && data.__event);

  if (explicit) {
    return explicit;
  }

  if (data && data.key === "activeChatId") {
    return "SETTINGS_UPDATED";
  }

  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, "chatId") &&
    !Object.prototype.hasOwnProperty.call(data, "message") &&
    !Object.prototype.hasOwnProperty.call(data, "messageId") &&
    !Object.prototype.hasOwnProperty.call(data, "generationId")
  ) {
    return data.chatId === null ? "CHAT_SWITCHED" : "CHAT_CHANGED";
  }

  return "";
}

function isManualRun(eventName) {
  return !eventName && !(data && (data.reason === "disabled" || data.reason === "deleted"));
}

function isTeardown(eventName) {
  if (eventName === "ls:teardown") {
    return true;
  }

  return (
    !eventName &&
    data &&
    (data.reason === "disabled" || data.reason === "deleted") &&
    (asText(data.scriptId) || asText(data.scriptName))
  );
}

function isActiveChatSettingChange(eventName) {
  return eventName === "SETTINGS_UPDATED" && data && data.key === "activeChatId";
}

function eventChatId(eventName) {
  return asText(data && data.chatId) ||
    (isActiveChatSettingChange(eventName) ? asText(data && data.value) : "");
}

function eventCharacterId() {
  return asText(data && data.id) ||
    asText(data && data.character && data.character.id);
}

function isActiveChatClose(eventName) {
  return (
    (eventName === "CHAT_SWITCHED" && data && data.chatId === null) ||
    (isActiveChatSettingChange(eventName) && !asText(data && data.value))
  );
}

function isUserMessage(message) {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (typeof message.is_user === "boolean") {
    return message.is_user;
  }

  return message.role === "user";
}

function chatMessageContent(message) {
  if (!message || typeof message !== "object") {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.swipes)) {
    const swipeId = Number.isInteger(message.swipeId) ? message.swipeId : 0;
    const swipe = message.swipes[swipeId];
    if (typeof swipe === "string") {
      return swipe;
    }
  }

  return asText(message.text) || asText(message.value);
}

function transitionContentFromEvent() {
  if (typeof data?.content === "string") {
    return data.content;
  }

  return chatMessageContent(data && data.message);
}

function transitionSourceIdFromEvent() {
  return asText(data && data.messageId) ||
    asText(data && data.message && data.message.id) ||
    asText(data && data.generationId);
}

function normalizeHandoffContent(content) {
  return String(content ?? "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\r\n?/g, "\n");
}

function hasHandoffExtra(extra) {
  return Boolean(extra && typeof extra === "object" && extra[HANDOFF_EXTRA_KEY]);
}

function stripHandoffTags(content) {
  const normalized = normalizeHandoffContent(content);
  let tagCount = 0;

  HANDOFF_TAG_PATTERN.lastIndex = 0;
  const stripped = normalized.replace(HANDOFF_TAG_PATTERN, () => {
    tagCount++;
    return "";
  });

  return {
    tagCount,
    content: stripped
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trimEnd(),
  };
}

function analyzeSceneHandoff(content, extra) {
  const normalized = normalizeHandoffContent(content);
  const stripped = stripHandoffTags(normalized);
  const extraHandoff = hasHandoffExtra(extra);

  return {
    hasHandoff: stripped.tagCount > 0 || extraHandoff,
    tagCount: stripped.tagCount,
    extraHandoff,
    content: stripped.content,
    length: normalized.length,
  };
}

function hasSceneChanged(content, extra) {
  return analyzeSceneHandoff(content, extra).hasHandoff;
}

function handoffExtraPayload(ctx, handoff) {
  return {
    at: Date.now(),
    origin: asText(ctx && ctx.origin),
    tagCount: handoff.tagCount,
    contentHash: hashString(handoff.content),
  };
}

function pendingHandoffs() {
  const pending = Array.isArray(globalThis[PENDING_HANDOFFS_KEY]) ?
    globalThis[PENDING_HANDOFFS_KEY]
  : [];
  globalThis[PENDING_HANDOFFS_KEY] = pending;
  return pending;
}

function rememberPendingHandoff(ctx, handoff) {
  const sourceId = asText(ctx && ctx.messageId);
  const content = String(handoff.content ?? "");
  const contentHash = hashString(handoff.content);

  if (!sourceId && !content) {
    return;
  }

  const pending = pendingHandoffs();
  pending.push({
    chatId: asText(ctx && ctx.chatId),
    sourceId,
    content,
    contentHash,
    tagCount: handoff.tagCount,
    origin: asText(ctx && ctx.origin),
    at: Date.now(),
  });

  while (pending.length > 24) {
    pending.shift();
  }
}

function takePendingHandoff(chatId, sourceId, content = "") {
  const pending = pendingHandoffs();
  const normalizedChatId = asText(chatId);
  const normalizedSourceId = asText(sourceId);
  const contentText = String(content ?? "");
  const contentHash = hashString(contentText);

  if (!normalizedSourceId && !contentText) {
    return null;
  }

  const index = pending.findIndex((entry) =>
    entry &&
    (!normalizedChatId || !entry.chatId || entry.chatId === normalizedChatId) &&
    (
      (normalizedSourceId && entry.sourceId === normalizedSourceId) ||
      (!entry.sourceId && entry.contentHash === contentHash)
    )
  );

  if (index < 0) {
    return null;
  }

  const [entry] = pending.splice(index, 1);
  return entry;
}

function handleHandoffContent(ctx) {
  const handoff = analyzeSceneHandoff(ctx && ctx.content, ctx && ctx.extra);
  if (!handoff.hasHandoff || handoff.tagCount <= 0) {
    return undefined;
  }

  if (ctx.origin !== "render") {
    rememberPendingHandoff(ctx, handoff);
  }

  logDebug("handoff tag captured", {
    origin: ctx && ctx.origin,
    messageId: ctx && ctx.messageId,
    tags: handoff.tagCount,
    length: handoff.length,
  });

  const patch = {};
  if (handoff.content !== String((ctx && ctx.content) ?? "")) {
    patch.content = handoff.content;
  }

  if (
    ctx.origin !== "render" &&
    ctx.origin !== "swipe_add" &&
    ctx.origin !== "swipe_update"
  ) {
    patch.extra = {
      [HANDOFF_EXTRA_KEY]: handoffExtraPayload(ctx, handoff),
    };
  }

  return Object.keys(patch).length ? patch : undefined;
}

async function registerHandoffContentProcessor() {
  if (
    !api.chat ||
    typeof api.chat.registerContentProcessor !== "function"
  ) {
    logDebug("handoff content processor unavailable");
    return;
  }

  try {
    const handle = await api.chat.registerContentProcessor(handleHandoffContent, {
      id: HANDOFF_CONTENT_PROCESSOR_ID,
      origin: ["create", "update", "swipe_add", "swipe_update", "render"],
      priority: 10,
      timeoutMs: 2000,
    });
    globalThis[HANDOFF_PROCESSOR_HANDLE_KEY] = handle;
    logDebug("handoff content processor registered", {
      id: handle && handle.id ? handle.id : HANDOFF_CONTENT_PROCESSOR_ID,
    });
  } catch (error) {
    logDebug("handoff content processor registration failed", {
      error: error.message || String(error),
    });
  }
}

function unregisterHandoffContentProcessor() {
  const handle = globalThis[HANDOFF_PROCESSOR_HANDLE_KEY];
  globalThis[HANDOFF_PROCESSOR_HANDLE_KEY] = null;

  if (!handle || typeof handle.remove !== "function") {
    return;
  }

  try {
    handle.remove();
  } catch {
    // Processor teardown is best-effort.
  }
}

function hashString(value) {
  const text = String(value ?? "");
  let hash = 5381;

  for (let index = 0; index < text.length; index++) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function transitionSignature(chatId, sourceId, content) {
  const text = String(content ?? "");
  return [
    asText(chatId),
    asText(sourceId),
    String(text.length),
    hashString(text),
  ].join("|");
}

function transitionEventKey(chatId, sourceId, content) {
  const text = String(content ?? "");
  return [
    asText(chatId),
    asText(sourceId),
    String(text.length),
    hashString(text.slice(-500)),
  ].join("|");
}

function isCurrentRunInteresting(eventName, manualRun) {
  if (manualRun || TRANSITION_EVENTS.has(eventName)) {
    return true;
  }

  if (!CONTEXT_REFRESH_EVENTS.has(eventName)) {
    return false;
  }

  if (eventName === "MESSAGE_SENT") {
    return isUserMessage(data && data.message);
  }

  if (eventName === "SETTINGS_UPDATED") {
    return isActiveChatSettingChange(eventName);
  }

  return true;
}

function getBusyAction() {
  return asText(globalThis[BUSY_ACTION_KEY]);
}

function setBusyAction(action) {
  globalThis[BUSY_ACTION_KEY] = asText(action);
}

function nextRefreshRevision() {
  const revision = (Number(globalThis[REFRESH_REVISION_KEY]) || 0) + 1;
  globalThis[REFRESH_REVISION_KEY] = revision;
  return revision;
}

function isCurrentRefreshRevision(revision) {
  return Number(globalThis[REFRESH_REVISION_KEY]) === revision;
}

function recentTransitionKeys() {
  return Array.isArray(globalThis[RECENT_TRANSITIONS_KEY]) ?
      globalThis[RECENT_TRANSITIONS_KEY]
    : [];
}

function hasRecentTransition(signature, eventKey) {
  const keys = recentTransitionKeys();
  return keys.includes(signature) || keys.includes(eventKey);
}

function rememberRecentTransition(signature, eventKey) {
  const keys = recentTransitionKeys()
    .filter((key) => key !== signature && key !== eventKey);

  keys.push(signature, eventKey);
  while (keys.length > 40) {
    keys.shift();
  }

  globalThis[RECENT_TRANSITIONS_KEY] = keys;
}

function clearCachedHandles() {
  globalThis[DRAWER_TAB_KEY] = null;
  globalThis[DRAWER_CLICK_UNSUB_KEY] = null;
  globalThis[DRAWER_CHANGE_UNSUB_KEY] = null;
  globalThis[FLOATING_HANDLE_KEY] = null;
  globalThis[FLOATING_CLICK_UNSUB_KEY] = null;
  globalThis[FLOATING_POINTER_UNSUB_KEY] = null;
  globalThis[FLOATING_POINTER_START_KEY] = null;
  globalThis[STYLES_READY_KEY] = false;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isMacroRaceError(error) {
  return String(error && error.message ? error.message : error).includes(
    "non-committing macro resolution",
  );
}

async function retryOnMacroRace(operation, label) {
  let delayMs = MACRO_RACE_INITIAL_DELAY_MS;

  for (let attempt = 0; attempt < MACRO_RACE_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isMacroRaceError(error) || attempt === MACRO_RACE_RETRY_ATTEMPTS - 1) {
        throw error;
      }

      logDebug("mutation delayed during prompt preview", {
        label,
        attempt: attempt + 1,
        delayMs,
      });
      await sleep(delayMs);
      delayMs *= 2;
    }
  }

  return undefined;
}

function pushCharacterRef(refs, id, character = null) {
  const characterId = asText(id) || asText(character && character.id);
  if (!characterId) {
    return;
  }

  if (refs.some((ref) => ref.id === characterId)) {
    return;
  }

  refs.push({ id: characterId, character });
}

function pushCharacterRefValue(refs, value) {
  if (!value) {
    return;
  }

  if (typeof value === "string") {
    pushCharacterRef(refs, value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      pushCharacterRefValue(refs, item);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (value.character && typeof value.character === "object") {
    pushCharacterRef(
      refs,
      value.characterId || value.character_id || value.character.id,
      value.character,
    );
    return;
  }

  pushCharacterRef(
    refs,
    value.characterId || value.character_id || value.id,
    value.firstMessage || value.alternateGreetings ? value : null,
  );
}

function collectChatCharacterRefs(chat) {
  const refs = [];
  if (!chat || typeof chat !== "object") {
    return refs;
  }

  pushCharacterRef(refs, chat.characterId, chat.character || null);
  pushCharacterRefValue(refs, chat.character);

  for (const key of [
    "characterIds",
    "character_ids",
    "characters",
    "groupCharacters",
    "group_members",
    "groupMembers",
    "members",
    "participants",
  ]) {
    pushCharacterRefValue(refs, chat[key]);
  }

  for (const groupKey of ["group", "groupChat", "metadata"]) {
    const group = chat[groupKey];
    if (!group || typeof group !== "object") {
      continue;
    }

    for (const key of [
      "characterIds",
      "character_ids",
      "characters",
      "members",
      "participants",
    ]) {
      pushCharacterRefValue(refs, group[key]);
    }
  }

  return refs;
}

async function resolveCharacterRef(ref) {
  if (!ref || !ref.id) {
    return null;
  }

  if (ref.character && typeof ref.character === "object") {
    return {
      ...ref.character,
      id: asText(ref.character.id) || ref.id,
    };
  }

  try {
    return await api.characters.get(ref.id);
  } catch (error) {
    logDebug("character load failed", {
      characterId: ref.id,
      error: error.message || String(error),
    });
    return null;
  }
}

async function loadChatCharacters(chat) {
  const refs = collectChatCharacterRefs(chat);
  const characters = [];

  for (const ref of refs) {
    const character = await resolveCharacterRef(ref);
    if (!character) {
      continue;
    }

    const characterId = asText(character.id) || ref.id;
    if (!characterId || characters.some((item) => item.id === characterId)) {
      continue;
    }

    characters.push({
      ...character,
      id: characterId,
    });
  }

  return characters;
}

async function getActiveChat() {
  const activeChat =
    api.chats && typeof api.chats.getActive === "function" ?
      await api.chats.getActive()
    : null;

  if (activeChat) {
    return activeChat;
  }

  if (!api.chat || typeof api.chat.getChatId !== "function") {
    return null;
  }

  const chatId = await api.chat.getChatId();
  return chatId && api.chats && typeof api.chats.get === "function" ?
      api.chats.get(chatId)
    : null;
}

async function waitForActiveChat(expectedChatId) {
  const expectedId = asText(expectedChatId);
  const attempts = expectedId ? CHAT_SWITCH_SETTLE_ATTEMPTS : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const activeChat = await getActiveChat();

    if (!expectedId || (activeChat && activeChat.id === expectedId)) {
      if (attempt > 0) {
        logDebug("active chat settled", { attempt: attempt + 1, expectedId });
      }

      return activeChat;
    }

    await sleep(CHAT_SWITCH_SETTLE_DELAY_MS);
  }

  const activeChat = await getActiveChat();
  logDebug("active chat settle timeout", {
    expectedId,
    activeChatId: activeChat && activeChat.id,
  });
  return activeChat;
}

async function ensureActiveChatStill(chatId, action) {
  const expectedId = asText(chatId);
  if (!expectedId) {
    return;
  }

  const activeChat = await getActiveChat();
  if (!activeChat || activeChat.id !== expectedId) {
    throw new Error(`${action} cancelled because the active chat changed; refresh and try again.`);
  }
}

async function deleteVariable(store, key) {
  if (!store || typeof store.delete !== "function") {
    return false;
  }

  try {
    return await retryOnMacroRace(() => store.delete(key), `delete ${key}`);
  } catch (error) {
    logDebug("variable delete failed", { key, error: error.message || String(error) });
    return false;
  }
}

async function hasVariable(store, key) {
  if (!store || typeof store.has !== "function") {
    return false;
  }

  try {
    return await store.has(key);
  } catch {
    return false;
  }
}

async function getVariable(store, key, fallback) {
  if (!store || typeof store.get !== "function") {
    return fallback;
  }

  try {
    return await store.get(key, fallback);
  } catch (error) {
    logDebug("variable read failed", { key, error: error.message || String(error) });
    return fallback;
  }
}

async function setVariable(store, key, value) {
  if (!store || typeof store.set !== "function") {
    return false;
  }

  try {
    await retryOnMacroRace(() => store.set(key, value), `set ${key}`);
    logDebug("variable written", { key, value: debugPreview(value, 80) });
    return true;
  } catch (error) {
    logDebug("variable write failed", { key, error: error.message || String(error) });
    return false;
  }
}

function requireVariableWrite(success, key) {
  if (!success) {
    throw new Error(`Could not persist ${key}; refresh before trying again.`);
  }
}

function oldChatVariableKey(key) {
  return OLD_CHAT_VARIABLE_KEYS[key] || "";
}

async function readChatVariable(key, fallback) {
  const oldKey = oldChatVariableKey(key);

  if (await hasVariable(api.variables.chat, key)) {
    return getVariable(api.variables.chat, key, fallback);
  }

  if (!oldKey || !(await hasVariable(api.variables.chat, oldKey))) {
    return fallback;
  }

  const value = await getVariable(api.variables.chat, oldKey, fallback);
  await writeChatVariable(key, value);
  await deleteVariable(api.variables.chat, oldKey);
  logDebug("migrated chat variable", { oldKey, key });
  return value;
}

async function writeChatVariable(key, value, options = {}) {
  const required = Boolean(options.required);
  const skipLegacyCleanup = Boolean(options.skipLegacyCleanup);
  const wrote = await setVariable(api.variables.chat, key, value);

  if (required) {
    requireVariableWrite(wrote, key);
  }

  const oldKey = oldChatVariableKey(key);
  if (oldKey && !skipLegacyCleanup) {
    await deleteVariable(api.variables.chat, oldKey);
  }

  return wrote;
}

async function deleteChatVariable(key, options = {}) {
  const required = Boolean(options.required);
  await deleteVariable(api.variables.chat, key);

  const oldKey = oldChatVariableKey(key);
  if (oldKey) {
    await deleteVariable(api.variables.chat, oldKey);
  }

  const success =
    !(await hasVariable(api.variables.chat, key)) &&
    (!oldKey || !(await hasVariable(api.variables.chat, oldKey)));

  if (required) {
    requireVariableWrite(success, key);
  }

  return success;
}

async function confirmChatVariable(key, expectedValue, normalize) {
  if (!(await hasVariable(api.variables.chat, key))) {
    return false;
  }

  const stored = await getVariable(api.variables.chat, key, null);
  const normalized = normalize ? normalize(stored) : stored;
  return normalized === expectedValue;
}

async function clearRemovedSequenceVariables() {
  const keys = [
    "GreetingInspectorSequenceKey",
    "GreetingInspectorSequenceCompletedReplies",
    "GreetingInspectorSequenceLastAssistantMessage",
    "greetingInspector.sequenceKey",
    "greetingInspector.sequenceCompletedReplies",
    "greetingInspector.sequenceLastAssistantMessage",
  ];

  for (const key of keys) {
    await deleteVariable(api.variables.chat, key);
  }
}

async function runMaintenance() {
  await clearRemovedSequenceVariables();
  await deleteVariable(api.variables.global, OLD_STATUS_IN_DRAWER_VAR);
  await deleteVariable(api.variables.character, DEBUG_VAR);
}

async function readActiveIndex(greetings, persist = true) {
  const maxIndex = greetings.length - 1;
  const hasStoredIndex = await hasVariable(api.variables.chat, ACTIVE_INDEX_VAR);
  const stored = await readChatVariable(ACTIVE_INDEX_VAR, 0);
  const activeIndex = clampIndex(stored, maxIndex);

  if (persist && (!hasStoredIndex || stored !== activeIndex)) {
    await writeChatVariable(ACTIVE_INDEX_VAR, activeIndex);
  }

  logDebug("active index read", { stored, activeIndex, maxIndex });
  return activeIndex;
}

async function writeActiveIndex(activeIndex, greetings, options = {}) {
  const clampedIndex = clampIndex(activeIndex, greetings.length - 1);
  const confirm = options.confirm !== false;

  await writeChatVariable(ACTIVE_INDEX_VAR, clampedIndex, {
    required: true,
    skipLegacyCleanup: Boolean(options.skipLegacyCleanup),
  });

  if (!confirm) {
    return clampedIndex;
  }

  const confirmed = await confirmChatVariable(
    ACTIVE_INDEX_VAR,
    clampedIndex,
    (value) => clampIndex(value, greetings.length - 1),
  );

  if (!confirmed) {
    throw new Error(`Could not confirm ${ACTIVE_INDEX_VAR}; refresh before trying again.`);
  }

  return clampedIndex;
}

async function readUpcomingIndex(activeIndex, greetings, persist = true) {
  const hasStoredIndex = await hasVariable(api.variables.chat, UPCOMING_INDEX_VAR);
  const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);
  const stored = await readChatVariable(UPCOMING_INDEX_VAR, fallbackIndex);
  const storedIndex = normalizeUpcomingIndex(stored, activeIndex, greetings);
  const upcomingIndex = storedIndex === null ? fallbackIndex : storedIndex;

  if (upcomingIndex === null) {
    logDebug("upcoming index read", { stored, upcomingIndex: "none" });
    return null;
  }

  if (persist && (!hasStoredIndex || stored !== upcomingIndex)) {
    logDebug("upcoming index derived without write", {
      stored,
      upcomingIndex,
      fallbackIndex,
    });
  }

  logDebug("upcoming index read", { stored, upcomingIndex, fallbackIndex });
  return upcomingIndex;
}

async function writeUpcomingIndex(upcomingIndex, activeIndex, greetings) {
  const normalizedIndex = normalizeUpcomingIndex(upcomingIndex, activeIndex, greetings);

  if (normalizedIndex === null) {
    const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);

    if (fallbackIndex === null) {
      await deleteChatVariable(UPCOMING_INDEX_VAR, { required: true });

      if (await hasVariable(api.variables.chat, UPCOMING_INDEX_VAR)) {
        throw new Error(`Could not clear ${UPCOMING_INDEX_VAR}; refresh before trying again.`);
      }

      return null;
    }

    await writeChatVariable(UPCOMING_INDEX_VAR, fallbackIndex, { required: true });

    const fallbackConfirmed = await confirmChatVariable(
      UPCOMING_INDEX_VAR,
      fallbackIndex,
      (value) => normalizeUpcomingIndex(value, activeIndex, greetings),
    );

    if (!fallbackConfirmed) {
      throw new Error(`Could not confirm ${UPCOMING_INDEX_VAR}; refresh before trying again.`);
    }

    return fallbackIndex;
  }

  await writeChatVariable(UPCOMING_INDEX_VAR, normalizedIndex, { required: true });

  const confirmed = await confirmChatVariable(
    UPCOMING_INDEX_VAR,
    normalizedIndex,
    (value) => normalizeUpcomingIndex(value, activeIndex, greetings),
  );

  if (!confirmed) {
    throw new Error(`Could not confirm ${UPCOMING_INDEX_VAR}; refresh before trying again.`);
  }

  return normalizedIndex;
}

async function resetUpcomingIndex(activeIndex, greetings) {
  const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);

  if (fallbackIndex === null) {
    await deleteChatVariable(UPCOMING_INDEX_VAR, { required: true });

    if (await hasVariable(api.variables.chat, UPCOMING_INDEX_VAR)) {
      throw new Error(`Could not clear ${UPCOMING_INDEX_VAR}; refresh before trying again.`);
    }

    return null;
  }

  await writeChatVariable(UPCOMING_INDEX_VAR, fallbackIndex, { required: true });

  const confirmed = await confirmChatVariable(
    UPCOMING_INDEX_VAR,
    fallbackIndex,
    (value) => normalizeUpcomingIndex(value, activeIndex, greetings),
  );

  if (!confirmed) {
    throw new Error(`Could not confirm ${UPCOMING_INDEX_VAR}; refresh before trying again.`);
  }

  return fallbackIndex;
}

function characterScope(characterId, groupScoped) {
  return {
    characterId: asText(characterId),
    groupScoped: Boolean(groupScoped),
  };
}

async function readGroupCharacterState() {
  const value = await readChatVariable(GROUP_CHARACTER_STATE_VAR, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function valuesEqual(left, right) {
  if (left === right) {
    return true;
  }

  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object"
  ) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return false;
}

async function writeGroupCharacterState(characterId, patch, options = {}) {
  const id = asText(characterId);
  if (!id) {
    return false;
  }

  const state = await readGroupCharacterState();
  const current =
    state[id] && typeof state[id] === "object" && !Array.isArray(state[id]) ?
      state[id]
    : {};

  const unchanged = Object.entries(patch)
    .every(([key, value]) => valuesEqual(current[key], value));

  if (unchanged) {
    return true;
  }

  state[id] = {
    ...current,
    ...patch,
  };

  return writeChatVariable(GROUP_CHARACTER_STATE_VAR, state, {
    required: Boolean(options.required),
  });
}

async function readScopedCharacterValue(scope, key, fallback, persist, normalize) {
  if (!scope || !scope.groupScoped) {
    const hasStoredValue = await hasVariable(api.variables.character, key);
    const stored = await getVariable(api.variables.character, key, fallback);
    const value = normalize(stored, hasStoredValue);

    if (persist && (!hasStoredValue || stored !== value)) {
      await setVariable(api.variables.character, key, value);
    }

    return value;
  }

  const state = await readGroupCharacterState();
  const current = state[scope.characterId] || {};
  const hasStoredValue = Object.prototype.hasOwnProperty.call(current, key);
  const stored = hasStoredValue ? current[key] : fallback;
  const value = normalize(stored, hasStoredValue);

  return value;
}

async function writeScopedCharacterValue(scope, key, value, options = {}) {
  const required = Boolean(options.required);

  if (!scope || !scope.groupScoped) {
    const wrote = await setVariable(api.variables.character, key, value);
    if (required) {
      requireVariableWrite(wrote, key);
    }

    const storedExists = await hasVariable(api.variables.character, key);
    const stored = await getVariable(api.variables.character, key, null);
    return { storedExists, stored };
  }

  const wrote = await writeGroupCharacterState(
    scope.characterId,
    { [key]: value },
    { required },
  );
  if (required) {
    requireVariableWrite(wrote, key);
  }

  const state = await readGroupCharacterState();
  const current = state[scope.characterId] || {};
  return {
    storedExists: Object.prototype.hasOwnProperty.call(current, key),
    stored: current[key],
  };
}

async function readGlobalSetting(key, fallback, persist, normalize, legacyReader = null) {
  const hasStoredValue = await hasVariable(api.variables.global, key);
  const stored =
    hasStoredValue ? await getVariable(api.variables.global, key, fallback)
    : typeof legacyReader === "function" ? await legacyReader()
    : fallback;
  let value;

  try {
    value = normalize(stored);
  } catch (error) {
    value = normalize(fallback);
    logDebug("global setting reset", { key, error: error.message || String(error) });
  }

  if (persist && (!hasStoredValue || !valuesEqual(stored, value))) {
    await setVariable(api.variables.global, key, value);
  }

  return value;
}

async function writeGlobalSetting(key, value, normalize) {
  const normalizedValue = normalize(value);
  requireVariableWrite(
    await setVariable(api.variables.global, key, normalizedValue),
    key,
  );

  const storedExists = await hasVariable(api.variables.global, key);
  const stored = await getVariable(api.variables.global, key, null);
  if (!storedExists || !valuesEqual(normalize(stored), normalizedValue)) {
    throw new Error(`Could not confirm ${key}; refresh before trying again.`);
  }

  return normalizedValue;
}

async function readAutoInject(scope, persist = true) {
  const enabled = await readGlobalSetting(
    AUTO_INJECT_VAR,
    false,
    persist,
    asBoolean,
    () => readScopedCharacterValue(scope, AUTO_INJECT_VAR, false, false, asBoolean),
  );

  logDebug("global auto prompt read", { enabled });
  return enabled;
}

async function writeAutoInject(enabled) {
  return writeGlobalSetting(AUTO_INJECT_VAR, Boolean(enabled), asBoolean);
}

async function readAutoInjectPosition(scope, persist = true) {
  const position = await readGlobalSetting(
    AUTO_INJECT_POSITION_VAR,
    AUTO_INJECT_MIN_POSITION,
    persist,
    normalizeAutoInjectPosition,
    () => readScopedCharacterValue(
      scope,
      AUTO_INJECT_POSITION_VAR,
      AUTO_INJECT_MIN_POSITION,
      false,
      normalizeAutoInjectPosition,
    ),
  );

  logDebug("global auto prompt position read", { position });
  return position;
}

async function writeAutoInjectPosition(position) {
  return writeGlobalSetting(
    AUTO_INJECT_POSITION_VAR,
    position,
    normalizeAutoInjectPosition,
  );
}

async function readPromptExcludeRegex(persist = true) {
  const literal = await readGlobalSetting(
    PROMPT_EXCLUDE_REGEX_VAR,
    "",
    persist,
    (value) => parseRegexLiteral(value).literal,
  );

  logDebug("global prompt exclude regex read", { literal: literal || "(disabled)" });
  return literal;
}

async function writePromptExcludeRegex(value) {
  return writeGlobalSetting(
    PROMPT_EXCLUDE_REGEX_VAR,
    value,
    (candidate) => parseRegexLiteral(candidate).literal,
  );
}

async function readInspectorEnabled(scope, persist = true) {
  const enabled = await readScopedCharacterValue(
    scope,
    ENABLED_VAR,
    true,
    persist,
    (stored, hasStoredValue) => hasStoredValue ? asBoolean(stored) : true,
  );

  logDebug("inspector enabled read", {
    enabled,
    characterId: scope && scope.characterId,
    groupScoped: scope && scope.groupScoped,
  });
  return enabled;
}

async function writeInspectorEnabled(scope, enabled) {
  const normalizedValue = Boolean(enabled);
  const result = await writeScopedCharacterValue(
    scope,
    ENABLED_VAR,
    normalizedValue,
    { required: true },
  );

  if (!result.storedExists || asBoolean(result.stored) !== normalizedValue) {
    throw new Error(`Could not confirm ${ENABLED_VAR}; refresh before trying again.`);
  }

  return normalizedValue;
}

async function writeInspectorActive(scope, active) {
  await setVariable(api.variables.character, ACTIVE_STATUS_VAR, Boolean(active));
}

async function writeInspectorContent(scope, content) {
  await setVariable(
    api.variables.character,
    CONTENT_VAR,
    typeof content === "string" ? content : "",
  );
}

function buildCharacterGreetings(character) {
  const alternateGreetings =
    Array.isArray(character.alternateGreetings) ? character.alternateGreetings : [];

  return [
    {
      characterId: asText(character.id),
      characterName: asText(character.name) || "(unnamed)",
      character,
      index: 0,
      label: greetingLabel(0),
      text: asText(character.firstMessage),
    },
    ...alternateGreetings.map((text, index) => ({
      characterId: asText(character.id),
      characterName: asText(character.name) || "(unnamed)",
      character,
      index: index + 1,
      label: greetingLabel(index + 1),
      text: asText(text),
    })),
  ];
}

function buildGreetingContext(activeChat, characters) {
  const characterStates = [];
  const characterById = {};
  const greetingsByCharacter = {};
  const greetingByKey = {};
  const allGreetings = [];
  const activeChatCharacterId = asText(activeChat && activeChat.characterId);

  for (const character of characters) {
    const characterId = asText(character && character.id);
    if (!characterId || characterById[characterId]) {
      continue;
    }

    const greetings = buildCharacterGreetings(character);
    const state = {
      id: characterId,
      character,
      greetings,
    };

    characterStates.push(state);
    characterById[characterId] = state;
    greetingsByCharacter[characterId] = greetings;

    for (const greeting of greetings) {
      greetingByKey[selectionKey(greeting)] = greeting;
      allGreetings.push(greeting);
    }
  }

  const hasGroupShape =
    characterStates.length > 1 ||
    Boolean(
      activeChat &&
      (
        Array.isArray(activeChat.characterIds) ||
        Array.isArray(activeChat.character_ids) ||
        Array.isArray(activeChat.characters) ||
        Array.isArray(activeChat.groupMembers) ||
        Array.isArray(activeChat.group_members) ||
        Array.isArray(activeChat.members) ||
        Array.isArray(activeChat.participants) ||
        activeChat.group ||
        activeChat.groupChat
      )
    );

  return {
    chat: activeChat,
    characters,
    characterStates,
    characterById,
    greetingsByCharacter,
    greetingByKey,
    allGreetings,
    activeChatCharacterId,
    isGroupChat: hasGroupShape,
  };
}

function defaultActiveSelection(context) {
  const preferredCharacterId =
    context.activeChatCharacterId && context.characterById[context.activeChatCharacterId] ?
      context.activeChatCharacterId
    : context.characterStates[0] && context.characterStates[0].id;
  const greetings = context.greetingsByCharacter[preferredCharacterId] || [];

  return selectionFromGreeting(greetings[0]);
}

async function readActiveSelection(context, persist = true) {
  const hasStoredSelection = await hasVariable(api.variables.chat, ACTIVE_SELECTION_VAR);
  const stored = await readChatVariable(ACTIVE_SELECTION_VAR, null);
  let activeSelection = normalizeStoredSelection(stored, context);

  if (!activeSelection) {
    const fallbackSelection = defaultActiveSelection(context);
    const fallbackIndex = fallbackSelection ? fallbackSelection.index : 0;
    const legacyIndex =
      persist ?
        await readChatVariable(ACTIVE_INDEX_VAR, fallbackIndex)
      : await getVariable(api.variables.chat, ACTIVE_INDEX_VAR, fallbackIndex);

    activeSelection = normalizeStoredSelection(
      {
        characterId: fallbackSelection && fallbackSelection.characterId,
        index: legacyIndex,
      },
      context,
    ) || fallbackSelection;
  }

  if (persist && activeSelection && (!hasStoredSelection || selectionKey(stored) !== selectionKey(activeSelection))) {
    await writeChatVariable(ACTIVE_SELECTION_VAR, activeSelection);
  }

  logDebug("active selection read", {
    stored: debugPreview(stored, 80),
    active: selectionKey(activeSelection),
  });
  return activeSelection;
}

async function writeActiveSelection(activeSelection, context, options = {}) {
  const normalized = normalizeStoredSelection(activeSelection, context);
  if (!normalized) {
    throw new Error(`Could not resolve ${ACTIVE_SELECTION_VAR}; refresh before trying again.`);
  }

  const confirm = options.confirm !== false;
  await writeChatVariable(ACTIVE_SELECTION_VAR, normalized, {
    required: true,
    skipLegacyCleanup: Boolean(options.skipLegacyCleanup),
  });

  if (!confirm) {
    return normalized;
  }

  const confirmed = await confirmChatVariable(
    ACTIVE_SELECTION_VAR,
    selectionKey(normalized),
    (value) => selectionKey(normalizeStoredSelection(value, context)),
  );

  if (!confirmed) {
    throw new Error(`Could not confirm ${ACTIVE_SELECTION_VAR}; refresh before trying again.`);
  }

  return normalized;
}

async function readUpcomingSelection(activeSelection, context, persist = true) {
  const hasStoredSelection = await hasVariable(api.variables.chat, UPCOMING_SELECTION_VAR);
  const fallbackSelection = defaultUpcomingSelection(activeSelection, context);
  const stored = await readChatVariable(UPCOMING_SELECTION_VAR, fallbackSelection);
  let upcomingSelection = normalizeUpcomingSelection(stored, activeSelection, context);

  if (!upcomingSelection) {
    const fallbackIndex = fallbackSelection ? fallbackSelection.index : null;
    const legacyIndex =
      persist ?
        await readChatVariable(UPCOMING_INDEX_VAR, fallbackIndex)
      : await getVariable(api.variables.chat, UPCOMING_INDEX_VAR, fallbackIndex);

    upcomingSelection = normalizeUpcomingSelection(
      {
        characterId: activeSelection && activeSelection.characterId,
        index: legacyIndex,
      },
      activeSelection,
      context,
    ) || fallbackSelection;
  }

  if (persist && upcomingSelection && (!hasStoredSelection || selectionKey(stored) !== selectionKey(upcomingSelection))) {
    logDebug("upcoming selection derived without write", {
      stored: debugPreview(stored, 80),
      upcoming: selectionKey(upcomingSelection),
      fallback: selectionKey(fallbackSelection),
    });
  }

  logDebug("upcoming selection read", {
    stored: debugPreview(stored, 80),
    upcoming: upcomingSelection ? selectionKey(upcomingSelection) : "none",
    fallback: fallbackSelection ? selectionKey(fallbackSelection) : "none",
  });
  return upcomingSelection;
}

async function writeUpcomingSelection(upcomingSelection, activeSelection, context) {
  const normalized = normalizeUpcomingSelection(upcomingSelection, activeSelection, context);

  if (!normalized) {
    const fallbackSelection = defaultUpcomingSelection(activeSelection, context);

    if (!fallbackSelection) {
      await deleteChatVariable(UPCOMING_SELECTION_VAR, { required: true });
      return null;
    }

    return writeUpcomingSelection(fallbackSelection, activeSelection, context);
  }

  await writeChatVariable(UPCOMING_SELECTION_VAR, normalized, { required: true });

  const confirmed = await confirmChatVariable(
    UPCOMING_SELECTION_VAR,
    selectionKey(normalized),
    (value) => selectionKey(normalizeUpcomingSelection(value, activeSelection, context)),
  );

  if (!confirmed) {
    throw new Error(`Could not confirm ${UPCOMING_SELECTION_VAR}; refresh before trying again.`);
  }

  return normalized;
}

async function resetUpcomingSelection(activeSelection, context) {
  const fallbackSelection = defaultUpcomingSelection(activeSelection, context);

  if (!fallbackSelection) {
    await deleteChatVariable(UPCOMING_SELECTION_VAR, { required: true });
    return null;
  }

  return writeUpcomingSelection(fallbackSelection, activeSelection, context);
}

function inactiveState(reason, detail = "", extraState = {}) {
  return {
    ready: false,
    reason,
    detail,
    busyAction: getBusyAction(),
    inspectorEnabled: true,
    ...extraState,
  };
}

async function loadState(options = {}) {
  const expectedChatId = asText(options.expectedChatId);
  const persistDerivedState = options.persistDerivedState !== false;
  const activeChat = await waitForActiveChat(expectedChatId);

  if (!activeChat) {
    logDebug("state unavailable", { reason: "no active chat", expectedChatId });
    return inactiveState("No active chat found.");
  }

  if (options.strictChat && expectedChatId && activeChat.id !== expectedChatId) {
    logDebug("state skipped", {
      reason: "active chat mismatch",
      expectedChatId,
      activeChatId: activeChat.id,
    });
    return {
      ...inactiveState("Skipped stale event for another chat."),
      staleEvent: true,
      activeChatId: activeChat.id,
    };
  }

  const characters = await loadChatCharacters(activeChat);
  const context = buildGreetingContext(activeChat, characters);

  if (!context.characterStates.length) {
    logDebug("state unavailable", {
      reason: "chat has no characters",
      chatId: activeChat.id,
      keys: Object.keys(activeChat).join(","),
    });
    return inactiveState("The active chat does not have any associated characters.");
  }

  await runMaintenance();

  if (context.allGreetings.length < 2) {
    logDebug("state unavailable", {
      reason: "not enough greetings",
      chatId: activeChat.id,
      characterCount: context.characterStates.length,
      greetingCount: context.allGreetings.length,
    });
    return inactiveState(
      "This chat has no alternate greeting to use as the next scene.",
      context.characterStates.map((item) => item.character.name || "(unnamed)").join(", "),
      {
        chat: activeChat,
        characters,
        context,
        isGroupChat: context.isGroupChat,
      },
    );
  }

  const activeSelection = await readActiveSelection(context, persistDerivedState);
  const activeGreeting = getGreetingBySelection(context, activeSelection);
  const activeCharacterState = selectedCharacterState(context, activeSelection);
  const character = activeCharacterState && activeCharacterState.character;

  if (!activeGreeting || !character) {
    return inactiveState("Could not resolve the selected greeting character.");
  }

  const scope = characterScope(character.id, context.isGroupChat);
  const inspectorEnabled = await readInspectorEnabled(scope, persistDerivedState);
  if (!inspectorEnabled) {
    logDebug("state unavailable", {
      reason: "inspector disabled",
      characterId: character.id,
      character: character.name || "",
    });
    return inactiveState(
      "Greeting Inspector is off for this character.",
      character.name || "",
      {
        chat: activeChat,
        character,
        characters,
        context,
        activeSelection,
        activeGreeting,
        scope,
        isGroupChat: context.isGroupChat,
        inspectorEnabled,
      },
    );
  }

  const upcomingSelection = await readUpcomingSelection(
    activeSelection,
    context,
    persistDerivedState,
  );
  const upcomingGreeting = getGreetingBySelection(context, upcomingSelection);
  const autoInject = await readAutoInject(scope, persistDerivedState);
  const autoInjectPosition = await readAutoInjectPosition(
    scope,
    persistDerivedState,
  );
  const promptExcludeRegex = await readPromptExcludeRegex(persistDerivedState);

  const state = {
    ready: true,
    chat: activeChat,
    character,
    characters,
    context,
    scope,
    isGroupChat: context.isGroupChat,
    greetings: activeCharacterState.greetings,
    allGreetings: context.allGreetings,
    activeSelection,
    upcomingSelection,
    activeGreeting,
    upcomingGreeting,
    activeIndex: activeSelection.index,
    upcomingIndex: upcomingSelection ? upcomingSelection.index : null,
    autoInject,
    autoInjectPosition,
    promptExcludeRegex,
    inspectorEnabled,
    busyAction: getBusyAction(),
    sync: null,
  };

  logDebug("state loaded", {
    chatId: activeChat.id,
    characterId: character.id,
    character: character.name || "",
    group: context.isGroupChat,
    characterCount: context.characterStates.length,
    active: selectionKey(activeSelection),
    upcoming: upcomingSelection ? selectionKey(upcomingSelection) : "none",
    autoInject,
    autoInjectPosition,
    promptExcludeRegex: promptExcludeRegex || "(disabled)",
  });

  return state;
}

async function removeInjectedNote() {
  if (!api.chat || typeof api.chat.removeInjection !== "function") {
    return;
  }

  try {
    await api.chat.removeInjection(INJECTION_ID);
    logDebug("prompt injection removed", { id: INJECTION_ID });
  } catch (error) {
    logDebug("prompt injection remove skipped", {
      error: error.message || String(error),
    });
  }
}

function buildAuthorNote(prewrittenScene, promptExcludeRegex) {
  const filteredScene = applyPromptExcludeRegex(prewrittenScene, promptExcludeRegex);
  const prewrittenSceneExcerpt = filteredScene.slice(
    0,
    PREWRITTEN_SCENE_PROMPT_CHAR_LIMIT,
  );

  return buildShapeSceneDirectionPrompt(prewrittenSceneExcerpt);
}

async function syncNextSceneContext(state) {
  if (!state.ready) {
    await removeInjectedNote();
    await writeInspectorActive(state.scope, false);
    await writeInspectorContent(state.scope, "");
    return { hasContent: false, injected: false, error: "" };
  }

  const nextGreeting = state.upcomingGreeting;

  if (!nextGreeting || !nextGreeting.text) {
    await removeInjectedNote();
    await writeInspectorActive(state.scope, true);
    await writeInspectorContent(state.scope, "");
    logDebug("prompt context cleared", {
      reason: "no upcoming content",
      upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
    });
    return { hasContent: false, injected: false, error: "" };
  }

  const content = buildAuthorNote(nextGreeting.text, state.promptExcludeRegex);

  if (!state.autoInject) {
    await removeInjectedNote();
    await writeInspectorActive(state.scope, true);
    await writeInspectorContent(state.scope, content);
    logDebug("prompt context saved without injection", {
      upcoming: selectionKey(state.upcomingSelection),
      length: content.length,
    });
    return { hasContent: true, injected: false, error: "" };
  }

  let injected = false;
  let injectionError = "";
  const injectionPosition = normalizeAutoInjectPosition(state.autoInjectPosition);

  try {
    await api.chat.inject(INJECTION_ID, content, {
      mode: "intercept",
      role: "system",
      depth: injectionPosition,
      ephemeral: false,
    });
    injected = true;
  } catch (error) {
    injectionError = error.message || String(error);
  }

  await writeInspectorActive(state.scope, true);
  await writeInspectorContent(state.scope, content);

  if (injected) {
    logDebug("prompt injection synced", {
      upcoming: selectionKey(state.upcomingSelection),
      characterId: nextGreeting.characterId,
      character: nextGreeting.characterName,
      greetingIndex: nextGreeting.index,
      contentHash: hashString(nextGreeting.text),
      position: injectionPosition,
      depth: injectionPosition,
      length: content.length,
    });
    return { hasContent: true, injected: true, error: "" };
  }

  logDebug("prompt injection failed", {
    upcoming: selectionKey(state.upcomingSelection),
    characterId: nextGreeting.characterId,
    character: nextGreeting.characterName,
    greetingIndex: nextGreeting.index,
    contentHash: hashString(nextGreeting.text),
    position: injectionPosition,
    depth: injectionPosition,
    error: injectionError,
  });
  return { hasContent: true, injected: false, error: injectionError };
}

function promptContentMessage(syncResult) {
  if (!syncResult || !syncResult.hasContent) {
    return "Prompt context cleared.";
  }

  if (syncResult.error) {
    return `Prompt context saved; prompt injection failed: ${syncResult.error}`;
  }

  return syncResult.injected ?
      "Prompt context saved and injected."
    : "Prompt context saved.";
}

function buildStyles() {
  return `
@keyframes ls-gi-spin { to { transform: rotate(360deg); } }

.ls-gi-root,
.ls-gi-floating-root,
.ls-gi-picker {
  box-sizing: border-box;
  color: var(--lumiverse-text, #f5f5f5);
  font-family: inherit;
}

.ls-gi-root *,
.ls-gi-floating-root *,
.ls-gi-picker * {
  box-sizing: border-box;
}

.ls-gi-root {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.ls-gi-status {
  display: grid;
  gap: 10px;
  padding: 10px;
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
}

.ls-gi-status-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.ls-gi-kicker,
.ls-gi-meta,
.ls-gi-message,
.ls-gi-debug-title {
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  font-size: 12px;
  line-height: 1.35;
}

.ls-gi-value {
  min-width: 0;
  color: var(--lumiverse-text, #f5f5f5);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.ls-gi-button-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.ls-gi-button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 9px;
  color: var(--lumiverse-primary-contrast, #ffffff);
  background: var(--lumiverse-primary, #3b82f6);
  border: 1px solid var(--lumiverse-primary, #3b82f6);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  line-height: 1.1;
  cursor: pointer;
  user-select: none;
}

.ls-gi-button-secondary {
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-fill, rgba(255, 255, 255, 0.1));
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.18));
}

.ls-gi-button-danger {
  color: #ffffff;
  background: var(--lumiverse-danger, #dc2626);
  border-color: var(--lumiverse-danger, #dc2626);
}

.ls-gi-power-button {
  width: 100%;
  min-height: 36px;
  font-size: 13px;
  font-weight: 750;
  letter-spacing: 0;
}

.ls-gi-power-button-on {
  color: #ffffff;
  background: #15803d;
  border-color: #166534;
}

.ls-gi-power-button-off {
  color: #ffffff;
  background: #dc2626;
  border-color: #b91c1c;
}

.ls-gi-refresh-button {
  min-width: 82px;
}

.ls-gi-button:disabled,
.ls-gi-button[aria-disabled="true"] {
  opacity: 0.48;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  background: var(--lumiverse-fill-subtle, rgba(255, 255, 255, 0.06));
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.14));
  cursor: not-allowed;
}

.ls-gi-button > span,
.ls-gi-button > svg {
  pointer-events: none;
}

.ls-gi-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 999px;
  animation: ls-gi-spin 0.8s linear infinite;
}

.ls-gi-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.ls-gi-checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--lumiverse-text, #f5f5f5);
  font-size: 12px;
  cursor: pointer;
}

.ls-gi-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--lumiverse-primary, #3b82f6);
}

.ls-gi-inline-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  font-size: 12px;
  white-space: nowrap;
}

.ls-gi-inline-input {
  min-height: 28px;
  width: 72px;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-fill, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  padding: 4px 8px;
  font: inherit;
  font-size: 12px;
}

.ls-gi-settings-header,
.ls-gi-regex-field {
  display: grid;
  gap: 4px;
}

.ls-gi-settings-title {
  color: var(--lumiverse-text, #f5f5f5);
  font-size: 13px;
  font-weight: 650;
}

.ls-gi-text-input {
  width: 100%;
  min-height: 32px;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-fill, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  padding: 6px 8px;
  font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.ls-gi-preview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.ls-gi-preview {
  min-width: 0;
  overflow: hidden;
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
}

.ls-gi-preview-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
}

.ls-gi-preview-title {
  color: var(--lumiverse-text, #f5f5f5);
  font-size: 12px;
  font-weight: 650;
}

.ls-gi-preview-text,
.ls-gi-debug-output {
  margin: 0;
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.ls-gi-preview-text {
  max-height: 190px;
  overflow: auto;
}

.ls-gi-debug-output {
  max-height: 240px;
  overflow: auto;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.82));
  background: rgba(0, 0, 0, 0.24);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  font-size: 11px;
}

.ls-gi-floating-root {
  position: fixed;
  left: 0;
  right: auto;
  bottom: 0;
  z-index: 2147483646;
}

.ls-gi-picker {
  height: min(78vh, 900px);
  min-height: min(560px, calc(100vh - 170px));
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
}

.ls-gi-picker-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.ls-gi-picker-field {
  display: grid;
  gap: 6px;
  flex: 0 0 auto;
}

.ls-gi-picker-label {
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  font-size: 12px;
}

.ls-gi-picker-select {
  width: 100%;
  min-height: 38px;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-fill, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  padding: 8px 10px;
}

.ls-gi-picker-preview {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.14));
  border-radius: 8px;
}

.ls-gi-picker-preview pre {
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.ls-gi-picker-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
}

@media (min-width: 720px) {
  .ls-gi-preview-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-height: 760px) {
  .ls-gi-picker {
    height: calc(100vh - 170px);
    min-height: 0;
  }
}
`;
}

function spinnerHtml(show) {
  return show ? '<span class="ls-gi-spinner" aria-hidden="true"></span>' : "";
}

function refreshButtonHtml(id, busyAction) {
  const busy = busyAction === "refresh";
  const disabled = busyAction ? ' disabled aria-disabled="true" aria-busy="true"' : "";
  return `<button class="ls-gi-button ls-gi-button-secondary ls-gi-refresh-button" id="${id}" data-action="refresh" type="button" title="Refresh Greeting Inspector for the active chat"${disabled}>${spinnerHtml(busy)}<span>Refresh</span></button>`;
}

function powerButtonHtml(state, busyAction) {
  if (!state.character) {
    return "";
  }

  const enabled = state.inspectorEnabled !== false;
  const label = enabled ? "ON" : "OFF";
  const className =
    enabled ? "ls-gi-power-button-on" : "ls-gi-power-button-off";
  const disabled = busyAction ? ' disabled aria-disabled="true"' : "";
  const title =
    enabled ?
      "Turn Greeting Inspector off for this character"
    : "Turn Greeting Inspector on for this character";

  return `<button class="ls-gi-button ls-gi-power-button ${className}" id="ls-gi-power-toggle" data-action="powerToggle" type="button" title="${title}"${disabled}><span>${label}</span></button>`;
}

function indexLabel(greeting, includeCharacter = false) {
  if (!greeting) {
    return "none";
  }

  const label = `${greeting.index} (${greeting.label})`;
  return includeCharacter ? `${greeting.characterName}: ${label}` : label;
}

function activeGreetingLabel(state) {
  return indexLabel(state.activeGreeting, state.isGroupChat);
}

function upcomingGreetingLabel(state) {
  return indexLabel(state.upcomingGreeting, state.isGroupChat);
}

function upcomingPickerOptions(state) {
  if (!state.ready) {
    return [];
  }

  if (!state.isGroupChat) {
    return state.greetings.filter((greeting) => greeting.index > state.activeIndex);
  }

  return state.allGreetings.filter(
    (greeting) => !sameSelection(greeting, state.activeSelection),
  );
}

function buildDrawerHtml(state) {
  const busyAction = getBusyAction();

  if (!state.ready) {
    const statusValue = state.inspectorEnabled === false ? "Off" : "Inactive";
    return `
<div class="ls-gi-root">
  ${powerButtonHtml(state, busyAction)}
  <div class="ls-gi-status">
    <div class="ls-gi-status-top">
      <div>
        <div class="ls-gi-kicker">Greeting Inspector</div>
        <div class="ls-gi-value">${statusValue}</div>
      </div>
      <div class="ls-gi-button-row">${refreshButtonHtml("ls-gi-drawer-refresh", busyAction)}</div>
    </div>
    <div class="ls-gi-message">${escapeHtml(state.reason || "Open a chat with alternate greetings.")}</div>
    ${state.detail ? `<div class="ls-gi-meta">${escapeHtml(state.detail)}</div>` : ""}
  </div>
  <div class="ls-gi-preview">
    <div class="ls-gi-preview-header">
      <span class="ls-gi-preview-title">Debug log</span>
      <span class="ls-gi-meta">always on</span>
    </div>
    <pre class="ls-gi-debug-output">${escapeHtml(debugLogText())}</pre>
  </div>
</div>`;
  }

  const activeGreeting = state.activeGreeting;
  const upcomingGreeting = state.upcomingGreeting;
  const canPickUpcoming = upcomingPickerOptions(state).length > 0;
  const promptMessage = promptContentMessage(state.sync);

  return `
<div class="ls-gi-root">
  ${powerButtonHtml(state, busyAction)}
  <div class="ls-gi-status">
    <div class="ls-gi-status-top">
      <div>
        <div class="ls-gi-kicker">Active greeting</div>
        <div class="ls-gi-value">${escapeHtml(activeGreetingLabel(state))}</div>
        <div class="ls-gi-meta">Next: ${escapeHtml(upcomingGreetingLabel(state))}</div>
      </div>
      <div class="ls-gi-button-row">
        ${refreshButtonHtml("ls-gi-drawer-refresh", busyAction)}
        <button class="ls-gi-button ls-gi-button-secondary" id="ls-gi-active" data-action="active" type="button"${busyAction ? " disabled" : ""}><span>Active</span></button>
        <button class="ls-gi-button" id="ls-gi-next" data-action="upcoming" type="button"${busyAction || !canPickUpcoming ? " disabled" : ""}><span>Next</span></button>
        <button class="ls-gi-button ls-gi-button-danger" id="ls-gi-force" data-action="force" type="button"${busyAction || !upcomingGreeting ? " disabled" : ""}><span>Force</span></button>
      </div>
    </div>
  </div>
  <div class="ls-gi-status ls-gi-settings">
    <div class="ls-gi-settings-header">
      <div class="ls-gi-settings-title">Settings</div>
      <div class="ls-gi-meta">Global across characters, chats, restarts, and ON/OFF toggles.</div>
    </div>
    <div class="ls-gi-option-row">
      <label class="ls-gi-checkbox-label" for="ls-gi-auto-prompt">
        <input class="ls-gi-checkbox" id="ls-gi-auto-prompt" type="checkbox"${state.autoInject ? " checked" : ""}${busyAction ? " disabled" : ""}>
        <span>Auto prompt</span>
      </label>
      <label class="ls-gi-inline-label" for="ls-gi-auto-position">
        <span>Within</span>
        <input class="ls-gi-inline-input" id="ls-gi-auto-position" type="number" min="${AUTO_INJECT_MIN_POSITION}" max="${AUTO_INJECT_MAX_POSITION}" step="1" inputmode="numeric" value="${escapeHtml(normalizeAutoInjectPosition(state.autoInjectPosition))}" title="Auto prompt within position"${busyAction ? " disabled" : ""}>
      </label>
      <div class="ls-gi-message">${escapeHtml(promptMessage)}</div>
    </div>
    <label class="ls-gi-regex-field" for="ls-gi-prompt-exclude-regex">
      <span class="ls-gi-inline-label">Prompt exclude regex</span>
      <input class="ls-gi-text-input" id="ls-gi-prompt-exclude-regex" type="text" value="${escapeHtml(state.promptExcludeRegex || "")}" placeholder="/pattern/gmixs" autocomplete="off" spellcheck="false"${busyAction ? " disabled" : ""}>
      <span class="ls-gi-meta">Optional. Matches are removed before the upcoming scene is truncated and added to the prompt. Use /pattern/flags; supported flags: g, m, i, s, x.</span>
    </label>
  </div>
  <div class="ls-gi-preview-grid">
    <section class="ls-gi-preview">
      <div class="ls-gi-preview-header">
        <span class="ls-gi-preview-title">Active</span>
        <span class="ls-gi-meta">${escapeHtml(activeGreetingLabel(state))}</span>
      </div>
      <pre class="ls-gi-preview-text">${escapeHtml(displayGreeting(activeGreeting && activeGreeting.text))}</pre>
    </section>
    <section class="ls-gi-preview">
      <div class="ls-gi-preview-header">
        <span class="ls-gi-preview-title">Next</span>
        <span class="ls-gi-meta">${escapeHtml(upcomingGreetingLabel(state))}</span>
      </div>
      <pre class="ls-gi-preview-text">${escapeHtml(upcomingGreeting ? displayGreeting(upcomingGreeting.text) : "(no upcoming greeting)")}</pre>
    </section>
  </div>
  <div class="ls-gi-preview">
    <div class="ls-gi-preview-header">
      <span class="ls-gi-preview-title">Debug log</span>
      <span class="ls-gi-meta">always on</span>
    </div>
    <pre class="ls-gi-debug-output">${escapeHtml(debugLogText())}</pre>
  </div>
</div>`;
}

function buildFloatingRefreshHtml() {
  return `<div class="ls-gi-floating-root">${refreshButtonHtml("ls-gi-floating-refresh", getBusyAction())}</div>`;
}

function drawerTabIconSvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M9 4v16"/>
      <path d="M6 8h0"/>
      <path d="M6 12h0"/>
      <path d="M6 16h0"/>
    </svg>
  `;
}

async function ensureStyles() {
  if (!api.ui || !api.ui.dom || typeof api.ui.dom.addStyle !== "function") {
    return false;
  }

  if (globalThis[STYLES_READY_KEY]) {
    return true;
  }

  try {
    await api.ui.dom.addStyle(buildStyles(), { id: STYLE_ID });
    globalThis[STYLES_READY_KEY] = true;
    return true;
  } catch (error) {
    globalThis[STYLES_READY_KEY] = false;
    logDebug("style injection failed", { error: error.message || String(error) });
    return false;
  }
}

function getDrawerTab() {
  if (!api.ui || typeof api.ui.registerDrawerTab !== "function") {
    return null;
  }

  const existingTab = globalThis[DRAWER_TAB_KEY];
  if (existingTab && existingTab.root) {
    return existingTab;
  }

  const tab = api.ui.registerDrawerTab({
    id: DRAWER_TAB_ID,
    title: "Greeting Inspector",
    shortName: "GI",
    description: "Greeting Inspector controls and upcoming prewritten scene",
    keywords: ["greeting", "inspector", "scene", "prewritten", "refresh"],
    headerTitle: "Greeting Inspector",
    iconSvg: drawerTabIconSvg(),
  });

  globalThis[DRAWER_TAB_KEY] = tab;
  logDebug("drawer tab registered", { id: DRAWER_TAB_ID });
  return tab;
}

function unsubscribeByKey(key) {
  const unsubscribe = globalThis[key];
  if (typeof unsubscribe === "function") {
    try {
      unsubscribe();
    } catch {
      // Listener cleanup is best-effort.
    }
  }

  globalThis[key] = null;
}

function actionFromEvent(event) {
  return asText(event && event.dataset && event.dataset.action);
}

async function attachDrawerHandlers(root) {
  unsubscribeByKey(DRAWER_CLICK_UNSUB_KEY);
  unsubscribeByKey(DRAWER_CHANGE_UNSUB_KEY);

  globalThis[DRAWER_CLICK_UNSUB_KEY] = root.on(
    "click",
    async (event) => {
      const action = actionFromEvent(event);

      if (!action) {
        return;
      }

      await handleUiAction(action, { source: "drawer" });
    },
  );

  globalThis[DRAWER_CHANGE_UNSUB_KEY] = root.on("change", async (event) => {
    if (event.targetId === "ls-gi-auto-prompt") {
      await handleUiAction("autoPrompt", {
        source: "drawer",
        checked: Boolean(event.targetChecked),
      });
      return;
    }

    if (event.targetId === "ls-gi-auto-position") {
      await handleUiAction("autoPosition", {
        source: "drawer",
        position: event.targetValue,
      });
      return;
    }

    if (event.targetId === "ls-gi-prompt-exclude-regex") {
      await handleUiAction("promptExcludeRegex", {
        source: "drawer",
        value: event.targetValue,
      });
    }
  });
}

async function renderDrawer(state) {
  const tab = getDrawerTab();

  if (!tab) {
    logDebug("drawer unavailable");
    return;
  }

  try {
    const badge =
      state.ready ?
        state.upcomingIndex === null ?
          String(state.activeIndex)
        : `${state.activeIndex}->${state.upcomingIndex}`
      : "off";

    tab.setBadge(badge);
    tab.root.update(buildDrawerHtml(state));
    await attachDrawerHandlers(tab.root);
    logDebug("drawer rendered", { badge, ready: state.ready });
  } catch (error) {
    logDebug("drawer render failed", { error: error.message || String(error) });
  }
}

async function attachFloatingRefreshHandlers(handle) {
  unsubscribeByKey(FLOATING_CLICK_UNSUB_KEY);
  unsubscribeByKey(FLOATING_POINTER_UNSUB_KEY);

  globalThis[FLOATING_POINTER_UNSUB_KEY] = handle.on(
    "pointerdown",
    async (event) => {
      globalThis[FLOATING_POINTER_START_KEY] = {
        x: Number(event && event.clientX) || 0,
        y: Number(event && event.clientY) || 0,
      };
    },
  );

  globalThis[FLOATING_CLICK_UNSUB_KEY] = handle.on(
    "click",
    async (event) => {
      if (actionFromEvent(event) !== "refresh") {
        return;
      }

      const start = globalThis[FLOATING_POINTER_START_KEY];
      globalThis[FLOATING_POINTER_START_KEY] = null;

      if (start) {
        const dx = (Number(event && event.clientX) || 0) - start.x;
        const dy = (Number(event && event.clientY) || 0) - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > DRAG_CLICK_DISTANCE_PX) {
          logDebug("floating refresh click ignored after drag", {
            distance: Math.round(distance),
          });
          return;
        }
      }

      await handleUiAction("refresh", { source: "floating" });
    },
    { preventDefault: true },
  );
}

async function renderFloatingRefresh() {
  if (!api.ui || !api.ui.dom || typeof api.ui.dom.inject !== "function") {
    return;
  }

  try {
    let handle = globalThis[FLOATING_HANDLE_KEY];

    if (handle && typeof handle.read === "function") {
      let snapshot = null;
      try {
        snapshot = await handle.read();
      } catch (error) {
        logDebug("floating refresh handle read failed", {
          error: error.message || String(error),
        });
      }

      if (!snapshot) {
        handle = null;
        globalThis[FLOATING_HANDLE_KEY] = null;
      }
    }

    if (handle && typeof handle.update === "function") {
      await handle.update(buildFloatingRefreshHtml());
      logDebug("floating refresh updated", { busy: getBusyAction() || "none" });
      return;
    }

    handle = await api.ui.dom.inject("body", buildFloatingRefreshHtml(), {
      id: FLOATING_REFRESH_ID,
      position: "beforeend",
    });
    globalThis[FLOATING_HANDLE_KEY] = handle;

    if (handle && typeof handle.makeDraggable === "function") {
      handle.makeDraggable(".ls-gi-refresh-button");
    }

    await attachFloatingRefreshHandlers(handle);
    logDebug("floating refresh rendered", { busy: getBusyAction() || "none" });
  } catch (error) {
    logDebug("floating refresh render failed", { error: error.message || String(error) });
  }
}

async function renderUi(state) {
  await ensureStyles();
  await renderDrawer(state);
  await renderFloatingRefresh();
}

function pickerOptions(kind, state) {
  return kind === "active" ? state.allGreetings : upcomingPickerOptions(state);
}

function buildGreetingOptions(greetings, selectedSelection, includeCharacter) {
  const selectedKey = selectionKey(selectedSelection);
  return greetings
    .map((greeting) => {
      const selected = selectionKey(greeting) === selectedKey ? " selected" : "";
      return `<option value="${escapeHtml(greetingOptionValue(greeting))}"${selected}>${escapeHtml(indexLabel(greeting, includeCharacter))}</option>`;
    })
    .join("");
}

function buildPickerHtml(kind, state, selectedSelection) {
  const isActivePicker = kind === "active";
  const options = pickerOptions(kind, state);
  const selectedGreeting =
    getGreetingBySelection(state.context, selectedSelection) || options[0] || null;
  const activeGreeting = state.activeGreeting;
  const selectId = isActivePicker ? "ls-gi-picker-active" : "ls-gi-picker-upcoming";
  const title = isActivePicker ? "Active greeting" : "Next greeting";
  const confirmLabel = isActivePicker ? "Use Active Greeting" : "Use Next Greeting";
  const nextAfterActive =
    isActivePicker ?
      getGreetingBySelection(
        state.context,
        defaultUpcomingSelection(selectionFromGreeting(selectedGreeting), state.context),
      )
    : selectedGreeting;
  const hint =
    isActivePicker ?
      `Selecting this greeting will reset next to ${indexLabel(nextAfterActive, state.isGroupChat)}.`
    : `Current active greeting remains ${indexLabel(activeGreeting, state.isGroupChat)}.`;

  return `
<div class="ls-gi-picker">
  <div class="ls-gi-picker-main">
    <div class="ls-gi-meta">${escapeHtml(state.isGroupChat ? `Group chat: ${state.context.characterStates.length} characters` : `Character: ${state.character.name || "(unnamed)"}`)}</div>
    <div class="ls-gi-picker-field">
      <label class="ls-gi-picker-label" for="${selectId}">${escapeHtml(title)}</label>
      <select class="ls-gi-picker-select" id="${selectId}">
        ${buildGreetingOptions(options, selectionFromGreeting(selectedGreeting), state.isGroupChat)}
      </select>
    </div>
    <div class="ls-gi-meta">Selected: ${escapeHtml(indexLabel(selectedGreeting, state.isGroupChat))}</div>
    <div class="ls-gi-meta">${escapeHtml(hint)}</div>
    <div class="ls-gi-picker-preview" aria-label="Selected greeting preview">
      <pre>${escapeHtml(displayGreeting(selectedGreeting && selectedGreeting.text))}</pre>
    </div>
  </div>
  <div class="ls-gi-picker-footer">
    <button class="ls-gi-button ls-gi-button-secondary" id="ls-gi-picker-cancel" data-action="cancel" type="button"><span>Cancel</span></button>
    <button class="ls-gi-button" id="ls-gi-picker-use" data-action="use" type="button"><span>${escapeHtml(confirmLabel)}</span></button>
  </div>
</div>`;
}

async function openPicker(kind, state, options = {}) {
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return null;
  }

  const isActivePicker = kind === "active";
  const selectableGreetings = pickerOptions(kind, state);

  if (!selectableGreetings.length) {
    api.ui.toast("There is no later greeting to use as the next greeting.", "warning");
    return null;
  }

  if (
    !api.ui ||
    typeof api.ui.showAdvancedModal !== "function" ||
    !api.ui.dom ||
    typeof api.ui.dom.addStyle !== "function"
  ) {
    const fallbackSelection = await openPickerFallback(kind, state);
    if (fallbackSelection !== null && typeof options.onUse === "function") {
      await options.onUse(fallbackSelection);
    }
    return fallbackSelection;
  }

  let selectedSelection =
    isActivePicker ?
      state.activeSelection
    : normalizeUpcomingSelection(state.upcomingSelection, state.activeSelection, state.context) ??
      selectionFromGreeting(selectableGreetings[0]);
  let modal = null;
  const unsubscribers = [];

  function render() {
    modal.root.update(buildPickerHtml(kind, state, selectedSelection));
  }

  function cleanup() {
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Modal listener cleanup is best-effort.
      }
    }
  }

  try {
    await api.ui.dom.addStyle(buildStyles(), { id: MODAL_STYLE_ID });
    modal = await api.ui.showAdvancedModal({
      title: isActivePicker ? "Choose Active Greeting" : "Choose Next Greeting",
      width: 1040,
      maxHeight: 1000,
      persistent: false,
    });
    render();
    logDebug("picker opened", { kind, selected: selectionKey(selectedSelection) });
  } catch (error) {
    cleanup();
    logDebug("picker open failed", { kind, error: error.message || String(error) });
    api.ui.toast(
      `Could not open the visual picker: ${error.message || String(error)}. Using text picker.`,
      "warning",
    );
    return openPickerFallback(kind, state);
  }

  return new Promise((resolve) => {
    let settled = false;
    let committing = false;

    function finish(value, dismissModal = true) {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (dismissModal && modal && !modal.dismissed) {
        modal.dismiss();
      }

      logDebug("picker closed", {
        kind,
        selected: value === null ? "cancelled" : selectionKey(value),
      });
      resolve(value);
    }

    unsubscribers.push(modal.onDismiss(() => finish(null, false)));

    unsubscribers.push(
      modal.root.on("change", async (event) => {
        const expectedId =
          isActivePicker ? "ls-gi-picker-active" : "ls-gi-picker-upcoming";

        if (event.targetId !== expectedId) {
          return;
        }

        const nextSelection =
          isActivePicker ?
            normalizeStoredSelection(parseSelectionValue(event.targetValue), state.context)
          : normalizeUpcomingSelection(
              parseSelectionValue(event.targetValue),
              state.activeSelection,
              state.context,
            );

        if (nextSelection === null) {
          return;
        }

        selectedSelection = nextSelection;
        logDebug("picker selection changed", {
          kind,
          selected: selectionKey(selectedSelection),
        });
        render();
      }),
    );

    unsubscribers.push(
      modal.root.on(
        "click",
        async (event) => {
          const action = actionFromEvent(event);

          if (action === "cancel") {
            finish(null);
            return;
          }

          if (action === "use") {
            if (typeof options.onUse !== "function") {
              finish(selectedSelection);
              return;
            }

            if (committing) {
              return;
            }

            committing = true;
            try {
              await options.onUse(selectedSelection);
              finish(selectedSelection);
            } catch (error) {
              const message = error.message || String(error);
              logDebug("picker commit failed", { kind, error: message });
              api.ui.toast(`Greeting Inspector picker failed: ${message}`, "warning");
              finish(null);
            }
          }
        },
      ),
    );
  });
}

async function openPickerFallback(kind, state) {
  const isActivePicker = kind === "active";
  const options = pickerOptions(kind, state);
  let selectedOptionIndex = Math.max(
    0,
    options.findIndex((greeting) =>
      sameSelection(
        greeting,
        isActivePicker ? state.activeSelection : state.upcomingSelection,
      )
    ),
  );

  while (true) {
    const greeting = options[selectedOptionIndex];
    const optionSummary = options
      .map((item, index) =>
        `${index + 1}. ${indexLabel(item, state.isGroupChat)}`,
      )
      .join("\n");
    const input = await api.ui.prompt(
      [
        state.isGroupChat ?
          `Group chat: ${state.context.characterStates.length} characters`
        : `Character: ${state.character.name || "(unnamed)"}`,
        `Selected: ${indexLabel(greeting, state.isGroupChat)}`,
        "",
        "Leave blank to use this greeting. Enter n, p, or an option number to change selection.",
        "",
        optionSummary,
        "",
        displayGreeting(greeting.text),
      ].join("\n"),
      "",
      {
        placeholder: `blank=use, n, p, or 1-${options.length}`,
        submitLabel: isActivePicker ? "Use active" : "Use next",
        cancelLabel: "Cancel",
      },
    );

    if (input === null) {
      return null;
    }

    const command = input.trim().toLowerCase();
    if (!command || command === "s" || command === "select" || command === "use") {
      return selectionFromGreeting(greeting);
    }

    if (command === "n" || command === "next") {
      selectedOptionIndex =
        selectedOptionIndex >= options.length - 1 ? 0 : selectedOptionIndex + 1;
      continue;
    }

    if (command === "p" || command === "prev" || command === "previous") {
      selectedOptionIndex =
        selectedOptionIndex <= 0 ? options.length - 1 : selectedOptionIndex - 1;
      continue;
    }

    const nextOptionIndex = parseIndex(command);
    if (
      nextOptionIndex === null ||
      nextOptionIndex < 1 ||
      nextOptionIndex > options.length
    ) {
      api.ui.toast(`Choose a number from 1 to ${options.length}.`, "warning");
      continue;
    }

    selectedOptionIndex = nextOptionIndex - 1;
  }
}

async function getLatestChatMessage() {
  if (!api.chat || typeof api.chat.getMessages !== "function") {
    logDebug("latest message unavailable", { reason: "api.chat.getMessages missing" });
    return null;
  }

  try {
    const messages = await api.chat.getMessages({ last: 1 });
    const latestMessage =
      Array.isArray(messages) && messages.length > 0 ? messages[0] : null;
    const content = chatMessageContent(latestMessage);
    const handoff = analyzeSceneHandoff(content, latestMessage && latestMessage.extra);

    logDebug("latest message read", {
      id: latestMessage && latestMessage.id,
      role: latestMessage && latestMessage.role,
      handoff: handoff.hasHandoff,
      tags: handoff.tagCount,
      extra: handoff.extraHandoff,
      length: handoff.length,
    });
    return latestMessage;
  } catch (error) {
    logDebug("latest message read failed", { error: error.message || String(error) });
    return null;
  }
}

async function getLatestHandoffMessage(expectedMessageId) {
  const expectedId = asText(expectedMessageId);
  let latestMessage = null;

  for (let attempt = 0; attempt < LATEST_MESSAGE_RETRY_ATTEMPTS; attempt++) {
    latestMessage = await getLatestChatMessage();

    if (!latestMessage) {
      await sleep(LATEST_MESSAGE_RETRY_DELAY_MS);
      continue;
    }

    const content = chatMessageContent(latestMessage);
    const handoff = analyzeSceneHandoff(content, latestMessage.extra);
    const latestId = asText(latestMessage.id);

    logDebug("latest handoff check", {
      attempt: attempt + 1,
      expectedId,
      latestId,
      handoff: handoff.hasHandoff,
      tags: handoff.tagCount,
      extra: handoff.extraHandoff,
    });

    if (handoff.hasHandoff) {
      return latestMessage;
    }

    await sleep(LATEST_MESSAGE_RETRY_DELAY_MS);
  }

  return latestMessage && hasSceneChanged(chatMessageContent(latestMessage), latestMessage.extra) ?
      latestMessage
    : null;
}

async function resolveTransitionSource(eventName) {
  if (data && data.message && isUserMessage(data.message)) {
    logDebug("transition source ignored", { event: eventName, reason: "user message" });
    return null;
  }

  const directContent = transitionContentFromEvent();
  const directSourceId = transitionSourceIdFromEvent();
  const directExtra = data && data.message ? data.message.extra : null;
  const directHandoff = analyzeSceneHandoff(directContent, directExtra);
  const pendingHandoff = takePendingHandoff(
    eventChatId(eventName),
    directSourceId,
    directHandoff.content,
  );

  logDebug("transition source check", {
    event: eventName,
    directSourceId,
    directHandoff: directHandoff.hasHandoff,
    directTags: directHandoff.tagCount,
    directExtra: directHandoff.extraHandoff,
    pending: Boolean(pendingHandoff),
    directLength: directHandoff.length,
  });

  if (directHandoff.hasHandoff) {
    return {
      content: directHandoff.content,
      sourceId: directSourceId,
      hasHandoff: true,
    };
  }

  if (pendingHandoff) {
    return {
      content: pendingHandoff.content,
      sourceId: pendingHandoff.sourceId || directSourceId,
      hasHandoff: true,
    };
  }

  if (
    eventName === "GENERATION_ENDED" ||
    eventName === "GENERATION_STOPPED" ||
    eventName === "CHARACTER_MESSAGE_RENDERED"
  ) {
    const latest = await getLatestHandoffMessage(directSourceId);
    if (latest) {
      const latestHandoff = analyzeSceneHandoff(
        chatMessageContent(latest),
        latest.extra,
      );
      return {
        content: latestHandoff.content,
        sourceId: asText(latest.id) || directSourceId,
        hasHandoff: true,
      };
    }

    return null;
  }

  return null;
}

function beginGreetingMessageInsert(greeting) {
  if (!greeting || !greeting.text) {
    logDebug("insert skipped", { reason: "empty greeting" });
    return Promise.resolve(false);
  }

  const baseOptions = { role: "assistant" };

  try {
    return api.chat.sendMessage(greeting.text, baseOptions)
      .then(() => {
        logDebug("greeting inserted", {
          characterId: greeting.characterId,
          character: greeting.characterName,
          index: greeting.index,
          contentHash: hashString(greeting.text),
          length: greeting.text.length,
        });
        return true;
      })
      .catch((error) => {
        logDebug("greeting insert failed", {
          index: greeting.index,
          error: error.message || String(error),
        });
        return false;
      });
  } catch (error) {
    logDebug("greeting insert failed", {
      index: greeting.index,
      error: error.message || String(error),
    });
    return Promise.resolve(false);
  }
}

async function insertGreetingMessage(greeting) {
  return beginGreetingMessageInsert(greeting);
}

async function advanceToUpcomingGreeting(state, source = "manual") {
  const advancedSelection =
    normalizeUpcomingSelection(
      state.upcomingSelection,
      state.activeSelection,
      state.context,
    ) ??
    defaultUpcomingSelection(state.activeSelection, state.context);
  const advancedGreeting = getGreetingBySelection(state.context, advancedSelection);
  const automaticTransition = TRANSITION_EVENTS.has(source);
  const previousActiveSelection = state.activeSelection;
  const previousUpcomingSelection = state.upcomingSelection;

  logDebug("advance requested", {
    source,
    active: selectionKey(state.activeSelection),
    upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
    advanced: advancedSelection ? selectionKey(advancedSelection) : "none",
  });

  if (!advancedSelection || !advancedGreeting || sameSelection(advancedSelection, state.activeSelection)) {
    state.upcomingSelection = await resetUpcomingSelection(state.activeSelection, state.context);
    state.upcomingGreeting = getGreetingBySelection(state.context, state.upcomingSelection);
    state.upcomingIndex = state.upcomingSelection ? state.upcomingSelection.index : null;
    return {
      advancedSelection: null,
      insertedGreeting: false,
      insertionFailed: false,
    };
  }

  if (automaticTransition) {
    const insertPromise = beginGreetingMessageInsert(advancedGreeting);
    const stateWritePromise = writeActiveSelection(advancedSelection, state.context, {
      confirm: false,
      skipLegacyCleanup: true,
    })
      .then((activeSelection) => ({ activeSelection, error: null }))
      .catch((error) => ({ activeSelection: null, error }));

    const insertedGreeting = await insertPromise;
    const stateWrite = await stateWritePromise;

    if (stateWrite.error) {
      logDebug("advance state commit after insert failed", {
        active: selectionKey(advancedSelection),
        error: stateWrite.error.message || String(stateWrite.error),
      });
    } else {
      state.activeSelection = stateWrite.activeSelection;
      state.activeGreeting = getGreetingBySelection(state.context, state.activeSelection);
      state.character = state.activeGreeting.character;
      state.scope = characterScope(state.character.id, state.context.isGroupChat);
      state.greetings =
        state.context.greetingsByCharacter[state.activeSelection.characterId] || [];
      state.activeIndex = state.activeSelection.index;
      state.upcomingSelection = defaultUpcomingSelection(
        state.activeSelection,
        state.context,
      );
      state.upcomingGreeting = getGreetingBySelection(
        state.context,
        state.upcomingSelection,
      );
      state.upcomingIndex = state.upcomingSelection ? state.upcomingSelection.index : null;
      logDebug("advance state committed after insert", {
        active: selectionKey(state.activeSelection),
        upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
      });
    }

    if (!insertedGreeting) {
      return {
        advancedSelection: null,
        attemptedSelection: advancedSelection,
        insertedGreeting: false,
        insertionFailed: true,
        persistedAdvancedState: sameSelection(state.activeSelection, advancedSelection),
        skipPostTransitionRefresh: true,
      };
    }

    return {
      advancedSelection,
      attemptedSelection: advancedSelection,
      insertedGreeting,
      insertionFailed: false,
      persistedAdvancedState: sameSelection(state.activeSelection, advancedSelection),
      skipPostTransitionRefresh: true,
    };
  }

  state.activeSelection = await writeActiveSelection(advancedSelection, state.context);
  state.activeGreeting = getGreetingBySelection(state.context, state.activeSelection);
  state.character = state.activeGreeting.character;
  state.scope = characterScope(state.character.id, state.context.isGroupChat);
  state.greetings =
    state.context.greetingsByCharacter[state.activeSelection.characterId] || [];
  state.activeIndex = state.activeSelection.index;
  state.upcomingSelection = await resetUpcomingSelection(state.activeSelection, state.context);
  state.upcomingGreeting = getGreetingBySelection(state.context, state.upcomingSelection);
  state.upcomingIndex = state.upcomingSelection ? state.upcomingSelection.index : null;

  logDebug("advance state committed before insert", {
    active: selectionKey(state.activeSelection),
    upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
  });

  const insertedGreeting = await insertGreetingMessage(advancedGreeting);

  if (!insertedGreeting) {
    state.activeSelection = await writeActiveSelection(previousActiveSelection, state.context);
    state.activeGreeting = getGreetingBySelection(state.context, state.activeSelection);
    state.character = state.activeGreeting.character;
    state.scope = characterScope(state.character.id, state.context.isGroupChat);
    state.greetings =
      state.context.greetingsByCharacter[state.activeSelection.characterId] || [];
    state.activeIndex = state.activeSelection.index;
    state.upcomingSelection = await writeUpcomingSelection(
      previousUpcomingSelection,
      state.activeSelection,
      state.context,
    );
    state.upcomingGreeting = getGreetingBySelection(state.context, state.upcomingSelection);
    state.upcomingIndex = state.upcomingSelection ? state.upcomingSelection.index : null;

    logDebug("advance rolled back after insert failure", {
      active: selectionKey(state.activeSelection),
      upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
    });

    return {
      advancedSelection: null,
      attemptedSelection: advancedSelection,
      insertedGreeting: false,
      insertionFailed: true,
    };
  }

  logDebug("advance committed", {
    active: selectionKey(state.activeSelection),
    upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
  });

  return {
    advancedSelection,
    attemptedSelection: advancedSelection,
    insertedGreeting,
    insertionFailed: false,
  };
}

async function maybeAdvanceForTransition(state, eventName) {
  if (!state.ready || !TRANSITION_EVENTS.has(eventName)) {
    return { advanced: false, result: null };
  }

  const source = await resolveTransitionSource(eventName);
  if (!source || !source.hasHandoff) {
    logDebug("transition not advanced", { event: eventName, reason: "no handoff tag" });
    return { advanced: false, result: null };
  }

  const signature = transitionSignature(state.chat.id, source.sourceId, source.content);
  const eventKey = transitionEventKey(state.chat.id, source.sourceId, source.content);

  if (globalThis[TRANSITION_IN_FLIGHT_KEY] === signature) {
    logDebug("transition ignored", { reason: "in flight", event: eventName });
    return { advanced: false, result: null };
  }

  if (hasRecentTransition(signature, eventKey)) {
    logDebug("transition ignored", {
      reason: "recently advanced",
      event: eventName,
      sourceId: source.sourceId,
    });
    return { advanced: false, result: null };
  }

  globalThis[TRANSITION_IN_FLIGHT_KEY] = signature;

  try {
    const lastEvent = await readChatVariable(LAST_ADVANCED_EVENT_VAR, "");
    const lastSignature = await readChatVariable(LAST_ADVANCED_SIGNATURE_VAR, "");

    if (lastEvent === eventKey || lastSignature === signature) {
      logDebug("transition ignored", {
        reason: "already advanced",
        event: eventName,
        sourceId: source.sourceId,
      });
      return { advanced: false, result: null };
    }

    const result = await advanceToUpcomingGreeting(state, eventName);

    if (!result.insertionFailed) {
      rememberRecentTransition(signature, eventKey);
    }

    return { advanced: result.advancedSelection !== null, result };
  } finally {
    if (globalThis[TRANSITION_IN_FLIGHT_KEY] === signature) {
      globalThis[TRANSITION_IN_FLIGHT_KEY] = "";
    }
  }
}

function nextGreetingMessage(state) {
  return !state.upcomingGreeting ?
      "No later greeting is available."
    : `Next greeting is ${indexLabel(state.upcomingGreeting, state.isGroupChat)}.`;
}

async function refreshPipeline(options = {}) {
  const revision = nextRefreshRevision();
  const eventName = asText(options.eventName);
  const expectedChatId = asText(options.expectedChatId);
  const strictChat = Boolean(options.strictChat);
  const toast = Boolean(options.toast);
  const reason = asText(options.reason) || eventName || "refresh";

  logDebug("refresh pipeline start", {
    reason,
    event: eventName,
    expectedChatId,
    strictChat,
    processTransition: Boolean(options.processTransition),
    revision,
  });

  let state = await loadState({
    expectedChatId,
    strictChat,
    persistDerivedState: !options.processTransition,
  });

  if (state.staleEvent) {
    return state;
  }

  if (!state.ready) {
    if (!isCurrentRefreshRevision(revision)) {
      logDebug("refresh pipeline skipped stale inactive render", { reason, revision });
      return state;
    }

    await syncNextSceneContext(state);
    await renderUi(state);

    if (toast) {
      api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    }

    return state;
  }

  let transitionResult = null;
  if (options.processTransition) {
    transitionResult = await maybeAdvanceForTransition(state, eventName);
  }

  if (transitionResult && transitionResult.result?.skipPostTransitionRefresh) {
    logDebug("refresh pipeline deferred post-transition render", {
      reason,
      active: selectionKey(transitionResult.result.advancedSelection),
    });
    return state;
  }

  if (transitionResult && transitionResult.result && !transitionResult.result.insertionFailed) {
    const refreshedState = await loadState({
      expectedChatId: state.chat && state.chat.id,
      strictChat: true,
    });

    if (!refreshedState.staleEvent) {
      state = refreshedState;
    }
  }

  if (!isCurrentRefreshRevision(revision)) {
    logDebug("refresh pipeline skipped stale render", { reason, revision });
    return state;
  }

  state.sync = await syncNextSceneContext(state);
  await renderUi(state);

  if (transitionResult && transitionResult.result) {
    const result = transitionResult.result;

    if (result.insertionFailed) {
      const attemptedGreeting =
        getGreetingBySelection(state.context, result.attemptedSelection) ||
        getGreetingBySelection(state.context, result.advancedSelection);
      api.ui.toast(
        `Could not insert greeting ${indexLabel(attemptedGreeting, state.isGroupChat)}; active greeting was not advanced.`,
        "warning",
      );
    } else if (result.advancedSelection !== null) {
      const advancedGreeting =
        getGreetingBySelection(state.context, result.advancedSelection) ||
        state.activeGreeting;
      api.ui.toast(
        `Greeting transition advanced to ${indexLabel(advancedGreeting, state.isGroupChat)}. ${nextGreetingMessage(state)}`,
        "success",
      );
    }
  } else if (toast) {
    const nextLabel =
      state.upcomingGreeting ? indexLabel(state.upcomingGreeting, state.isGroupChat) : "none";
    api.ui.toast(
      `Greeting Inspector refreshed. Active ${activeGreetingLabel(state)}; next ${nextLabel}. ${promptContentMessage(state.sync)}`,
      state.sync && state.sync.error ? "warning" : "success",
    );
  }

  logDebug("refresh pipeline complete", {
    reason,
    active: selectionKey(state.activeSelection),
    upcoming: state.upcomingSelection ? selectionKey(state.upcomingSelection) : "none",
    autoInject: state.autoInject,
  });

  return state;
}

async function refreshWithBusy(source) {
  if (getBusyAction()) {
    logDebug("refresh ignored", { source, reason: "busy", busy: getBusyAction() });
    return;
  }

  setBusyAction("refresh");
  try {
    await refreshPipeline({ reason: `${source} refresh`, toast: true });
  } finally {
    setBusyAction("");
    await refreshPipeline({ reason: `${source} refresh complete`, toast: false });
  }
}

async function commitActiveSelection(state, selectedSelection) {
  await ensureActiveChatStill(state.chat && state.chat.id, "Active greeting change");
  const committedActiveSelection = await writeActiveSelection(
    selectedSelection,
    state.context,
  );
  await resetUpcomingSelection(committedActiveSelection, state.context);

  const refreshedState = await refreshPipeline({ reason: "active picker committed" });
  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  api.ui.toast(
    `Active greeting set to ${activeGreetingLabel(refreshedState)}. ${nextGreetingMessage(refreshedState)} ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function commitUpcomingSelection(state, selectedSelection) {
  await ensureActiveChatStill(state.chat && state.chat.id, "Next greeting change");
  await writeUpcomingSelection(
    selectedSelection,
    state.activeSelection,
    state.context,
  );

  const refreshedState = await refreshPipeline({ reason: "next picker committed" });
  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  if (!refreshedState.upcomingGreeting) {
    api.ui.toast("There is no later greeting to use as the next greeting.", "warning");
    return;
  }

  api.ui.toast(
    `Next greeting set to ${upcomingGreetingLabel(refreshedState)}. ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handleActivePicker() {
  const state = await refreshPipeline({ reason: "active picker open" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  await openPicker("active", state, {
    onUse: (selectedSelection) => commitActiveSelection(state, selectedSelection),
  });
}

async function handleUpcomingPicker() {
  const state = await refreshPipeline({ reason: "next picker open" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  await openPicker("upcoming", state, {
    onUse: (selectedSelection) => commitUpcomingSelection(state, selectedSelection),
  });
}

async function handleForceAdvance() {
  const state = await refreshPipeline({ reason: "force prepare" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  await ensureActiveChatStill(state.chat && state.chat.id, "Force transition");
  const result = await advanceToUpcomingGreeting(state, "force");
  const refreshedState = await refreshPipeline({ reason: "force complete" });

  if (result.insertionFailed) {
    const attemptedGreeting =
      getGreetingBySelection(state.context, result.attemptedSelection) ||
      getGreetingBySelection(state.context, result.advancedSelection);
    api.ui.toast(
      `Could not insert greeting ${indexLabel(attemptedGreeting, state.isGroupChat)}; active greeting was not advanced.`,
      "warning",
    );
    return;
  }

  if (result.advancedSelection === null) {
    api.ui.toast("There is no later greeting to force.", "warning");
    return;
  }

  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  api.ui.toast(
    `Forced greeting transition to ${activeGreetingLabel(refreshedState)}. ${nextGreetingMessage(refreshedState)} ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handleAutoPromptChange(checked) {
  const state = await refreshPipeline({ reason: "auto prompt prepare" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  await writeAutoInject(checked);
  const refreshedState = await refreshPipeline({ reason: "auto prompt committed" });

  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  api.ui.toast(
    `Auto prompt ${refreshedState.autoInject ? "enabled" : "disabled"}. ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handleAutoPositionChange(position) {
  const state = await refreshPipeline({ reason: "auto position prepare" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  await writeAutoInjectPosition(position);
  const refreshedState = await refreshPipeline({ reason: "auto position committed" });

  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  api.ui.toast(
    `Auto prompt within position ${normalizeAutoInjectPosition(refreshedState.autoInjectPosition)}. ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handlePromptExcludeRegexChange(value) {
  const literal = await writePromptExcludeRegex(value);
  const refreshedState = await refreshPipeline({ reason: "prompt exclude regex committed" });

  api.ui.toast(
    literal ? `Prompt exclude regex saved: ${literal}` : "Prompt exclude regex disabled.",
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handlePowerToggle() {
  const state = await loadState();
  if (!state.character) {
    api.ui.toast("Open a character chat before changing Greeting Inspector.", "warning");
    return;
  }

  const nextEnabled = state.inspectorEnabled === false;
  const characterName = state.character.name || "(unnamed)";

  setBusyAction("powerToggle");
  try {
    await writeInspectorEnabled(state.scope, nextEnabled);
    logDebug("inspector enabled toggled", {
      enabled: nextEnabled,
      character: characterName,
    });
  } finally {
    setBusyAction("");
  }

  const refreshedState = await refreshPipeline({
    reason: nextEnabled ? "character enabled" : "character disabled",
  });

  api.ui.toast(
    `Greeting Inspector ${nextEnabled ? "ON" : "OFF"} for ${characterName}.`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handleUiAction(action, options = {}) {
  try {
    logDebug("ui action", { action, source: options.source || "" });

    if (action === "refresh") {
      await refreshWithBusy(options.source || "ui");
      return;
    }

    if (getBusyAction()) {
      logDebug("ui action ignored", { action, reason: "busy", busy: getBusyAction() });
      return;
    }

    if (action === "active") {
      await handleActivePicker();
      return;
    }

    if (action === "upcoming") {
      await handleUpcomingPicker();
      return;
    }

    if (action === "force") {
      await handleForceAdvance();
      return;
    }

    if (action === "autoPrompt") {
      await handleAutoPromptChange(Boolean(options.checked));
      return;
    }

    if (action === "autoPosition") {
      await handleAutoPositionChange(options.position);
      return;
    }

    if (action === "promptExcludeRegex") {
      await handlePromptExcludeRegexChange(options.value);
      return;
    }

    if (action === "powerToggle") {
      await handlePowerToggle();
    }
  } catch (error) {
    const message = error.message || String(error);
    logDebug("ui action failed", { action, error: message });
    api.ui.toast(`Greeting Inspector action failed: ${message}`, "warning");
  }
}

async function teardown() {
  logDebug("teardown start");
  setBusyAction("");
  unregisterHandoffContentProcessor();
  unsubscribeByKey(DRAWER_CLICK_UNSUB_KEY);
  unsubscribeByKey(DRAWER_CHANGE_UNSUB_KEY);
  unsubscribeByKey(FLOATING_CLICK_UNSUB_KEY);
  await removeInjectedNote();
  await writeInspectorActive(null, false);
  await writeInspectorContent(null, "");

  try {
    if (api.ui && api.ui.dom && typeof api.ui.dom.cleanup === "function") {
      await api.ui.dom.cleanup();
    }
  } catch (error) {
    logDebug("dom cleanup failed", { error: error.message || String(error) });
  }

  const tab = globalThis[DRAWER_TAB_KEY];
  if (tab && typeof tab.destroy === "function") {
    try {
      tab.destroy();
    } catch {
      // Drawer teardown is best-effort.
    }
  }

  clearCachedHandles();
  logDebug("teardown complete");
}

async function main() {
  const eventName = getEventName();
  const manualRun = isManualRun(eventName);

  logDebug("run start", {
    version: VERSION,
    event: eventName || (manualRun ? "manual" : ""),
    chatId: eventChatId(eventName),
    characterId: eventCharacterId(),
  });

  if (!isTeardown(eventName)) {
    await registerHandoffContentProcessor();
  }

  if (eventName === "ls:startup" || eventName === "ls:reload") {
    clearCachedHandles();
    try {
      if (api.ui && api.ui.dom && typeof api.ui.dom.cleanup === "function") {
        await api.ui.dom.cleanup();
      }
    } catch (error) {
      logDebug("startup dom cleanup failed", { error: error.message || String(error) });
    }
  }

  if (isTeardown(eventName)) {
    await teardown();
    return;
  }

  if (!isCurrentRunInteresting(eventName, manualRun)) {
    logDebug("run skipped", { reason: "unhandled event", event: eventName });
    return;
  }

  if (isActiveChatClose(eventName)) {
    await refreshPipeline({
      eventName,
      reason: "active chat closed",
      toast: manualRun,
    });
    return;
  }

  const expectedChatId = manualRun ? "" : eventChatId(eventName);
  const strictChat =
    Boolean(expectedChatId) &&
    (TRANSITION_EVENTS.has(eventName) ||
      eventName === "MESSAGE_SENT" ||
      eventName === "GENERATION_STARTED");

  await refreshPipeline({
    eventName,
    expectedChatId,
    strictChat,
    processTransition: TRANSITION_EVENTS.has(eventName),
    toast: manualRun,
    reason: eventName || "manual",
  });
}

try {
  await main();
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  logDebug("fatal error", { error: message });
  api.ui.toast(`Greeting Inspector failed: ${message}`, "warning");
}
