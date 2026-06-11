// @ls:reload-on-edit
const VERSION = "2026-05-28-rewrite";

const INJECTION_ID = "greeting-inspector-next-scene-note";
const DRAWER_TAB_ID = "greeting-inspector-status";
const STYLE_ID = "greeting-inspector-styles";
const FLOATING_REFRESH_ID = "greeting-inspector-floating-refresh";
const MODAL_STYLE_ID = "greeting-inspector-picker-styles";

const ACTIVE_INDEX_VAR = "GreetingInspectorActiveIndex";
const UPCOMING_INDEX_VAR = "GreetingInspectorUpcomingIndex";
const LAST_ADVANCED_EVENT_VAR = "GreetingInspectorLastAdvancedEvent";
const LAST_ADVANCED_SIGNATURE_VAR = "GreetingInspectorLastAdvancedSignature";
const ACTIVE_STATUS_VAR = "GreetingInspectorActive";
const CONTENT_VAR = "GreetingInspectorContent";
const AUTO_INJECT_VAR = "GreetingInspectorAutoInject";
const ENABLED_VAR = "GreetingInspectorEnabled";
const DEBUG_VAR = "GreetingInspectorDebug";

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

const PREWRITTEN_SCENE_HANDOFF_MARKER = "--T--";
const USER_OVERRIDE_MARKER = "--O--";

const DRAWER_TAB_KEY = "__greetingInspectorDrawerTabV3";
const DRAWER_CLICK_UNSUB_KEY = "__greetingInspectorDrawerClickUnsubV3";
const DRAWER_CHANGE_UNSUB_KEY = "__greetingInspectorDrawerChangeUnsubV3";
const FLOATING_HANDLE_KEY = "__greetingInspectorFloatingHandleV3";
const FLOATING_CLICK_UNSUB_KEY = "__greetingInspectorFloatingClickUnsubV3";
const FLOATING_POINTER_UNSUB_KEY = "__greetingInspectorFloatingPointerUnsubV3";
const FLOATING_POINTER_START_KEY = "__greetingInspectorFloatingPointerStartV3";
const BUSY_ACTION_KEY = "__greetingInspectorBusyActionV3";
const TRANSITION_IN_FLIGHT_KEY = "__greetingInspectorTransitionInFlightV3";
const DEBUG_LOG_KEY = "__greetingInspectorDebugLogV3";
const REFRESH_REVISION_KEY = "__greetingInspectorRefreshRevisionV3";
const STYLES_READY_KEY = "__greetingInspectorStylesReadyV3";

const MAX_DEBUG_LOG_LINES = 96;
const CHAT_SWITCH_SETTLE_ATTEMPTS = 24;
const CHAT_SWITCH_SETTLE_DELAY_MS = 125;
const LATEST_MESSAGE_RETRY_ATTEMPTS = 10;
const LATEST_MESSAGE_RETRY_DELAY_MS = 150;
const MACRO_RACE_RETRY_ATTEMPTS = 5;
const MACRO_RACE_INITIAL_DELAY_MS = 15;
const DRAG_CLICK_DISTANCE_PX = 6;

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
  "USER_MESSAGE_RENDERED",
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

