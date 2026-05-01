const INJECTION_ID = 'greeting-inspector-next-scene-note';
const SELECTOR_INJECTION_ID = 'greeting-inspector-selector';
const STATUS_INJECTION_ID = 'greeting-inspector-status';
const STATUS_PICK_BUTTON_ID = 'ls-gi-status-pick';
const STATUS_ACTIVE_BUTTON_ID = 'ls-gi-status-active';
const STATUS_FORCE_BUTTON_ID = 'ls-gi-status-force';
const STATUS_COLLAPSE_BUTTON_ID = 'ls-gi-status-collapse';
const STATUS_RESTORE_BUTTON_ID = 'ls-gi-status-restore';
const STATUS_ACTION_EVENT = 'greeting-inspector:status-action';
const ACTIVE_INDEX_VAR = 'greetingInspector.activeIndex';
const UPCOMING_INDEX_VAR = 'greetingInspector.upcomingIndex';
const STATUS_COLLAPSED_VAR = 'greetingInspector.statusCollapsed';
const LAST_ADVANCED_EVENT_VAR = 'greetingInspector.lastAdvancedEvent';
const GREETING_TRANSITION_MARKER = '---GREETING TRANSITION---';
const LEGACY_END_SCENE_MARKER = '---END SCENE---';
const TRANSITION_MARKERS = [GREETING_TRANSITION_MARKER, LEGACY_END_SCENE_MARKER];
const PRIME_EVENTS = new Set(['MESSAGE_SENT', 'GENERATION_STARTED', 'SETTINGS_UPDATED', 'CHAT_SWITCHED']);
const TRANSITION_EVENTS = new Set(['GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_EDITED']);

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function greetingLabel(index) {
  return index === 0 ? 'default greeting' : `alternate greeting ${index}`;
}

function displayGreeting(value) {
  return asText(value) || '(empty)';
}

function parseIndex(value) {
  const number = typeof value === 'number'
    ? value
    : Number.parseInt(asText(value), 10);

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
  if (typeof value === 'boolean') {
    return value;
  }

  return asText(value).toLowerCase() === 'true';
}

function getEventName() {
  return asText(data && data.__event);
}

function isManualRun() {
  return !getEventName();
}

function hasEventField(key) {
  return Object.prototype.hasOwnProperty.call(data || {}, key);
}

function isUserMessage(message) {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (typeof message.is_user === 'boolean') {
    return message.is_user;
  }

  return message.role === 'user';
}

function isActiveChatSettingChange() {
  return data && data.key === 'activeChatId';
}

function isChatSwitch() {
  return getEventName() === 'CHAT_SWITCHED';
}

function isActiveChatClose() {
  if (isChatSwitch()) {
    return !asText(data && data.chatId);
  }

  return isActiveChatSettingChange() && !asText(data.value);
}

function eventChatId() {
  return asText(data && data.chatId);
}

function isPreAssemblyGenerationStart() {
  return getEventName() === 'GENERATION_STARTED' && !hasEventField('breakdown');
}

function shouldCheckTransitionOnTrigger() {
  const eventName = getEventName();
  return TRANSITION_EVENTS.has(eventName);
}

function shouldHandleTrigger() {
  const eventName = getEventName();

  if (!eventName) {
    return true;
  }

  if (TRANSITION_EVENTS.has(eventName)) {
    return true;
  }

  if (!PRIME_EVENTS.has(eventName)) {
    return false;
  }

  if (eventName === 'MESSAGE_SENT') {
    return isUserMessage(data.message);
  }

  if (eventName === 'GENERATION_STARTED') {
    return isPreAssemblyGenerationStart();
  }

  if (eventName === 'CHAT_SWITCHED') {
    return true;
  }

  return isActiveChatSettingChange();
}

function transitionContent() {
  if (typeof data.content === 'string') {
    return data.content;
  }

  if (data.message && typeof data.message.content === 'string') {
    return data.message.content;
  }

  return '';
}

function transitionMessageId() {
  return asText(data.messageId) || asText(data.message && data.message.id);
}

function transitionSourceId() {
  return transitionMessageId() || asText(data.generationId);
}

function hasSceneChanged(content) {
  const text = asText(content);

  return TRANSITION_MARKERS.some((marker) => {
    const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`${escapedMarker}\\s*$`, 'i').test(text);
  });
}

