# LumiScript Reference

*Exported 2026-05-02*

---

## Lumiverse Events

| Event | Group | Payload shape |
| --- | --- | --- |
| `ls:startup` | LumiScript | `{ __event: "ls:startup" }` |
| `ls:teardown` | LumiScript | `{ reason: 'disabled' | 'deleted', scriptId, scriptName }` |
| `MESSAGE_SENT` | Chat | `{ chatId, message }` |
| `MESSAGE_EDITED` | Chat | `{ chatId, message }` |
| `MESSAGE_DELETED` | Chat | `{ chatId, messageId }` |
| `MESSAGE_SWIPED` | Chat | `{ chatId, message, action, swipeId, previousSwipeId? }` |
| `SWIPE_EDITED` | Chat | `{ chatId, message, previousSwipeId }` |
| `CHARACTER_MESSAGE_RENDERED` | Chat | `{ chatId, messageId }` |
| `USER_MESSAGE_RENDERED` | Chat | `{ chatId, messageId }` |
| `GENERATION_STARTED` | Generation | `{ generationId, chatId, model }` |
| `GENERATION_ENDED` | Generation | `{ generationId, chatId, messageId, content }` |
| `GENERATION_STOPPED` | Generation | `{ generationId, chatId, content }` |
| `STREAM_TOKEN_RECEIVED` | Generation | `{ generationId, chatId, token }` |
| `CHAT_CHANGED` | Entities | `{ chatId }` |
| `CHAT_SWITCHED` | Entities | `{ chatId: string | null }  // null on return-to-home` |
| `CHARACTER_EDITED` | Entities | `{ id, character }` |
| `CHARACTER_DELETED` | Entities | `{ id }` |
| `CHARACTER_DUPLICATED` | Entities | `{ id, newId }` |
| `PERSONA_CHANGED` | Entities | `{ persona }` |
| `SETTINGS_UPDATED` | Settings | `{ key, value }` |
| `PRESET_CHANGED` | Settings | `{ presetId }` |
| `CONNECTION_PROFILE_LOADED` | Settings | `{ connectionId }` |
| `WORLD_INFO_ACTIVATED` | Settings | `{ entries }` |
| `TOOL_INVOCATION` | Tools | `{ toolName, requestId, args }` |

---

## Permission Matrix

### Chat

| Method | Required permissions |
| --- | --- |
| `api.chat.getMessages` | `chat_mutation` |
| `api.chat.sendMessage` | `chat_mutation` |
| `api.chat.editMessage` | `chat_mutation` |
| `api.chat.deleteMessage` | `chat_mutation` |
| `api.chat.getChatId` | *none* |
| `api.chat.getMetadata` | `chats` |
| `api.chat.setMetadata` | `chats` |
| `api.chat.inject` | `interceptor` |
| `api.chat.removeInjection` | *none* |
| `api.chat.getInjections` | *none* |
| `api.chat.clearInjections` | `interceptor` |
| `api.chat.clearAllInjections` | `interceptor` + allowDangerous |
| `api.chat.setMessageHidden` | `chat_mutation` |
| `api.chat.setMessagesHidden` | `chat_mutation` |
| `api.chat.isMessageHidden` | `chat_mutation` |
| `api.chat.registerContentProcessor` | `chat_mutation` |
| `api.chat.listContentProcessors` | *none* |

### LLM

| Method | Required permissions |
| --- | --- |
| `api.llm.generate` | `generation` |
| `api.llm.generateStructured` | `generation` |
| `api.llm.generateWithTools` | `generation` |
| `api.llm.dryRun` | `generation` |

### Variables / JSON / Utils

| Method | Required permissions |
| --- | --- |
| `api.variables.*` | *none* |
| `api.json.*` | *none* |
| `api.utils.uuid / shortId / wait` | *none* |
| `api.utils.random.*` | *none* |
| `api.utils.template.*` | *none* |
| `api.utils.macros.resolve` | *none* |
| `api.utils.image.*` | *none* |
| `api.utils.http.*` | `cors_proxy` + allowDangerous |

### UI

| Method | Required permissions |
| --- | --- |
| `api.ui.toast` | *none* |
| `api.ui.prompt` | *none* |
| `api.ui.confirm` | *none* |
| `api.ui.showModal` | *none* |
| `api.ui.showAdvancedModal` | `app_manipulation` |
| `api.ui.editText` | *none* |
| `api.ui.pushNotification` | `push_notification` |
| `api.ui.getPushStatus` | `push_notification` |
| `api.ui.createFloatWidget` | `ui_panels` |
| `api.ui.dom.*` | `app_manipulation` |

### Files

| Method | Required permissions |
| --- | --- |
| `api.files.user*` | allowDangerous |
| `api.files.shared*` | allowDangerous |
| `api.files.temp*` | `ephemeral_storage` + allowDangerous |

### Entity APIs

| Method | Required permissions |
| --- | --- |
| `api.characters.*` | `characters` |
| `api.chats.*` | `chats` |
| `api.worldInfo.*` | `world_books` |
| `api.personas.*` | `personas` |
| `api.council.*` | free tier, read-only |

### Tools & Broadcast

| Method | Required permissions |
| --- | --- |
| `api.tools.*` | `tools` |
| `api.macros.register / updateValue / unregister / list` | *none* |
| `api.macros.registerInterceptor` | `macro_interceptor` |
| `api.macros.listInterceptors` | *none* |
| `api.broadcast.*` | *none* |
| `api.commands.*` | *none* |
| `api.events.*` | `event_tracking` |
| `api.tokens.*` | *none* |
| `api.db.*` | *none* |

---

## LumiScript Events

| Event | Payload fields | Emitted by |
| --- | --- | --- |
| `ls:tool:registered` | `{ name, scriptId }` | api.tools.register() |
| `ls:tool:unregistered` | `{ name, scriptId }` | api.tools.unregister() / auto-cleanup |
| `ls:tool:invoked` | `{ name, args, result, scriptId, callMs, councilMember? }` | api.tools.invoke() + TOOL_INVOCATION handler |
| `ls:macro:registered` | `{ name, scriptId, mode: 'push' | 'pull' }` | api.macros.register() |
| `ls:macro:unregistered` | `{ name, scriptId }` | api.macros.unregister() / auto-cleanup |
| `ls:collection:created` | `{ name, scope, scriptId, path }` | api.db.collection() |
| `ls:collection:dropped` | `{ name, scope, scriptId, path, deletedCount }` | api.db.drop() |
| `ls:collection:inserted` | `{ name, scope, scriptId, id, record }` | collection.insert() |
| `ls:collection:updated` | `{ name, scope, scriptId, count, filterKind: 'all' | 'object' | 'fn' }` | collection.update() (only when count &gt; 0) |
| `ls:collection:deleted` | `{ name, scope, scriptId, count, filterKind }` | collection.delete() / clear() (clear emits count=-1) |
| `ls:collection:size-warning` | `{ name, scope, scriptId, bytes }` | auto — collection exceeds 10 MB soft threshold |

*The `ls:` prefix is reserved for LumiScript engine events. Use any other name for custom events between scripts.*

---

## LumiScript Macros

### Presence

| Macro | Aliases | Returns | Description |
| --- | --- | --- | --- |
| `{{lumiScriptActive}}` | — | `"true" / "false"` | Push-model boolean. "true" when the LumiScript master toggle is on, "false" when off. Ideal for conditional preset blocks: {{if::{{lumiScriptActive}}}}…{{/if}} |

### Character Variables

*reads/writes the active character's variable store. Write operations are silent.*

| Macro | Aliases | Returns | Description |
| --- | --- | --- | --- |
| `{{getcvar::key}}` | `{{getcharvar::key}}` | `string` | Get a character-scoped variable. Returns "" if the key is not set or there is no active character. |
| `{{setcvar::key::value}}` | `{{setcharvar::key::value}}` | *silent* | Set a character-scoped variable to value. |
| `{{addcvar::key::n}}` | `{{addcharvar::key::n}}` | *silent* | Add the number n to a character-scoped variable (treated as 0 if unset or non-numeric). |
| `{{inccvar::key}}` | — | *silent* | Increment a character-scoped variable by 1. |
| `{{deccvar::key}}` | — | *silent* | Decrement a character-scoped variable by 1. |
| `{{hascvar::key}}` | `{{hascharvar::key}}` | `"true" / "false"` | Returns "true" if the variable exists in the active character's store, "false" otherwise. |
| `{{deletecvar::key}}` | `{{deletecharvar::key}}` | *silent* | Delete a character-scoped variable. |

*Character variable macros read from and write to the active character's store at `variables/characters/<id>.json` in user storage. They resolve to `""` when no character is active.*

---

## Key Types

### ChatMessage

*Returned by api.chat.getMessages().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Message identifier. |
| `content` | `string` | Plain-text message content. |
| `role` | `'user' | 'assistant' | 'system'` | Sender role. |
| `metadata?` | `Record<string, unknown>` | Arbitrary metadata attached to the message. |
| `swipeId` | `number` | Index of the active swipe variant. 0 when the message has no alternates. |
| `swipes` | `string[]` | All swipe variants. swipes[swipeId] equals content. |
| `swipeDates` | `number[]` | Per-swipe creation timestamps (unix epoch seconds), aligned with swipes. Empty array on older hosts (pre-spindle-types 0.4.27). |
| `extra` | `Record<string, unknown>` | Host-maintained bag: reasoning text/duration, attachments, hidden flag, etc. Keys depend on host build — treat as opaque. Empty object on older hosts. |

### GetMessagesOptions

*Passed to api.chat.getMessages(options?).*

| Field | Type | Description |
| --- | --- | --- |
| `first?` | `number` | Return only the first N messages. |
| `last?` | `number` | Return only the last N messages. |

### SendMessageOptions

*Passed to api.chat.sendMessage(content, options?). HTML rendering note: a block-level element (&lt;div&gt;, &lt;section&gt;, &lt;article&gt;, etc.) whose content includes a &lt;style&gt; tag OR three or more inline style="..." attributes is auto-extracted into a Shadow DOM "island" by the host renderer. This isolates card-style rules from the chat UI and prevents markdown from corrupting interactive markup. To opt out (e.g. you need document-level click delegation, CSS cascade into surrounding DOM, or MutationObserver access from the message subtree), add data-no-island to the outer block element's opening tag. Opting out disables both style isolation AND the markdown-safety wrapper — scope your selectors with a unique class prefix and ensure markdown won't misinterpret your content. Standalone &lt;style&gt; blocks not inside a wrapper element are extracted together with subsequent sibling HTML; wrap them in &lt;div data-no-island&gt; if you need them inline.*

| Field | Type | Description |
| --- | --- | --- |
| `role?` | `'user' | 'assistant' | 'system'` | Sender role. Default 'user'. |
| `metadata?` | `Record<string, unknown>` | Arbitrary metadata to attach. |

### MessagePatch

*Passed to api.chat.editMessage(id, patch) when using the richer object form. Only fields you provide are updated. Patches touching swipes / swipeId / swipeDates fire SWIPE_EDITED alongside MESSAGE_EDITED; plain content patches fire only MESSAGE_EDITED.*

| Field | Type | Description |
| --- | --- | --- |
| `content?` | `string` | Replace the active swipe's content. |
| `metadata?` | `Record<string, unknown>` | Replace the host-maintained metadata bag. Host-side merge semantics apply. |
| `swipes?` | `string[]` | Replace the full swipes array. Length changes are expressible here. |
| `swipeId?` | `number` | Navigate to a different swipe index. Can be used alone to cycle without rewriting content. |
| `swipeDates?` | `number[]` | Replace per-swipe timestamps. Length should match swipes after the patch applies. |
| `reasoning?` | `{ text?, duration? }` | Set chain-of-thought reasoning text + duration (assistant messages). text: string \| null; duration: number \| null. |

### InjectOptions