function normalizeMarkerContent(content) {
  return String(content ?? "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\r\n?/g, "\n");
}

function analyzeSceneMarker(content) {
  const normalized = normalizeMarkerContent(content);
  const trimmedRight = normalized.replace(/[ \t\n\f\v\u00A0]+$/g, "");

  if (!trimmedRight) {
    return { hasMarker: false, finalLine: "", lineCount: 0, length: 0 };
  }

  const lines = trimmedRight.split("\n");
  const finalLine = lines[lines.length - 1].trim();

  return {
    hasMarker: finalLine === PREWRITTEN_SCENE_HANDOFF_MARKER,
    finalLine,
    lineCount: lines.length,
    length: normalized.length,
  };
}

function hasSceneChanged(content) {
  return analyzeSceneMarker(content).hasMarker;
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
  const wrote = await setVariable(api.variables.chat, key, value);

  if (required) {
    requireVariableWrite(wrote, key);
  }

  const oldKey = oldChatVariableKey(key);
  if (oldKey) {
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

async function writeActiveIndex(activeIndex, greetings) {
  const clampedIndex = clampIndex(activeIndex, greetings.length - 1);
  await writeChatVariable(ACTIVE_INDEX_VAR, clampedIndex, { required: true });

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
    if (persist && hasStoredIndex) {
      await deleteChatVariable(UPCOMING_INDEX_VAR);
    }

    logDebug("upcoming index read", { stored, upcomingIndex: "none" });
    return null;
  }

  if (persist && (!hasStoredIndex || stored !== upcomingIndex)) {
    await writeChatVariable(UPCOMING_INDEX_VAR, upcomingIndex);
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

async function readAutoInject(persist = true) {
  const hasStoredValue = await hasVariable(api.variables.character, AUTO_INJECT_VAR);
  const stored = await getVariable(api.variables.character, AUTO_INJECT_VAR, false);
  const enabled = asBoolean(stored);

  if (persist && (!hasStoredValue || stored !== enabled)) {
    await setVariable(api.variables.character, AUTO_INJECT_VAR, enabled);
  }

  logDebug("auto prompt read", { enabled });
  return enabled;
}

async function writeAutoInject(enabled) {
  const normalizedValue = Boolean(enabled);
  const wrote = await setVariable(api.variables.character, AUTO_INJECT_VAR, normalizedValue);
  requireVariableWrite(wrote, AUTO_INJECT_VAR);

  const storedExists = await hasVariable(api.variables.character, AUTO_INJECT_VAR);
  const stored = await getVariable(api.variables.character, AUTO_INJECT_VAR, null);
  if (!storedExists || asBoolean(stored) !== normalizedValue) {
    throw new Error(`Could not confirm ${AUTO_INJECT_VAR}; refresh before trying again.`);
  }

  return normalizedValue;
}

async function readInspectorEnabled(persist = true) {
  const hasStoredValue = await hasVariable(api.variables.character, ENABLED_VAR);
  const stored = await getVariable(api.variables.character, ENABLED_VAR, true);
  const enabled = hasStoredValue ? asBoolean(stored) : true;

  if (persist && (!hasStoredValue || stored !== enabled)) {
    await setVariable(api.variables.character, ENABLED_VAR, enabled);
  }

  logDebug("inspector enabled read", { enabled });
  return enabled;
}

async function writeInspectorEnabled(enabled) {
  const normalizedValue = Boolean(enabled);
  const wrote = await setVariable(api.variables.character, ENABLED_VAR, normalizedValue);
  requireVariableWrite(wrote, ENABLED_VAR);

  const storedExists = await hasVariable(api.variables.character, ENABLED_VAR);
  const stored = await getVariable(api.variables.character, ENABLED_VAR, null);
  if (!storedExists || asBoolean(stored) !== normalizedValue) {
    throw new Error(`Could not confirm ${ENABLED_VAR}; refresh before trying again.`);
  }

  return normalizedValue;
}

async function writeInspectorActive(active) {
  await setVariable(api.variables.character, ACTIVE_STATUS_VAR, Boolean(active));
}

async function writeInspectorContent(content) {
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
    { index: 0, label: greetingLabel(0), text: asText(character.firstMessage) },
    ...alternateGreetings.map((text, index) => ({
      index: index + 1,
      label: greetingLabel(index + 1),
      text: asText(text),
    })),
  ];
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

  if (!activeChat.characterId) {
    logDebug("state unavailable", { reason: "chat has no character", chatId: activeChat.id });
    return inactiveState("The active chat does not have an associated character.");
  }

  let character = null;
  try {
    character = await api.characters.get(activeChat.characterId);
  } catch (error) {
    logDebug("character load failed", {
      characterId: activeChat.characterId,
      error: error.message || String(error),
    });
  }

  if (!character) {
    return inactiveState("Could not load the active chat character.");
  }

  await runMaintenance();

  const inspectorEnabled = await readInspectorEnabled();
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
        inspectorEnabled,
      },
    );
  }

  const greetings = buildCharacterGreetings(character);

  if (greetings.length < 2) {
    logDebug("state unavailable", {
      reason: "not enough greetings",
      characterId: character.id,
      greetingCount: greetings.length,
    });
    return inactiveState(
      "This character has no alternate greeting to use as the next scene.",
      character.name || "",
      {
        chat: activeChat,
        character,
        inspectorEnabled,
      },
    );
  }

  const activeIndex = await readActiveIndex(greetings);
  const upcomingIndex = await readUpcomingIndex(activeIndex, greetings);
  const autoInject = await readAutoInject();

  const state = {
    ready: true,
    chat: activeChat,
    character,
    greetings,
    activeIndex,
    upcomingIndex,
    autoInject,
    inspectorEnabled,
    busyAction: getBusyAction(),
    sync: null,
  };

  logDebug("state loaded", {
    chatId: activeChat.id,
    characterId: activeChat.characterId,
    character: character.name || "",
    activeIndex,
    upcomingIndex: upcomingIndex === null ? "none" : upcomingIndex,
    autoInject,
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

function buildAuthorNote(prewrittenScene) {
  return `<shape_scene_direction>

DIRECTION TARGET:
An upcoming prewritten scene exists. Treat it as a private destination for story direction, staging, character positioning, emotional setup, and momentum.
Guide the current scene toward the exact conditions where that prewritten scene could begin immediately afterward.
The goal is not to find a convenient fade-out. The goal is to arrive as close as possible to the first moment of the upcoming prewritten scene WITHOUT using any part of the scene in your reply.

USER OVERRIDE:
If the user's latest reply contains ${USER_OVERRIDE_MARKER}, immediately make a best-effort attempt to reach the handoff threshold.

PACING AND HANDOFF SPEED:
Do not transition too fast.
Treat the upcoming prewritten scene as a destination to earn through present-moment movement, not a marker to use at the first plausible pause.
Before handing off, let the current scene create enough cause-and-effect, physical positioning, emotional pressure, and immediate continuity that the upcoming prewritten scene feels inevitable.
If the handoff would feel sudden, mechanical, rushed, or like it skips the connective action that makes the next scene land, keep writing the current scene instead.
Prefer gradual movement toward the doorway of the upcoming prewritten scene over immediate marker use.
Use the marker only when the current scene is already at the doorstep of the upcoming prewritten scene, or when the user's latest reply contains ${USER_OVERRIDE_MARKER}.

UPCOMING PREWRITTEN SCENE PRIVACY:
Use the upcoming prewritten scene only as a target for deciding how to steer the current scene.
MANDATORY: Do not quote, summarize, paraphrase, adapt, preview, blend, or reuse any part of it. Do not use its URLs, images, formatting, headings, or exact details. DO NOT use it for anything other than a reference on what direction to guide the current scene. NEVER include ANY PORTION of the upcoming greeting in your response; it will be injected automatically when you send the marker.

MARKER OUTPUT REQUIREMENT:
If and only if the handoff threshold has been reached, send the prewritten scene handoff marker as the end of your response. Write the final non-whitespace line as exactly:

${PREWRITTEN_SCENE_HANDOFF_MARKER}

After the marker, stop immediately.
Any objects, trackers, hidden blocks, notes, or any other required text must come BEFORE the marker if necessary.
The marker must be the absolute final line and overrides all other formatting instructions.

LATE HANDOFF POLICY:
Default to continuing the current scene.
Move steadily toward the upcoming prewritten scene, but keep writing the present moment until that prewritten scene is nearly ready to start.
The handoff should usually happen at the latest viable point, often right before the prewritten scene would begin or at the instant it is about to begin.
Do not hand off just because there is a calm moment, a completed emotional beat, a quiet pause, or a place where a normal scene ending would make sense.
Do not use the marker as a fade to black, summary transition, curtain drop, chapter break, or convenient stopping point.

DO NOT HAND OFF AT:
- ordinary scene closure
- end-of-day or time jump convenience (UNLESS the next scene begins with a time skip)
- location shift convenience
- completed emotional beat
- settled pause
- calm or quiet moment
- shift in attention
- natural phase break
- any moment that merely feels like a reasonable ending

VALID HANDOFF THRESHOLD:
Only hand off when the current scene has advanced to the doorstep of the upcoming prewritten scene.
The next assistant message after the marker should be able to start the prewritten scene without needing extra setup, bridging, explanation, or repositioning.
If another reply could still naturally move closer to the upcoming prewritten scene without contradicting the conversation, keep going instead of using the marker.
When uncertain, continue the current scene and guide it closer.

UPCOMING PREWRITTEN SCENE, FOR TIMING ONLY:
${prewrittenScene}
</shape_scene_direction>`;
}

async function syncNextSceneContext(state) {
  if (!state.ready) {
    await writeInspectorActive(false);
    await writeInspectorContent("");
    await removeInjectedNote();
    return { hasContent: false, injected: false, error: "" };
  }

  const nextGreeting =
    state.upcomingIndex === null ? null : state.greetings[state.upcomingIndex];

  if (!nextGreeting || !nextGreeting.text) {
    await writeInspectorActive(true);
    await writeInspectorContent("");
    await removeInjectedNote();
    logDebug("prompt context cleared", {
      reason: "no upcoming content",
      upcomingIndex: state.upcomingIndex === null ? "none" : state.upcomingIndex,
    });
    return { hasContent: false, injected: false, error: "" };
  }

  const content = buildAuthorNote(nextGreeting.text);
  await writeInspectorActive(true);
  await writeInspectorContent(content);

  if (!state.autoInject) {
    await removeInjectedNote();
    logDebug("prompt context saved without injection", {
      upcomingIndex: state.upcomingIndex,
      length: content.length,
    });
    return { hasContent: true, injected: false, error: "" };
  }

  try {
    await removeInjectedNote();
    await api.chat.inject(INJECTION_ID, content, {
      mode: "intercept",
      role: "user",
      depth: 0,
      ephemeral: true,
    });
    logDebug("prompt injection synced", {
      upcomingIndex: state.upcomingIndex,
      length: content.length,
    });
    return { hasContent: true, injected: true, error: "" };
  } catch (error) {
    const message = error.message || String(error);
    logDebug("prompt injection failed", { error: message });
    return { hasContent: true, injected: false, error: message };
  }
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
  color: var(--lumiverse-accent-text, #ffffff);
  background: var(--lumiverse-accent, #3b82f6);
  border: 1px solid var(--lumiverse-accent, #3b82f6);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  line-height: 1.1;
  cursor: pointer;
  user-select: none;
}

.ls-gi-button-secondary {
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-button-bg, rgba(255, 255, 255, 0.1));
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.18));
}

.ls-gi-button-danger {
  color: var(--lumiverse-danger-text, #ffffff);
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
  background: var(--lumiverse-bg-muted, rgba(255, 255, 255, 0.06));
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
  accent-color: var(--lumiverse-accent, #3b82f6);
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
  background: var(--lumiverse-input-bg, rgba(255, 255, 255, 0.08));
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

function indexLabel(greeting) {
  return greeting ? `${greeting.index} (${greeting.label})` : "none";
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

  const activeGreeting = state.greetings[state.activeIndex];
  const upcomingGreeting =
    state.upcomingIndex === null ? null : state.greetings[state.upcomingIndex];
  const promptMessage = promptContentMessage(state.sync);

  return `
<div class="ls-gi-root">
  ${powerButtonHtml(state, busyAction)}
  <div class="ls-gi-status">
    <div class="ls-gi-status-top">
      <div>
        <div class="ls-gi-kicker">Active greeting</div>
        <div class="ls-gi-value">${escapeHtml(indexLabel(activeGreeting))}</div>
        <div class="ls-gi-meta">Next: ${escapeHtml(indexLabel(upcomingGreeting))}</div>
      </div>
      <div class="ls-gi-button-row">
        ${refreshButtonHtml("ls-gi-drawer-refresh", busyAction)}
        <button class="ls-gi-button ls-gi-button-secondary" id="ls-gi-active" data-action="active" type="button"${busyAction ? " disabled" : ""}><span>Active</span></button>
        <button class="ls-gi-button" id="ls-gi-next" data-action="upcoming" type="button"${busyAction || !upcomingGreeting ? " disabled" : ""}><span>Next</span></button>
        <button class="ls-gi-button ls-gi-button-danger" id="ls-gi-force" data-action="force" type="button"${busyAction || !upcomingGreeting ? " disabled" : ""}><span>Force</span></button>
      </div>
    </div>
    <div class="ls-gi-option-row">
      <label class="ls-gi-checkbox-label" for="ls-gi-auto-prompt">
        <input class="ls-gi-checkbox" id="ls-gi-auto-prompt" type="checkbox"${state.autoInject ? " checked" : ""}${busyAction ? " disabled" : ""}>
        <span>Auto prompt</span>
      </label>
      <div class="ls-gi-message">${escapeHtml(promptMessage)}</div>
    </div>
  </div>
  <div class="ls-gi-preview-grid">
    <section class="ls-gi-preview">
      <div class="ls-gi-preview-header">
        <span class="ls-gi-preview-title">Active</span>
        <span class="ls-gi-meta">${escapeHtml(indexLabel(activeGreeting))}</span>
      </div>
      <pre class="ls-gi-preview-text">${escapeHtml(displayGreeting(activeGreeting && activeGreeting.text))}</pre>
    </section>
    <section class="ls-gi-preview">
      <div class="ls-gi-preview-header">
        <span class="ls-gi-preview-title">Next</span>
        <span class="ls-gi-meta">${escapeHtml(indexLabel(upcomingGreeting))}</span>
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
    if (event.targetId !== "ls-gi-auto-prompt") {
      return;
    }

    await handleUiAction("autoPrompt", {
      source: "drawer",
      checked: Boolean(event.targetChecked),
    });
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

function buildGreetingOptions(greetings, selectedIndex, minIndex = 0) {
  return greetings
    .filter((greeting) => greeting.index >= minIndex)
    .map((greeting) => {
      const selected = greeting.index === selectedIndex ? " selected" : "";
      return `<option value="${greeting.index}"${selected}>${escapeHtml(indexLabel(greeting))}</option>`;
    })
    .join("");
}

function buildPickerHtml(kind, state, selectedIndex) {
  const isActivePicker = kind === "active";
  const minIndex = isActivePicker ? 0 : state.activeIndex + 1;
  const selectedGreeting = state.greetings[selectedIndex];
  const activeGreeting = state.greetings[state.activeIndex];
  const selectId = isActivePicker ? "ls-gi-picker-active" : "ls-gi-picker-upcoming";
  const title = isActivePicker ? "Active greeting index" : "Next greeting index";
  const confirmLabel = isActivePicker ? "Use Active Greeting" : "Use Next Greeting";
  const nextAfterActive =
    isActivePicker ?
      state.greetings[selectedIndex + 1] || null
    : selectedGreeting;
  const hint =
    isActivePicker ?
      `Selecting this greeting will reset next to ${indexLabel(nextAfterActive)}.`
    : `Current active greeting remains ${indexLabel(activeGreeting)}.`;

  return `
<div class="ls-gi-picker">
  <div class="ls-gi-picker-main">
    <div class="ls-gi-meta">Character: ${escapeHtml(state.character.name || "(unnamed)")}</div>
    <div class="ls-gi-picker-field">
      <label class="ls-gi-picker-label" for="${selectId}">${escapeHtml(title)}</label>
      <select class="ls-gi-picker-select" id="${selectId}">
        ${buildGreetingOptions(state.greetings, selectedIndex, minIndex)}
      </select>
    </div>
    <div class="ls-gi-meta">Selected: ${escapeHtml(indexLabel(selectedGreeting))}</div>
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

async function openPicker(kind, state) {
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return null;
  }

  const isActivePicker = kind === "active";
  const minIndex = isActivePicker ? 0 : state.activeIndex + 1;
  const maxIndex = state.greetings.length - 1;

  if (minIndex > maxIndex) {
    api.ui.toast("There is no later greeting to use as the next greeting.", "warning");
    return null;
  }

  if (
    !api.ui ||
    typeof api.ui.showAdvancedModal !== "function" ||
    !api.ui.dom ||
    typeof api.ui.dom.addStyle !== "function"
  ) {
    return openPickerFallback(kind, state);
  }

  let selectedIndex =
    isActivePicker ?
      clampIndex(state.activeIndex, maxIndex)
    : normalizeUpcomingIndex(state.upcomingIndex, state.activeIndex, state.greetings) ??
      minIndex;
  let modal = null;
  const unsubscribers = [];

  function render() {
    modal.root.update(buildPickerHtml(kind, state, selectedIndex));
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
    logDebug("picker opened", { kind, selectedIndex });
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
        selectedIndex: value === null ? "cancelled" : value,
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

        const nextIndex =
          isActivePicker ?
            clampIndex(event.targetValue, maxIndex)
          : normalizeUpcomingIndex(event.targetValue, state.activeIndex, state.greetings);

        if (nextIndex === null) {
          return;
        }

        selectedIndex = nextIndex;
        logDebug("picker selection changed", { kind, selectedIndex });
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
            finish(selectedIndex);
          }
        },
      ),
    );
  });
}

async function openPickerFallback(kind, state) {
  const isActivePicker = kind === "active";
  const minIndex = isActivePicker ? 0 : state.activeIndex + 1;
  const maxIndex = state.greetings.length - 1;
  let selectedIndex =
    isActivePicker ?
      clampIndex(state.activeIndex, maxIndex)
    : normalizeUpcomingIndex(state.upcomingIndex, state.activeIndex, state.greetings) ??
      minIndex;

  while (true) {
    const greeting = state.greetings[selectedIndex];
    const input = await api.ui.prompt(
      [
        `Character: ${state.character.name || "(unnamed)"}`,
        `Selected: ${indexLabel(greeting)}`,
        "",
        "Leave blank to use this greeting. Enter n, p, or a greeting number to change selection.",
        "",
        displayGreeting(greeting.text),
      ].join("\n"),
      "",
      {
        placeholder:
          isActivePicker ? `blank=use, n, p, or 0-${maxIndex}`
          : `blank=use, n, p, or ${minIndex}-${maxIndex}`,
        submitLabel: isActivePicker ? "Use active" : "Use next",
        cancelLabel: "Cancel",
      },
    );

    if (input === null) {
      return null;
    }

    const command = input.trim().toLowerCase();
    if (!command || command === "s" || command === "select" || command === "use") {
      return selectedIndex;
    }

    if (command === "n" || command === "next") {
      selectedIndex =
        selectedIndex >= maxIndex ? minIndex : selectedIndex + 1;
      continue;
    }

    if (command === "p" || command === "prev" || command === "previous") {
      selectedIndex =
        selectedIndex <= minIndex ? maxIndex : selectedIndex - 1;
      continue;
    }

    const nextIndex = parseIndex(command);
    if (nextIndex === null || nextIndex < minIndex || nextIndex > maxIndex) {
      api.ui.toast(`Choose a number from ${minIndex} to ${maxIndex}.`, "warning");
      continue;
    }

    selectedIndex = nextIndex;
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
    const marker = analyzeSceneMarker(content);

    logDebug("latest message read", {
      id: latestMessage && latestMessage.id,
      role: latestMessage && latestMessage.role,
      marker: marker.hasMarker,
      finalLine: marker.finalLine,
      length: marker.length,
    });
    return latestMessage;
  } catch (error) {
    logDebug("latest message read failed", { error: error.message || String(error) });
    return null;
  }
}

async function getLatestMarkerMessage(expectedMessageId) {
  const expectedId = asText(expectedMessageId);
  let latestMessage = null;

  for (let attempt = 0; attempt < LATEST_MESSAGE_RETRY_ATTEMPTS; attempt++) {
    latestMessage = await getLatestChatMessage();

    if (!latestMessage) {
      await sleep(LATEST_MESSAGE_RETRY_DELAY_MS);
      continue;
    }

    const content = chatMessageContent(latestMessage);
    const marker = analyzeSceneMarker(content);
    const latestId = asText(latestMessage.id);

    logDebug("latest marker check", {
      attempt: attempt + 1,
      expectedId,
      latestId,
      marker: marker.hasMarker,
      finalLine: marker.finalLine,
    });

    if (marker.hasMarker) {
      return latestMessage;
    }

    await sleep(LATEST_MESSAGE_RETRY_DELAY_MS);
  }

  return latestMessage && hasSceneChanged(chatMessageContent(latestMessage)) ?
      latestMessage
    : null;
}

async function resolveTransitionSource(eventName) {
  const directContent = transitionContentFromEvent();
  const directSourceId = transitionSourceIdFromEvent();
  const directMarker = analyzeSceneMarker(directContent);

  logDebug("transition source check", {
    event: eventName,
    directSourceId,
    directMarker: directMarker.hasMarker,
    directFinalLine: directMarker.finalLine,
    directLength: directMarker.length,
  });

  if (
    eventName === "GENERATION_ENDED" ||
    eventName === "GENERATION_STOPPED" ||
    eventName === "CHARACTER_MESSAGE_RENDERED" ||
    eventName === "USER_MESSAGE_RENDERED"
  ) {
    const latest = await getLatestMarkerMessage(directSourceId);
    if (latest) {
      return {
        content: chatMessageContent(latest),
        sourceId: asText(latest.id) || directSourceId,
      };
    }

    if (directMarker.hasMarker) {
      logDebug("using direct transition payload fallback", { event: eventName });
      return { content: directContent, sourceId: directSourceId };
    }

    return null;
  }

  if (directMarker.hasMarker) {
    return { content: directContent, sourceId: directSourceId };
  }

  return null;
}

async function insertGreetingMessage(greeting) {
  if (!greeting || !greeting.text) {
    logDebug("insert skipped", { reason: "empty greeting" });
    return false;
  }

  try {
    await api.chat.sendMessage(greeting.text, { role: "assistant" });
    logDebug("greeting inserted", {
      index: greeting.index,
      length: greeting.text.length,
    });
    return true;
  } catch (error) {
    logDebug("greeting insert failed", {
      index: greeting.index,
      error: error.message || String(error),
    });
    return false;
  }
}

async function advanceToUpcomingGreeting(state, source = "manual") {
  const advancedIndex =
    normalizeUpcomingIndex(state.upcomingIndex, state.activeIndex, state.greetings) ??
    defaultUpcomingIndex(state.activeIndex, state.greetings);
  const previousActiveIndex = state.activeIndex;
  const previousUpcomingIndex = state.upcomingIndex;

  logDebug("advance requested", {
    source,
    activeIndex: state.activeIndex,
    upcomingIndex: state.upcomingIndex === null ? "none" : state.upcomingIndex,
    advancedIndex: advancedIndex === null ? "none" : advancedIndex,
  });

  if (advancedIndex === null || advancedIndex === state.activeIndex) {
    state.upcomingIndex = await resetUpcomingIndex(state.activeIndex, state.greetings);
    return {
      advancedIndex: null,
      insertedGreeting: false,
      insertionFailed: false,
    };
  }

  state.activeIndex = await writeActiveIndex(advancedIndex, state.greetings);
  state.upcomingIndex = await resetUpcomingIndex(state.activeIndex, state.greetings);

  logDebug("advance state committed before insert", {
    activeIndex: state.activeIndex,
    upcomingIndex: state.upcomingIndex === null ? "none" : state.upcomingIndex,
  });

  const insertedGreeting = await insertGreetingMessage(state.greetings[advancedIndex]);

  if (!insertedGreeting) {
    state.activeIndex = await writeActiveIndex(previousActiveIndex, state.greetings);
    state.upcomingIndex = await writeUpcomingIndex(
      previousUpcomingIndex,
      state.activeIndex,
      state.greetings,
    );

    logDebug("advance rolled back after insert failure", {
      activeIndex: state.activeIndex,
      upcomingIndex: state.upcomingIndex === null ? "none" : state.upcomingIndex,
    });

    return {
      advancedIndex: null,
      attemptedIndex: advancedIndex,
      insertedGreeting: false,
      insertionFailed: true,
    };
  }

  logDebug("advance committed", {
    activeIndex: state.activeIndex,
    upcomingIndex: state.upcomingIndex === null ? "none" : state.upcomingIndex,
  });

  return {
    advancedIndex,
    attemptedIndex: advancedIndex,
    insertedGreeting,
    insertionFailed: false,
  };
}

async function maybeAdvanceForTransition(state, eventName) {
  if (!state.ready || !TRANSITION_EVENTS.has(eventName)) {
    return { advanced: false, result: null };
  }

  const source = await resolveTransitionSource(eventName);
  if (!source || !hasSceneChanged(source.content)) {
    logDebug("transition not advanced", { event: eventName, reason: "no marker" });
    return { advanced: false, result: null };
  }

  const signature = transitionSignature(state.chat.id, source.sourceId, source.content);
  const eventKey = transitionEventKey(state.chat.id, source.sourceId, source.content);

  if (globalThis[TRANSITION_IN_FLIGHT_KEY] === signature) {
    logDebug("transition ignored", { reason: "in flight", event: eventName });
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
      await writeChatVariable(LAST_ADVANCED_EVENT_VAR, eventKey);
      await writeChatVariable(LAST_ADVANCED_SIGNATURE_VAR, signature);
    }

    return { advanced: result.advancedIndex !== null, result };
  } finally {
    if (globalThis[TRANSITION_IN_FLIGHT_KEY] === signature) {
      globalThis[TRANSITION_IN_FLIGHT_KEY] = "";
    }
  }
}