function transitionEventKey(content, sourceId) {
  return [
    asText(data.chatId),
    sourceId,
    String(content.length),
    content.slice(-80),
  ].join('|');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildGreetingSelectorCss() {
  return `
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
  border-top: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
}

.ls-gi-action-row {
  padding: 0;
  border: 0;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.ls-gi-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
}

.ls-gi-body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
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
  min-height: 240px;
  max-height: min(58vh, 560px);
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

.ls-gi-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
`;
}

function buildGreetingOptions(greetings, selectedIndex) {
  return greetings
    .map((greeting) => {
      const selected = greeting.index === selectedIndex ? ' selected' : '';
      const label = `${greeting.index} - ${greeting.label}`;

      return `<option value="${greeting.index}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function buildGreetingSelectorHtml(character, greetings, selectedIndex) {
  const selectedGreeting = greetings[selectedIndex];
  const nextGreeting = greetings[selectedIndex + 1];
  const nextSceneLabel = nextGreeting
    ? `${nextGreeting.index} (${nextGreeting.label})`
    : 'none';
  const nextSceneHint = nextGreeting
    ? 'The following index is injected as the upcoming greeting target.'
    : 'This is the final greeting. Selecting it clears the upcoming greeting target and removes the transition injection.';

  return `
<div class="ls-gi-backdrop">
  <div class="ls-gi-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-gi-title">
    <div class="ls-gi-header">
      <h2 class="ls-gi-title" id="ls-gi-title">Choose active greeting</h2>
      <button class="ls-gi-button" id="ls-gi-close" type="button">Close</button>
    </div>
    <div class="ls-gi-body">
      <div class="ls-gi-meta">Active character: ${escapeHtml(character.name || '(unnamed)')}</div>
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
  </div>
</div>`;
}

function buildUpcomingOptions(greetings, activeIndex, selectedIndex) {
  return greetings
    .slice(activeIndex + 1)
    .map((greeting) => {
      const selected = greeting.index === selectedIndex ? ' selected' : '';
      const label = `${greeting.index} - ${greeting.label}`;

      return `<option value="${greeting.index}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function buildUpcomingSelectorHtml(character, greetings, activeIndex, selectedIndex) {
  const activeGreeting = greetings[activeIndex];
  const selectedGreeting = greetings[selectedIndex];

  return `
<div class="ls-gi-backdrop">
  <div class="ls-gi-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-gi-title">
    <div class="ls-gi-header">
      <h2 class="ls-gi-title" id="ls-gi-title">Choose upcoming greeting</h2>
      <button class="ls-gi-button" id="ls-gi-close" type="button">Close</button>
    </div>
    <div class="ls-gi-body">
      <div class="ls-gi-meta">Active character: ${escapeHtml(character.name || '(unnamed)')}</div>
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
  </div>
</div>`;
}

function buildManualActionHtml(character, greetings, activeIndex, upcomingIndex) {
  const activeGreeting = greetings[activeIndex];
  const upcomingGreeting = upcomingIndex === null ? null : greetings[upcomingIndex];
  const activeLabel = activeGreeting
    ? `${activeGreeting.index} (${activeGreeting.label})`
    : String(activeIndex);
  const upcomingLabel = upcomingGreeting
    ? `${upcomingGreeting.index} (${upcomingGreeting.label})`
    : 'none';
  const upcomingText = upcomingGreeting
    ? displayGreeting(upcomingGreeting.text)
    : '(no upcoming greeting)';

  return `
<div class="ls-gi-backdrop">
  <div class="ls-gi-dialog" role="dialog" aria-modal="true" aria-labelledby="ls-gi-title">
    <div class="ls-gi-header">
      <h2 class="ls-gi-title" id="ls-gi-title">Greeting inspector</h2>
      <button class="ls-gi-button" id="ls-gi-action-cancel" type="button">Close</button>
    </div>
    <div class="ls-gi-body">
      <div class="ls-gi-meta">Active character: ${escapeHtml(character.name || '(unnamed)')}</div>
      <div class="ls-gi-meta">Active greeting: ${escapeHtml(activeLabel)}</div>
      <div class="ls-gi-meta">Upcoming greeting: ${escapeHtml(upcomingLabel)}</div>
      <div class="ls-gi-footer ls-gi-action-row">
        <button class="ls-gi-button ls-gi-button-primary" id="ls-gi-action-active" type="button">Active</button>
        <button class="ls-gi-button ls-gi-button-primary" id="ls-gi-action-upcoming" type="button"${upcomingGreeting ? '' : ' disabled'}>Next</button>
        <button class="ls-gi-button" id="ls-gi-action-force" type="button"${upcomingGreeting ? '' : ' disabled'}>Force</button>
        <button class="ls-gi-button" id="ls-gi-action-refresh" type="button">Refresh</button>
      </div>
      <div class="ls-gi-viewer" aria-label="Upcoming greeting content">
        <pre class="ls-gi-greeting">${escapeHtml(upcomingText)}</pre>
      </div>
    </div>
  </div>
</div>`;
}

function buildStatusCss() {
  return `
.ls-gi-status {
  position: fixed;
  right: 16px;
  bottom: 84px;
  z-index: 2147483000;
  width: min(360px, calc(100vw - 32px));
  color: var(--lumiverse-text, #f5f5f5);
  font-family: inherit;
  pointer-events: auto;
}

.ls-gi-status[data-collapsed="true"] {
  right: 16px;
  bottom: 16px;
  width: auto;
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

.ls-gi-status[data-collapsed="true"] .ls-gi-status-pill,
.ls-gi-status[data-collapsed="true"] .ls-gi-status-popover {
  display: none;
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

.ls-gi-status-active {
  background: var(--lumiverse-button-bg, rgba(255, 255, 255, 0.1));
  border-color: var(--lumiverse-border, rgba(255, 255, 255, 0.18));
}

.ls-gi-status-collapse {
  width: 28px;
  min-height: 28px;
  padding: 0;
  color: var(--lumiverse-text, #f5f5f5);
  background: transparent;
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 6px;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.ls-gi-status-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ls-gi-status-popover {
  display: none;
  margin-top: 8px;
  max-height: min(56vh, 440px);
  overflow: auto;
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 8px;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);
}

.ls-gi-status:hover .ls-gi-status-popover,
.ls-gi-status[data-expanded="true"] .ls-gi-status-popover {
  display: block;
}

.ls-gi-status[data-collapsed="true"]:hover .ls-gi-status-popover,
.ls-gi-status[data-collapsed="true"][data-expanded="true"] .ls-gi-status-popover {
  display: none;
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

.ls-gi-status-restore {
  display: none;
  min-width: 52px;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  padding: 8px 10px;
  color: var(--lumiverse-text, #f5f5f5);
  background: var(--lumiverse-bg-elevated, #181818);
  border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.18));
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}

.ls-gi-status[data-collapsed="true"] .ls-gi-status-restore {
  display: flex;
}
`;
}

function buildStatusHtml(character, greetings, activeIndex, upcomingIndex, expanded, collapsed) {
  const activeGreeting = greetings[activeIndex];
  const upcomingGreeting = upcomingIndex === null ? null : greetings[upcomingIndex];
  const activeLabel = activeGreeting
    ? `${activeGreeting.index} (${activeGreeting.label})`
    : String(activeIndex);
  const upcomingLabel = upcomingGreeting
    ? `${upcomingGreeting.index} (${upcomingGreeting.label})`
    : 'none';
  const upcomingText = upcomingGreeting
    ? displayGreeting(upcomingGreeting.text)
    : '(no upcoming greeting)';

  return `
<div class="ls-gi-status" data-expanded="${expanded ? 'true' : 'false'}" data-collapsed="${collapsed ? 'true' : 'false'}" role="button" tabindex="0">
  <div class="ls-gi-status-pill">
    <div class="ls-gi-status-main">
      <div class="ls-gi-status-kicker">Active greeting index</div>
      <div class="ls-gi-status-value">${escapeHtml(activeLabel)}</div>
    </div>
    <div class="ls-gi-status-actions">
      <div class="ls-gi-status-next">Next: ${escapeHtml(upcomingLabel)}</div>
      <div class="ls-gi-status-buttons">
        <button class="ls-gi-status-button ls-gi-status-active" id="${STATUS_ACTIVE_BUTTON_ID}" type="button">Active</button>
        <button class="ls-gi-status-button" id="${STATUS_PICK_BUTTON_ID}" type="button"${upcomingGreeting ? '' : ' disabled'}>Next</button>
        <button class="ls-gi-status-button" id="${STATUS_FORCE_BUTTON_ID}" type="button" title="Force transition and insert the upcoming greeting"${upcomingGreeting ? '' : ' disabled'}>Force</button>
        <button class="ls-gi-status-collapse" id="${STATUS_COLLAPSE_BUTTON_ID}" type="button" aria-label="Collapse greeting widget">_</button>
      </div>
    </div>
  </div>
  <button class="ls-gi-status-restore" id="${STATUS_RESTORE_BUTTON_ID}" type="button" aria-label="Restore greeting widget">GI</button>
  <div class="ls-gi-status-popover">
    <div class="ls-gi-status-popover-header">Upcoming greeting for ${escapeHtml(character.name || '(unnamed)')}</div>
    <pre class="ls-gi-status-greeting">${escapeHtml(upcomingText)}</pre>
  </div>
</div>`;
}

function buildAuthorNote(nextGreeting) {
  return `[SCENE END CONTROL]

USER OVERRIDE:
If the user's latest reply contains ((override)), immediately make a best-effort attempt to close the current scene.

SCENE PACING:
An upcoming narrative segment exists, but it is only a private target for pacing and story direction. Progress toward a point where that upcoming beat would fit naturally through believable character behavior, emotional logic, and scene momentum.

Do not stall indefinitely.
Do not rush.
When uncertain, keep the current scene going.
End the scene only when the story has clearly reached a natural breakpoint where the upcoming narrative segment would fit cleanly afterward.

MINIMUM TURN REQUIREMENT:
Do not end the current scene until this narrative segment has been active for at least 4 assistant replies.
This minimum is mandatory unless the user uses ((override)).

UPCOMING SCENE HANDLING:
Use the upcoming narrative segment only as a private target for deciding when the current scene is ready to end.
Do not quote, summarize, paraphrase, adapt, preview, blend, or reuse any part of it.
Do not use its URLs, images, formatting, headings, or exact details.

VALID SCENE END POINTS:
End the current scene only at a clean narrative breakpoint, such as:
- scene closure
- end-of-day or time jump
- location shift
- completed emotional beat
- settled pause
- shift in attention
- natural phase break

When ending the scene, stop at that breakpoint.
Do not introduce new complications.
Do not begin or preview the upcoming narrative segment.

FINAL LINE REQUIREMENT:
If and only if ending the scene, write the final non-whitespace line as exactly:

${GREETING_TRANSITION_MARKER}

After the marker, stop immediately.
Do not add objects, trackers, hidden blocks, notes, or any other text after it.
The marker must be the absolute final line and overrides all other formatting instructions.

UPCOMING NARRATIVE SEGMENT, FOR TIMING ONLY:
${nextGreeting}`;
}

async function getActiveChat() {
  const activeChat = await api.chats.getActive();

  if (activeChat) {
    return activeChat;
  }

  const chatId = await api.chat.getChatId();

  return chatId ? api.chats.get(chatId) : null;
}

async function removeInjectedNote() {
  try {
    await api.chat.removeInjection(INJECTION_ID);
  } catch {
    // Removing a missing injection is best-effort.
  }
}

async function removeStatusUi() {
  if (!api.ui.dom || !api.ui.dom.cleanup) {
    return;
  }

  try {
    await api.ui.dom.cleanup();
  } catch {
    // UI cleanup is best-effort; the prompt injection state is independent.
  }
}

async function readStatusCollapsed() {
  const hasStoredValue = await api.variables.character.has(STATUS_COLLAPSED_VAR);
  const stored = await api.variables.character.get(STATUS_COLLAPSED_VAR, false);
  const collapsed = asBoolean(stored);

  if (!hasStoredValue || stored !== collapsed) {
    await api.variables.character.set(STATUS_COLLAPSED_VAR, collapsed);
  }

  return collapsed;
}

async function writeStatusCollapsed(collapsed) {
  const normalizedValue = Boolean(collapsed);
  await api.variables.character.set(STATUS_COLLAPSED_VAR, normalizedValue);
  return normalizedValue;
}

async function renderStatusUi(character, greetings, activeIndex, upcomingIndex, chatId) {
  if (!api.ui.dom || !api.ui.dom.inject || !api.ui.dom.addStyle || !api.ui.dom.cleanup) {
    return;
  }

  try {
    await api.ui.dom.cleanup();
    await api.ui.dom.addStyle(buildStatusCss());
    let expanded = false;
    let collapsed = await readStatusCollapsed();
    const handle = await api.ui.dom.inject('body', buildStatusHtml(character, greetings, activeIndex, upcomingIndex, expanded, collapsed), {
      id: STATUS_INJECTION_ID,
      position: 'beforeend',
    });

    handle.on('click', (event) => {
      const targetId = event.targetId || '';
      let action = '';

      if (targetId === STATUS_ACTIVE_BUTTON_ID) {
        action = 'active';
      } else if (targetId === STATUS_PICK_BUTTON_ID) {
        action = 'upcoming';
      } else if (targetId === STATUS_FORCE_BUTTON_ID) {
        action = 'force';
      } else if (targetId === STATUS_COLLAPSE_BUTTON_ID) {
        collapsed = true;
        handle.update(buildStatusHtml(character, greetings, activeIndex, upcomingIndex, expanded, collapsed));
        action = 'collapse';
      } else if (targetId === STATUS_RESTORE_BUTTON_ID) {
        collapsed = false;
        handle.update(buildStatusHtml(character, greetings, activeIndex, upcomingIndex, expanded, collapsed));
        action = 'restore';
      } else {
        expanded = !expanded;
        handle.update(buildStatusHtml(character, greetings, activeIndex, upcomingIndex, expanded, collapsed));
        return;
      }

      api.broadcast.emit(STATUS_ACTION_EVENT, { action, chatId });
    });
  } catch (error) {
    if (isManualRun()) {
      const message = error && error.message ? error.message : String(error);
      api.ui.toast(`Could not render greeting status: ${message}`, 'warning');
    }
  }
}

async function readActiveIndex(greetings) {
  const maxIndex = greetings.length - 1;
  const hasStoredIndex = await api.variables.chat.has(ACTIVE_INDEX_VAR);
  const stored = await api.variables.chat.get(ACTIVE_INDEX_VAR, 0);
  const activeIndex = clampIndex(stored, maxIndex);

  if (!hasStoredIndex || stored !== activeIndex) {
    await api.variables.chat.set(ACTIVE_INDEX_VAR, activeIndex);
  }

  return activeIndex;
}

async function writeActiveIndex(activeIndex, greetings) {
  const clampedIndex = clampIndex(activeIndex, greetings.length - 1);
  await api.variables.chat.set(ACTIVE_INDEX_VAR, clampedIndex);
  return clampedIndex;
}

async function readUpcomingIndex(activeIndex, greetings) {
  const hasStoredIndex = await api.variables.chat.has(UPCOMING_INDEX_VAR);
  const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);
  const stored = await api.variables.chat.get(UPCOMING_INDEX_VAR, fallbackIndex);
  const storedIndex = normalizeUpcomingIndex(stored, activeIndex, greetings);
  const upcomingIndex = storedIndex === null ? fallbackIndex : storedIndex;

  if (upcomingIndex === null) {
    if (hasStoredIndex) {
      await api.variables.chat.delete(UPCOMING_INDEX_VAR);
    }

    return null;
  }

  if (!hasStoredIndex || stored !== upcomingIndex) {
    await api.variables.chat.set(UPCOMING_INDEX_VAR, upcomingIndex);
  }

  return upcomingIndex;
}

async function writeUpcomingIndex(upcomingIndex, activeIndex, greetings) {
  const normalizedIndex = normalizeUpcomingIndex(upcomingIndex, activeIndex, greetings);

  if (normalizedIndex === null) {
    const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);

    if (fallbackIndex === null) {
      await api.variables.chat.delete(UPCOMING_INDEX_VAR);
      return null;
    }

    await api.variables.chat.set(UPCOMING_INDEX_VAR, fallbackIndex);
    return fallbackIndex;
  }

  await api.variables.chat.set(UPCOMING_INDEX_VAR, normalizedIndex);
  return normalizedIndex;
}

async function resetUpcomingIndex(activeIndex, greetings) {
  const fallbackIndex = defaultUpcomingIndex(activeIndex, greetings);

  if (fallbackIndex === null) {
    await api.variables.chat.delete(UPCOMING_INDEX_VAR);
    return null;
  }

  await api.variables.chat.set(UPCOMING_INDEX_VAR, fallbackIndex);
  return fallbackIndex;
}

function nextGreetingMessage(upcomingIndex, greetings) {
  return upcomingIndex === null
    ? 'No later greeting is available.'
    : `Next greeting index is ${upcomingIndex} (${greetings[upcomingIndex].label}).`;
}

async function advanceToUpcomingGreeting(activeIndex, upcomingIndex, greetings) {
  const advancedIndex = normalizeUpcomingIndex(upcomingIndex, activeIndex, greetings)
    ?? defaultUpcomingIndex(activeIndex, greetings);

  if (advancedIndex === null || advancedIndex === activeIndex) {
    const nextUpcomingIndex = await resetUpcomingIndex(activeIndex, greetings);
    return {
      activeIndex,
      upcomingIndex: nextUpcomingIndex,
      advancedIndex: null,
      insertedGreeting: false,
    };
  }

  await api.variables.chat.set(ACTIVE_INDEX_VAR, advancedIndex);

  const insertedGreeting = await insertGreetingMessage(greetings[advancedIndex]);
  const nextUpcomingIndex = await resetUpcomingIndex(advancedIndex, greetings);

  return {
    activeIndex: advancedIndex,
    upcomingIndex: nextUpcomingIndex,
    advancedIndex,
    insertedGreeting,
  };
}

async function insertGreetingMessage(greeting) {
  if (!greeting || !greeting.text || !api.chat || typeof api.chat.sendMessage !== 'function') {
    return false;
  }

  try {
    await api.chat.sendMessage(greeting.text, { role: 'assistant' });
    return true;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(`Greeting transition advanced, but the greeting could not be inserted verbatim: ${message}`, 'warning');
    return false;
  }
}

async function getLatestChatMessage() {
  if (!api.chat || typeof api.chat.getMessages !== 'function') {
    return null;
  }

  try {
    const messages = await api.chat.getMessages({ last: 1 });
    return Array.isArray(messages) && messages.length > 0 ? messages[0] : null;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(`Could not check the latest chat message for a transition marker: ${message}`, 'warning');
    return null;
  }
}

async function resolveTransitionSource() {
  const eventName = getEventName();
  const eventContent = transitionContent();
  const eventSourceId = transitionSourceId();

  if (eventName === 'MESSAGE_EDITED') {
    const latestMessage = await getLatestChatMessage();
    const latestMessageId = asText(latestMessage && latestMessage.id);
    const editedMessageId = transitionMessageId();

    if (!editedMessageId || latestMessageId !== editedMessageId) {
      return null;
    }

    return {
      content: hasSceneChanged(eventContent) ? eventContent : asText(latestMessage && latestMessage.content),
      sourceId: editedMessageId,
    };
  }

  if (hasSceneChanged(eventContent)) {
    return {
      content: eventContent,
      sourceId: eventSourceId,
    };
  }

  const latestMessage = await getLatestChatMessage();
  const latestContent = asText(latestMessage && latestMessage.content);

  if (!hasSceneChanged(latestContent)) {
    return null;
  }

  return {
    content: latestContent,
    sourceId: asText(latestMessage && latestMessage.id) || eventSourceId,
  };
}

async function advanceActiveIndexIfSceneChanged(activeIndex, upcomingIndex, greetings) {
  if (!shouldCheckTransitionOnTrigger()) {
    return { activeIndex, upcomingIndex };
  }

  const transitionSource = await resolveTransitionSource();

  if (!transitionSource || !hasSceneChanged(transitionSource.content)) {
    return { activeIndex, upcomingIndex };
  }

  const content = transitionSource.content;
  const eventKey = transitionEventKey(content, transitionSource.sourceId);
  const lastAdvancedEvent = await api.variables.chat.get(LAST_ADVANCED_EVENT_VAR, '');

  if (lastAdvancedEvent === eventKey) {
    return { activeIndex, upcomingIndex };
  }

  await api.variables.chat.set(LAST_ADVANCED_EVENT_VAR, eventKey);

  const result = await advanceToUpcomingGreeting(activeIndex, upcomingIndex, greetings);

  if (result.advancedIndex === null) {
    return {
      activeIndex: result.activeIndex,
      upcomingIndex: result.upcomingIndex,
    };
  }

  const advancedIndex = result.advancedIndex;
  const insertMessage = result.insertedGreeting
    ? 'Inserted the greeting verbatim.'
    : 'The greeting was not inserted automatically.';

  api.ui.toast(`Greeting transition advanced to ${advancedIndex} (${greetings[advancedIndex].label}). ${insertMessage} ${nextGreetingMessage(result.upcomingIndex, greetings)}`, 'success');
  return {
    activeIndex: result.activeIndex,
    upcomingIndex: result.upcomingIndex,
  };
}

async function injectNextSceneNote(upcomingIndex, greetings) {
  const nextGreeting = upcomingIndex === null ? null : greetings[upcomingIndex];

  if (!nextGreeting || !nextGreeting.text) {
    await removeInjectedNote();
    return false;
  }

  await removeInjectedNote();

  await api.chat.inject(INJECTION_ID, buildAuthorNote(nextGreeting.text), {
    mode: 'intercept',
    role: 'user',
    depth: 0,
    ephemeral: true,
  });

  return true;
}

async function promptForActiveGreetingFallback(character, greetings, initialIndex) {
  const maxActiveIndex = greetings.length - 1;
  let selectedIndex = clampIndex(initialIndex, maxActiveIndex);

  while (true) {
    const nextGreeting = greetings[selectedIndex + 1];
    const nextSceneSource = nextGreeting
      ? `${nextGreeting.index} (${nextGreeting.label})`
      : 'none';

    const input = await api.ui.prompt([
      `Active character: ${character.name}`,
      `Selected active greeting: ${selectedIndex} (${greetings[selectedIndex].label})`,
      `Next greeting source: ${nextSceneSource}`,
      '',
      'Leave blank to select. Type n, p, or a number to change selection.',
      '',
      'CURRENTLY SELECTED GREETING:',
      displayGreeting(greetings[selectedIndex].text),
    ].join('\n'), '', {
      placeholder: `blank=select, n, p, or 0-${maxActiveIndex}`,
      submitLabel: 'Select shown',
      cancelLabel: 'Cancel',
    });

    if (input === null) {
      return null;
    }

    const command = input.trim().toLowerCase();

    if (!command || command === 's' || command === 'select') {
      return selectedIndex;
    }

    if (command === 'n' || command === 'next') {
      selectedIndex = selectedIndex >= maxActiveIndex ? 0 : selectedIndex + 1;
      continue;
    }

    if (command === 'p' || command === 'prev' || command === 'previous') {
      selectedIndex = selectedIndex <= 0 ? maxActiveIndex : selectedIndex - 1;
      continue;
    }

    if (!/^\d+$/.test(command)) {
      api.ui.toast('Enter blank to select, n, p, or a valid greeting number.', 'warning');
      continue;
    }

    const activeIndex = Number.parseInt(command, 10);

    if (activeIndex < 0 || activeIndex > maxActiveIndex) {
      api.ui.toast(`Choose a number from 0 to ${maxActiveIndex}.`, 'warning');
      continue;
    }

    selectedIndex = activeIndex;
  }
}

async function promptForActiveGreeting(character, greetings, initialIndex) {
  if (!api.ui.dom || !api.ui.dom.inject || !api.ui.dom.addStyle) {
    api.ui.toast('App manipulation is unavailable; using the text prompt selector.', 'warning');
    return promptForActiveGreetingFallback(character, greetings, initialIndex);
  }

  const maxActiveIndex = greetings.length - 1;
  let selectedIndex = clampIndex(initialIndex, maxActiveIndex);
  let handle = null;
  let styleHandle = null;
  const unsubscribers = [];

  function render() {
    handle.update(buildGreetingSelectorHtml(character, greetings, selectedIndex));
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
    if (api.ui.dom.cleanup) {
      await api.ui.dom.cleanup();
    }

    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    handle = await api.ui.dom.inject('body', buildGreetingSelectorHtml(character, greetings, selectedIndex), {
      id: SELECTOR_INJECTION_ID,
      position: 'beforeend',
    });
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(`Could not open dropdown selector: ${message}. Using text prompt selector.`, 'warning');
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

    unsubscribers.push(handle.on('change', (event) => {
      if (event.targetId !== 'ls-gi-greeting-select') {
        return;
      }

      const nextIndex = Number.parseInt(event.targetValue, 10);

      if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= greetings.length) {
        return;
      }

      selectedIndex = nextIndex;
      render();
    }));

    unsubscribers.push(handle.on('click', (event) => {
      if (event.targetId === 'ls-gi-cancel' || event.targetId === 'ls-gi-close') {
        finish(null);
        return;
      }

      if (event.targetId === 'ls-gi-use') {
        finish(selectedIndex);
      }
    }));
  });
}

