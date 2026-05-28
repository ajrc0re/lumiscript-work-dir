// @ls:reload-on-edit
const INJECTION_ID = "greeting-inspector-next-scene-note";
const SELECTOR_INJECTION_ID = "greeting-inspector-selector";
const STATUS_PICK_BUTTON_ID = "ls-gi-status-pick";
const STATUS_ACTIVE_BUTTON_ID = "ls-gi-status-active";
const STATUS_FORCE_BUTTON_ID = "ls-gi-status-force";
const STATUS_RESTART_BUTTON_ID = "ls-gi-status-restart";
const EXTERNAL_RESTART_BUTTON_ID = "ls-gi-external-restart";
const EXTERNAL_RESTART_INJECTION_ID = "greeting-inspector-external-restart";
const STATUS_AUTO_INJECT_CHECKBOX_ID = "ls-gi-status-auto-inject";
const STATUS_DEBUG_CHECKBOX_ID = "ls-gi-status-debug";
const STATUS_ACTION_EVENT = "greeting-inspector:status-action:v2";
const ACTIVE_INDEX_VAR = "GreetingInspectorActiveIndex";
const UPCOMING_INDEX_VAR = "GreetingInspectorUpcomingIndex";
const LAST_ADVANCED_EVENT_VAR = "GreetingInspectorLastAdvancedEvent";
const LAST_ADVANCED_SIGNATURE_VAR = "GreetingInspectorLastAdvancedSignature";
const ACTIVE_STATUS_VAR = "GreetingInspectorActive";
const CONTENT_VAR = "GreetingInspectorContent";
const AUTO_INJECT_VAR = "GreetingInspectorAutoInject";
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
const STATUS_ACTION_UNSUBSCRIBE_KEY =
  "__greetingInspectorStatusActionUnsubscribe";
const STATUS_DRAWER_TAB_KEY = "__greetingInspectorStatusDrawerTab";
const STATUS_DRAWER_CLICK_UNSUBSCRIBE_KEY =
  "__greetingInspectorStatusDrawerClickUnsubscribe";
const EXTERNAL_RESTART_HANDLE_KEY = "__greetingInspectorExternalRestartHandle";
const EXTERNAL_RESTART_CLICK_UNSUBSCRIBE_KEY =
  "__greetingInspectorExternalRestartClickUnsubscribe";