function nextGreetingMessage(state) {
  return state.upcomingIndex === null ?
      "No later greeting is available."
    : `Next greeting is ${state.upcomingIndex} (${state.greetings[state.upcomingIndex].label}).`;
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

  let state = await loadState({ expectedChatId, strictChat });

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
      api.ui.toast(
        `Could not insert greeting ${result.attemptedIndex} (${state.greetings[result.attemptedIndex].label}); active greeting was not advanced.`,
        "warning",
      );
    } else if (result.advancedIndex !== null) {
      api.ui.toast(
        `Greeting transition advanced to ${result.advancedIndex} (${state.greetings[result.advancedIndex].label}). ${nextGreetingMessage(state)}`,
        "success",
      );
    }
  } else if (toast) {
    const nextLabel =
      state.upcomingIndex === null ? "none" : String(state.upcomingIndex);
    api.ui.toast(
      `Greeting Inspector refreshed. Active ${state.activeIndex}; next ${nextLabel}. ${promptContentMessage(state.sync)}`,
      state.sync && state.sync.error ? "warning" : "success",
    );
  }

  logDebug("refresh pipeline complete", {
    reason,
    activeIndex: state.activeIndex,
    upcomingIndex: state.upcomingIndex === null ? "none" : state.upcomingIndex,
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

async function handleActivePicker() {
  const state = await refreshPipeline({ reason: "active picker open" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  const selectedIndex = await openPicker("active", state);
  if (selectedIndex === null) {
    await refreshPipeline({ reason: "active picker cancelled" });
    return;
  }

  await ensureActiveChatStill(state.chat && state.chat.id, "Active greeting change");
  const committedActiveIndex = await writeActiveIndex(selectedIndex, state.greetings);
  await resetUpcomingIndex(committedActiveIndex, state.greetings);

  const refreshedState = await refreshPipeline({ reason: "active picker committed" });
  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  api.ui.toast(
    `Active greeting set to ${refreshedState.activeIndex} (${refreshedState.greetings[refreshedState.activeIndex].label}). ${nextGreetingMessage(refreshedState)} ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
}

async function handleUpcomingPicker() {
  const state = await refreshPipeline({ reason: "next picker open" });
  if (!state.ready) {
    api.ui.toast(state.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  const selectedIndex = await openPicker("upcoming", state);
  if (selectedIndex === null) {
    await refreshPipeline({ reason: "next picker cancelled" });
    return;
  }

  await ensureActiveChatStill(state.chat && state.chat.id, "Next greeting change");
  await writeUpcomingIndex(
    selectedIndex,
    state.activeIndex,
    state.greetings,
  );

  const refreshedState = await refreshPipeline({ reason: "next picker committed" });
  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  if (refreshedState.upcomingIndex === null) {
    api.ui.toast("There is no later greeting to use as the next greeting.", "warning");
    return;
  }

  api.ui.toast(
    `Next greeting set to ${refreshedState.upcomingIndex} (${refreshedState.greetings[refreshedState.upcomingIndex].label}). ${promptContentMessage(refreshedState.sync)}`,
    refreshedState.sync && refreshedState.sync.error ? "warning" : "success",
  );
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
    api.ui.toast(
      `Could not insert greeting ${result.attemptedIndex} (${state.greetings[result.attemptedIndex].label}); active greeting was not advanced.`,
      "warning",
    );
    return;
  }

  if (result.advancedIndex === null) {
    api.ui.toast("There is no later greeting to force.", "warning");
    return;
  }

  if (!refreshedState.ready) {
    api.ui.toast(refreshedState.reason || "Greeting Inspector is inactive.", "warning");
    return;
  }

  api.ui.toast(
    `Forced greeting transition to ${result.advancedIndex} (${refreshedState.greetings[result.advancedIndex].label}). ${nextGreetingMessage(refreshedState)} ${promptContentMessage(refreshedState.sync)}`,
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
    await writeInspectorEnabled(nextEnabled);
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
  unsubscribeByKey(DRAWER_CLICK_UNSUB_KEY);
  unsubscribeByKey(DRAWER_CHANGE_UNSUB_KEY);
  unsubscribeByKey(FLOATING_CLICK_UNSUB_KEY);
  await removeInjectedNote();
  await writeInspectorActive(false);
  await writeInspectorContent("");

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