async function promptForUpcomingGreetingFallback(character, greetings, activeIndex, initialIndex) {
  const minUpcomingIndex = activeIndex + 1;
  const maxUpcomingIndex = greetings.length - 1;

  if (minUpcomingIndex > maxUpcomingIndex) {
    api.ui.toast('There is no later greeting to use as the upcoming greeting target.', 'warning');
    return null;
  }

  let selectedIndex = normalizeUpcomingIndex(initialIndex, activeIndex, greetings) ?? minUpcomingIndex;

  while (true) {
    const input = await api.ui.prompt([
      `Active character: ${character.name}`,
      `Current active greeting: ${activeIndex} (${greetings[activeIndex].label})`,
      `Selected upcoming greeting: ${selectedIndex} (${greetings[selectedIndex].label})`,
      '',
      'Leave blank to select. Type n, p, or a greeting number to change selection.',
      '',
      'UPCOMING GREETING:',
      displayGreeting(greetings[selectedIndex].text),
    ].join('\n'), '', {
      placeholder: `blank=select, n, p, or ${minUpcomingIndex}-${maxUpcomingIndex}`,
      submitLabel: 'Select upcoming',
      cancelLabel: 'Cancel',
    });

    if (input === null) {
      return null;
    }

    const command = input.trim().toLowerCase();

    if (!command || command === 's' || command === 'select') {
      return selectedIndex;
    }

    if (command === 'n' || command === 'next') {
      selectedIndex = selectedIndex >= maxUpcomingIndex ? minUpcomingIndex : selectedIndex + 1;
      continue;
    }

    if (command === 'p' || command === 'prev' || command === 'previous') {
      selectedIndex = selectedIndex <= minUpcomingIndex ? maxUpcomingIndex : selectedIndex - 1;
      continue;
    }

    const nextIndex = normalizeUpcomingIndex(command, activeIndex, greetings);

    if (nextIndex === null) {
      api.ui.toast(`Choose a number from ${minUpcomingIndex} to ${maxUpcomingIndex}.`, 'warning');
      continue;
    }

    selectedIndex = nextIndex;
  }
}