const RESTART_IN_FLIGHT_KEY = "__greetingInspectorRestartInFlight";
const STATUS_STYLE_HANDLE_KEY = "__greetingInspectorStatusStyleHandle";
const TRANSITION_IN_FLIGHT_KEY = "__greetingInspectorTransitionInFlight";
const MANUAL_RUN_OVERRIDE_KEY = "__greetingInspectorManualRunOverride";
const DEBUG_LOG_KEY = "__greetingInspectorDebugLog";
const MAX_DEBUG_LOG_LINES = 24;
const CHAT_SWITCH_SETTLE_ATTEMPTS = 24;
const CHAT_SWITCH_SETTLE_DELAY_MS = 125;
const LATEST_MESSAGE_RETRY_ATTEMPTS = 30;
const LATEST_MESSAGE_RETRY_DELAY_MS = 150;
const PREWRITTEN_SCENE_HANDOFF_MARKER = "--T--";
const PRIME_EVENTS = new Set([
  "MESSAGE_SENT",
  "GENERATION_STARTED",
  "SETTINGS_UPDATED",
  "CHAT_SWITCHED",
  "CHAT_CHANGED",
  "CHARACTER_EDITED",
  "CHARACTER_DELETED",
  "ls:startup",
  "ls:teardown",
  "ls:reload",
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
const LATEST_MESSAGE_TRANSITION_EVENTS = new Set([
  "CHAT_SWITCHED",
  "CHAT_CHANGED",
  "CHARACTER_EDITED",
  "CHARACTER_DELETED",
  "CHARACTER_MESSAGE_RENDERED",
  "USER_MESSAGE_RENDERED",
  "GENERATION_ENDED",
  "GENERATION_STOPPED",
  "MESSAGE_EDITED",
  "MESSAGE_SWIPED",
  "SWIPE_EDITED",
]);

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function greetingLabel(index) {
  return index === 0 ? "default greeting" : `alternate greeting ${index}`;
}

function displayGreeting(value) {
  return asText(value) || "(empty)";
}

function parseIndex(value) {
  const number =
    typeof value === "number" ? value : Number.parseInt(asText(value), 10);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.trunc(number);
}

function clampIndex(value, maxIndex) {
  if (maxIndex < 0) {
    return 0;
  }

  const index = parseIndex(value);

  if (index === null) {
    return 0;
  }

  return Math.max(0, Math.min(index, maxIndex));
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

function asBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return asText(value).toLowerCase() === "true";
}

function knownEventName(value) {
  const eventName = asText(value);

  if (!eventName) {
    return "";
  }

  if (
    PRIME_EVENTS.has(eventName) ||
    TRANSITION_EVENTS.has(eventName) ||
    eventName.startsWith("ls:")
  ) {
    return eventName;
  }

  return "";
}

function getExplicitEventName() {
  return (
    knownEventName(data && data.__event) ||
    knownEventName(data && data.eventName) ||
    knownEventName(data && data.event) ||
    knownEventName(data && data.name) ||
    knownEventName(data && data.type)
  );
}

function inferEventNameFromPayload() {
  if (!data || typeof data !== "object") {
    return "";
  }

  if (hasEventField("generationId")) {
    if (hasEventField("model")) {
      return "GENERATION_STARTED";
    }

    if (hasEventField("content")) {
      return hasEventField("messageId") ? "GENERATION_ENDED" : (
          "GENERATION_STOPPED"
        );
    }
  }

  if (hasEventField("chatId") && hasEventField("message")) {
    if (hasEventField("action") || hasEventField("swipeId")) {
      return "MESSAGE_SWIPED";
    }

    if (hasEventField("previousSwipeId")) {
      return "SWIPE_EDITED";
    }

    return "MESSAGE_SENT";
  }

  if (hasEventField("chatId") && hasEventField("messageId")) {
    return "CHARACTER_MESSAGE_RENDERED";
  }

  if (hasEventField("id") && hasEventField("character")) {
    return "CHARACTER_EDITED";
  }

  if (hasEventField("id") && !hasEventField("character")) {
    return "CHARACTER_DELETED";
  }

  return "";
}

function isBareChatChangePayload() {
  return (
    hasEventField("chatId") &&
    !hasEventField("message") &&
    !hasEventField("messageId") &&
    !hasEventField("generationId") &&
    !hasEventField("content") &&
    !hasEventField("token") &&
    !hasEventField("model") &&
    !hasEventField("action") &&
    !hasEventField("swipeId") &&
    !hasEventField("previousSwipeId")
  );
}

function getEventName() {
  const eventName = getExplicitEventName();

  if (eventName) {
    return eventName;
  }

  if (isActiveChatSettingChange()) {
    return "SETTINGS_UPDATED";
  }

  const inferredEventName = inferEventNameFromPayload();

  if (inferredEventName) {
    return inferredEventName;
  }

  if (isBareChatChangePayload()) {
    return data && data.chatId === null ? "CHAT_SWITCHED" : "CHAT_CHANGED";
  }

  return "";
}

function isScriptTeardown() {
  if (getEventName() === "ls:teardown") {
    return true;
  }

  const reason = asText(data && data.reason);

  return (
    !getEventName() &&
    (reason === "disabled" || reason === "deleted") &&
    (asText(data && data.scriptId) || asText(data && data.scriptName))
  );
}

function isManualRun() {
  return (
    Boolean(globalThis[MANUAL_RUN_OVERRIDE_KEY]) ||
    (!getEventName() && !isScriptTeardown())
  );
}

function hasEventField(key) {
  return Object.prototype.hasOwnProperty.call(data || {}, key);
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

function isActiveChatSettingChange() {
  return data && data.key === "activeChatId";
}

function isChatSwitch() {
  return getEventName() === "CHAT_SWITCHED";
}

function isChatContextRefresh() {
  const eventName = getEventName();
  return (
    eventName === "CHAT_SWITCHED" ||
    eventName === "CHAT_CHANGED" ||
    eventName === "ls:startup" ||
    eventName === "ls:reload" ||
    eventName === "CHARACTER_EDITED" ||
    eventName === "CHARACTER_DELETED"
  );
}

function isActiveChatClose() {
  if (isChatSwitch()) {
    return !asText(data && data.chatId);
  }

  return isActiveChatSettingChange() && !asText(data.value);
}

function eventChatId() {
  return (
    asText(data && data.chatId) ||
    (isActiveChatSettingChange() ? asText(data.value) : "")
  );
}

function eventCharacterId() {
  return (
    asText(data && data.id) ||
    asText(data && data.character && data.character.id)
  );
}

function isPreAssemblyGenerationStart() {
  return getEventName() === "GENERATION_STARTED";
}

function shouldCheckTransitionOnTrigger() {
  const eventName = getEventName();
  return (
    isManualRun() ||
    TRANSITION_EVENTS.has(eventName) ||
    isChatContextRefresh() ||
    isActiveChatSettingChange() ||
    eventName === "MESSAGE_SENT"
  );
}

function shouldCheckLatestMessageForTransition() {
  const eventName = getEventName();

  return (
    isManualRun() ||
    LATEST_MESSAGE_TRANSITION_EVENTS.has(eventName) ||
    isActiveChatSettingChange()
  );
}

function shouldHandleTrigger() {
  if (isManualRun()) {
    return true;
  }

  const eventName = getEventName();

  if (TRANSITION_EVENTS.has(eventName)) {
    return true;
  }

  if (!PRIME_EVENTS.has(eventName)) {
    return false;
  }

  if (eventName === "MESSAGE_SENT") {
    return isUserMessage(data.message) || hasSceneChanged(transitionContent());
  }

  if (eventName === "GENERATION_STARTED") {
    return isPreAssemblyGenerationStart();
  }

  if (isChatContextRefresh()) {
    return true;
  }

  return isActiveChatSettingChange();
}

function transitionContent() {
  if (typeof data.content === "string") {
    return data.content;
  }

  const messageContent = chatMessageContent(data && data.message);

  if (messageContent) {
    return messageContent;
  }

  return "";
}

function transitionMessageId() {
  return asText(data.messageId) || asText(data.message && data.message.id);
}

function transitionSourceId() {
  return transitionMessageId() || asText(data.generationId);
}

function normalizeMarkerContent(content) {
  return (typeof content === "string" ? content : "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\r\n?/g, "\n");
}

function analyzeSceneMarker(content) {
  const normalized = normalizeMarkerContent(content);
  const trimmedRight = normalized.replace(/[ \t\n\f\v\u00A0]+$/g, "");

  if (!trimmedRight) {
    return {
      hasMarker: false,
      finalLine: "",
      lineCount: 0,
      length: normalized.length,
    };
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

function markerDebugDetails(content) {
  const marker = analyzeSceneMarker(content);

  return {
    marker: marker.hasMarker,
    finalLine: marker.finalLine ? debugPreview(marker.finalLine, 80) : "",
    lineCount: marker.lineCount,
    length: marker.length,
  };
}

function hasSceneChanged(content) {
  return analyzeSceneMarker(content).hasMarker;
}

function transitionEventKey(content, sourceId) {
  return [
    asText(data.chatId),
    sourceId,
    String(content.length),
    content.slice(-80),
  ].join("|");
}

function transitionEventSignature(content) {
  const text = asText(content);

  return [asText(data.chatId), String(text.length), text.slice(-240)].join("|");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debugPreview(value, maxLength = 180) {
  const rawText = typeof value === "string" ? value : JSON.stringify(value);
  const text = String(rawText ?? value).replace(/\s+/g, " ");

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function appendDebugLog(message, details = {}) {
  const log =
    Array.isArray(globalThis[DEBUG_LOG_KEY]) ? globalThis[DEBUG_LOG_KEY] : [];
  const detailText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${debugPreview(value, 120)}`)
    .join(" ");
  const line =
    detailText ?
      `${new Date().toLocaleTimeString()} ${message} ${detailText}`
    : `${new Date().toLocaleTimeString()} ${message}`;

  log.push(line);

  while (log.length > MAX_DEBUG_LOG_LINES) {
    log.shift();
  }

  globalThis[DEBUG_LOG_KEY] = log;
}

function debugLogLines() {
  return Array.isArray(globalThis[DEBUG_LOG_KEY]) ?
      globalThis[DEBUG_LOG_KEY]
    : [];
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function allowFireAndForgetApiToFlush() {
  await sleep(150);
}

function buildGreetingSelectorCss() {
  return `
.ls-gi-modal-body {
  min-width: 0;
  min-height: 0;
  height: clamp(360px, 60vh, 620px);
  max-height: calc(100vh - 220px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-bg, #151515);
}

.ls-gi-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
}

.ls-gi-dialog {
  width: min(980px, calc(100vw - 32px));
  max-height: min(860px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-bg, #151515);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.16));
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
}

.ls-gi-dialog .ls-gi-modal-body {
  height: auto;
  max-height: none;
  flex: 1 1 auto;
}

.ls-gi-header,
.ls-gi-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.12));
}

.ls-gi-header {
  border-bottom: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
}

.ls-gi-footer {
  flex: 0 0 auto;
  border-top: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
}

.ls-gi-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.ls-gi-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
}

.ls-gi-field {
  display: grid;
  gap: 6px;
}

.ls-gi-label,
.ls-gi-meta,
.ls-gi-hint {
  font-size: 13px;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
}

.ls-gi-select {
  width: 100%;
  min-height: 38px;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-input-bg, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  padding: 8px 10px;
}

.ls-gi-viewer {
  flex: 1 1 auto;
  min-height: 72px;
  max-height: none;
  overflow: auto;
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.14));
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
}

.ls-gi-greeting {
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.ls-gi-button {
  min-height: 34px;
  padding: 8px 12px;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-button-bg, rgba(255, 255, 255, 0.1));
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.16));
  border-radius: 6px;
  cursor: pointer;
}

.ls-gi-button-primary {
  background: var(--lumiverse-accent, #3b82f6);
  border-color: var(--lumiverse-accent, #3b82f6);
  color: var(--lumiverse-accent-text, #ffffff);
}

.ls-gi-button-danger {
  color: var(--lumiverse-danger-text, #ffffff);
  background: var(--lumiverse-danger, #dc2626);
  border-color: var(--lumiverse-danger, #dc2626);
}

.ls-gi-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;
}

function buildGreetingOptions(greetings, selectedIndex) {
  return greetings
    .map((greeting) => {
      const selected = greeting.index === selectedIndex ? " selected" : "";
      const label = `${greeting.index} - ${greeting.label}`;

      return `<option value="${greeting.index}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function buildGreetingSelectorHtml(character, greetings, selectedIndex) {
  return `
<div class="ls-gi-backdrop">
  <div class="ls-gi-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-gi-title">
    <div class="ls-gi-header">
      <h2 class="ls-gi-title" id="ls-gi-title">Choose active greeting</h2>
      <button class="ls-gi-button" id="ls-gi-close" type="button">Close</button>
    </div>
    ${buildGreetingSelectorBodyHtml(character, greetings, selectedIndex)}
  </div>
</div>`;
}

function buildGreetingSelectorBodyHtml(character, greetings, selectedIndex) {
  const selectedGreeting = greetings[selectedIndex];
  const nextGreeting = greetings[selectedIndex + 1];
  const nextSceneLabel =
    nextGreeting ? `${nextGreeting.index} (${nextGreeting.label})` : "none";
  const nextSceneHint =
    nextGreeting ?
      "The following index is injected as the upcoming greeting target."
    : "This is the final greeting. Selecting it clears the upcoming greeting target and removes the transition injection.";

  return `
<div class="ls-gi-modal-body">
    <div class="ls-gi-body">
      <div class="ls-gi-meta">Active character: ${escapeHtml(character.name || "(unnamed)")}</div>
      <div class="ls-gi-field">
        <label class="ls-gi-label" for="ls-gi-greeting-select">Active greeting index</label>
        <select class="ls-gi-select" id="ls-gi-greeting-select">${buildGreetingOptions(greetings, selectedIndex)}</select>
      </div>
      <div class="ls-gi-meta">Selected index: ${selectedGreeting.index} (${escapeHtml(selectedGreeting.label)})</div>
      <div class="ls-gi-meta">Next greeting source: ${escapeHtml(nextSceneLabel)}</div>
      <div class="ls-gi-hint">The selected greeting is treated as active. ${escapeHtml(nextSceneHint)}</div>
      <div class="ls-gi-viewer" aria-label="Selected greeting content">
        <pre class="ls-gi-greeting">${escapeHtml(displayGreeting(selectedGreeting.text))}</pre>
      </div>
    </div>
    <div class="ls-gi-footer">
      <button class="ls-gi-button" id="ls-gi-cancel" type="button">Cancel</button>
      <button class="ls-gi-button ls-gi-button-primary" id="ls-gi-use" type="button">Use selected greeting</button>
    </div>
</div>`;
}

function buildUpcomingOptions(greetings, activeIndex, selectedIndex) {
  return greetings
    .slice(activeIndex + 1)
    .map((greeting) => {
      const selected = greeting.index === selectedIndex ? " selected" : "";
      const label = `${greeting.index} - ${greeting.label}`;

      return `<option value="${greeting.index}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function buildUpcomingSelectorHtml(
  character,
  greetings,
  activeIndex,
  selectedIndex,
) {
  return `
<div class="ls-gi-backdrop">
  <div class="ls-gi-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-gi-title">
    <div class="ls-gi-header">
      <h2 class="ls-gi-title" id="ls-gi-title">Choose upcoming greeting</h2>
      <button class="ls-gi-button" id="ls-gi-close" type="button">Close</button>
    </div>
    ${buildUpcomingSelectorBodyHtml(character, greetings, activeIndex, selectedIndex)}
  </div>
</div>`;
}

function buildUpcomingSelectorBodyHtml(
  character,
  greetings,
  activeIndex,
  selectedIndex,
) {
  const activeGreeting = greetings[activeIndex];
  const selectedGreeting = greetings[selectedIndex];

  return `
<div class="ls-gi-modal-body">
    <div class="ls-gi-body">
      <div class="ls-gi-meta">Active character: ${escapeHtml(character.name || "(unnamed)")}</div>
      <div class="ls-gi-meta">Current active index: ${activeGreeting.index} (${escapeHtml(activeGreeting.label)})</div>
      <div class="ls-gi-field">
        <label class="ls-gi-label" for="ls-gi-upcoming-select">Upcoming greeting index</label>
        <select class="ls-gi-select" id="ls-gi-upcoming-select">${buildUpcomingOptions(greetings, activeIndex, selectedIndex)}</select>
      </div>
      <div class="ls-gi-meta">Selected upcoming index: ${selectedGreeting.index} (${escapeHtml(selectedGreeting.label)})</div>
      <div class="ls-gi-hint">The selected greeting is used as the upcoming greeting target. When the transition marker appears, it is inserted verbatim and the active index advances to this greeting.</div>
      <div class="ls-gi-viewer" aria-label="Selected upcoming greeting content">
        <pre class="ls-gi-greeting">${escapeHtml(displayGreeting(selectedGreeting.text))}</pre>
      </div>
    </div>
    <div class="ls-gi-footer">
      <button class="ls-gi-button" id="ls-gi-cancel" type="button">Cancel</button>
      <button class="ls-gi-button ls-gi-button-primary" id="ls-gi-use" type="button">Use upcoming greeting</button>
    </div>
</div>`;
}

function buildStatusCss() {
  return `
@keyframes ls-gi-spin {
  to {
    transform: rotate(360deg);
  }
}

.ls-gi-status {
  width: 100%;
  min-height: 100%;
  padding: 12px;
  box-sizing: border-box;
  color: var(--lumiverse-text, #f5f5f5);
  font-family: inherit;
}

.ls-gi-status-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  padding: 8px 10px;
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  user-select: none;
}

.ls-gi-status-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.ls-gi-status-kicker {
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.68));
  font-size: 11px;
  line-height: 1.2;
}

.ls-gi-status-value {
  color: var(--lumiverse-text, #f5f5f5);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
}

.ls-gi-status-next {
  flex-shrink: 0;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.7));
  font-size: 12px;
  text-align: right;
}

.ls-gi-status-actions {
  display: grid;
  flex-shrink: 0;
  justify-items: end;
  gap: 6px;
}

.ls-gi-status-buttons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

.ls-gi-status-button {
  min-height: 28px;
  padding: 5px 8px;
  color: var(--lumiverse-accent-text, #ffffff);
  background: var(--lumiverse-accent, #3b82f6);
  border: 1px solid var(--lumiverse-accent, #3b82f6);
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ls-gi-status-button-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.ls-gi-status-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 999px;
  box-sizing: border-box;
  animation: ls-gi-spin 0.8s linear infinite;
}

.ls-gi-status-active {
  background: var(--lumiverse-button-bg, rgba(255, 255, 255, 0.1));
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.18));
}

.ls-gi-status-button:disabled {
  opacity: 0.45;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  background: var(--lumiverse-bg-muted, rgba(255, 255, 255, 0.06));
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.14));
  cursor: not-allowed;
}

.ls-gi-status-option {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: var(--lumiverse-text, #f5f5f5);
  font-size: 12px;
  line-height: 1.25;
  cursor: pointer;
}

.ls-gi-status-control-box {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 8px;
}

.ls-gi-status-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.ls-gi-status-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--lumiverse-accent, #3b82f6);
}

.ls-gi-status-message {
  max-width: 248px;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  font-size: 11px;
  line-height: 1.3;
}

.ls-gi-status-popover {
  margin-top: 8px;
  max-height: none;
  overflow: auto;
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 8px;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
}

.ls-gi-status-popover-header {
  padding: 10px 12px;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.72));
  border-bottom: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
  font-size: 12px;
  line-height: 1.35;
}

.ls-gi-status-greeting {
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.ls-gi-debug-output {
  margin: 0;
  padding: 10px;
  max-height: 220px;
  overflow: auto;
  color: var(--lumiverse-text-muted, rgba(245, 245, 245, 0.82));
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

.ls-gi-external-restart {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483646;
}

`;
}

function buildRestartButtonHtml(id, restartInFlight) {
  const spinner =
    restartInFlight ?
      '<span class="ls-gi-status-spinner" aria-hidden="true"></span>'
    : "";
  const disabled = restartInFlight ? " disabled aria-busy=\"true\"" : "";

  return `<button class="ls-gi-status-button ls-gi-status-active" id="${id}" type="button" title="Run Greeting Inspector as if the script was launched directly"${disabled}><span class="ls-gi-status-button-inner">${spinner}<span>Restart</span></span></button>`;
}

function buildExternalRestartHtml(restartInFlight) {
  return `
<div class="ls-gi-external-restart">
  ${buildRestartButtonHtml(EXTERNAL_RESTART_BUTTON_ID, restartInFlight)}
</div>`;
}

function buildStatusHtml(
  character,
  greetings,
  activeIndex,
  upcomingIndex,
  autoInject,
  debugEnabled,
  restartInFlight = false,
) {
  const activeGreeting = greetings[activeIndex];
  const upcomingGreeting =
    upcomingIndex === null ? null : greetings[upcomingIndex];
  const activeLabel =
    activeGreeting ?
      `${activeGreeting.index} (${activeGreeting.label})`
    : String(activeIndex);
  const upcomingLabel =
    upcomingGreeting ?
      `${upcomingGreeting.index} (${upcomingGreeting.label})`
    : "none";
  const upcomingText =
    upcomingGreeting ?
      displayGreeting(upcomingGreeting.text)
    : "(no upcoming greeting)";
  const autoInjectMessage =
    autoInject ?
      "Automatic prompt injection is enabled."
    : "Automatic prompt injection is off. Add contents to prompt manually using {{getcvar::GreetingInspectorContent}}.";
  const debugText =
    debugLogLines().length ?
      debugLogLines().join("\n")
    : "No debug events recorded yet.";
  const debugBlock =
    debugEnabled ?
      `<pre class="ls-gi-debug-output">${escapeHtml(debugText)}</pre>`
    : "";

  return `
<div class="ls-gi-status">
  <div class="ls-gi-status-pill">
    <div class="ls-gi-status-main">
      <div class="ls-gi-status-kicker">Active greeting index</div>
      <div class="ls-gi-status-value">${escapeHtml(activeLabel)}</div>
    </div>
    <div class="ls-gi-status-actions">
      <div class="ls-gi-status-next">Next: ${escapeHtml(upcomingLabel)}</div>
      <div class="ls-gi-status-buttons">
        <button class="ls-gi-status-button ls-gi-status-active" id="${STATUS_ACTIVE_BUTTON_ID}" type="button">Active</button>
        <button class="ls-gi-status-button" id="${STATUS_PICK_BUTTON_ID}" type="button"${upcomingGreeting ? "" : " disabled"}>Next</button>
        <button class="ls-gi-status-button" id="${STATUS_FORCE_BUTTON_ID}" type="button" title="Force transition and insert the upcoming greeting"${upcomingGreeting ? "" : " disabled"}>Force</button>
      </div>
    </div>
  </div>
  <div class="ls-gi-status-control-box">
    <div class="ls-gi-status-control-row">
      ${buildRestartButtonHtml(STATUS_RESTART_BUTTON_ID, restartInFlight)}
      <label class="ls-gi-status-option" for="${STATUS_AUTO_INJECT_CHECKBOX_ID}">
        <input class="ls-gi-status-checkbox" id="${STATUS_AUTO_INJECT_CHECKBOX_ID}" type="checkbox"${autoInject ? " checked" : ""}>
        <span>Auto prompt</span>
      </label>
      <label class="ls-gi-status-option" for="${STATUS_DEBUG_CHECKBOX_ID}">
        <input class="ls-gi-status-checkbox" id="${STATUS_DEBUG_CHECKBOX_ID}" type="checkbox"${debugEnabled ? " checked" : ""}>
        <span>Debug</span>
      </label>
    </div>
    <div class="ls-gi-status-message">${escapeHtml(autoInjectMessage)}</div>
    ${debugBlock}
  </div>
  <div class="ls-gi-status-popover">
    <div class="ls-gi-status-popover-header">Upcoming greeting for ${escapeHtml(character.name || "(unnamed)")}</div>
    <pre class="ls-gi-status-greeting">${escapeHtml(upcomingText)}</pre>
  </div>
</div>`;
}

function buildCharacterGreetings(character) {
  const alternateGreetings =
    Array.isArray(character.alternateGreetings) ?
      character.alternateGreetings
    : [];

  return [
    { index: 0, label: greetingLabel(0), text: asText(character.firstMessage) },
    ...alternateGreetings.map((text, alternateIndex) => ({
      index: alternateIndex + 1,
      label: greetingLabel(alternateIndex + 1),
      text: asText(text),
    })),
  ];
}

function buildAuthorNote(prewrittenScene) {
  return `<shape_scene_direction>

DIRECTION TARGET:
An upcoming prewritten scene exists. Treat it as a private destination for story direction, staging, character positioning, emotional setup, and momentum.
Guide the current scene toward the exact conditions where that prewritten scene could begin immediately afterward.
The goal is not to find a convenient fade-out. The goal is to arrive as close as possible to the first moment of the upcoming prewritten scene WITHOUT using any part of the scene in your reply.

USER OVERRIDE:
If the user's latest reply contains --O--, immediately make a best-effort attempt to reach the handoff threshold.

PACING AND HANDOFF SPEED:
Do not transition too fast.
Treat the upcoming prewritten scene as a destination to earn through present-moment movement, not a marker to use at the first plausible pause.
Before handing off, let the current scene create enough cause-and-effect, physical positioning, emotional pressure, and immediate continuity that the upcoming prewritten scene feels inevitable.
If the handoff would feel sudden, mechanical, rushed, or like it skips the connective action that makes the next scene land, keep writing the current scene instead.
Prefer gradual movement toward the doorway of the upcoming prewritten scene over immediate marker use.
Use the marker only when the current scene is already at the doorstep of the upcoming prewritten scene, or when the user's latest reply contains --O--.

UPCOMING PREWRITTEN SCENE PRIVACY:
Use the upcoming prewritten scene only as a target for deciding how to steer the current scene.
MANDATORY: Do not quote, summarize, paraphrase, adapt, preview, blend, or reuse any part of it. Do not use its URLs, images, formatting, headings, or exact details. DO NOT use it for anything other than a reference on what direction to guide the current scene. NEVER include ANY PORTION of the upcoming greeting in your response, it will be injected automatically when you send the marker.

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

async function getActiveChat() {
  const activeChat = await api.chats.getActive();

  if (activeChat) {
    return activeChat;
  }

  const chatId = await api.chat.getChatId();

  return chatId ? api.chats.get(chatId) : null;
}

async function waitForActiveChat(expectedChatId) {
  const expectedId = asText(expectedChatId);
  const attempts = expectedId ? CHAT_SWITCH_SETTLE_ATTEMPTS : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const activeChat = await getActiveChat();

    if (!expectedId || (activeChat && activeChat.id === expectedId)) {
      return activeChat;
    }

    await sleep(CHAT_SWITCH_SETTLE_DELAY_MS);
  }

  return getActiveChat();
}

async function removeInjectedNote() {
  try {
    await api.chat.removeInjection(INJECTION_ID);
  } catch {
    // Removing a missing injection is best-effort.
  }
}

function removeHandleByKey(key) {
  const handle = globalThis[key];

  if (handle && typeof handle.remove === "function") {
    try {
      handle.remove();
    } catch {
      // DOM handle removal is best-effort.
    }
  } else if (handle && typeof handle.destroy === "function") {
    try {
      handle.destroy();
    } catch {
      // UI handle destruction is best-effort.
    }
  }

  globalThis[key] = null;
}

function removeStatusStyle() {
  removeHandleByKey(STATUS_STYLE_HANDLE_KEY);
}

function removeDrawerStatusClickHandler() {
  const previousUnsubscribe = globalThis[STATUS_DRAWER_CLICK_UNSUBSCRIBE_KEY];

  if (typeof previousUnsubscribe === "function") {
    try {
      previousUnsubscribe();
    } catch {
      // Listener cleanup is best-effort.
    }
  }

  globalThis[STATUS_DRAWER_CLICK_UNSUBSCRIBE_KEY] = null;
}

function removeExternalRestartClickHandler() {
  const previousUnsubscribe =
    globalThis[EXTERNAL_RESTART_CLICK_UNSUBSCRIBE_KEY];

  if (typeof previousUnsubscribe === "function") {
    try {
      previousUnsubscribe();
    } catch {
      // Listener cleanup is best-effort.
    }
  }

  globalThis[EXTERNAL_RESTART_CLICK_UNSUBSCRIBE_KEY] = null;
}

function removeExternalRestartControl() {
  removeExternalRestartClickHandler();
  removeHandleByKey(EXTERNAL_RESTART_HANDLE_KEY);
}

function removeStatusActionHandler() {
  const previousUnsubscribe = globalThis[STATUS_ACTION_UNSUBSCRIBE_KEY];

  if (typeof previousUnsubscribe === "function") {
    try {
      previousUnsubscribe();
    } catch {
      // Listener cleanup is best-effort.
    }
  }

  globalThis[STATUS_ACTION_UNSUBSCRIBE_KEY] = null;
}

async function replaceStatusStyle() {
  if (!api.ui.dom || !api.ui.dom.addStyle) {
    return;
  }

  removeStatusStyle();
  globalThis[STATUS_STYLE_HANDLE_KEY] =
    await api.ui.dom.addStyle(buildStatusCss());
}

function buildInactiveStatusHtml(message) {
  return `
<div class="ls-gi-status">
  <div class="ls-gi-status-pill">
    <div class="ls-gi-status-main">
      <div class="ls-gi-status-kicker">Greeting Inspector</div>
      <div class="ls-gi-status-value">Inactive</div>
    </div>
  </div>
  <div class="ls-gi-status-popover">
    <div class="ls-gi-status-popover-header">${escapeHtml(message)}</div>
    <pre class="ls-gi-status-greeting"></pre>
  </div>
</div>`;
}

async function clearStatusDrawerUi(message) {
  let tab = null;

  try {
    tab = getStatusDrawerTab();
  } catch {
    return;
  }

  if (!tab) {
    return;
  }

  try {
    removeDrawerStatusClickHandler();
    await replaceStatusStyle();
    tab.setBadge("off");
    tab.root.update(buildInactiveStatusHtml(message));
  } catch {
    // Drawer clearing is best-effort; the next render will replace it.
  }
}

async function removeStatusUi(
  message = "Open a chat with alternate greetings to use Greeting Inspector.",
) {
  removeStatusActionHandler();
  removeExternalRestartControl();

  try {
    await clearStatusDrawerUi(message);
  } catch {
    // UI cleanup is best-effort; the prompt injection state is independent.
  }
}

async function destroyStatusUi() {
  removeDrawerStatusClickHandler();
  removeStatusActionHandler();
  removeExternalRestartControl();
  removeStatusStyle();

  const tab = globalThis[STATUS_DRAWER_TAB_KEY];

  if (tab && typeof tab.destroy === "function") {
    try {
      tab.destroy();
    } catch {
      // Drawer teardown is best-effort.
    }
  }

  globalThis[STATUS_DRAWER_TAB_KEY] = null;

  try {
    if (api.ui.dom && api.ui.dom.cleanup) {
      await api.ui.dom.cleanup();
    }
  } catch {
    // DOM cleanup is best-effort during script teardown.
  }
}

async function cleanupDomBeforeOverlay() {
  // Selector overlays are removed by their own handles. Avoid broad DOM cleanup,
  // because drawer tabs are persistent host-managed surfaces.
}

async function deleteVariable(store, key) {
  if (!store || typeof store.delete !== "function") {
    return false;
  }

  try {
    return await store.delete(key);
  } catch {
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
  } catch {
    return fallback;
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
  return value;
}

async function writeChatVariable(key, value) {
  try {
    await api.variables.chat.set(key, value);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendDebugLog("chat variable write failed", { key, error: message });
  }

  const oldKey = oldChatVariableKey(key);

  if (oldKey) {
    await deleteVariable(api.variables.chat, oldKey);
  }
}

async function deleteChatVariable(key) {
  await deleteVariable(api.variables.chat, key);

  const oldKey = oldChatVariableKey(key);

  if (oldKey) {
    await deleteVariable(api.variables.chat, oldKey);
  }
}

async function clearRemovedSequenceVariables() {
  await deleteVariable(api.variables.chat, "GreetingInspectorSequenceKey");
  await deleteVariable(
    api.variables.chat,
    "GreetingInspectorSequenceCompletedReplies",
  );
  await deleteVariable(
    api.variables.chat,
    "GreetingInspectorSequenceLastAssistantMessage",
  );
  await deleteVariable(api.variables.chat, "greetingInspector.sequenceKey");
  await deleteVariable(
    api.variables.chat,
    "greetingInspector.sequenceCompletedReplies",
  );
  await deleteVariable(
    api.variables.chat,
    "greetingInspector.sequenceLastAssistantMessage",
  );
}

async function clearGreetingInspectorVariables() {
  await deleteVariable(api.variables.global, OLD_STATUS_IN_DRAWER_VAR);
  await deleteChatVariable(ACTIVE_INDEX_VAR);
  await deleteChatVariable(UPCOMING_INDEX_VAR);
  await deleteChatVariable(LAST_ADVANCED_EVENT_VAR);
  await deleteChatVariable(LAST_ADVANCED_SIGNATURE_VAR);
  await clearRemovedSequenceVariables();
  await deleteVariable(api.variables.character, ACTIVE_STATUS_VAR);
  await deleteVariable(api.variables.character, CONTENT_VAR);
  await deleteVariable(api.variables.character, AUTO_INJECT_VAR);
  await deleteVariable(api.variables.character, DEBUG_VAR);

  globalThis[DEBUG_LOG_KEY] = [];
  globalThis[TRANSITION_IN_FLIGHT_KEY] = "";
}

async function writeGreetingInspectorActive(active) {
  try {
    await api.variables.character.set(ACTIVE_STATUS_VAR, Boolean(active));
  } catch {
    // Character-scoped status is best-effort when no active character exists.
  }
}

async function writeGreetingInspectorContent(content) {
  try {
    await api.variables.character.set(
      CONTENT_VAR,
      typeof content === "string" ? content : "",
    );
  } catch {
    // Character-scoped prompt content is best-effort when no active character exists.
  }
}

async function readAutoInject(persist = true) {
  try {
    const hasStoredValue = await api.variables.character.has(AUTO_INJECT_VAR);
    const stored = await api.variables.character.get(AUTO_INJECT_VAR, false);
    const enabled = asBoolean(stored);

    if (persist && (!hasStoredValue || stored !== enabled)) {
      await api.variables.character.set(AUTO_INJECT_VAR, enabled);
    }

    return enabled;
  } catch {
    return false;
  }
}

async function writeAutoInject(enabled) {
  const normalizedValue = Boolean(enabled);

  try {
    await api.variables.character.set(AUTO_INJECT_VAR, normalizedValue);
  } catch {
    // Character-scoped auto-injection preference is best-effort.
  }

  return normalizedValue;
}

async function readDebugEnabled(persist = true) {
  try {
    const hasStoredValue = await api.variables.character.has(DEBUG_VAR);
    const stored = await api.variables.character.get(DEBUG_VAR, false);
    const enabled = asBoolean(stored);

    if (persist && (!hasStoredValue || stored !== enabled)) {
      await api.variables.character.set(DEBUG_VAR, enabled);
    }

    return enabled;
  } catch {
    return false;
  }
}

async function writeDebugEnabled(enabled) {
  const normalizedValue = Boolean(enabled);

  try {
    await api.variables.character.set(DEBUG_VAR, normalizedValue);
  } catch {
    // Character-scoped debug preference is best-effort.
  }

  return normalizedValue;
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

function getStatusDrawerTab() {
  if (!api.ui || typeof api.ui.registerDrawerTab !== "function") {
    return null;
  }

  const existingTab = globalThis[STATUS_DRAWER_TAB_KEY];

  if (existingTab) {
    return existingTab;
  }

  const tab = api.ui.registerDrawerTab({
    id: "greeting-inspector-status",
    title: "Greeting Inspector",
    shortName: "GI",
    description: "Greeting Inspector controls and upcoming prewritten scene",
    keywords: ["greeting", "inspector", "scene", "prewritten"],
    headerTitle: "Greeting Inspector",
    iconSvg: drawerTabIconSvg(),
  });

  globalThis[STATUS_DRAWER_TAB_KEY] = tab;
  return tab;
}

function attachStatusClickHandler(
  handle,
  character,
  greetings,
  activeIndex,
  upcomingIndex,
  autoInject,
  debugEnabled,
  chatId,
  restartInFlight,
) {
  return handle.on("click", async (event) => {
    const targetId = event.targetId || "";
    let action = "";

    if (targetId === STATUS_ACTIVE_BUTTON_ID) {
      action = "active";
    } else if (targetId === STATUS_PICK_BUTTON_ID) {
      action = "upcoming";
    } else if (targetId === STATUS_FORCE_BUTTON_ID) {
      action = "force";
    } else if (targetId === STATUS_RESTART_BUTTON_ID) {
      if (restartInFlight || globalThis[RESTART_IN_FLIGHT_KEY]) {
        return;
      }

      action = "restart";
    } else if (targetId === STATUS_AUTO_INJECT_CHECKBOX_ID) {
      autoInject =
        typeof event.targetChecked === "boolean" ?
          event.targetChecked
        : !autoInject;
      handle.update(
        buildStatusHtml(
          character,
          greetings,
          activeIndex,
          upcomingIndex,
          autoInject,
          debugEnabled,
          Boolean(globalThis[RESTART_IN_FLIGHT_KEY]),
        ),
      );
      action = "autoInject";
    } else if (targetId === STATUS_DEBUG_CHECKBOX_ID) {
      debugEnabled =
        typeof event.targetChecked === "boolean" ?
          event.targetChecked
        : !debugEnabled;
      handle.update(
        buildStatusHtml(
          character,
          greetings,
          activeIndex,
          upcomingIndex,
          autoInject,
          debugEnabled,
          Boolean(globalThis[RESTART_IN_FLIGHT_KEY]),
        ),
      );
      action = "debug";
    } else {
      return;
    }

    await api.broadcast.emit(STATUS_ACTION_EVENT, {
      action,
      autoInject,
      debugEnabled,
      chatId,
    });
  });
}

async function renderStatusUi(
  character,
  greetings,
  activeIndex,
  upcomingIndex,
  autoInject,
  debugEnabled,
  chatId,
) {
  const restartInFlight = Boolean(globalThis[RESTART_IN_FLIGHT_KEY]);

  await renderStatusDrawerUi(
    character,
    greetings,
    activeIndex,
    upcomingIndex,
    autoInject,
    debugEnabled,
    chatId,
    restartInFlight,
  );
  await renderExternalRestartUi(restartInFlight, chatId);
}

async function renderStatusDrawerUi(
  character,
  greetings,
  activeIndex,
  upcomingIndex,
  autoInject,
  debugEnabled,
  chatId,
  restartInFlight,
) {
  let tab = null;

  try {
    tab = getStatusDrawerTab();
  } catch (error) {
    if (isManualRun()) {
      const message = error && error.message ? error.message : String(error);
      api.ui.toast(
        `Could not register the greeting drawer tab: ${message}`,
        "warning",
      );
    }

    return;
  }

  if (!tab) {
    if (isManualRun()) {
      api.ui.toast(
        "Drawer tabs are unavailable; Greeting Inspector cannot render controls.",
        "warning",
      );
    }

    return;
  }

  try {
    await replaceStatusStyle();

    tab.setBadge(
      upcomingIndex === null ?
        String(activeIndex)
      : `${activeIndex}->${upcomingIndex}`,
    );
    tab.root.update(
      buildStatusHtml(
        character,
        greetings,
        activeIndex,
        upcomingIndex,
        autoInject,
        debugEnabled,
        restartInFlight,
      ),
    );

    const previousUnsubscribe = globalThis[STATUS_DRAWER_CLICK_UNSUBSCRIBE_KEY];

    if (typeof previousUnsubscribe === "function") {
      try {
        previousUnsubscribe();
      } catch {
        // Listener cleanup is best-effort; replacing the drawer handler prevents duplicate actions.
      }
    }

    globalThis[STATUS_DRAWER_CLICK_UNSUBSCRIBE_KEY] = attachStatusClickHandler(
      tab.root,
      character,
      greetings,
      activeIndex,
      upcomingIndex,
      autoInject,
      debugEnabled,
      chatId,
      restartInFlight,
    );

    await allowFireAndForgetApiToFlush();
  } catch (error) {
    if (isManualRun()) {
      const message = error && error.message ? error.message : String(error);
      api.ui.toast(
        `Could not render greeting drawer tab: ${message}`,
        "warning",
      );
    }
  }
}

async function renderExternalRestartUi(restartInFlight, chatId) {
  if (!api.ui || !api.ui.dom || typeof api.ui.dom.inject !== "function") {
    return;
  }

  let handle = globalThis[EXTERNAL_RESTART_HANDLE_KEY];
  const html = buildExternalRestartHtml(restartInFlight);

  try {
    if (handle && typeof handle.update === "function") {
      try {
        handle.update(html);
      } catch {
        removeExternalRestartControl();
        handle = null;
      }
    }

    if (!handle) {
      handle = await api.ui.dom.inject("body", html, {
        id: EXTERNAL_RESTART_INJECTION_ID,
        position: "beforeend",
      });
      globalThis[EXTERNAL_RESTART_HANDLE_KEY] = handle;
    }

    removeExternalRestartClickHandler();
    globalThis[EXTERNAL_RESTART_CLICK_UNSUBSCRIBE_KEY] = handle.on(
      "click",
      async (event) => {
        if (event.targetId !== EXTERNAL_RESTART_BUTTON_ID) {
          return;
        }

        if (restartInFlight || globalThis[RESTART_IN_FLIGHT_KEY]) {
          return;
        }

        await api.broadcast.emit(STATUS_ACTION_EVENT, {
          action: "restart",
          chatId,
        });
      },
      { preventDefault: true },
    );
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendDebugLog("external restart render failed", { error: message });
  }
}

async function readActiveIndex(greetings, persist = true) {
  const maxIndex = greetings.length - 1;
  const hasStoredIndex = await hasVariable(
    api.variables.chat,
    ACTIVE_INDEX_VAR,
  );
  const stored = await readChatVariable(ACTIVE_INDEX_VAR, 0);
  const activeIndex = clampIndex(stored, maxIndex);

  if (persist && (!hasStoredIndex || stored !== activeIndex)) {
    await writeChatVariable(ACTIVE_INDEX_VAR, activeIndex);
  }

  return activeIndex;
}

async function writeActiveIndex(activeIndex, greetings) {
  const clampedIndex = clampIndex(activeIndex, greetings.length - 1);
  await writeChatVariable(ACTIVE_INDEX_VAR, clampedIndex);
  return clampedIndex;
}

async function readUpcomingIndex(activeIndex, greetings, persist = true) {
  const hasStoredIndex = await hasVariable(
    api.variables.chat,
    UPCOMING_INDEX_VAR,
  );
  const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);
  const stored = await readChatVariable(UPCOMING_INDEX_VAR, fallbackIndex);
  const storedIndex = normalizeUpcomingIndex(stored, activeIndex, greetings);
  const upcomingIndex = storedIndex === null ? fallbackIndex : storedIndex;

  if (upcomingIndex === null) {
    if (persist && hasStoredIndex) {
      await deleteChatVariable(UPCOMING_INDEX_VAR);
    }

    return null;
  }

  if (persist && (!hasStoredIndex || stored !== upcomingIndex)) {
    await writeChatVariable(UPCOMING_INDEX_VAR, upcomingIndex);
  }

  return upcomingIndex;
}

async function writeUpcomingIndex(upcomingIndex, activeIndex, greetings) {
  const normalizedIndex = normalizeUpcomingIndex(
    upcomingIndex,
    activeIndex,
    greetings,
  );

  if (normalizedIndex === null) {
    const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);

    if (fallbackIndex === null) {
      await deleteChatVariable(UPCOMING_INDEX_VAR);
      return null;
    }

    await writeChatVariable(UPCOMING_INDEX_VAR, fallbackIndex);
    return fallbackIndex;
  }

  await writeChatVariable(UPCOMING_INDEX_VAR, normalizedIndex);
  return normalizedIndex;
}

async function resetUpcomingIndex(activeIndex, greetings) {
  const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);

  if (fallbackIndex === null) {
    await deleteChatVariable(UPCOMING_INDEX_VAR);
    return null;
  }

  await writeChatVariable(UPCOMING_INDEX_VAR, fallbackIndex);
  return fallbackIndex;
}

function nextGreetingMessage(upcomingIndex, greetings) {
  return upcomingIndex === null ?
      "No later greeting is available."
    : `Next greeting index is ${upcomingIndex} (${greetings[upcomingIndex].label}).`;
}

function promptContentMessage(syncResult) {
  if (!syncResult.hasContent) {
    return "Prompt context cleared.";
  }

  if (syncResult.error) {
    return `Prompt context saved; prompt update failed: ${syncResult.error}`;
  }

  return "Prompt context saved.";
}

async function advanceToUpcomingGreeting(
  activeIndex,
  upcomingIndex,
  greetings,
) {
  const advancedIndex =
    normalizeUpcomingIndex(upcomingIndex, activeIndex, greetings) ??
    defaultUpcomingIndex(activeIndex, greetings);

  appendDebugLog("advance requested", {
    activeIndex,
    upcomingIndex,
    advancedIndex,
  });

  if (advancedIndex === null || advancedIndex === activeIndex) {
    const nextUpcomingIndex = await resetUpcomingIndex(activeIndex, greetings);
    appendDebugLog("advance skipped", {
      reason: "no later greeting",
      activeIndex,
      upcomingIndex: nextUpcomingIndex,
    });
    return {
      activeIndex,
      upcomingIndex: nextUpcomingIndex,
      advancedIndex: null,
      attemptedIndex: null,
      insertedGreeting: false,
      insertionFailed: false,
    };
  }

  const insertedGreeting = await insertGreetingMessage(
    greetings[advancedIndex],
  );

  if (!insertedGreeting) {
    appendDebugLog("advance aborted", {
      reason: "sendMessage failed",
      attemptedIndex: advancedIndex,
    });
    return {
      activeIndex,
      upcomingIndex,
      advancedIndex: null,
      attemptedIndex: advancedIndex,
      insertedGreeting: false,
      insertionFailed: true,
    };
  }

  await writeChatVariable(ACTIVE_INDEX_VAR, advancedIndex);
  const nextUpcomingIndex = await resetUpcomingIndex(advancedIndex, greetings);
  appendDebugLog("advance committed", {
    activeIndex: advancedIndex,
    upcomingIndex: nextUpcomingIndex,
  });

  return {
    activeIndex: advancedIndex,
    upcomingIndex: nextUpcomingIndex,
    advancedIndex,
    attemptedIndex: advancedIndex,
    insertedGreeting,
    insertionFailed: false,
  };
}

async function insertGreetingMessage(greeting) {
  if (
    !greeting ||
    !greeting.text ||
    !api.chat ||
    typeof api.chat.sendMessage !== "function"
  ) {
    appendDebugLog("insert skipped", {
      reason:
        !greeting || !greeting.text ?
          "empty greeting"
        : "sendMessage unavailable",
    });
    return false;
  }

  try {
    appendDebugLog("insert attempt", { length: greeting.text.length });
    await api.chat.sendMessage(greeting.text, { role: "assistant" });
    appendDebugLog("insert succeeded", { length: greeting.text.length });
    return true;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendDebugLog("insert failed", { error: message });
    api.ui.toast(
      `Greeting transition advanced, but the greeting could not be inserted verbatim: ${message}`,
      "warning",
    );
    return false;
  }
}

async function getLatestChatMessage() {
  if (!api.chat || typeof api.chat.getMessages !== "function") {
    appendDebugLog("latest message unavailable", {
      reason: "getMessages unavailable",
    });
    return null;
  }

  try {
    const messages = await api.chat.getMessages({ last: 1 });
    const latestMessage =
      Array.isArray(messages) && messages.length > 0 ? messages[0] : null;
    const latestContent = chatMessageContent(latestMessage);
    appendDebugLog("latest message read", {
      id: latestMessage && latestMessage.id,
      role: latestMessage && latestMessage.role,
      swipeId: latestMessage && latestMessage.swipeId,
      ...markerDebugDetails(latestContent),
    });
    return latestMessage;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendDebugLog("latest message failed", { error: message });
    api.ui.toast(
      `Could not check the latest chat message for a transition marker: ${message}`,
      "warning",
    );
    return null;
  }
}

async function getLatestChatMessageForTransition(
  expectedMessageId,
  waitForMarker = false,
) {
  const expectedId = asText(expectedMessageId);
  let latestMessage = null;

  for (let attempt = 0; attempt < LATEST_MESSAGE_RETRY_ATTEMPTS; attempt++) {
    latestMessage = await getLatestChatMessage();

    if (!latestMessage) {
      await sleep(LATEST_MESSAGE_RETRY_DELAY_MS);
      continue;
    }

    const latestContent = chatMessageContent(latestMessage);
    const latestMessageId = asText(latestMessage && latestMessage.id);
    const markerDetails = markerDebugDetails(latestContent);

    appendDebugLog("latest transition check", {
      attempt: attempt + 1,
      expectedId,
      latestId: latestMessageId,
      role: latestMessage && latestMessage.role,
      ...markerDetails,
    });

    if (markerDetails.marker) {
      appendDebugLog("transition marker found in latest message", {
        attempt: attempt + 1,
        id: latestMessageId,
      });
      return latestMessage;
    }

    if (!expectedId && !waitForMarker && attempt === 0) {
      appendDebugLog("latest message returned without marker", {
        attempt: attempt + 1,
        id: latestMessageId,
      });
      return latestMessage;
    }

    await sleep(LATEST_MESSAGE_RETRY_DELAY_MS);
  }

  appendDebugLog("transition marker not found in latest message", {
    attempts: LATEST_MESSAGE_RETRY_ATTEMPTS,
    latestId: latestMessage && latestMessage.id,
  });
  return latestMessage;
}

async function resolveTransitionSource() {
  const eventName = getEventName();
  const eventContent = transitionContent();
  const eventSourceId = transitionSourceId();
  const eventMarkerDetails = markerDebugDetails(eventContent);
  const latestMessageAuthoritative = shouldCheckLatestMessageForTransition();

  appendDebugLog("transition check", {
    event: eventName || "manual",
    eventSourceId,
    latestMessageAuthoritative,
    ...eventMarkerDetails,
    contentPreview: eventContent ? debugPreview(eventContent, 80) : "",
  });

  if (latestMessageAuthoritative) {
    const expectedMessageId = transitionMessageId();
    appendDebugLog("checking latest message for transition", {
      event: eventName,
      expectedMessageId,
    });

    const latestMessage = await getLatestChatMessageForTransition(
      expectedMessageId,
      true,
    );
    const latestContent = chatMessageContent(latestMessage);
    const latestMarkerDetails = markerDebugDetails(latestContent);

    if (latestMarkerDetails.marker) {
      return {
        content: latestContent,
        sourceId: asText(latestMessage && latestMessage.id) || eventSourceId,
      };
    }

    appendDebugLog("latest message has no transition marker", {
      event: eventName,
      latestId: latestMessage && latestMessage.id,
      role: latestMessage && latestMessage.role,
      ...latestMarkerDetails,
    });

    if (
      eventMarkerDetails.marker &&
      (eventName === "GENERATION_ENDED" || eventName === "GENERATION_STOPPED")
    ) {
      appendDebugLog("using event payload marker as fallback", {
        event: eventName,
        reason:
          latestMessage ?
            "latest message did not expose marker after retry"
          : "latest message unavailable",
        sourceId: eventSourceId,
      });
      return {
        content: eventContent,
        sourceId: eventSourceId,
      };
    }

    if (eventMarkerDetails.marker) {
      appendDebugLog("event payload marker ignored", {
        event: eventName,
        reason: "latest message is authoritative",
        sourceId: eventSourceId,
      });
    }

    return null;
  }

  if (eventMarkerDetails.marker) {
    appendDebugLog("transition marker found in event payload", {
      event: eventName,
      sourceId: eventSourceId,
    });
    return {
      content: eventContent,
      sourceId: eventSourceId,
    };
  }

  if (eventName === "MESSAGE_SENT" && eventContent) {
    appendDebugLog("message sent has no transition marker", {
      event: eventName,
      isUserMessage: isUserMessage(data.message),
      ...eventMarkerDetails,
    });
    return null;
  }

  const latestMessage = await getLatestChatMessageForTransition(
    transitionMessageId(),
    true,
  );
  const latestContent = chatMessageContent(latestMessage);
  const latestMarkerDetails = markerDebugDetails(latestContent);

  if (!latestMarkerDetails.marker) {
    appendDebugLog("transition source unresolved", {
      event: eventName,
      latestId: latestMessage && latestMessage.id,
      ...latestMarkerDetails,
    });
    return null;
  }

  return {
    content: latestContent,
    sourceId: asText(latestMessage && latestMessage.id) || eventSourceId,
  };
}

async function advanceActiveIndexIfSceneChanged(
  activeIndex,
  upcomingIndex,
  greetings,
) {
  if (!shouldCheckTransitionOnTrigger()) {
    if (getEventName() === "MESSAGE_SENT" && isUserMessage(data.message)) {
      await deleteChatVariable(LAST_ADVANCED_SIGNATURE_VAR);
    }

    appendDebugLog("transition check skipped", {
      event: getEventName() || "manual",
    });
    return { activeIndex, upcomingIndex };
  }

  const transitionSource = await resolveTransitionSource();

  if (!transitionSource || !hasSceneChanged(transitionSource.content)) {
    if (
      getEventName() === "MESSAGE_SENT" &&
      isUserMessage(data.message) &&
      !hasSceneChanged(transitionContent())
    ) {
      await deleteChatVariable(LAST_ADVANCED_SIGNATURE_VAR);
    }

    appendDebugLog("no transition marker to advance", {
      event: getEventName() || "manual",
    });
    return { activeIndex, upcomingIndex };
  }

  const content = transitionSource.content;
  const eventKey = transitionEventKey(content, transitionSource.sourceId);
  const eventSignature = transitionEventSignature(content);

  if (globalThis[TRANSITION_IN_FLIGHT_KEY] === eventSignature) {
    appendDebugLog("duplicate transition ignored", { reason: "in flight" });
    return { activeIndex, upcomingIndex };
  }

  globalThis[TRANSITION_IN_FLIGHT_KEY] = eventSignature;

  try {
    const lastAdvancedEvent = await readChatVariable(
      LAST_ADVANCED_EVENT_VAR,
      "",
    );
    const lastAdvancedSignature = await readChatVariable(
      LAST_ADVANCED_SIGNATURE_VAR,
      "",
    );

    if (
      lastAdvancedEvent === eventKey ||
      lastAdvancedSignature === eventSignature
    ) {
      appendDebugLog("duplicate transition ignored", {
        reason: "already advanced",
      });
      return { activeIndex, upcomingIndex };
    }

    const result = await advanceToUpcomingGreeting(
      activeIndex,
      upcomingIndex,
      greetings,
    );

    if (result.insertionFailed) {
      return {
        activeIndex: result.activeIndex,
        upcomingIndex: result.upcomingIndex,
      };
    }

    if (result.advancedIndex === null) {
      return {
        activeIndex: result.activeIndex,
        upcomingIndex: result.upcomingIndex,
      };
    }

    await writeChatVariable(LAST_ADVANCED_EVENT_VAR, eventKey);
    await writeChatVariable(LAST_ADVANCED_SIGNATURE_VAR, eventSignature);

    const advancedIndex = result.advancedIndex;
    const insertMessage =
      result.insertedGreeting ?
        "Inserted the greeting verbatim."
      : "The greeting was not inserted.";

    api.ui.toast(
      `Greeting transition advanced to ${advancedIndex} (${greetings[advancedIndex].label}). ${insertMessage} ${nextGreetingMessage(result.upcomingIndex, greetings)}`,
      "success",
    );
    return {
      activeIndex: result.activeIndex,
      upcomingIndex: result.upcomingIndex,
    };
  } finally {
    if (globalThis[TRANSITION_IN_FLIGHT_KEY] === eventSignature) {
      globalThis[TRANSITION_IN_FLIGHT_KEY] = "";
    }
  }
}

async function syncNextSceneContext(upcomingIndex, greetings, autoInject) {
  const nextGreeting = upcomingIndex === null ? null : greetings[upcomingIndex];

  if (!nextGreeting || !nextGreeting.text) {
    appendDebugLog("prompt context cleared", {
      reason: "no upcoming content",
      upcomingIndex,
    });
    await writeGreetingInspectorContent("");
    await removeInjectedNote();
    return { hasContent: false, injected: false, error: "" };
  }

  const content = buildAuthorNote(nextGreeting.text);
  await writeGreetingInspectorContent(content);
  appendDebugLog("prompt content saved", {
    upcomingIndex,
    autoInject,
    length: content.length,
  });

  if (!autoInject) {
    await removeInjectedNote();
    appendDebugLog("prompt injection skipped", {
      reason: "auto prompt disabled",
      upcomingIndex,
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
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    appendDebugLog("prompt injection failed", { error: message });
    return { hasContent: true, injected: false, error: message };
  }

  appendDebugLog("prompt injection succeeded", { upcomingIndex });
  return { hasContent: true, injected: true, error: "" };
}

async function promptForActiveGreetingFallback(
  character,
  greetings,
  initialIndex,
) {
  const maxActiveIndex = greetings.length - 1;
  let selectedIndex = clampIndex(initialIndex, maxActiveIndex);

  while (true) {
    const nextGreeting = greetings[selectedIndex + 1];
    const nextSceneSource =
      nextGreeting ? `${nextGreeting.index} (${nextGreeting.label})` : "none";

    const input = await api.ui.prompt(
      [
        `Active character: ${character.name}`,
        `Selected active greeting: ${selectedIndex} (${greetings[selectedIndex].label})`,
        `Next greeting source: ${nextSceneSource}`,
        "",
        "Leave blank to select. Type n, p, or a number to change selection.",
        "",
        "CURRENTLY SELECTED GREETING:",
        displayGreeting(greetings[selectedIndex].text),
      ].join("\n"),
      "",
      {
        placeholder: `blank=select, n, p, or 0-${maxActiveIndex}`,
        submitLabel: "Select shown",
        cancelLabel: "Cancel",
      },
    );

    if (input === null) {
      return null;
    }

    const command = input.trim().toLowerCase();

    if (!command || command === "s" || command === "select") {
      return selectedIndex;
    }

    if (command === "n" || command === "next") {
      selectedIndex = selectedIndex >= maxActiveIndex ? 0 : selectedIndex + 1;
      continue;
    }

    if (command === "p" || command === "prev" || command === "previous") {
      selectedIndex = selectedIndex <= 0 ? maxActiveIndex : selectedIndex - 1;
      continue;
    }

    if (!/^\d+$/.test(command)) {
      api.ui.toast(
        "Enter blank to select, n, p, or a valid greeting number.",
        "warning",
      );
      continue;
    }

    const activeIndex = Number.parseInt(command, 10);

    if (activeIndex < 0 || activeIndex > maxActiveIndex) {
      api.ui.toast(`Choose a number from 0 to ${maxActiveIndex}.`, "warning");
      continue;
    }

    selectedIndex = activeIndex;
  }
}

async function promptForActiveGreetingAdvancedModal(
  character,
  greetings,
  initialIndex,
) {
  if (
    !api.ui ||
    typeof api.ui.showAdvancedModal !== "function" ||
    !api.ui.dom ||
    !api.ui.dom.addStyle
  ) {
    return { supported: false, value: null };
  }

  const maxActiveIndex = greetings.length - 1;
  let selectedIndex = clampIndex(initialIndex, maxActiveIndex);
  let modal = null;
  let styleHandle = null;
  const unsubscribers = [];

  function render() {
    modal.root.update(
      buildGreetingSelectorBodyHtml(character, greetings, selectedIndex),
    );
  }

  function removeInjectedUi() {
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Listener cleanup is best-effort.
      }
    }

    if (styleHandle) {
      styleHandle.remove();
    }
  }

  try {
    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    modal = await api.ui.showAdvancedModal({
      title: "Choose active greeting",
      width: 980,
      maxHeight: 640,
      persistent: true,
    });
    render();
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(
      `Could not open advanced selector: ${message}. Using legacy selector.`,
      "warning",
    );
    return { supported: false, value: null };
  }

  const value = await new Promise((resolve) => {
    let settled = false;

    function finish(nextValue, dismissModal = true) {
      if (settled) {
        return;
      }

      settled = true;
      removeInjectedUi();

      if (
        dismissModal &&
        modal &&
        typeof modal.dismiss === "function" &&
        !modal.dismissed
      ) {
        modal.dismiss();
      }

      resolve(nextValue);
    }

    unsubscribers.push(
      modal.onDismiss(() => {
        finish(null, false);
      }),
    );

    unsubscribers.push(
      modal.root.on("change", (event) => {
        if (event.targetId !== "ls-gi-greeting-select") {
          return;
        }

        const nextIndex = Number.parseInt(event.targetValue, 10);

        if (
          !Number.isInteger(nextIndex) ||
          nextIndex < 0 ||
          nextIndex >= greetings.length
        ) {
          return;
        }

        selectedIndex = nextIndex;
        render();
      }),
    );

    unsubscribers.push(
      modal.root.on("click", (event) => {
        if (event.targetId === "ls-gi-cancel") {
          finish(null);
          return;
        }

        if (event.targetId === "ls-gi-use") {
          finish(selectedIndex);
        }
      }),
    );
  });

  return { supported: true, value };
}

async function promptForActiveGreeting(character, greetings, initialIndex) {
  const advancedResult = await promptForActiveGreetingAdvancedModal(
    character,
    greetings,
    initialIndex,
  );

  if (advancedResult.supported) {
    return advancedResult.value;
  }

  if (!api.ui.dom || !api.ui.dom.inject || !api.ui.dom.addStyle) {
    api.ui.toast(
      "App manipulation is unavailable; using the text prompt selector.",
      "warning",
    );
    return promptForActiveGreetingFallback(character, greetings, initialIndex);
  }

  const maxActiveIndex = greetings.length - 1;
  let selectedIndex = clampIndex(initialIndex, maxActiveIndex);
  let handle = null;
  let styleHandle = null;
  const unsubscribers = [];

  function render() {
    handle.update(
      buildGreetingSelectorHtml(character, greetings, selectedIndex),
    );
  }

  function removeInjectedUi() {
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Listener cleanup is best-effort.
      }
    }

    if (handle) {
      handle.remove();
    }

    if (styleHandle) {
      styleHandle.remove();
    }
  }

  try {
    await cleanupDomBeforeOverlay();

    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    handle = await api.ui.dom.inject(
      "body",
      buildGreetingSelectorHtml(character, greetings, selectedIndex),
      {
        id: SELECTOR_INJECTION_ID,
        position: "beforeend",
      },
    );
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(
      `Could not open dropdown selector: ${message}. Using text prompt selector.`,
      "warning",
    );
    return promptForActiveGreetingFallback(character, greetings, initialIndex);
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish(value) {
      if (settled) {
        return;
      }

      settled = true;
      removeInjectedUi();
      resolve(value);
    }

    unsubscribers.push(
      handle.on("change", (event) => {
        if (event.targetId !== "ls-gi-greeting-select") {
          return;
        }

        const nextIndex = Number.parseInt(event.targetValue, 10);

        if (
          !Number.isInteger(nextIndex) ||
          nextIndex < 0 ||
          nextIndex >= greetings.length
        ) {
          return;
        }

        selectedIndex = nextIndex;
        render();
      }),
    );

    unsubscribers.push(
      handle.on("click", (event) => {
        if (
          event.targetId === "ls-gi-cancel" ||
          event.targetId === "ls-gi-close"
        ) {
          finish(null);
          return;
        }

        if (event.targetId === "ls-gi-use") {
          finish(selectedIndex);
        }
      }),
    );
  });
}

async function promptForUpcomingGreetingFallback(
  character,
  greetings,
  activeIndex,
  initialIndex,
) {
  const minUpcomingIndex = activeIndex + 1;
  const maxUpcomingIndex = greetings.length - 1;

  if (minUpcomingIndex > maxUpcomingIndex) {
    api.ui.toast(
      "There is no later greeting to use as the upcoming greeting target.",
      "warning",
    );
    return null;
  }

  let selectedIndex =
    normalizeUpcomingIndex(initialIndex, activeIndex, greetings) ??
    minUpcomingIndex;

  while (true) {
    const input = await api.ui.prompt(
      [
        `Active character: ${character.name}`,
        `Current active greeting: ${activeIndex} (${greetings[activeIndex].label})`,
        `Selected upcoming greeting: ${selectedIndex} (${greetings[selectedIndex].label})`,
        "",
        "Leave blank to select. Type n, p, or a greeting number to change selection.",
        "",
        "UPCOMING GREETING:",
        displayGreeting(greetings[selectedIndex].text),
      ].join("\n"),
      "",
      {
        placeholder: `blank=select, n, p, or ${minUpcomingIndex}-${maxUpcomingIndex}`,
        submitLabel: "Select upcoming",
        cancelLabel: "Cancel",
      },
    );

    if (input === null) {
      return null;
    }

    const command = input.trim().toLowerCase();

    if (!command || command === "s" || command === "select") {
      return selectedIndex;
    }

    if (command === "n" || command === "next") {
      selectedIndex =
        selectedIndex >= maxUpcomingIndex ? minUpcomingIndex : (
          selectedIndex + 1
        );
      continue;
    }

    if (command === "p" || command === "prev" || command === "previous") {
      selectedIndex =
        selectedIndex <= minUpcomingIndex ? maxUpcomingIndex : (
          selectedIndex - 1
        );
      continue;
    }

    const nextIndex = normalizeUpcomingIndex(command, activeIndex, greetings);

    if (nextIndex === null) {
      api.ui.toast(
        `Choose a number from ${minUpcomingIndex} to ${maxUpcomingIndex}.`,
        "warning",
      );
      continue;
    }

    selectedIndex = nextIndex;
  }
}

async function promptForUpcomingGreetingAdvancedModal(
  character,
  greetings,
  activeIndex,
  initialIndex,
) {
  if (
    !api.ui ||
    typeof api.ui.showAdvancedModal !== "function" ||
    !api.ui.dom ||
    !api.ui.dom.addStyle
  ) {
    return { supported: false, value: null };
  }

  const minUpcomingIndex = activeIndex + 1;
  const maxUpcomingIndex = greetings.length - 1;

  if (minUpcomingIndex > maxUpcomingIndex) {
    api.ui.toast(
      "There is no later greeting to use as the upcoming greeting target.",
      "warning",
    );
    return { supported: true, value: null };
  }

  let selectedIndex =
    normalizeUpcomingIndex(initialIndex, activeIndex, greetings) ??
    minUpcomingIndex;
  let modal = null;
  let styleHandle = null;
  const unsubscribers = [];

  function render() {
    modal.root.update(
      buildUpcomingSelectorBodyHtml(
        character,
        greetings,
        activeIndex,
        selectedIndex,
      ),
    );
  }

  function removeInjectedUi() {
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Listener cleanup is best-effort.
      }
    }

    if (styleHandle) {
      styleHandle.remove();
    }
  }

  try {
    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    modal = await api.ui.showAdvancedModal({
      title: "Choose upcoming greeting",
      width: 980,
      maxHeight: 640,
      persistent: true,
    });
    render();
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(
      `Could not open advanced upcoming selector: ${message}. Using legacy selector.`,
      "warning",
    );
    return { supported: false, value: null };
  }

  const value = await new Promise((resolve) => {
    let settled = false;

    function finish(nextValue, dismissModal = true) {
      if (settled) {
        return;
      }

      settled = true;
      removeInjectedUi();

      if (
        dismissModal &&
        modal &&
        typeof modal.dismiss === "function" &&
        !modal.dismissed
      ) {
        modal.dismiss();
      }

      resolve(nextValue);
    }

    unsubscribers.push(
      modal.onDismiss(() => {
        finish(null, false);
      }),
    );

    unsubscribers.push(
      modal.root.on("change", (event) => {
        if (event.targetId !== "ls-gi-upcoming-select") {
          return;
        }

        const nextIndex = normalizeUpcomingIndex(
          event.targetValue,
          activeIndex,
          greetings,
        );

        if (nextIndex === null) {
          return;
        }

        selectedIndex = nextIndex;
        render();
      }),
    );

    unsubscribers.push(
      modal.root.on("click", (event) => {
        if (event.targetId === "ls-gi-cancel") {
          finish(null);
          return;
        }

        if (event.targetId === "ls-gi-use") {
          finish(selectedIndex);
        }
      }),
    );
  });

  return { supported: true, value };
}

async function promptForUpcomingGreeting(
  character,
  greetings,
  activeIndex,
  initialIndex,
) {
  const minUpcomingIndex = activeIndex + 1;
  const maxUpcomingIndex = greetings.length - 1;

  if (minUpcomingIndex > maxUpcomingIndex) {
    api.ui.toast(
      "There is no later greeting to use as the upcoming greeting target.",
      "warning",
    );
    return null;
  }

  const advancedResult = await promptForUpcomingGreetingAdvancedModal(
    character,
    greetings,
    activeIndex,
    initialIndex,
  );

  if (advancedResult.supported) {
    return advancedResult.value;
  }

  if (!api.ui.dom || !api.ui.dom.inject || !api.ui.dom.addStyle) {
    api.ui.toast(
      "App manipulation is unavailable; using the text prompt selector.",
      "warning",
    );
    return promptForUpcomingGreetingFallback(
      character,
      greetings,
      activeIndex,
      initialIndex,
    );
  }

  let selectedIndex =
    normalizeUpcomingIndex(initialIndex, activeIndex, greetings) ??
    minUpcomingIndex;
  let handle = null;
  let styleHandle = null;
  const unsubscribers = [];

  function render() {
    handle.update(
      buildUpcomingSelectorHtml(
        character,
        greetings,
        activeIndex,
        selectedIndex,
      ),
    );
  }

  function removeInjectedUi() {
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Listener cleanup is best-effort.
      }
    }

    if (handle) {
      handle.remove();
    }

    if (styleHandle) {
      styleHandle.remove();
    }
  }

  try {
    await cleanupDomBeforeOverlay();

    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    handle = await api.ui.dom.inject(
      "body",
      buildUpcomingSelectorHtml(
        character,
        greetings,
        activeIndex,
        selectedIndex,
      ),
      {
        id: SELECTOR_INJECTION_ID,
        position: "beforeend",
      },
    );
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(
      `Could not open upcoming greeting picker: ${message}. Using text prompt selector.`,
      "warning",
    );
    return promptForUpcomingGreetingFallback(
      character,
      greetings,
      activeIndex,
      initialIndex,
    );
  }

  return new Promise((resolve) => {
    let settled = false;

    function finish(value) {
      if (settled) {
        return;
      }

      settled = true;
      removeInjectedUi();
      resolve(value);
    }

    unsubscribers.push(
      handle.on("change", (event) => {
        if (event.targetId !== "ls-gi-upcoming-select") {
          return;
        }

        const nextIndex = normalizeUpcomingIndex(
          event.targetValue,
          activeIndex,
          greetings,
        );

        if (nextIndex === null) {
          return;
        }

        selectedIndex = nextIndex;
        render();
      }),
    );

    unsubscribers.push(
      handle.on("click", (event) => {
        if (
          event.targetId === "ls-gi-cancel" ||
          event.targetId === "ls-gi-close"
        ) {
          finish(null);
          return;
        }

        if (event.targetId === "ls-gi-use") {
          finish(selectedIndex);
        }
      }),
    );
  });
}

async function restartGreetingInspector() {
  globalThis[MANUAL_RUN_OVERRIDE_KEY] = true;

  try {
    await main();
  } finally {
    globalThis[MANUAL_RUN_OVERRIDE_KEY] = false;
  }
}

async function deactivateGreetingInspector() {
  await removeInjectedNote();
  await destroyStatusUi();
  await clearGreetingInspectorVariables();
}

function registerStatusActionHandler(
  character,
  greetings,
  activeIndex,
  upcomingIndex,
  autoInject,
  debugEnabled,
  chatId,
) {
  if (!api.broadcast || typeof api.broadcast.on !== "function") {
    return null;
  }

  let currentActiveIndex = activeIndex;
  let currentUpcomingIndex = upcomingIndex;
  let currentAutoInject = autoInject;
  let currentDebugEnabled = debugEnabled;

  function repaint() {
    return renderStatusUi(
      character,
      greetings,
      currentActiveIndex,
      currentUpcomingIndex,
      currentAutoInject,
      currentDebugEnabled,
      chatId,
    );
  }

  const previousUnsubscribe = globalThis[STATUS_ACTION_UNSUBSCRIBE_KEY];

  if (typeof previousUnsubscribe === "function") {
    try {
      previousUnsubscribe();
    } catch {
      // Listener cleanup is best-effort; replacing the handler prevents duplicate actions.
    }
  }

  const unsubscribe = api.broadcast.on(STATUS_ACTION_EVENT, async (payload) => {
    try {
      const action = asText(payload && payload.action);
      const payloadChatId = asText(payload && payload.chatId);

      if (action === "restart") {
        if (globalThis[RESTART_IN_FLIGHT_KEY]) {
          return;
        }

        globalThis[RESTART_IN_FLIGHT_KEY] = true;
        appendDebugLog("restart requested", { chatId: payloadChatId || chatId });
        await repaint();

        try {
          await restartGreetingInspector();
        } finally {
          globalThis[RESTART_IN_FLIGHT_KEY] = false;
        }

        return;
      }

      if (payloadChatId && chatId && payloadChatId !== chatId) {
        return;
      }

      if (action === "autoInject") {
        currentAutoInject = await writeAutoInject(
          asBoolean(payload && payload.autoInject),
        );
        appendDebugLog("auto prompt toggled", { enabled: currentAutoInject });
        const syncResult = await syncNextSceneContext(
          currentUpcomingIndex,
          greetings,
          currentAutoInject,
        );
        await repaint();
        api.ui.toast(
          promptContentMessage(syncResult),
          syncResult.error ? "warning" : "success",
        );
        return;
      }

      if (action === "debug") {
        currentDebugEnabled = await writeDebugEnabled(
          asBoolean(payload && payload.debugEnabled),
        );
        appendDebugLog("debug toggled", { enabled: currentDebugEnabled });
        await repaint();
        return;
      }

      if (action === "active") {
        const selectedIndex = await promptForActiveGreeting(
          character,
          greetings,
          currentActiveIndex,
        );

        if (selectedIndex === null) {
          await repaint();
          return;
        }

        currentActiveIndex = await writeActiveIndex(selectedIndex, greetings);
        currentUpcomingIndex = await resetUpcomingIndex(
          currentActiveIndex,
          greetings,
        );
        const syncResult = await syncNextSceneContext(
          currentUpcomingIndex,
          greetings,
          currentAutoInject,
        );
        await repaint();

        if (currentUpcomingIndex === null) {
          api.ui.toast(
            `Active greeting set to ${currentActiveIndex} (${greetings[currentActiveIndex].label}). No later greeting is available.`,
            "success",
          );
          return;
        }

        api.ui.toast(
          `Active greeting set to ${currentActiveIndex} (${greetings[currentActiveIndex].label}); next is ${currentUpcomingIndex} (${greetings[currentUpcomingIndex].label}). ${promptContentMessage(syncResult)}`,
          syncResult.error ? "warning" : "success",
        );
        return;
      }

      if (action === "upcoming") {
        const selectedIndex = await promptForUpcomingGreeting(
          character,
          greetings,
          currentActiveIndex,
          currentUpcomingIndex,
        );

        if (selectedIndex === null) {
          await repaint();
          return;
        }

        currentUpcomingIndex = await writeUpcomingIndex(
          selectedIndex,
          currentActiveIndex,
          greetings,
        );

        if (currentUpcomingIndex === null) {
          await repaint();
          api.ui.toast(
            "There is no later greeting to use as the upcoming greeting target.",
            "warning",
          );
          return;
        }

        const syncResult = await syncNextSceneContext(
          currentUpcomingIndex,
          greetings,
          currentAutoInject,
        );
        await repaint();
        api.ui.toast(
          `Upcoming greeting set to ${currentUpcomingIndex} (${greetings[currentUpcomingIndex].label}). ${promptContentMessage(syncResult)}`,
          syncResult.error ? "warning" : "success",
        );
        return;
      }

      if (action === "force") {
        const result = await advanceToUpcomingGreeting(
          currentActiveIndex,
          currentUpcomingIndex,
          greetings,
        );

        currentActiveIndex = result.activeIndex;
        currentUpcomingIndex = result.upcomingIndex;
        const syncResult = await syncNextSceneContext(
          currentUpcomingIndex,
          greetings,
          currentAutoInject,
        );
        await repaint();

        if (result.insertionFailed) {
          api.ui.toast(
            `Could not insert greeting ${result.attemptedIndex} (${greetings[result.attemptedIndex].label}); active greeting was not advanced. ${promptContentMessage(syncResult)}`,
            "warning",
          );
          return;
        }

        if (result.advancedIndex === null) {
          api.ui.toast("There is no later greeting to force.", "warning");
          return;
        }

        const insertMessage =
          result.insertedGreeting ?
            "Inserted the greeting into chat."
          : "The greeting was not inserted.";

        api.ui.toast(
          `Forced greeting transition to ${result.advancedIndex} (${greetings[result.advancedIndex].label}). ${insertMessage} ${nextGreetingMessage(result.upcomingIndex, greetings)} ${promptContentMessage(syncResult)}`,
          syncResult.error ? "warning" : "success",
        );
      }
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      api.ui.toast(`Greeting Inspector action failed: ${message}`, "warning");
    }
  });

  if (typeof unsubscribe === "function") {
    globalThis[STATUS_ACTION_UNSUBSCRIBE_KEY] = unsubscribe;
  } else {
    globalThis[STATUS_ACTION_UNSUBSCRIBE_KEY] = null;
  }

  return unsubscribe;
}

async function main() {
  if (isScriptTeardown()) {
    await deactivateGreetingInspector();
    return;
  }

  const manualRun = isManualRun();
  const triggeredChatId = !manualRun ? eventChatId() : "";
  const eventName = getEventName() || (manualRun ? "manual" : "");

  appendDebugLog("run trigger", {
    event: eventName,
    chatId: triggeredChatId,
    characterId: eventCharacterId(),
  });

  if (!shouldHandleTrigger()) {
    appendDebugLog("run skipped", {
      reason: "unhandled trigger",
      event: eventName,
    });
    return;
  }

  if (!manualRun && isActiveChatClose()) {
    await removeInjectedNote();
    await removeStatusUi();
    await clearGreetingInspectorVariables();
    return;
  }

  if (!manualRun && isChatSwitch() && triggeredChatId) {
    await removeInjectedNote();
  }

  if (
    !manualRun &&
    (isChatContextRefresh() || isActiveChatSettingChange())
  ) {
    removeStatusActionHandler();
    removeDrawerStatusClickHandler();
  }

  const activeChat = await waitForActiveChat(triggeredChatId);

  if (!activeChat) {
    await removeInjectedNote();
    await removeStatusUi("No active chat found.");
    await clearGreetingInspectorVariables();

    if (manualRun) {
      api.ui.toast("No active chat found.", "warning");
    }

    return;
  }

  if (!manualRun && triggeredChatId && triggeredChatId !== activeChat.id) {
    if (isChatContextRefresh() || isActiveChatSettingChange()) {
      appendDebugLog("continuing with settled active chat", {
        event: eventName,
        triggeredChatId,
        activeChatId: activeChat.id,
      });
    } else {
      appendDebugLog("run skipped", {
        reason: "active chat mismatch",
        event: eventName,
        triggeredChatId,
        activeChatId: activeChat.id,
      });
      return;
    }
  }

  await clearRemovedSequenceVariables();

  const changedCharacterId = eventCharacterId();

  if (
    !manualRun &&
    changedCharacterId &&
    (eventName === "CHARACTER_EDITED" || eventName === "CHARACTER_DELETED") &&
    changedCharacterId !== activeChat.characterId
  ) {
    appendDebugLog("run skipped", {
      reason: "character event is not active character",
      event: eventName,
      changedCharacterId,
      activeCharacterId: activeChat.characterId,
    });
    return;
  }

  if (!activeChat.characterId) {
    await removeInjectedNote();
    await removeStatusUi(
      "The active chat does not have an associated character.",
    );
    await clearGreetingInspectorVariables();

    if (manualRun) {
      api.ui.toast(
        "The active chat does not have an associated character.",
        "warning",
      );
    }

    return;
  }

  const character = await api.characters.get(activeChat.characterId);

  if (!character) {
    await removeInjectedNote();
    await removeStatusUi("Could not load the active chat character.");
    await clearGreetingInspectorVariables();

    if (manualRun) {
      api.ui.toast("Could not load the active chat character.", "warning");
    }

    return;
  }

  const greetings = buildCharacterGreetings(character);

  if (greetings.length < 2) {
    await removeInjectedNote();
    await removeStatusUi(
      "This character has no alternate greeting to use as the next scene.",
    );
    await clearGreetingInspectorVariables();

    if (manualRun) {
      api.ui.toast(
        "This character has no alternate greeting to use as the next scene.",
        "warning",
      );
    }

    return;
  }

  let activeIndex = await readActiveIndex(greetings);
  let upcomingIndex = await readUpcomingIndex(activeIndex, greetings);
  let autoInject = await readAutoInject();
  let debugEnabled = await readDebugEnabled();

  const advancedState = await advanceActiveIndexIfSceneChanged(
    activeIndex,
    upcomingIndex,
    greetings,
  );
  activeIndex = advancedState.activeIndex;
  upcomingIndex = advancedState.upcomingIndex;

  async function renderAndRegisterStatus() {
    debugEnabled = await readDebugEnabled();
    await renderStatusUi(
      character,
      greetings,
      activeIndex,
      upcomingIndex,
      autoInject,
      debugEnabled,
      activeChat.id,
    );
    registerStatusActionHandler(
      character,
      greetings,
      activeIndex,
      upcomingIndex,
      autoInject,
      debugEnabled,
      activeChat.id,
    );
  }

  await writeGreetingInspectorActive(true);

  const syncResult = await syncNextSceneContext(
    upcomingIndex,
    greetings,
    autoInject,
  );

  if (manualRun && globalThis[RESTART_IN_FLIGHT_KEY]) {
    globalThis[RESTART_IN_FLIGHT_KEY] = false;
    appendDebugLog("restart render ready", { chatId: activeChat.id });
  }

  await renderAndRegisterStatus();

  if (!manualRun) {
    return;
  }

  const nextLabel = upcomingIndex === null ? "none" : String(upcomingIndex);
  const contextMessage =
    syncResult.error ? ` ${promptContentMessage(syncResult)}` : "";
  api.ui.toast(
    `Greeting Inspector initialized. Active ${activeIndex}; next ${nextLabel}. Open the Greeting Inspector sidebar tab for controls.${contextMessage}`,
    syncResult.error ? "warning" : "success",
  );
}

try {
  await main();
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  api.ui.toast(`Greeting inspector failed: ${message}`, "warning");
}