*Passed to api.chat.inject(id, content, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `mode?` | `'intercept' | 'context'` | Default 'intercept'. 'intercept' splices post-assembly at generation time. 'context' enriches the assembler context pre-assembly. |
| `role?` | `'system' | 'user' | 'assistant'` | Message role. Default 'system'. |
| `depth?` | `number` | intercept mode only. Messages from the END to insert before. 0 = append (default). 1 = before last message. |
| `ephemeral?` | `boolean` | Auto-remove after the next generation cycle. Default false. |

### InjectionInfo

*Returned by api.chat.getInjections().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Injection identifier. |
| `content` | `string` | Injected message content. |
| `mode` | `'intercept' | 'context'` | Pipeline phase this injection targets. |
| `role` | `string` | Message role. |
| `depth` | `number` | Position from end of assembled array (intercept mode). |
| `ephemeral` | `boolean` | Whether the injection auto-removes after generation. |
| `scriptId` | `string` | ID of the script that created this injection. |

### MessageContentProcessorOptions

*Passed to api.chat.registerContentProcessor(handler, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `id?` | `string` | Stable identifier. Re-registration with the same id from the same script replaces the prior entry. Auto-generated if omitted. |
| `priority?` | `number` | Lower runs first within the LumiScript multiplexer pass. Default 100. |
| `origin?` | `MessageContentProcessorOrigin | MessageContentProcessorOrigin[]` | Restrict to specific origins. Default: all four. Pre-filtered before invocation. |
| `timeoutMs?` | `number` | Per-invocation soft timeout. Default 2000. The host's outer 10-second budget is shared across all LumiScript handlers. |

### MessageContentProcessorCtx

*Passed to a registerContentProcessor handler. All fields readonly. The host's chat_mutation permission gates this surface, but does NOT route api.chat.* mutations through the chain (loop safety).*

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | `string` | Active chat id. |
| `messageId?` | `string` | Undefined for 'create' origins (the row doesn't exist yet). |
| `content` | `string` | Current content (already transformed by any earlier processors in the chain). |
| `extra?` | `Record<string, unknown>` | Current extra map (initial.extra + delta-so-far from prior processors). Threaded through the chain even on swipe origins. |
| `origin` | `'create' | 'update' | 'swipe_add' | 'swipe_update'` | Which write path triggered this invocation. 'create' includes auto-greetings. |
| `swipeIndex?` | `number` | Set for 'swipe_update' only — zero-based index of the swipe being rewritten. |
| `userId` | `string` | Owning user id for the write. |

### MessageContentProcessorResult

*Return value of a registerContentProcessor handler. Return undefined / void to pass through, or a partial patch. content replaces the stored content. extra shallow-merges into existing — keys you omit are PRESERVED. extra is IGNORED on swipe origins (swipes share the parent message's extra). Return ONLY keys you mutated; pristine initial.extra keys are NOT round-tripped to avoid re-stamping unchanged keys on every write.*

| Field | Type | Description |
| --- | --- | --- |
| `content?` | `string` | Replaces the stored content for downstream processors and the DB write. |
| `extra?` | `Record<string, unknown>` | Delta keys to shallow-merge. Ignored on swipe origins. |

### MacroInterceptorOptions

*Passed to api.macros.registerInterceptor(handler, options?). Pre-filters short-circuit before the handler runs.*

| Field | Type | Description |
| --- | --- | --- |
| `id?` | `string` | Stable identifier. Re-registration with the same id from the same script replaces the prior entry. Auto-generated if omitted. |
| `priority?` | `number` | Lower runs first. Default 100. |
| `phase?` | `MacroInterceptorPhase | MacroInterceptorPhase[]` | Restrict to specific evaluation phases. Default: all of 'prompt', 'display', 'response', 'other'. |
| `matchTemplate?` | `string | string[] | RegExp` | Pre-filter on template content. string = simple includes() check; string[] = any-of; RegExp = test. Most common: gating on a macro family namespace like '{{tracker.'. |
| `timeoutMs?` | `number` | Per-invocation soft timeout. Default 2000. The host's outer 10-second budget is shared across all LumiScript handlers. |

### MacroInterceptorCtx

*Passed to a registerInterceptor handler. All fields readonly. The handler receives the CURRENT raw template (already transformed by any earlier interceptors in the chain) and returns either a transformed template string or void to pass through.*

| Field | Type | Description |
| --- | --- | --- |
| `template` | `string` | Current raw template (post earlier-handler transforms). |
| `env` | `MacroInterceptorEnv` | Read-only structured-clone snapshot of the macro evaluation environment (names, character, chat, system, variables, extra). Mutating has NO effect on the real environment — persist state via api.variables.* / api.db.* instead. |
| `commit` | `boolean` | Whether the host is in commit mode for this evaluation. |
| `phase` | `'prompt' | 'display' | 'response' | 'other'` | Which call site triggered this evaluation. |
| `sourceHint?` | `string` | Optional source hint when the host can attribute the eval (preset block name, etc.). |
| `userId?` | `string` | User ID that initiated the macro resolution (when available). |

### ModalItem

*A single content item in an api.ui.showModal() items array. Five variants rendered in order using the system theme.*

| Field | Type | Description |
| --- | --- | --- |
| `type: 'text'` | `{ content: string; muted?: boolean }` | A text block. muted: true renders in dim/muted colour. |
| `type: 'heading'` | `{ content: string }` | A section heading. |
| `type: 'key_value'` | `{ label: string; value: string }` | Label–value row (left label, right value). |
| `type: 'divider'` | `{}` | A horizontal separator. No extra fields. |
| `type: 'card'` | `{ items: ModalItem[] }` | A themed card grouping child items (1 level deep recommended). |

### ShowModalOptions

*Options for api.ui.showModal(items, options).*

| Field | Type | Description |
| --- | --- | --- |
| `title` | `string` | Modal header title. Required. |
| `width?` | `number` | Width in pixels (default: 420). Clamped to viewport. |
| `maxHeight?` | `number` | Max height in pixels (default: 520). Clamped to viewport. |
| `persistent?` | `boolean` | When true, user cannot close the modal (no button, Escape, or backdrop). Only programmatic dismissal or cleanup will close it. Default: false. |

### ModalResult

*Dismissal payload inside ModalHandle.result.*

| Field | Type | Description |
| --- | --- | --- |
| `dismissedBy` | `'user' | 'extension' | 'cleanup'` | 'user' = close button / backdrop / Escape; 'extension' = programmatic; 'cleanup' = extension unloaded. |

### ModalHandle

*Returned by api.ui.showModal(). Await handle.result for dismissal; call handle.close() to dismiss programmatically.*

| Field | Type | Description |
| --- | --- | --- |
| `openRequestId` | `string` | UUID identifying this modal instance. Immediately available on the returned handle. |
| `result` | `Promise<ModalResult>` | Resolves with dismissal reason when the modal closes. |
| `close()` | `Promise<void>` | Programmatically dismiss the modal. |

### AdvancedModalOptions

*Options for api.ui.showAdvancedModal(options). Extension-owned body DOM.*

| Field | Type | Description |
| --- | --- | --- |
| `title` | `string` | Modal header title. Required. |
| `width?` | `number` | Width in pixels. Default: 420 (host). Clamped to viewport. |
| `maxHeight?` | `number` | Max height in pixels. Default: 520 (host). Clamped to viewport. |
| `persistent?` | `boolean` | When true, backdrop click no longer dismisses. Close button and programmatic dismiss() still work. |

### AdvancedModalDismissReason

*Reason a modal was dismissed. Passed to onDismiss handlers.*

| Field | Type | Description |
| --- | --- | --- |
| `'user'` | `literal` | Close button, backdrop click, or Escape key. |
| `'script'` | `literal` | The script called handle.dismiss(). |
| `'teardown'` | `literal` | Script was disabled or deleted while the modal was open. |

### AdvancedModalHandle

*Returned by api.ui.showAdvancedModal(). Body DOM is fully script-owned via the root DOMHandle. The modal element carries data-ls-script and data-ls-modal attributes, so api.ui.dom.addStyle() @scope rules match content inside the modal just like any other injected DOM.*

| Field | Type | Description |
| --- | --- | --- |
| `modalId` | `string` | UUID identifying this modal instance. Available synchronously. |
| `root` | `DOMHandle` | DOMHandle bound to the modal's content container. Use root.update(html), root.on(event, handler), etc. Calls are buffered until the frontend has mounted the modal. |
| `dismissed` | `boolean` | True once the modal has been dismissed by any path (user/script/teardown). Useful for bailing out of long-running async work if the user closed the modal mid-task. |
| `setTitle(title)` | `(string) => void` | Update the modal header title. |
| `dismiss()` | `() => void` | Close the modal programmatically. Safe to call after dismissal (no-op). |
| `onDismiss(handler)` | `(fn: (reason) => void) => () => void` | Fire once when the modal is dismissed, with the reason. Returns unsubscribe. If already dismissed when registered, fires on next microtask with the recorded reason. |

### ContextMenuItem

*A single entry in api.ui.showContextMenu()`s items array.*

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | Stable key returned when this item is selected. Required. |
| `label` | `string` | Display text. Ignored when type === 'divider'. |
| `type?` | `'item' | 'divider'` | Entry type. Default: 'item'. |
| `disabled?` | `boolean` | Greyed out and not clickable. |
| `danger?` | `boolean` | Rendered in red / danger style. |
| `active?` | `boolean` | Highlighted to indicate current selection. |

### ShowContextMenuOptions

*Options for api.ui.showContextMenu().*

| Field | Type | Description |
| --- | --- | --- |
| `position` | `{ x: number; y: number }` | Screen coordinates to anchor the menu. Typically taken from a pointer event (use data.clientX / data.clientY from a contextmenu handler). |
| `items` | `ContextMenuItem[]` | Menu entries. |

### InputBarActionOptions

*Options for api.ui.registerInputBarAction().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique identifier within your script — used by the handle for subsequent setLabel / setSubtitle / setEnabled / destroy calls. Required. |
| `label` | `string` | Display label shown in the Extras popover row. |
| `subtitle?` | `string` | Optional secondary line rendered beneath the label. Useful for short status strings ("Last roll: 17"), keyboard shortcuts, or one-line descriptions. Omit (or pass undefined via setSubtitle) for a single-line row. |
| `iconSvg?` | `string` | Inline SVG string (sanitized upstream via DOMPurify). Rendered at 14×14. |
| `iconUrl?` | `string` | URL to an icon image. Takes precedence over iconSvg if both are set. |
| `enabled?` | `boolean` | When false, the action is hidden from the popover. Default: true. |

### InputBarActionHandle

*Returned by api.ui.registerInputBarAction(). Actions appear in the chat input-bar Extras popover under a teal-badged extension header. Limits: 4 per script, 12 global.*

| Field | Type | Description |
| --- | --- | --- |
| `actionId` | `string` | The action id (same as the id passed in options). |
| `setLabel(label)` | `(string) => void` | Update the display label. Safe to call after destroy (no-op). |
| `setSubtitle(subtitle?)` | `(string | undefined) => void` | Update (or clear) the secondary line beneath the label. Pass undefined to remove a previously-set subtitle and collapse the row back to single-line. Safe to call after destroy. |
| `setEnabled(enabled)` | `(boolean) => void` | Show or hide the action in the popover. Disabled actions are hidden entirely rather than greyed out. Safe to call after destroy. |
| `onClick(handler)` | `(fn: () => void) => () => void` | Register a click handler. Multiple handlers supported — all fire on each click. Returns unsubscribe. The Extras popover closes automatically after a click (host behaviour). |
| `destroy()` | `() => void` | Remove the action from the popover and clear all click handlers. Idempotent. |

### FloatWidgetOptions

*Options for api.ui.createFloatWidget(). Widget is a small draggable overlay with script-owned body DOM.*

| Field | Type | Description |
| --- | --- | --- |
| `width` | `number` | Widget width in pixels. Required. |
| `height` | `number` | Widget height in pixels. Required. |
| `initialPosition?` | `{ x: number; y: number }` | Starting position in viewport coordinates. If omitted, the host applies its own default placement. |
| `snapToEdge?` | `boolean` | Snap to the nearest screen edge after drag. Default: false. |
| `tooltip?` | `string` | Hover tooltip text. |
| `chromeless?` | `boolean` | Strip the default container chrome (border, background, shadow, border-radius). Script fully owns visual presentation via root + addStyle. Default: false. |

### FloatWidgetHandle

*Returned by api.ui.createFloatWidget(). Body DOM is script-owned via root (DOMHandle). The root element carries data-ls-script and data-ls-widget attributes, so api.ui.dom.addStyle() @scope rules match content inside the widget. getPosition() / isVisible() return backend-cached state — see docs for caching semantics around moveTo and drag-end echoes.*

| Field | Type | Description |
| --- | --- | --- |
| `widgetId` | `string` | UUID identifying this widget instance. Available synchronously. |
| `root` | `DOMHandle` | DOMHandle bound to the widget's content container. Use root.update(html), root.on(event, handler), etc. Calls are buffered until the frontend has mounted the widget. |
| `moveTo(x, y)` | `(number, number) => void` | Move the widget to new viewport coordinates. Updates the cache optimistically; if the host clamps, the next drag-end corrects it. |
| `getPosition()` | `() => { x: number; y: number }` | Current cached position. Synchronous — value updates via moveTo (optimistic) and drag-end echoes (authoritative). |
| `setVisible(visible)` | `(boolean) => void` | Show or hide the widget. |
| `isVisible()` | `() => boolean` | Current cached visibility state. |
| `onDragEnd(handler)` | `(fn: (pos) => void) => () => void` | Register a drag-end handler — fires with the final coordinates after each drag. Multiple handlers supported. Returns unsubscribe. |
| `destroy()` | `() => void` | Remove the widget from the viewport. Idempotent — subsequent calls and method invocations are silent no-ops. |

### DrawerTabOptions

*Options for api.ui.registerDrawerTab(). Tab appears in the ViewportDrawer sidebar and is automatically searchable in the command palette.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique identifier within your script. Used for subsequent setTitle / setShortName / setBadge / activate / destroy calls. Required. |
| `title` | `string` | Full display title. Shown in the panel header and the command palette listing. Required. |
| `shortName?` | `string` | Short label rendered beneath the sidebar icon (~8 chars, truncated with ellipsis). Defaults to a truncation of title. |
| `description?` | `string` | One-line description shown below the title in the command palette. Defaults to "Open {title} extension tab". |
| `keywords?` | `string[]` | Extra terms for command-palette fuzzy search. The extension name is always included automatically. |
| `headerTitle?` | `string` | Title shown in the panel header navbar. Useful when the full title is too long for the header. Defaults to title. |
| `iconSvg?` | `string` | Inline SVG string for the sidebar icon. Rendered at 20×20, sanitized upstream. |
| `iconUrl?` | `string` | URL to an icon image. Mutually exclusive with iconSvg. |

### DrawerTabHandle

*Returned by api.ui.registerDrawerTab(). Body DOM is script-owned via root (DOMHandle). The root element carries data-ls-script and data-ls-tab attributes, so api.ui.dom.addStyle() @scope rules match content inside the tab. LumiScript enforces 1 drawer tab per script; if all 4 of LumiScript's host-quota tabs are in use by other scripts, registration throws with a distinct 'quota exhausted' message.*

| Field | Type | Description |
| --- | --- | --- |
| `tabId` | `string` | The tab id (same as the id passed in options). |
| `root` | `DOMHandle` | DOMHandle bound to the tab's content container. |
| `setTitle(title)` | `(string) => void` | Update the full title (command palette + panel header). |
| `setShortName(shortName)` | `(string) => void` | Update the sidebar icon label. |
| `setBadge(text)` | `(string | null) => void` | Show a badge next to the tab icon. Pass null to clear. |
| `activate()` | `() => void` | Programmatically switch the drawer to this tab. |
| `onActivate(handler)` | `(fn: () => void) => () => void` | Register an activation handler. Multiple handlers supported. Returns unsubscribe. |
| `destroy()` | `() => void` | Remove the tab from the sidebar and detach all handlers. Idempotent. |

### DOMInjectOptions

*Options for api.ui.dom.inject(target, html, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `position?` | `'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'` | Insertion position relative to the target element. Default: 'beforeend'. |
| `id?` | `string` | Stable ID for idempotent injection. Re-using the same ID updates the existing element instead of creating a duplicate. |

### DOMMessageInjectOptions

*Options for api.ui.dom.injectAtMessage(messageId, html, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `position?` | `'header' | 'footer'` | Semantic position within the message bubble. 'footer' (default): after content/controls. 'header': before all content. |
| `id?` | `string` | Stable ID for idempotent injection. Re-using the same ID updates the existing element instead of creating a duplicate. |

### DOMHandle

*Returned by api.ui.dom.inject() and api.ui.dom.injectAtMessage(). All methods are fire-and-forget.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique element ID (generated or from stable ID). |
| `update(html)` | `void` | Replace the inner HTML of the injected element. |
| `remove()` | `void` | Remove the element from the DOM and detach all listeners. |
| `on(event, handler, options?)` | `() => void` | Attach a DOM event listener. Handler receives DOMEventData. Pass { preventDefault: true } to suppress the browser default synchronously (e.g. to block the native context menu on right-click). Returns an unsubscribe function. |
| `makeDraggable(handleSelector?)` | `void` | Enable frontend-only drag. Optional CSS selector picks a drag handle child; the root element moves. Without a selector, the whole element is draggable. |

### DOMEventData

*Serialized event data passed to DOM event handlers. A safe subset of the browser Event object.*

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Event type (e.g. 'click', 'input', 'change'). |
| `targetId?` | `string` | The id attribute of the event target element. |
| `targetValue?` | `string` | The value property (for input/select elements). |
| `targetChecked?` | `boolean` | The checked property (for checkbox/radio elements). |
| `dataset?` | `Record<string, string>` | All data-* attributes on the event target. |
| `detail?` | `unknown` | CustomEvent.detail (must be JSON-serializable). |
| `clientX?` | `number` | Viewport X coordinate. Populated for MouseEvent / PointerEvent / contextmenu and from the first touch of a TouchEvent. Useful for positioning api.ui.showContextMenu at the cursor. |
| `clientY?` | `number` | Viewport Y coordinate. Same event families as clientX. |

### DOMListenOptions

*Options bag for DOMHandle.on(event, handler, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `preventDefault?` | `boolean` | When true, the frontend listener calls event.preventDefault() synchronously before dispatching to the script handler. Must be set at registration time — the async worker-boundary dispatch returns too late to preventDefault from inside the handler body. Default: false. |

### LLMMessage

*A single message in the messages array passed to api.llm.generate / generateStructured / generateWithTools.*

| Field | Type | Description |
| --- | --- | --- |
| `role` | `'system' | 'user' | 'assistant'` | Message sender role. |
| `content` | `string` | Message text content. |

### LLMOptions

*Resolution order: connectionId → connectionName → provider + model → active user connection.*

| Field | Type | Description |
| --- | --- | --- |
| `connectionId?` | `string` | Connection profile ID. Takes precedence over all other options. |
| `connectionName?` | `string` | Human-readable name (case-insensitive). Ignored when connectionId is set. |
| `provider?` | `LLMProvider` | Provider string e.g. "anthropic", "openai". Ignored when connectionId or connectionName is set. |
| `model?` | `string` | Model identifier. Used with provider for direct calls. |
| `temperature?` | `number` | Override temperature (0–2). |
| `maxTokens?` | `number` | Override max tokens. |
| `parallelToolCalls?` | `boolean` | When false, forces one tool call per turn. Only meaningful for generateWithTools(). Needed for Mistral and other providers that require serialised tool use. |
| `signal?` | `AbortSignal` | Cancel an in-flight generation. On abort the promise rejects with an AbortError. The worker auto-aborts on extension teardown — use this for script-level cancellation (timeouts, user cancel, races). |

### DryRunOptions

*Passed to api.llm.dryRun(options?). All fields are optional; defaults use the active context.*

| Field | Type | Description |
| --- | --- | --- |
| `chatId?` | `string` | Chat to assemble the prompt for. Defaults to the active chat. |
| `connectionId?` | `string` | Override the connection profile used for assembly. |
| `personaId?` | `string` | Override the persona used for assembly. |
| `presetId?` | `string` | Override the generation preset. |
| `generationType?` | `'normal' | 'continue' | 'regenerate' | 'swipe' | 'impersonate'` | Override generation type. Default 'normal'. |
| `parameters?` | `Record<string, unknown>` | Override sampler parameters. |

### LLMRawResult

*Return type of api.llm.generateWithTools() without a schema. On intermediate steps tool_calls is set; on the final step content holds the text response.*

| Field | Type | Description |
| --- | --- | --- |
| `content` | `string` | Text generated by the LLM. Empty string when tool_calls is present. |
| `tool_calls?` | `ToolCall[]` | Function calls requested by the LLM. When present, content is typically empty. |

### LLMRawResultStructured&lt;T&gt;

*Return type of api.llm.generateWithTools(messages, tools, opts, schema). On intermediate steps only tool_calls is set. On the final step only content is set.*

| Field | Type | Description |
| --- | --- | --- |
| `content?` | `T` | Final step: JSON-parsed and Zod-validated result typed as T. |
| `tool_calls?` | `ToolCall[]` | Intermediate steps: function calls requested by the LLM. When present, content is absent. |

### ToolCall

*A single function call inside LLMRawResult.tool_calls or LLMRawResultStructured.tool_calls.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Tool name as given in the schema. |
| `args` | `Record<string, unknown>` | Parsed arguments as returned by the LLM. |
| `call_id` | `string` | Provider call ID (Anthropic id, OpenAI id, or synthetic UUID). |

### DryRunResult

*Return type of api.llm.dryRun(). Contains everything that would be sent to the LLM plus diagnostic data.*

| Field | Type | Description |
| --- | --- | --- |
| `messages` | `LLMMessage[]` | The fully assembled message array. |
| `breakdown` | `DryRunBlock[]` | Ordered prompt composition blocks. |
| `parameters` | `Record<string, unknown>` | Final merged sampler parameters. |
| `model` | `string` | Resolved model identifier. |
| `provider` | `string` | Resolved provider identifier. |
| `tokenCount?` | `DryRunTokenCount` | Per-block token counts. Present only if a tokenizer is configured. |
| `worldInfoStats?` | `WorldInfoActivationStats` | World info activation statistics. |
| `memoryStats?` | `DryRunMemoryStats` | Long-term memory retrieval statistics. |

### DryRunBlock

*A single prompt composition block inside DryRunResult.breakdown.*

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Block type (e.g. "block", "chat_history", "world_info", "authors_note"). |
| `name` | `string` | Human-readable block name. |
| `role?` | `string` | Message role for this block. |
| `content?` | `string` | Block text content. |
| `messageCount?` | `number` | Number of messages (for chat_history blocks). |
| `preCountedTokens?` | `number` | Pre-computed token estimate. |
| `excludeFromTotal?` | `boolean` | Whether this block is excluded from the token total. |

### DryRunTokenCount

*Per-block token counts inside DryRunResult.tokenCount. Only present if a tokenizer is configured.*

| Field | Type | Description |
| --- | --- | --- |
| `totalTokens` | `number` | Total token count across all blocks. |
| `breakdown` | `Array` | Per-block breakdown: [{ name, type, tokens, role? }]. |
| `tokenizerId` | `string | null` | Tokenizer identifier used, or null. |
| `tokenizerName` | `string | null` | Human-readable tokenizer name, or null. |

### WorldInfoActivationStats

*World info activation statistics inside DryRunResult.worldInfoStats.*

| Field | Type | Description |
| --- | --- | --- |
| `totalCandidates` | `number` | Total number of WI entries evaluated. |
| `activatedBeforeBudget` | `number` | Entries activated before budget enforcement. |
| `activatedAfterBudget` | `number` | Entries that survived budget enforcement. |
| `evictedByBudget` | `number` | Entries removed due to token budget. |
| `evictedByMinPriority` | `number` | Entries removed due to minimum priority threshold. |
| `estimatedTokens` | `number` | Total token estimate for activated entries. |
| `recursionPassesUsed` | `number` | Number of recursive activation passes performed. |

### DryRunMemoryStats

*Long-term memory retrieval statistics inside DryRunResult.memoryStats.*

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Whether long-term memory is configured and active. |
| `chunksRetrieved` | `number` | Number of memory chunks returned by vector search. |
| `chunksAvailable` | `number` | Total vectorized chunks available. |
| `chunksPending` | `number` | Chunks awaiting vectorization (results may be incomplete if &gt; 0). |
| `injectionMethod` | `'macro' | 'fallback' | 'disabled'` | How memories are injected into the prompt. |
| `queryPreview` | `string` | The query string used for the vector search. |
| `settingsSource` | `'global' | 'per_chat'` | Whether memory settings come from global or per-chat config. |

### HttpRequestOptions

*Passed to api.utils.http.get / post / put / delete / request. Requires allowDangerous + cors_proxy permission. Responses are capped at 25 MB by the Lumiverse cors_proxy; larger bodies are rejected upstream.*

| Field | Type | Description |
| --- | --- | --- |
| `method?` | `'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'` | HTTP method. Default depends on the helper used. |
| `headers?` | `Record<string, string>` | Request headers. |
| `body?` | `string` | Request body (string). Use JSON.stringify for JSON payloads. |
| `timeout?` | `number` | Request timeout in milliseconds. |

### HttpResponse

*Returned by api.utils.http.* methods. Response body is capped at 25 MB by the Lumiverse cors_proxy — requests for larger payloads reject with an upstream error.*

| Field | Type | Description |
| --- | --- | --- |
| `status` | `number` | HTTP status code (e.g. 200, 404). |
| `statusText` | `string` | HTTP status text (e.g. "OK", "Not Found"). |
| `headers` | `Record<string, string>` | Response headers. |
| `body` | `string` | Response body as a string. Use JSON.parse for JSON responses. |

### TempWriteOptions

*Passed to api.files.tempWrite(path, data, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `ttlMs?` | `number` | Time-to-live in milliseconds. If omitted the file persists until deleted or restart. |

### FileStatResult

*Returned by api.files.sharedStat(path).*

| Field | Type | Description |
| --- | --- | --- |
| `exists` | `boolean` | Whether the path exists. |
| `isFile` | `boolean` | Whether the path is a file. |
| `isDirectory` | `boolean` | Whether the path is a directory. |
| `sizeBytes` | `number` | File size in bytes. |
| `modifiedAt` | `string` | ISO 8601 timestamp of last modification. |

### TempStatResult

*Returned by api.files.tempStat(path).*

| Field | Type | Description |
| --- | --- | --- |
| `sizeBytes` | `number` | File size in bytes. |
| `createdAt` | `string` | ISO 8601 creation timestamp. |
| `expiresAt?` | `string` | ISO 8601 expiration timestamp. Absent if no TTL was set. |

### Character

*Returned by api.characters.get / create / update.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Character UUID. |
| `name` | `string` | Character name. |
| `description` | `string` | Character description. |
| `personality` | `string` | Personality summary. |
| `scenario` | `string` | Scenario / setting. |
| `firstMessage` | `string` | Opening message / greeting. |
| `systemPrompt` | `string` | Character-level system prompt. |
| `postHistoryInstructions` | `string` | Instructions appended after chat history. |
| `tags` | `string[]` | Searchable tags. |
| `alternateGreetings` | `string[]` | Additional greeting variants. |
| `imageId` | `string | null` | Avatar image ID. Null if no avatar. |
| `worldBookIds` | `string[]` | World book IDs attached to this character. |
| `extensions` | `Record<string, unknown>` | Free-form extension data attached to the character (per-character analog of message.extra). Namespace your keys (e.g. "my-script:state") to avoid collisions with other extensions / Lumiverse-internal fields. Reads return the full blob; writes via update() shallow-merge into existing — top-level keys overwrite, omitted keys preserved, nested objects replaced wholesale (NOT recursively merged). Keep values JSON-serializable. |
| `createdAt` | `number` | Creation timestamp (Unix ms). |
| `updatedAt` | `number` | Last update timestamp (Unix ms). |

### CharacterCreateInput

*Passed to api.characters.create(input). Only name is required.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Character name. |
| `description?` | `string` | Character description. |
| `personality?` | `string` | Personality summary. |
| `scenario?` | `string` | Scenario / setting. |
| `firstMessage?` | `string` | Opening message. |
| `systemPrompt?` | `string` | Character-level system prompt. |
| `postHistoryInstructions?` | `string` | Post-history instructions. |
| `tags?` | `string[]` | Searchable tags. |
| `alternateGreetings?` | `string[]` | Additional greeting variants. |
| `creator?` | `string` | Creator name / attribution. |
| `worldBookIds?` | `string[]` | World book IDs to attach. Pass [] to detach all. Omit to leave unchanged. |
| `extensions?` | `Record<string, unknown>` | Initial extension data to seed the character with. See `Character.extensions` for the namespacing + JSON-serialization conventions. Subsequent updates use the same shallow-merge rules. |

### CharacterUpdateInput

*Passed to api.characters.update(id, input). Same fields as CharacterCreateInput, all optional.*

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` | Character name. |
| `description?` | `string` | Character description. |
| `personality?` | `string` | Personality summary. |
| `scenario?` | `string` | Scenario / setting. |
| `firstMessage?` | `string` | Opening message. |
| `systemPrompt?` | `string` | Character-level system prompt. |
| `postHistoryInstructions?` | `string` | Post-history instructions. |
| `tags?` | `string[]` | Searchable tags. |
| `alternateGreetings?` | `string[]` | Additional greeting variants. |
| `creator?` | `string` | Creator name / attribution. |
| `worldBookIds?` | `string[]` | Replace world book attachments. Pass [] to detach all. |
| `extensions?` | `Record<string, unknown>` | Shallow-merged into existing extensions on the character. Top-level keys you provide overwrite, omitted keys are preserved, nested objects are replaced wholesale (not recursively merged). Pass an empty object to leave the field unchanged. See `Character.extensions` for the full semantics. |

### ChatSession

*Returned by api.chats.get / getActive / update.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Chat session UUID. |
| `characterId` | `string` | UUID of the associated character. |
| `name` | `string` | Chat session title. |
| `metadata` | `Record<string, unknown>` | Arbitrary key-value metadata (read/write via api.chat.getMetadata / setMetadata). |
| `createdAt` | `number` | Creation timestamp (Unix ms). |
| `updatedAt` | `number` | Last update timestamp (Unix ms). |

### ChatSessionUpdateInput

*Passed to api.chats.update(id, input).*

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` | New chat session title. |
| `metadata?` | `Record<string, unknown>` | Metadata to merge in (replaces entire metadata object). |

### ChatMemoryChunk

*A single memory chunk inside ChatMemoryResult.chunks.*

| Field | Type | Description |
| --- | --- | --- |
| `content` | `string` | Chunk text (concatenated messages from a conversation segment). |
| `score` | `number` | Cosine similarity score (lower = more similar to the query). |
| `metadata` | `Record<string, unknown>` | Chunk metadata (may include startIndex, endIndex, etc.). |

### ChatMemoryResult

*Returned by api.chats.getMemories().*

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Whether long-term memory is active. When false, all other fields are empty/zero. |
| `chunks` | `ChatMemoryChunk[]` | Retrieved memory chunks, sorted by relevance. |
| `formatted` | `string` | Pre-formatted output using the user's memory template. Ready to inject directly. |
| `count` | `number` | Number of chunks returned. |
| `chunksAvailable` | `number` | Total vectorized chunks available. |
| `chunksPending` | `number` | Chunks awaiting vectorization. Results may be incomplete if &gt; 0. |
| `queryPreview` | `string` | The query used for the vector search. |
| `settingsSource` | `'global' | 'per_chat'` | Whether memory settings come from global or per-chat config. |

### WorldInfo

*A world book header. Returned by api.worldInfo.get / create / update.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | World book UUID. |
| `name` | `string` | World book name. |
| `description` | `string` | World book description. |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata. |
| `createdAt` | `number` | Creation timestamp (Unix ms). |
| `updatedAt` | `number` | Last update timestamp (Unix ms). |

### WorldInfoCreateInput

*Passed to api.worldInfo.create(input).*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | World book name. |
| `description?` | `string` | World book description. |
| `metadata?` | `Record<string, unknown>` | Arbitrary metadata. |

### WorldInfoUpdateInput

*Passed to api.worldInfo.update(ref, input). All fields optional.*

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` | New world book name. |
| `description?` | `string` | New description. |
| `metadata?` | `Record<string, unknown>` | New metadata (replaces entire object). |

### WorldInfoEntry

*A lorebook entry. Returned by api.worldInfo.entries.get / create / update. Key fields listed; full set available in IntelliSense hover.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Entry UUID. |
| `worldBookId` | `string` | Parent world book UUID. |
| `content` | `string` | Entry text content injected into the prompt. |
| `key` | `string[]` | Primary trigger keywords. |
| `keysecondary` | `string[]` | Secondary trigger keywords (selective logic applies). |
| `position` | `number` | Injection position (0=WI Before, 1=WI After, 4=at depth). |
| `depth` | `number` | Injection depth from end of chat history. |
| `priority` | `number` | Activation priority (higher = evicted last). |
| `constant` | `boolean` | Always active regardless of keyword matches. |
| `disabled` | `boolean` | Entry is disabled and will not activate. |
| `probability` | `number` | Activation probability (0–100) when useProbability is true. |
| `selective` | `boolean` | Requires secondary key match when true. |

### WorldInfoEntryInput

*Passed to api.worldInfo.entries.create / update. All fields optional on update; content and key recommended on create.*

| Field | Type | Description |
| --- | --- | --- |
| `content?` | `string` | Entry text content. |
| `key?` | `string[]` | Primary trigger keywords. |
| `keysecondary?` | `string[]` | Secondary trigger keywords. |
| `position?` | `number` | Injection position. |
| `depth?` | `number` | Injection depth. |
| `priority?` | `number` | Activation priority. |
| `constant?` | `boolean` | Always active flag. |
| `disabled?` | `boolean` | Disable this entry. |
| `probability?` | `number` | Activation probability (0–100). |
| `selective?` | `boolean` | Require secondary key match. |
| `(+ more)?` | `—` | Additional fields (comment, role, groupName, scanDepth, etc.) available in IntelliSense hover. |

### ActivatedWorldInfoEntry

*Returned by api.worldInfo.getCapturedActive(). Extends WorldInfoEntry with activation metadata.*

| Field | Type | Description |
| --- | --- | --- |
| `(all WorldInfoEntry fields)` | `—` | All WorldInfoEntry fields are present. |
| `source` | `'keyword' | 'vector'` | How this entry was activated. |
| `score?` | `number` | Cosine similarity score for vector-activated entries. Absent for keyword-activated entries. |

### Persona

*Returned by api.personas.get / getDefault / getActive / create / update.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Persona UUID. |
| `name` | `string` | Persona name. |
| `title` | `string` | Short tagline shown in the persona picker. |
| `description` | `string` | Persona description. |
| `imageId` | `string | null` | Avatar image ID. Null if no avatar. |
| `attachedWorldBookId` | `string | null` | World book attached to this persona. Null if none. |
| `folder` | `string` | Organisational folder label. |
| `isDefault` | `boolean` | Whether this is the default persona. |
| `subjectivePronoun?` | `string` | Subjective pronoun (e.g. "he", "she", "they"). |
| `objectivePronoun?` | `string` | Objective pronoun (e.g. "him", "her", "them"). |
| `possessivePronoun?` | `string` | Possessive pronoun (e.g. "his", "her", "their"). |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata. |
| `createdAt` | `number` | Creation timestamp (Unix ms). |
| `updatedAt` | `number` | Last update timestamp (Unix ms). |

### PersonaCreateInput

*Passed to api.personas.create(input). Only name is required.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Persona name. |
| `title?` | `string` | Short tagline. |
| `description?` | `string` | Persona description. |
| `folder?` | `string` | Organisational folder label. |
| `isDefault?` | `boolean` | Set as default persona (clears previous default). |
| `attachedWorldBookId?` | `string` | World book UUID to attach. |
| `subjectivePronoun?` | `string` | Subjective pronoun (e.g. "he", "she", "they"). |
| `objectivePronoun?` | `string` | Objective pronoun (e.g. "him", "her", "them"). |
| `possessivePronoun?` | `string` | Possessive pronoun (e.g. "his", "her", "their"). |
| `metadata?` | `Record<string, unknown>` | Arbitrary metadata. |

### PersonaUpdateInput

*Passed to api.personas.update(personaId, input). All fields optional — only the fields provided are updated; omitted fields are left unchanged.*

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` | New persona name. |
| `title?` | `string` | Short tagline. |
| `description?` | `string` | Persona description. |
| `folder?` | `string` | Organisational folder label. |
| `isDefault?` | `boolean` | Set as default persona (clears previous default). |
| `attachedWorldBookId?` | `string` | World book UUID to attach. |
| `subjectivePronoun?` | `string` | Subjective pronoun (e.g. "he", "she", "they"). |
| `objectivePronoun?` | `string` | Objective pronoun (e.g. "him", "her", "them"). |
| `possessivePronoun?` | `string` | Possessive pronoun (e.g. "his", "her", "their"). |
| `metadata?` | `Record<string, unknown>` | Arbitrary metadata (replaces entire object). |

### CouncilSettings

*Returned by api.council.getSettings(). The user's top-level Council configuration object. All fields camelCase — no DTO transform on the LumiScript side.*

| Field | Type | Description |
| --- | --- | --- |
| `councilMode` | `boolean` | Whether Council mode is currently enabled for this user. |
| `members` | `CouncilMember[]` | Member assignments. See CouncilMember for the per-row shape; getMembers() returns the same set enriched with Lumia context as CouncilMemberContext[]. |
| `toolsSettings` | `CouncilToolsSettings` | Tool-execution settings (mode, timeoutMs, sidecar context window, etc.). |

### CouncilMember

*A single Council member assignment — the binding row stored in CouncilSettings.members. Includes role + chance + tool assignment list. getMembers() returns the same data enriched with full Lumia source fields as CouncilMemberContext[].*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique Council member id (settings row id). |
| `packId` | `string` | Pack id that contains the source Lumia item. |
| `packName` | `string` | Pack name (display label). |
| `itemId` | `string` | Source Lumia item id this member is backed by. |
| `itemName` | `string` | Source Lumia item display name. |
| `tools` | `string[]` | Tool names this member is assigned (empty array if no tools). |
| `role` | `string` | Freeform role description (e.g. "Plot Enforcer"). |
| `chance` | `number` | Probability (0–100) that this member participates each generation. |

### CouncilMemberContext

*Returned by api.council.getMembers() AND delivered as the second arg to api.tools.register handlers when invoked via the Council execution path. Merges a member's assignment (role + chance) with the source Lumia item's full definition (avatar / definition / personality / behavior). When you're inside a tool handler, prefer reading ctx.councilMember directly rather than calling getMembers() — it's faster and tied to the active invocation.*

| Field | Type | Description |
| --- | --- | --- |
| `memberId` | `string` | Unique Council member id. |
| `itemId` | `string` | Source Lumia item id. |
| `packId` | `string` | Pack id. |
| `packName` | `string` | Pack name. |
| `name` | `string` | Display name (also used as the member name). |
| `role` | `string` | Freeform role description. |
| `chance` | `number` | Probability (0–100) per generation. |
| `avatarUrl` | `string | null` | Relative URL to the avatar (e.g. /api/v1/images/{id}), or null. |
| `definition` | `string` | Lumia "definition" field — physical / identity description. |
| `personality` | `string` | Lumia "personality" field. |
| `behavior` | `string` | Lumia "behavior" field — behavioural patterns. |
| `genderIdentity` | `0 | 1 | 2` | 0 = unspecified, 1 = feminine, 2 = masculine. (Note: upstream council.md docs describe a wider 4-value range; LumiScript matches the typed surface in spindle-types 0.4.40 — type-vs-doc inconsistency tracked.) |

### CouncilToolsSettings

*Settings governing Council tool execution. Nested inside CouncilSettings.toolsSettings.*

| Field | Type | Description |
| --- | --- | --- |
| `mode` | `'sidecar' | 'inline'` | 'sidecar' uses a separate LLM connection profile for the deliberation pass; 'inline' sends tools as native function definitions to the main LLM. |
| `timeoutMs` | `number` | Timeout per tool call in ms. |
| `sidecarContextWindow` | `number` | Number of recent chat messages to include in sidecar context (only meaningful when mode is 'sidecar'). |
| `includeUserPersona` | `boolean` | Whether to include the user persona in tool context. |
| `includeCharacterInfo` | `boolean` | Whether to include the active character info in tool context. |
| `includeWorldInfo` | `boolean` | Whether to include activated world info in tool context. |
| `allowUserControl` | `boolean` | Whether the user can trigger individual tools on demand. |
| `maxWordsPerTool` | `number` | Word limit per tool response (0 = unlimited). |
| `retainResultsForRegens?` | `boolean` | When true, council tools are NOT re-executed on regenerations / swipes — last successful results are reused from chat metadata. Tools still fire for fresh sends, continues, impersonations. |
| `enabled?` | `boolean` | @deprecated — kept for backwards compatibility with saved settings. |

### LumiaItem

*Returned by api.council.getAvailableLumiaItems(). LumiScript-shaped (camelCase) mapping of upstream LumiaItemDTO. The full pool of Lumia items the user has across all installed packs — superset of what's currently assigned to Council members.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique Lumia item id. |
| `packId` | `string` | Pack id this item belongs to. |
| `name` | `string` | Display name. |
| `avatarUrl` | `string | null` | Relative URL to the avatar image, or null when no avatar is set. |
| `authorName` | `string` | Display name of the pack author. |
| `definition` | `string` | Physical / identity description (free-form text). |
| `personality` | `string` | Personality description (free-form text). |
| `behavior` | `string` | Behavioural patterns (free-form text). |
| `genderIdentity` | `0 | 1 | 2` | 0 = unspecified, 1 = feminine, 2 = masculine. (Same upstream type-vs-doc inconsistency as CouncilMemberContext.genderIdentity.) |
| `version` | `string` | Pack-author-supplied version string (e.g. "1.0.0"). |
| `sortOrder` | `number` | Sort index within the pack (lower renders first). |
| `createdAt` | `number` | Creation timestamp (Unix seconds). |
| `updatedAt` | `number` | Last update timestamp (Unix seconds). |

### ToolDefinition

*Passed to api.tools.register(name, def, handler).*

| Field | Type | Description |
| --- | --- | --- |
| `display_name` | `string` | Human-readable name shown in the Lumiverse Council tools list. |
| `description` | `string` | Description for the LLM — explains what the tool does and when to call it. |
| `parameters?` | `object` | JSON Schema describing input parameters. Format: { type: "object", properties: {...}, required: [...] }. |
| `council_eligible?` | `boolean` | When true, the tool appears in the Council tools list and can be assigned to Council members. Default false. |

### ToolInvocationArgs

*Parameter passed to tool handler callbacks registered via api.tools.register(). Contains well-known Lumiverse fields plus tool-specific parameters.*

| Field | Type | Description |
| --- | --- | --- |
| `context?` | `string` | Formatted chat context provided by Lumiverse (character info, world info, recent messages). |
| `__userId?` | `string` | User ID of the invoking user. Use for scoped api.* operations inside the handler. |
| `__deadlineMs?` | `number` | Timestamp (ms) by which the handler must return a result. |
| `[key]?` | `unknown` | Tool-specific parameters from the registration schema are available as additional fields. |

### ToolInvocationContext

*Optional third parameter passed to tool handlers. Populated when invoked via Lumiverse TOOL_INVOCATION; undefined when invoked via api.tools.invoke() (script-to-script). Field-level host requirements: requestId/councilMember require Lumiverse 8d310f8+ (spindle-types 0.4.25+); contextMessages require Lumiverse 993544c8+ (spindle-types 0.4.26+). Older hosts leave the corresponding fields undefined and the helper gracefully falls back.*

| Field | Type | Description |
| --- | --- | --- |
| `requestId?` | `string` | Host-side correlation id for this invocation. Useful for matching handler-side logs against Lumiverse server logs. |
| `councilMember?` | `CouncilMemberContext` | Personality snapshot of the Council member that triggered the invocation. Populated only when the tool ran as part of a Council execution cycle; undefined for inline function-calling, api.tools.invoke(), and older hosts. |
| `contextMessages?` | `LLMMessage[]` | Structured chat context for Council invocations — same content as args.context but with role boundaries preserved. Prefer this over args.context when available — the ls:council-prompt helper's buildCouncilMessages uses it automatically when passed via the contextMessages option. Multi-part (text+image) content is flattened to its text portion before delivery. Undefined for non-Council paths / older hosts. |

### CouncilMemberContext

*Re-exported from lumiverse-spindle-types. Personality snapshot of the Council member that triggered a tool invocation — identity, role, avatar, and Lumia personality fields. Delivered on ToolInvocationContext.councilMember.*

| Field | Type | Description |
| --- | --- | --- |
| `memberId` | `string` | Unique Council member id (Council settings row id). |
| `itemId` | `string` | Source Lumia item id this member is backed by. |
| `packId` | `string` | Pack id the Lumia item lives in. |
| `packName` | `string` | Pack name the Lumia item lives in. |
| `name` | `string` | Display name of the Lumia item (also used as the member name). |
| `role` | `string` | Freeform role description assigned by the user (e.g. "Plot Enforcer", "Comic Relief"). |
| `chance` | `number` | Probability (0–100) that this member participates in each generation. |
| `avatarUrl` | `string | null` | Relative URL to the member's avatar (e.g. "/api/v1/images/{id}"), or null. |
| `definition` | `string` | Lumia "definition" field — physical/identity description. |
| `personality` | `string` | Lumia "personality" field. |
| `behavior` | `string` | Lumia "behavior" field — behavioural patterns. |
| `genderIdentity` | `0 | 1 | 2` | Gender identity marker (0=unspecified, 1=feminine, 2=masculine). |

### RegisteredToolInfo

*Returned by api.tools.list(). A serialisable snapshot of a registered tool.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Tool identifier (bare name, no prefix). |
| `display_name` | `string` | Human-readable name. |
| `description` | `string` | LLM-facing description. |
| `parameters?` | `object` | JSON Schema for the tool's input parameters. |
| `council_eligible` | `boolean` | Whether the tool can be assigned to Council members. |
| `scriptId` | `string` | ID of the script that registered this tool. |
| `scriptName` | `string` | Name of the script that registered this tool. |

### MacroDefinition

*Passed to api.macros.register(name, def, handler?).*

| Field | Type | Description |
| --- | --- | --- |
| `description` | `string` | Human-readable description shown in preset editors and macro browsers. |
| `category?` | `string` | Category label. Default: 'extension:lumiscript:user'. |
| `returnType?` | `'string'|'integer'|'number'|'boolean'` | Hint for value-type coercion on resolution. Default string. |
| `args?` | `Array<{ name, description?, required? }>` | Argument schema shown to preset authors. |

### MacroContext

*Parameter passed to a pull-mode macro handler at resolution time. Mirrors Lumiverse's MacroExecContext. Per convention, `args` is on ctx — not a top-level variable.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | The bare macro name (no `{{}}`, no arguments). |
| `args` | `string[]` | Argument tokens parsed from the macro invocation. |
| `env?` | `{ character?, chat?, names?, variables?, … }` | Environment context populated by the macro engine (character UUID is NOT in here; use globalThis.__lsActiveCharId if you need it). |
| `isScoped?` | `boolean` | True when the macro is resolved inside a scoped block (e.g. {{if::…}}…{{/if}}). |
| `body?` | `string` | Body text for scoped macros. |

### RegisteredMacroInfo

*Returned by api.macros.list(). Visible across scripts — any script can see push-values set by any other script (matches the already-world-readable nature of macros).*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Macro identifier. |
| `description` | `string` | Description as supplied at registration. |
| `category` | `string` | Category label. User-registered macros default to `extension:lumiscript:user`. |
| `returnType?` | `'string'|'integer'|'number'|'boolean'` | Return-type hint. |
| `args?` | `Array<{ name, description?, required? }>` | Argument schema. |
| `mode` | `'push' | 'pull'` | `push` when registered without a handler; `pull` when handler-backed. |
| `lastValue?` | `string` | Most recent value pushed via updateValue. Only meaningful in push mode. |
| `scriptId` | `string` | ID of the owning script. |
| `scriptName` | `string` | Name of the owning script. |

### DbScope

*Scope of an api.db collection — determines the storage path and resolution requirements. Baked into the collection handle at api.db.collection() time.*

| Field | Type | Description |
| --- | --- | --- |
| `'script'` | `'script'` | Per-scriptId, cross-chat. Default. Stored at db/scripts/{scriptId}/{name}.json. Always resolves (scriptId always present). |
| `'character'` | `'character'` | Per-active-character, per-scriptId. Stored at db/characters/{characterId}/{scriptId}/{name}.json. Throws if there is no active character. |
| `'chat'` | `'chat'` | Per-active-chat, per-scriptId. Stored at db/chats/{chatId}/{scriptId}/{name}.json. Throws if there is no active chat. |

### CollectionOpts

*Options for api.db.collection(name, opts). Generic over the record type so schema (if provided) infers field shapes.*

| Field | Type | Description |
| --- | --- | --- |
| `scope?` | `DbScope` | Scope of the collection. Defaults to 'script'. |
| `schema?` | `ZodLike<T>` | Optional Zod schema (or any object with a parse(data): T method) applied on every write — insert / insertMany / update. On update the MERGED record is validated against the full schema, not the raw patch. Validation failures throw `api.db: schema validation failed on <op>: <msg>`. find / findOne / count / query are NOT validated — if your schema evolves, use drop() + re-insert rather than expecting lazy migration. |

### DbRecord

*Record shape produced by api.db.*. Every inserted record carries id + createdAt + updatedAt alongside user-supplied fields. id and createdAt are immutable (update() silently strips them from the patch). updatedAt is bumped on every successful update.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | UUID v4 auto-assigned at insert (overridable by caller). |
| `createdAt` | `number` | Epoch ms — set once at insert. Immutable. |
| `updatedAt` | `number` | Epoch ms — bumped to Date.now() on every successful update. |
| `[key: string]` | `unknown` | User-supplied fields — anything JSON-serializable. |

### DbFilter

*Filter shapes accepted by find() / findOne() / update() / delete() / count(). The store picks a matching strategy based on the runtime type. Operator envelopes (LumiScript 0.20.0+) unlock Mongo-style comparisons without dropping to a function filter.*

| Field | Type | Description |
| --- | --- | --- |
| `undefined` | `undefined` | Matches all records. Used as sugar for "operate on everything". |
| `function` | `(record: T) => boolean` | Caller predicate. Full expressive power. A throwing predicate is treated as no-match — errors never propagate. |
| `object (literal)` | `Partial<T>` | Deep-equality match with dot-notation path resolution. { 'author.name': 'alice' } matches nested fields. Arrays compared via JSON.stringify. |
| `object (envelope)` | `{ $op: value, ... }` | Value position accepts an operator envelope — all keys must start with `$`; mixed-key envelopes throw. Supported: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex. Example: { margin: { $gt: 0 }, tier: { $in: ["hard", "very_hard"] } }. $eq is the explicit form of literal equality ({ name: { $eq: "alice" } } and { name: "alice" } match identically). Numeric comparisons return false on type mismatch (never throw); bad arg shapes ($in without array, invalid $regex) throw. $regex also accepts a RegExp instance shorthand: { name: /alice/i }. $options sibling is honored alongside $regex for flag control. |

### EventTrackOptions

*Options for api.events.track().*

| Field | Type | Description |
| --- | --- | --- |
| `level?` | `'debug'|'info'|'warn'|'error'` | Severity level (default: info). |
| `chatId?` | `string` | Associate with a specific chat (defaults to active chat). |
| `retentionDays?` | `number` | Auto-expire after this many days. |

### EventQueryFilter

*Filter for api.events.query() and api.events.replay().*

| Field | Type | Description |
| --- | --- | --- |
| `eventName?` | `string` | Filter by event name. |
| `chatId?` | `string` | Filter by chat. |
| `since?` | `string` | ISO 8601 — only events after this timestamp. |
| `until?` | `string` | ISO 8601 — only events before this timestamp. |
| `level?` | `'debug'|'info'|'warn'|'error'` | Filter by severity level. |
| `limit?` | `number` | Maximum number of results. |

### EventRecord

*Returned by api.events.query() and api.events.replay().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique event ID. |
| `ts` | `string` | ISO 8601 timestamp. |
| `eventName` | `string` | Name of the tracked event. |
| `level` | `'debug'|'info'|'warn'|'error'` | Severity level. |
| `chatId?` | `string` | Chat this event was associated with. |
| `payload?` | `Record<string, unknown>` | Arbitrary event data. |

### MacrosResolveOptions

*Options for api.utils.macros.resolve(template, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `chatId?` | `string` | Chat ID for context-sensitive macros. Defaults to the active chat. |
| `characterId?` | `string` | Character ID for character macros. Inferred from active chat if omitted. |
| `commit?` | `boolean` | When false, requests a dry / non-committing resolve — extension macro handlers that honour the flag skip side effects (disk writes, event emissions, etc.). Default: true. |

### MacrosResolveResult

*Returned by api.utils.macros.resolve().*

| Field | Type | Description |
| --- | --- | --- |
| `text` | `string` | Resolved template text. |
| `diagnostics` | `Array<{ message, offset, length }>` | Diagnostics from the macro engine (parse errors, unknown macros, etc.). |

### TokenCountOptions

*Options for api.tokens.count* methods.*

| Field | Type | Description |
| --- | --- | --- |
| `model?` | `string` | Explicit model ID to resolve the tokenizer against. Takes precedence over modelSource when both are set. |
| `modelSource?` | `'main' | 'sidecar'` | Which configured model to use when `model` isn't set. 'main' = user's default connection profile (default), 'sidecar' = user's selected sidecar model. |

### TokenCountResult

*Returned by api.tokens.count* methods.*

| Field | Type | Description |
| --- | --- | --- |
| `totalTokens` | `number` | Total token count. |
| `model` | `string` | Model ID actually used to resolve the tokenizer. |
| `modelSource` | `'main' | 'sidecar' | 'explicit'` | Whether the tokenizer model came from the main connection, sidecar selection, or an explicit override. |
| `tokenizerId` | `string | null` | Null when no exact tokenizer match was found and an approximate fallback was used. |
| `tokenizerName` | `string` | Human-readable tokenizer name (empty string when approximate). |
| `approximate` | `boolean` | True when Lumiverse fell back to its approximate char/4 heuristic. |

### CharacterAvatarUpload

*Payload for api.characters.setAvatar(id, avatar).*

| Field | Type | Description |
| --- | --- | --- |
| `data` | `Uint8Array` | Raw avatar image bytes. Source from api.utils.http.*, api.files.*, api.enclave.*, etc. |
| `filename?` | `string` | Optional filename — preserves the file extension when stored. |
| `mimeType?` | `string` | Optional content type. Defaults to 'image/png' on the host side. |

---

## API Functions

### api.chat

| Method | Arguments | Description |
| --- | --- | --- |
| `getMessages` | options? | Get messages in the current chat. Pass { last: N } for the N most recent. |
| `sendMessage` | content, options? | Append a new message. Options: role, metadata. |
| `editMessage` | id, contentOrPatch | Edit a message by ID. Pass a string to replace the active swipe's content, or a MessagePatch to update swipes / swipeId / swipeDates / reasoning / metadata. Patches touching swipe-shaped fields fire SWIPE_EDITED alongside MESSAGE_EDITED. |
| `deleteMessage` | id | Delete a message by ID. |
| `getChatId` | — | Return the active chat ID, or null. |
| `getMetadata` | key | Get a metadata value from the current chat. |
| `setMetadata` | key, value | Set a metadata key (read-modify-write). |
| `inject` | id, content, options? | Register a prompt injection. Options: mode, role, depth, ephemeral. |
| `removeInjection` | id | Remove one injection by ID. |
| `getInjections` | — | List all active injections across all scripts. |
| `clearInjections` | — | Remove all injections from this script. |
| `clearAllInjections` | — | Remove ALL injections across all scripts. |
| `registerContentProcessor` | handler, options? | Register a handler that fires before a user-initiated message write hits SQLite. Returns a patch { content?, extra? } to transform what gets stored. Options: id, priority (default 100), origin filter, timeoutMs (default 2000). NOT invoked for api.chat.* mutations (loop safety). Returns handle { id, remove }. Requires chat_mutation. |
| `listContentProcessors` | — | List all currently registered message content processors across all scripts. |

### api.llm

| Method | Arguments | Description |
| --- | --- | --- |
| `generate` | messages, options? | Generate a text response from the LLM. |
| `generateStructured` | messages, schema, options? | Generate and parse a structured JSON response against a Zod or JSON Schema. |
| `generateWithTools` | messages, tools, options?, schema? | Generate with tool schemas. Returns text or function calls for an agentic loop. |
| `dryRun` | options? | Assemble the full prompt without calling the LLM. Returns messages, token counts, WI stats. |

### api.variables.local / .global / .character

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | key, defaultValue? | Get a variable. Returns defaultValue if the key does not exist. |
| `set` | key, value | Set a variable (JSON-serialized). |
| `delete` | key | Delete a variable. Returns true if it existed. |
| `has` | key | Check if a variable exists. |
| `clear` | — | Delete all variables in this store. |

### api.json

| Method | Arguments | Description |
| --- | --- | --- |
| `parse` | text | Parse a JSON string. Throws on invalid JSON. |
| `stringify` | data, pretty? | Serialize to JSON. Pass true for formatted output. |
| `clone` | data | Deep clone a value. |
| `get` | data, path, defaultValue? | Get a nested value by dot-path (e.g. "user.address.city"). |
| `set` | data, path, value | Set a nested value by dot-path. |
| `merge` | ...objects | Deep merge objects. Later arguments override earlier ones. |
| `isValid` | text | Check if a string is valid JSON. |
| `filter` | data, predicate | Filter an array by predicate. |
| `sort` | data, key, direction? | Sort array by key (asc or desc). |
| `uniq` | data | Deduplicate array. |
| `flatten` | data | Flatten a nested array. |
| `query` | data, queryString | Run a jsonquery pipeline (jq-like). See jsonquerylang.org. |

### api.utils

| Method | Arguments | Description |
| --- | --- | --- |
| `uuid` | — | Generate a UUID v4 string. |
| `shortId` | — | Generate a short random ID (8 chars, URL-safe). |
| `wait` | ms | Pause execution for ms milliseconds. |
| `random.int` | min, max | Random integer in [min, max] inclusive. |
| `random.float` | min, max | Random float in [min, max). |
| `random.pick` | array | Pick a random element from an array. |
| `random.bool` | — | Random true/false. |
| `random.chance` | probability | Returns true with probability p (0–1). |
| `random.shuffle` | array | Return a shuffled copy of the array. |
| `http.get` | url, options? | GET request via cors_proxy. Requires allowDangerous. |
| `http.post` | url, body, options? | POST request via cors_proxy. Requires allowDangerous. |
| `http.put` | url, body, options? | PUT request via cors_proxy. Requires allowDangerous. |
| `http.delete` | url, options? | DELETE request via cors_proxy. Requires allowDangerous. |
| `http.request` | url, options | Custom HTTP request via cors_proxy. Requires allowDangerous. |
| `template.render` | template, data?, options? | Two-pass render: Lumiverse macros first, then Handlebars. Returns Promise&lt;string&gt;. |
| `template.compile` | template | Pre-compile a Handlebars template for sync reuse. No macro resolution. |
| `template.registerHelper` | name, fn | Register a custom Handlebars helper scoped to this script. |
| `macros.resolve` | template, options? | Resolve Lumiverse macros without the Handlebars pass. Pass { commit: false } for a dry resolve — extension macro handlers that honour the flag skip their side effects (useful for template previews). chatId / characterId default to the active context. Returns Promise&lt;{ text, diagnostics }&gt;. |
| `image.detectMime` | bytes | Magic-byte sniff. Returns image MIME type (image/png, image/jpeg, image/webp, image/gif, image/bmp) or null. Pair with api.characters.setAvatar when the source format is unknown — the host defaults to image/png on missing mimeType. |
| `image.dataUrlToBytes` | url | Parse a base64 data URL (data:&lt;mime&gt;;base64,&lt;payload&gt;) into { data: Uint8Array, mimeType }. Returns null for malformed or non-base64 data URIs. |
| `image.bytesToDataUrl` | bytes, mimeType | Encode bytes + MIME into a base64 data URL. Useful for previewing proposed avatars in the UI before committing via setAvatar. |

### api.ui

| Method | Arguments | Description |
| --- | --- | --- |
| `toast` | message, type?, options? | Show a native Lumiverse toast notification. Fire-and-forget. Rate-limited 5/10s. Options: title, duration. |
| `prompt` | message, defaultValue?, options? | Show a themed text input dialog. Returns entered string (trimmed) or null if cancelled. Options: placeholder, submitLabel, cancelLabel, multiline. |
| `confirm` | message, title?, options? | Show a themed confirmation dialog. Returns true if confirmed. Options: variant (info/warning/danger/success), confirmLabel, cancelLabel. |
| `showModal` | items, options | Display structured read-only content in a themed modal. Returns ModalHandle { result, openRequestId, close() }. Await handle.result for dismissal. Options: title (required), width, maxHeight, persistent. |
| `showAdvancedModal` | options | Open a modal whose body is fully script-owned via a DOMHandle (handle.root). Use api.ui.dom.* on root.update/on/... to render and wire interactive UIs. Up to 2 concurrent modals per script (pre-checked backend-side). Returns AdvancedModalHandle { modalId, root, dismissed, setTitle, dismiss, onDismiss }. Requires app_manipulation. |
| `showContextMenu` | options | Show a themed context menu at a screen position and await the user's selection. Resolves with the chosen item's key, or null if dismissed. Options: { position: { x, y }, items: [{ key, label, type?, disabled?, danger?, active? }] }. Pair with a contextmenu event listener using { preventDefault: true } to suppress the native browser menu. Free-tier. |
| `registerInputBarAction` | options | Register an action inside the chat input-bar Extras popover. Extension actions are visually grouped under a teal-badged extension header. Optional subtitle adds a second line under the label (status text, shortcut, etc.) — settable via setSubtitle for live updates. Limits: 4 per script (pre-checked backend-side), 12 global. Returns InputBarActionHandle { actionId, setLabel, setSubtitle, setEnabled, onClick, destroy }. Free-tier. |
| `createFloatWidget` | options | Create a small draggable widget overlaying the app. Body DOM is fully script-owned via handle.root (DOMHandle). Supports snap-to-edge, chromeless mode, drag-end callbacks for position persistence. Limits: 2 widgets per script (pre-checked backend-side), 8 global. Returns FloatWidgetHandle { widgetId, root, moveTo, getPosition, setVisible, isVisible, onDragEnd, destroy }. Requires ui_panels. |
| `registerDrawerTab` | options | Register a tab in the ViewportDrawer sidebar. Body DOM is script-owned via handle.root (DOMHandle). Tabs auto-appear in the command palette (Ctrl+K) searchable by title, shortName, description terms, keywords, and the extension name. Limits: 1 tab per script (LumiScript-enforced), 4 total across all LumiScript scripts (Spindle host cap), 8 global. Returns DrawerTabHandle { tabId, root, setTitle, setShortName, setBadge, activate, onActivate, destroy }. Free-tier. |
| `editText` | title?, value?, options? | Open the native Lumiverse expanded text editor with macro syntax highlighting. Blocks until close. Returns edited text or null if cancelled. Options: placeholder. |
| `pushNotification` | title, body, options? | Send an OS push notification. Only delivered when app is unfocused. Returns { sent }. Options: tag (dedup), url, icon, rawTitle, image. Requires push_notification. |
| `getPushStatus` | — | Check if push notifications are available. Returns { available, subscriptionCount }. Requires push_notification. |

### api.ui.dom

| Method | Arguments | Description |
| --- | --- | --- |
| `inject` | target, html, options? | Inject sanitized HTML at a CSS selector. Returns DOMHandle { id, update, remove, on }. Options: position (default "beforeend"), id (stable ID for idempotent injection). Requires app_manipulation. |
| `injectAtMessage` | messageId, html, options? | Inject sanitized HTML into a message bubble. Waits up to 5 s for the element if not yet rendered. Options: position ("footer" default / "header"), id (stable ID). Returns DOMHandle. Requires app_manipulation. |
| `addStyle` | css | Add a &lt;style&gt; element scoped to this script via @scope. Returns { remove() }. Use --lumiverse-* CSS variables for theming. Requires app_manipulation. |
| `cleanup` | — | Remove all DOM injections and styles created by this script. Requires app_manipulation. |

### api.files — user* (per-user persistent)

| Method | Arguments | Description |
| --- | --- | --- |
| `userRead` | path | Read a file as UTF-8 text. |
| `userWrite` | path, data | Write UTF-8 text (creates dirs as needed). |
| `userDelete` | path | Delete a file. |
| `userExists` | path | Check if a path exists. |
| `userList` | prefix? | List files under a prefix. |
| `userMkdir` | path | Create a directory. |

### api.files — shared* (extension-wide persistent)

| Method | Arguments | Description |
| --- | --- | --- |
| `sharedRead` | path | Read a file as UTF-8 text. |
| `sharedWrite` | path, data | Write UTF-8 text (creates dirs as needed). |
| `sharedDelete` | path | Delete a file. |
| `sharedExists` | path | Check if a path exists. |
| `sharedList` | prefix? | List files under a prefix. |
| `sharedStat` | path | Get file metadata (size, modifiedAt, isFile, isDirectory). |
| `sharedMkdir` | path | Create a directory. |
| `sharedMove` | from, to | Move or rename a file. |

### api.files — temp* (TTL-bound, requires ephemeral_storage)

| Method | Arguments | Description |
| --- | --- | --- |
| `tempRead` | path | Read a file as UTF-8 text. |
| `tempWrite` | path, data, options? | Write UTF-8 text. Options: { ttlMs } for expiry. |
| `tempDelete` | path | Delete a file. |
| `tempList` | prefix? | List files under a prefix. |
| `tempStat` | path | Get file metadata (sizeBytes, createdAt, expiresAt?). |
| `tempClearExpired` | — | Remove all expired files. Returns count removed. |

### api.characters

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List characters (paginated). Returns { data, total }. |
| `get` | id | Get a character by ID. Returns null if not found. |
| `getByName` | name | Find the first character whose name exactly matches (case-sensitive). Scans all pages. Returns null if no match. |
| `create` | input | Create a new character. |
| `setAvatar` | id, avatar | Replace a character's avatar image. `avatar` is { data: Uint8Array, filename?, mimeType? }. Useful for image-gen integrations or bulk avatar tooling. |
| `update` | id, input | Update a character. |
| `delete` | id | Delete a character. Returns true if deleted. |

### api.chats

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List chat sessions (paginated). Options: characterId, limit, offset. |
| `get` | id | Get a chat session by ID. |
| `getActive` | — | Get the currently active chat session. |
| `update` | id, input | Update a chat session name or metadata. |
| `delete` | id | Delete a chat session and all its messages. |
| `getMemories` | chatId?, options? | Retrieve long-term memory chunks via vector search. Falls back to active chat. |

### api.worldInfo

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List world books (paginated). |
| `get` | ref | Get a world book by ID or name. |
| `create` | input | Create a world book. |
| `update` | ref, input | Update a world book by ID or name. |
| `delete` | ref | Delete a world book and all its entries. |
| `entries.list` | ref, options? | List entries in a world book. |
| `entries.get` | entryId | Get a single entry by ID. |
| `entries.create` | ref, input | Create a new entry in a world book. |
| `entries.update` | entryId, input | Update an entry by ID. |
| `entries.delete` | entryId | Delete an entry by ID. |
| `entries.listByAutomationIdPrefix` | prefix | Find all entries across all world books whose automationId starts with the given prefix. Useful for enumerating / cleaning up entries a script owns (e.g. "lumiscript:&lt;scriptId&gt;:" convention). Returns WorldInfoEntry[]; O(books × entries-per-book). |
| `getCapturedActive` | chatId? | Get all entries that would activate for the current chat (full pipeline). |

### api.personas

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List personas (paginated). |
| `get` | personaId | Get a persona by ID. |
| `getDefault` | — | Get the default persona (isDefault = true). |
| `getActive` | — | Get the currently active persona. |
| `create` | input | Create a persona. |
| `update` | personaId, input | Update a persona. |
| `delete` | personaId | Delete a persona. |
| `switchActive` | personaId \| null | Switch the active persona. Pass null to deactivate. |
| `getWorldBook` | personaId | Get the world book attached to a persona. |

### api.council

| Method | Arguments | Description |
| --- | --- | --- |
| `getSettings` | — | Get the user's full Council settings: mode flag, members[], tool-execution settings (timeout, sidecar context window, etc.). Returns CouncilSettings verbatim. No permission required. |
| `getMembers` | — | Get the user's currently-assigned Council members with full Lumia context (role + chance from the assignment, plus avatar / definition / personality / behavior from the source Lumia item). Returns CouncilMemberContext[]. Inside a tool handler, prefer the ctx.councilMember arg passed automatically — this method is for inspecting Council state OUTSIDE a tool execution cycle. |
| `getAvailableLumiaItems` | — | Get all Lumia items available across the user's installed packs. Superset of getMembers() — includes items not currently assigned. Returns LumiItem[] (camelCase mapping of the upstream snake_case DTO). |

### api.tools

| Method | Arguments | Description |
| --- | --- | --- |
| `register` | name, def, handler | Register an LLM tool. Handler receives (args, api, ctx?) and must return a string. ctx is populated when invoked via Lumiverse TOOL_INVOCATION — read ctx.councilMember to personalise output per Council member, ctx.requestId to correlate with host-side logging. |
| `unregister` | name | Unregister a tool registered by this script. No-op if not found. |
| `list` | — | List all currently registered tools across all scripts. |
| `invoke` | name, args? | Invoke a registered tool handler directly (for use inside an agentic loop). |

### api.macros

| Method | Arguments | Description |
| --- | --- | --- |
| `register` | name, def, handler? | Register a Lumiverse macro. Omit handler for push-mode (value set via updateValue); provide handler for pull-mode (computed at resolution). |
| `updateValue` | name, value | Push a new value for a push-mode macro. Throws if the macro was registered with a handler. |
| `unregister` | name | Unregister a macro owned by this script. No-op if not found or not owned. |
| `list` | — | List all currently registered macros across all scripts. |
| `registerInterceptor` | handler, options? | Register a handler that receives the RAW template before Lumiverse parses it; return a transformed template or void to pass through. Use for iteration-heavy templates ({{#each LARGE_LIST}}…{{my_macro}}…{{/each}}) where per-macro RPC cost dominates. Options: id, priority (default 100), phase filter (prompt/display/response/other), matchTemplate (string \| string[] \| RegExp), timeoutMs (default 2000). Returns handle { id, remove }. Requires macro_interceptor permission. |
| `listInterceptors` | — | List all currently registered macro interceptors across all scripts. |

### api.broadcast

| Method | Arguments | Description |
| --- | --- | --- |
| `emit` | event, payload? | Fire a named event to all subscribed handlers across all scripts. |
| `on` | event, handler | Subscribe to a named event. Returns an unsubscribe function. |

### api.commands

| Method | Arguments | Description |
| --- | --- | --- |
| `register` | commands[] | Register (or replace) command palette entries. Max 20 per extension. |
| `unregister` | commandIds? | Remove specific commands by ID, or all if no IDs given. |
| `onInvoked` | handler | Register a handler for when the user selects a command. Returns unsubscribe fn. |

### api.events

| Method | Arguments | Description |
| --- | --- | --- |
| `track` | eventName, payload?, options? | Record a named event. Options: level, chatId, retentionDays. |
| `query` | filter? | Query events (newest-first). Filter by name, chat, date range, level, limit. |
| `replay` | filter? | Replay events (oldest-first). Same filter options as query. |
| `getLatestState` | keys[] | Retrieve latest known state for a set of keys. Useful for resuming after restarts. |

### api.enclave

| Method | Arguments | Description |
| --- | --- | --- |
| `put` | key, value | Store or overwrite an AES-256-GCM encrypted secret. Requires allowDangerous. Key: alphanumeric + _ - . (max 128 chars); value: printable ASCII, max 64 KB. |
| `get` | key | Retrieve a decrypted secret, or null if not found. Requires allowDangerous. |
| `delete` | key | Delete a secret. Returns true if it existed. Requires allowDangerous. |
| `has` | key | Check if a secret exists without decrypting it. Requires allowDangerous. |
| `list` | — | List all secret keys for this user and extension. Requires allowDangerous. |

### api.tokens

| Method | Arguments | Description |
| --- | --- | --- |
| `countText` | text, options? | Server-side token count for an arbitrary string. Uses the provider's actual tokenizer (falls back to char/4 heuristic with `approximate: true`). Options: { model?, modelSource? } — `model` overrides `modelSource`. Returns { totalTokens, model, modelSource, tokenizerId, tokenizerName, approximate }. Free-tier. |
| `countMessages` | messages, options? | Same as countText but for an array of LLMMessage-shaped items. Accepts the output of api.chat.getMessages directly (only role + content are used). Free-tier. |
| `countChat` | chatId, options? | Count tokens for a live stored chat by ID. Convenient when you want to size a whole chat without fetching messages yourself. Free-tier. |

### api.db

| Method | Arguments | Description |
| --- | --- | --- |
| `collection` | name, opts? | Open or create a collection. opts.scope = 'script' (default, per-scriptId) / 'character' (per-active-character) / 'chat' (per-active-chat). opts.schema (0.20.0+) attaches a ZodLike validator applied on every write. Path is baked into the handle at creation — throws if scope requires context (e.g. 'chat') that isn't present. Collection name: 1-64 chars, alphanumeric + _ - ., leading char must be alphanumeric. |
| `list` | scope? | List collection names visible to this script in the given scope (default `script`). Owner-scoped — cross-script visibility is not supported. |
| `exists` | name, scope? | Cheap existence check — true if the collection file exists, false otherwise. Does NOT load or parse. Ownership-safe: scope paths bake in the calling script id, so exists only sees this script's own collections. (0.20.0+) |
| `drop` | name, scope? | Delete a collection entirely. No-op if the collection does not exist. Fires `ls:collection:dropped` with deletedCount. |
| `collection.insert` | record | Insert a record. Auto-assigns id (UUID v4), createdAt, updatedAt unless caller supplies them. Returns the persisted record. With schema: validates AFTER injection; reserved fields (id/createdAt/updatedAt) are preserved even when the schema strips unknown keys. |
| `collection.insertMany` | records | Batch-insert N records with a single file-write. All records share one timestamp (batch-commit semantic). Atomicity: validation + size guard run on the final array before persist — if any record fails, NOTHING lands. Fires one `ls:collection:inserted` per record in insertion order after the persist resolves. Empty array is a fast no-op. (0.20.0+) |
| `collection.find` | filter? | Find matching records. Filter: undefined = all, Partial&lt;T&gt; = literal match with dot-notation paths, (r) =&gt; boolean = caller predicate, or operator envelope { $gt, $in, $regex, ... } per-value (0.20.0+). Direct RegExp shorthand also works: { name: /alice/i }. |
| `collection.findOne` | filter | First matching record or null. |
| `collection.update` | filter, patch | Update all matching records. Returns count. Silently strips id/createdAt/updatedAt from patch — updatedAt is bumped to Date.now() on every match. With schema: validates the MERGED record against the full schema (not the patch alone); atomic (no records persist if any validation fails). |
| `collection.delete` | filter | Delete all matching records. Returns count. |
| `collection.count` | filter? | Count matching records (or all if filter omitted). |
| `collection.clear` | — | Remove all records, leaving an empty collection file. |
| `collection.query` | jsonQuery | Run a jsonquery string against the full collection. Escape hatch for aggregations / sorts / complex projections. Example: 'filter(.margin &gt; 0) \| size()'. Throws SyntaxError on malformed queries. |

### script

| Method | Arguments | Description |
| --- | --- | --- |
| `id` | (property) | This script's stable UUID. Immutable across enables, edits, renames. Use as owner key for any external state the script creates (world-book entries via automation_id, persistent storage paths, etc.). |
| `name` | (property) | This script's current human-readable name. Tracks the Script Manager — can change when the user renames. Useful for log lines; NOT stable for ownership (use script.id for that). |
| `type` | (property) | Script type: 'trigger' or 'library'. |
| `require` | nameOrId | Load a library by name/ID, or a built-in library by ls: prefix (e.g. 'ls:components'). |

---

## Built-in Libraries

Built-in libraries are loaded via `script.require('ls:<name>')`. Two are currently shipped: `ls:components` (DOM widget factories — all operations attributed to the calling script; injection components require `app_manipulation`, HTML builders are free) and `ls:council-prompt` (pure string helpers for replicating Lumiverse's built-in Council sidecar prompt in extension tools; no permissions required; only meaningful when the tool was invoked as part of a Council cycle).

### ls:components

| Method | Arguments | Description |
| --- | --- | --- |
| `messageFooter` | messageId, html, options? | Attach a styled footer below a message bubble. Returns DOMHandle, or CollapsibleDOMHandle when options.collapsible is true. Options: { id?, className?, collapsible?, title?, defaultCollapsed? }. |
| `messageHeader` | messageId, html, options? | Attach a styled header above message content. Returns DOMHandle, or CollapsibleDOMHandle when options.collapsible is true. Options: { id?, className?, collapsible?, title?, defaultCollapsed? }. |
| `progressBar` | target, options? | Inject a progress bar with live setValue(). Returns ProgressBarHandle. Options: { value?, label?, color?, showPercent?, height?, id?, className? }. |
| `floatingButton` | label, options? | Fixed-position action button. Returns DOMHandle. Options: { position?, icon?, variant?, size?, id?, className? }. |
| `badgeHtml` | text, options? | Returns badge/pill HTML string for composing inside other injections. |
| `statBarHtml` | label, value, options? | Returns labeled stat bar HTML string. Options: { max?, color?, showValue?, height?, className? }. |
| `keyValueHtml` | label, value, options? | Returns label-value pair HTML string. Options: { muted?, className? }. |
| `multiSelect` | options | Open an advanced modal with a checkbox list + Confirm / Cancel. Resolves Promise&lt;string[] \| null&gt; — selected keys on confirm, null on cancel / dismiss / teardown. Options: { title, items, confirmLabel?, cancelLabel?, minSelect?, maxSelect?, width?, maxHeight? }. Keys returned in input item order. Requires app_manipulation (transitively via showAdvancedModal). |

### ls:council-prompt

| Method | Arguments | Description |
| --- | --- | --- |
| `buildCouncilMessages` | options | Build the full LLMMessage[] array for a Council-voice tool invocation — identity + role + tool spec + flattened context + closing directive. Returns [system, system?, user]. Throws if options.councilMember is missing. |
| `buildCouncilSystemPrompt` | options | Build just the system-prompt string used by buildCouncilMessages. Useful when composing your own message structure. |
| `buildCouncilIdentity` | councilMember | Member-identity block: "You are a council member named ..." plus WHO YOU ARE / INSTRUCTION sections when personality fields are present. |
| `roleNote` | role | Role-aware directive block. Returns "" when role is empty; otherwise prepends "\n". |
| `brevityNote` | maxWords | Word-budget directive. Returns "" when maxWords ≤ 0; otherwise prepends "\n\n" to attach as a paragraph. |
| `userControlNote` | allow | User-character guidance block. Permissive variant when allow=true, restrictive variant when false. Always non-empty (prepended with "\n\n"). |
| `debug.formatMember` | councilMember | Pretty-printed snapshot of all CouncilMemberContext fields — identifiers, identity strings, chance, gender label, avatar URL, personality strings (truncated for long values). Returns a framed string ready to console.log. |
| `debug.formatIdentity` | councilMember | Framed wrapper around buildCouncilIdentity output with the member name in the header. For "what does the identity prefix look like for this member" inspection. |
| `debug.formatSystemPrompt` | options | Framed wrapper around buildCouncilSystemPrompt output with character count in the header. Shows exactly what goes to the LLM as the system message. |
| `debug.formatMessages` | options | Framed rendering of the full LLMMessage[] array with per-message headers (index, role, char count). Reveals the context system message that isn't visible from the system-prompt view alone. |
| `debug.formatReport` | options | Comprehensive one-call dump: member snapshot + identity + system prompt + all messages, stitched together. What you reach for when you want the whole picture in one console.log. |

### Built-in types

#### MessageFooterOptions / MessageHeaderOptions

*Options for messageFooter() and messageHeader().*

| Field | Type | Description |
| --- | --- | --- |
| `id?` | `string` | Stable ID for idempotent injection (forwarded to injectAtMessage). |
| `className?` | `string` | Additional CSS class applied to the wrapper div. |
| `collapsible?` | `boolean` | Render a persistent title bar with a click-to-toggle chevron. Default: false. |
| `title?` | `string` | HTML shown in the persistent title bar (visible when collapsed). Composable with badgeHtml / keyValueHtml. Only meaningful when collapsible is true. |
| `defaultCollapsed?` | `boolean` | Initial collapsed state. Default: false (expanded). Only meaningful when collapsible is true. |

#### CollapsibleDOMHandle

*Extends DOMHandle. Returned by messageHeader() / messageFooter() when collapsible is true.*

| Field | Type | Description |
| --- | --- | --- |
| `isCollapsed()` | `() => boolean` | Current collapsed state (false = body visible). |
| `setCollapsed(collapsed)` | `(boolean) => void` | Set collapsed state explicitly. Re-renders the inner content. |
| `toggle()` | `() => void` | Flip the collapsed state. |
| `setTitle(title)` | `(string) => void` | Replace the persistent title. Preserves collapsed state and body. |
| `update(bodyHtml)` | `(string) => void` | Replace the body HTML. Preserves collapsed state and title. Overrides DOMHandle.update() — for collapsible handles, update() means "replace body", not "replace wrapper". |

#### BadgeHtmlOptions

*Options for badgeHtml().*

| Field | Type | Description |
| --- | --- | --- |
| `variant?` | `'default'|'success'|'warning'|'danger'|'info'|'accent'` | Color variant. Default: 'default'. |
| `size?` | `'sm' | 'md'` | Size preset. Default: 'md'. |
| `dot?` | `boolean` | Prepend a colored dot indicator. Default: false. |
| `className?` | `string` | Additional CSS class on the badge span. |

#### StatBarHtmlOptions

*Options for statBarHtml().*

| Field | Type | Description |
| --- | --- | --- |
| `max?` | `number` | Max value for percentage calc. Default: 100. |
| `color?` | `string` | CSS color or gradient for the fill. |
| `showValue?` | `boolean` | Show numeric value label. Default: true. |
| `height?` | `number` | Bar height in px. Default: 6. |
| `className?` | `string` | Additional CSS class. |

#### ProgressBarOptions

*Options for progressBar(). Returns ProgressBarHandle (extends DOMHandle + setValue).*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `number` | Initial value (0-100). Default: 0. |
| `label?` | `string` | Text label above the bar. |
| `color?` | `string` | CSS color or gradient for the fill. |
| `showPercent?` | `boolean` | Show percentage text. Default: true. |
| `height?` | `number` | Bar height in px. Default: 8. |
| `id?` | `string` | Stable ID for idempotent injection. |
| `className?` | `string` | Additional CSS class. |

#### MultiSelectItem

*A single selectable row in a multiSelect() items array.*

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | Stable identifier returned in the resolved array when this item is selected. |
| `label` | `string` | Primary label shown next to the checkbox. |
| `description?` | `string` | Secondary line shown below the label in dim text. |
| `checked?` | `boolean` | Initial checked state. Default: false. |
| `disabled?` | `boolean` | When true, the row is unclickable and visually dimmed. |

#### MultiSelectOptions

*Options for multiSelect(). Built on api.ui.showAdvancedModal — inherits the 2-per-script stack limit.*

| Field | Type | Description |
| --- | --- | --- |
| `title` | `string` | Modal title. Required. |
| `items` | `MultiSelectItem[]` | List of selectable items. |
| `confirmLabel?` | `string` | Label for the confirm button. Default: 'Confirm'. |
| `cancelLabel?` | `string` | Label for the cancel button. Default: 'Cancel'. |
| `minSelect?` | `number` | Minimum selections to confirm. Below this, Confirm shows a warning toast and the modal stays open. Default: 0. |
| `maxSelect?` | `number` | Maximum selections allowed. Over-limit on Confirm shows a warning toast and the modal stays open. Default: unlimited. |
| `width?` | `number` | Modal width in pixels. Default: 480. |
| `maxHeight?` | `number` | Modal max-height in pixels. Clamped to viewport. |

#### FloatingButtonOptions

*Options for floatingButton().*

| Field | Type | Description |
| --- | --- | --- |
| `position?` | `{ top?, right?, bottom?, left? }` | Fixed position. Defaults to { bottom: '80px', right: '16px' }. |
| `icon?` | `string` | HTML string for an icon (e.g. SVG). |
| `variant?` | `'default' | 'accent' | 'ghost'` | Visual variant. Default: 'default'. |
| `size?` | `'sm' | 'md'` | Size preset. Default: 'md'. |
| `draggable?` | `boolean` | Enable drag-to-reposition. Handled on the frontend for smooth UX. Default: false. |
| `id?` | `string` | Stable ID for idempotent injection. |
| `className?` | `string` | Additional CSS class. |

#### CouncilSystemPromptOptions

*Options for buildCouncilSystemPrompt() from ls:council-prompt. Three Council settings the host doesn't forward to extension tools (tool.prompt, maxWordsPerTool, allowUserControl) are supplied here — published tools probably want deterministic behavior regardless of local user preferences.*

| Field | Type | Description |
| --- | --- | --- |
| `councilMember` | `CouncilMemberContext` | Member snapshot from ToolInvocationContext.councilMember. Required — this helper only makes sense for Council-originated invocations. |
| `tool` | `{ display_name, description, prompt? }` | Tool identification + optional per-tool directive. `prompt` is appended after the tool description. |
| `maxWordsPerTool?` | `number` | Per-tool word budget. 0 or omitted → no brevity note. |
| `allowUserControl?` | `boolean` | Whether the tool may direct the user-character. Default false (restrictive). |
| `dynamicSuffix?` | `string` | Extra text appended after tool.prompt, before the brevity note. Use for tool-specific dynamic enrichment. |

#### CouncilMessagesOptions

*Extends CouncilSystemPromptOptions. Passed to buildCouncilMessages() — adds context-source fields so the helper can include chat history in the output message array. When both contextMessages and args.context are present, contextMessages takes priority (preserves role boundaries); args.context is the fallback path for older Lumiverse hosts.*

| Field | Type | Description |
| --- | --- | --- |
| `args` | `ToolInvocationArgs` | The args object from the tool handler. args.context (flattened chat context) is used as a fallback when contextMessages is absent or empty. |
| `contextMessages?` | `LLMMessage[]` | Structured chat context from ToolInvocationContext.contextMessages. When provided and non-empty, takes priority over args.context — preserves role boundaries for better LLM voice continuity. Pass through as `contextMessages: ctx.contextMessages` from your handler. Requires Lumiverse 993544c8+. |

---

## Script Packs

**Export** — click the `↓` button in the script list header to download the currently filtered scripts as a `.lumiscript.zip` file. The pack contains a `pack.json` with script names, code, triggers, bindings, folders, and metadata. IDs, timestamps, enabled state, and the allowDangerous flag are *not* included.

**Import** — click the `↑` button to pick a `.lumiscript.zip`. After validation (format version, schema, 1 MB decompressed size limit, max 100 scripts per pack), a confirmation dialog shows the script list. Imported scripts are always created with `enabled: false` and `allowDangerous: false` — review and enable them manually.