async function promptForUpcomingGreeting(character, greetings, activeIndex, initialIndex) {
  const minUpcomingIndex = activeIndex + 1;
  const maxUpcomingIndex = greetings.length - 1;

  if (minUpcomingIndex > maxUpcomingIndex) {
    api.ui.toast('There is no later greeting to use as the upcoming greeting target.', 'warning');
    return null;
  }

  if (!api.ui.dom || !api.ui.dom.inject || !api.ui.dom.addStyle) {
    api.ui.toast('App manipulation is unavailable; using the text prompt selector.', 'warning');
    return promptForUpcomingGreetingFallback(character, greetings, activeIndex, initialIndex);
  }

  let selectedIndex = normalizeUpcomingIndex(initialIndex, activeIndex, greetings) ?? minUpcomingIndex;
  let handle = null;
  let styleHandle = null;
  const unsubscribers = [];

  function render() {
    handle.update(buildUpcomingSelectorHtml(character, greetings, activeIndex, selectedIndex));
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
    if (api.ui.dom.cleanup) {
      await api.ui.dom.cleanup();
    }

    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    handle = await api.ui.dom.inject('body', buildUpcomingSelectorHtml(character, greetings, activeIndex, selectedIndex), {
      id: SELECTOR_INJECTION_ID,
      position: 'beforeend',
    });
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(`Could not open upcoming greeting picker: ${message}. Using text prompt selector.`, 'warning');
    return promptForUpcomingGreetingFallback(character, greetings, activeIndex, initialIndex);
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

    unsubscribers.push(handle.on('change', (event) => {
      if (event.targetId !== 'ls-gi-upcoming-select') {
        return;
      }

      const nextIndex = normalizeUpcomingIndex(event.targetValue, activeIndex, greetings);

      if (nextIndex === null) {
        return;
      }

      selectedIndex = nextIndex;
      render();
    }));

    unsubscribers.push(handle.on('click', (event) => {
      if (event.targetId === 'ls-gi-cancel' || event.targetId === 'ls-gi-close') {
        finish(null);
        return;
      }

      if (event.targetId === 'ls-gi-use') {
        finish(selectedIndex);
      }
    }));
  });
}

async function promptForManualAction(character, greetings, activeIndex, upcomingIndex) {
  const hasUpcoming = upcomingIndex !== null && greetings[upcomingIndex];

  if (!api.ui.dom || !api.ui.dom.inject || !api.ui.dom.addStyle) {
    if (await api.ui.confirm('Set the active greeting?', 'Greeting inspector', {
      confirmLabel: 'Active',
      cancelLabel: hasUpcoming ? 'More' : 'Refresh',
    })) {
      return 'active';
    }

    if (!hasUpcoming) {
      return 'refresh';
    }

    if (await api.ui.confirm('Choose the upcoming greeting?', 'Greeting inspector', {
      confirmLabel: 'Next',
      cancelLabel: 'More',
    })) {
      return 'upcoming';
    }

    if (await api.ui.confirm('Force the current upcoming greeting now?', 'Greeting inspector', {
      confirmLabel: 'Force',
      cancelLabel: 'Refresh',
      variant: 'warning',
    })) {
      return 'force';
    }

    return 'refresh';
  }

  let handle = null;
  let styleHandle = null;
  const unsubscribers = [];

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
    if (api.ui.dom.cleanup) {
      await api.ui.dom.cleanup();
    }

    styleHandle = await api.ui.dom.addStyle(buildGreetingSelectorCss());
    handle = await api.ui.dom.inject('body', buildManualActionHtml(character, greetings, activeIndex, upcomingIndex), {
      id: SELECTOR_INJECTION_ID,
      position: 'beforeend',
    });
  } catch (error) {
    removeInjectedUi();
    const message = error && error.message ? error.message : String(error);
    api.ui.toast(`Could not open greeting inspector controls: ${message}.`, 'warning');
    return null;
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

    unsubscribers.push(handle.on('click', (event) => {
      if (event.targetId === 'ls-gi-action-cancel') {
        finish(null);
        return;
      }

      if (event.targetId === 'ls-gi-action-active') {
        finish('active');
        return;
      }

      if (event.targetId === 'ls-gi-action-upcoming' && hasUpcoming) {
        finish('upcoming');
        return;
      }

      if (event.targetId === 'ls-gi-action-force' && hasUpcoming) {
        finish('force');
        return;
      }

      if (event.targetId === 'ls-gi-action-refresh') {
        finish('refresh');
      }
    }));
  });
}

function registerStatusActionHandler(character, greetings, activeIndex, upcomingIndex, chatId) {
  if (!api.broadcast || typeof api.broadcast.on !== 'function') {
    return null;
  }

  let currentActiveIndex = activeIndex;
  let currentUpcomingIndex = upcomingIndex;

  function repaint() {
    return renderStatusUi(character, greetings, currentActiveIndex, currentUpcomingIndex, chatId);
  }

  return api.broadcast.on(STATUS_ACTION_EVENT, (payload) => {
    void (async () => {
      const action = asText(payload && payload.action);
      const payloadChatId = asText(payload && payload.chatId);

      if (payloadChatId && chatId && payloadChatId !== chatId) {
        return;
      }

      if (action === 'collapse') {
        await writeStatusCollapsed(true);
        await repaint();
        return;
      }

      if (action === 'restore') {
        await writeStatusCollapsed(false);
        await repaint();
        return;
      }

      if (action === 'active') {
        const selectedIndex = await promptForActiveGreeting(character, greetings, currentActiveIndex);

        if (selectedIndex === null) {
          await repaint();
          return;
        }

        currentActiveIndex = await writeActiveIndex(selectedIndex, greetings);
        currentUpcomingIndex = await resetUpcomingIndex(currentActiveIndex, greetings);
        await injectNextSceneNote(currentUpcomingIndex, greetings);
        await repaint();

        if (currentUpcomingIndex === null) {
          api.ui.toast(`Active greeting set to ${currentActiveIndex} (${greetings[currentActiveIndex].label}). No later greeting is available.`, 'success');
          return;
        }

        api.ui.toast(`Active greeting set to ${currentActiveIndex} (${greetings[currentActiveIndex].label}); next is ${currentUpcomingIndex} (${greetings[currentUpcomingIndex].label}).`, 'success');
        return;
      }

      if (action === 'upcoming') {
        const selectedIndex = await promptForUpcomingGreeting(character, greetings, currentActiveIndex, currentUpcomingIndex);

        if (selectedIndex === null) {
          await repaint();
          return;
        }

        currentUpcomingIndex = await writeUpcomingIndex(selectedIndex, currentActiveIndex, greetings);

        if (currentUpcomingIndex === null) {
          await repaint();
          api.ui.toast('There is no later greeting to use as the upcoming greeting target.', 'warning');
          return;
        }

        await injectNextSceneNote(currentUpcomingIndex, greetings);
        await repaint();
        api.ui.toast(`Upcoming greeting set to ${currentUpcomingIndex} (${greetings[currentUpcomingIndex].label}).`, 'success');
        return;
      }

      if (action === 'force') {
        const result = await advanceToUpcomingGreeting(currentActiveIndex, currentUpcomingIndex, greetings);

        currentActiveIndex = result.activeIndex;
        currentUpcomingIndex = result.upcomingIndex;
        await injectNextSceneNote(currentUpcomingIndex, greetings);
        await repaint();

        if (result.advancedIndex === null) {
          api.ui.toast('There is no later greeting to force.', 'warning');
          return;
        }

        const insertMessage = result.insertedGreeting
          ? 'Inserted the greeting into chat.'
          : 'The greeting was not inserted automatically.';

        api.ui.toast(`Forced greeting transition to ${result.advancedIndex} (${greetings[result.advancedIndex].label}). ${insertMessage} ${nextGreetingMessage(result.upcomingIndex, greetings)}`, 'success');
      }
    })().catch((error) => {
      const message = error && error.message ? error.message : String(error);
      api.ui.toast(`Greeting picker failed: ${message}`, 'warning');
    });
  });
}

async function main() {
  const manualRun = isManualRun();

  if (!shouldHandleTrigger()) {
    return;
  }

  if (isActiveChatClose()) {
    await removeInjectedNote();
    await removeStatusUi();
    return;
  }

  const activeChat = await getActiveChat();

  if (!activeChat) {
    await removeInjectedNote();
    await removeStatusUi();

    if (manualRun) {
      api.ui.toast('No active chat found.', 'warning');
    }

    return;
  }

  if (!manualRun) {
    const triggeredChatId = eventChatId();

    if (triggeredChatId && triggeredChatId !== activeChat.id) {
      return;
    }
  }

  if (!activeChat.characterId) {
    await removeInjectedNote();
    await removeStatusUi();

    if (manualRun) {
      api.ui.toast('The active chat does not have an associated character.', 'warning');
    }

    return;
  }

  const character = await api.characters.get(activeChat.characterId);

  if (!character) {
    await removeInjectedNote();
    await removeStatusUi();

    if (manualRun) {
      api.ui.toast('Could not load the active chat character.', 'warning');
    }

    return;
  }

  const alternateGreetings = Array.isArray(character.alternateGreetings)
    ? character.alternateGreetings
    : [];
  const greetings = [
    { index: 0, label: greetingLabel(0), text: asText(character.firstMessage) },
    ...alternateGreetings.map((text, alternateIndex) => ({
      index: alternateIndex + 1,
      label: greetingLabel(alternateIndex + 1),
      text: asText(text),
    })),
  ];

  if (greetings.length < 2) {
    await removeInjectedNote();
    await removeStatusUi();

    if (manualRun) {
      api.ui.toast('This character has no alternate greeting to use as the next scene.', 'warning');
    }

    return;
  }

  let activeIndex = await readActiveIndex(greetings);
  let upcomingIndex = await readUpcomingIndex(activeIndex, greetings);
  const advancedState = await advanceActiveIndexIfSceneChanged(activeIndex, upcomingIndex, greetings);
  activeIndex = advancedState.activeIndex;
  upcomingIndex = advancedState.upcomingIndex;

  async function renderAndRegisterStatus() {
    await renderStatusUi(character, greetings, activeIndex, upcomingIndex, activeChat.id);
    registerStatusActionHandler(character, greetings, activeIndex, upcomingIndex, activeChat.id);
  }

  let manualAction = null;
  let forceResult = null;

  if (manualRun) {
    manualAction = await promptForManualAction(character, greetings, activeIndex, upcomingIndex);

    if (manualAction === null) {
      await renderAndRegisterStatus();
      api.ui.toast('Greeting inspector cancelled.', 'warning');
      return;
    }

    if (manualAction === 'active') {
      const selectedIndex = await promptForActiveGreeting(character, greetings, activeIndex);

      if (selectedIndex === null) {
        await renderAndRegisterStatus();
        api.ui.toast('Greeting inspector cancelled.', 'warning');
        return;
      }

      activeIndex = await writeActiveIndex(selectedIndex, greetings);
      upcomingIndex = await resetUpcomingIndex(activeIndex, greetings);
    }

    if (manualAction === 'upcoming') {
      const selectedIndex = await promptForUpcomingGreeting(character, greetings, activeIndex, upcomingIndex);

      if (selectedIndex === null) {
        await renderAndRegisterStatus();
        api.ui.toast('Greeting inspector cancelled.', 'warning');
        return;
      }

      upcomingIndex = await writeUpcomingIndex(selectedIndex, activeIndex, greetings);
    }

    if (manualAction === 'force') {
      forceResult = await advanceToUpcomingGreeting(activeIndex, upcomingIndex, greetings);
      activeIndex = forceResult.activeIndex;
      upcomingIndex = forceResult.upcomingIndex;
    }
  }

  const injected = await injectNextSceneNote(upcomingIndex, greetings);
  await renderAndRegisterStatus();

  if (!manualRun) {
    return;
  }

  if (manualAction === 'force') {
    if (forceResult.advancedIndex === null) {
      api.ui.toast('There is no later greeting to force.', 'warning');
      return;
    }

    const insertMessage = forceResult.insertedGreeting
      ? 'Inserted the greeting into chat.'
      : 'The greeting was not inserted automatically.';

    api.ui.toast(`Forced greeting transition to ${forceResult.advancedIndex} (${greetings[forceResult.advancedIndex].label}). ${insertMessage} ${nextGreetingMessage(forceResult.upcomingIndex, greetings)}`, 'success');
    return;
  }

  if (!injected) {
    if (upcomingIndex === null) {
      api.ui.toast(`Stored active greeting index ${activeIndex}; no later greeting is available, so the transition injection was removed.`, 'success');
      return;
    }

    const missingIndex = upcomingIndex === null ? activeIndex + 1 : upcomingIndex;
    api.ui.toast(`Greeting ${missingIndex} is empty or unavailable, so no note was injected.`, 'warning');
    return;
  }

  if (manualAction === 'upcoming') {
    api.ui.toast(`Stored upcoming greeting index ${upcomingIndex}; injected context from ${greetings[upcomingIndex].label}.`, 'success');
    return;
  }

  if (manualAction === 'refresh') {
    api.ui.toast(`Greeting inspector refreshed; injected upcoming-greeting context from ${greetings[upcomingIndex].label}.`, 'success');
    return;
  }

  api.ui.toast(`Stored active greeting index ${activeIndex}; injected upcoming-greeting context from ${greetings[upcomingIndex].label}.`, 'success');
}

try {
  await main();
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  api.ui.toast(`Greeting inspector failed: ${message}`, 'warning');
}
