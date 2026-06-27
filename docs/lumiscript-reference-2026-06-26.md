# LumiScript Reference

*Exported 2026-06-26*

---

## Trigger model

**LumiScript does NOT use runtime event subscription.** There is no `api.on()`, no `api.events.on()`, no `api.subscribe()`, no `api.listen()`, no `api.triggers.on()` — and no, you don't write `event.on('message', handler)` either. None of those exist. **Do not lookup_api on any of them.** The paradigm is completely different from Node.js EventEmitter or DOM event listeners.

**Event wiring is configured in the editor UI, not in the script source.** When you create or edit a script in LumiScript's script editor, an event-selector control lets you pick which Lumiverse events should run this script's body. There is no script-side syntax that subscribes — the wiring lives in the script's editor config, alongside its name, enabled flag, and binding.

**`// @triggers EVENT_NAME[, ...]` in a script header is INFORMATIVE ONLY.** It's a comment convention you may write at the top of your script to document which events the script is *intended* to be wired to. The host does not parse it — writing `@triggers` has zero runtime effect. The actual events that fire your script come from the editor-UI wiring, not from this comment. (A future LumiScript version may add a programmatic-subscription API; current versions do not.)

When a wired event fires, the **script body itself runs as the handler** — the entire body executes top-to-bottom with the event's payload available as the `data` global. No callback, no subscription object, no listener registry. `data.__event` carries the event name (e.g. `"MESSAGE_SENT"`); the rest of `data` is the event-specific payload (see the **Lumiverse Events** section for per-event payload shapes).

```js
// Optional documentary comment — has no effect on what triggers the script.
// Actual wiring (e.g. "MESSAGE_SENT, MESSAGE_EDITED") is set in the editor UI.
// @triggers MESSAGE_SENT, MESSAGE_EDITED

// The body runs every time a wired event fires.
// `data.__event` identifies which event triggered this invocation;
// the rest of `data` is the event-specific payload.
if (data.__event === 'MESSAGE_SENT') {
  const score = await api.llm.generateStructured(/* ... */);
  await api.databanks.documents.create('reviews-databank-id', {
    data: JSON.stringify(score),
    filename: `score-${data.message.id}.json`,
  });
}
```

The full list of available event names + their payload shapes + firing semantics is in the **Lumiverse Events** section below. To make a script react to one of those events, open it in the editor and select the event in the UI.

**Execution isolation — every fire is a fresh function scope.** When a wired event fires, the host wraps your script body in a brand-new `AsyncFunction` and invokes it ONCE. Module-scope `let` / `const` / `var` declarations at the top of your script body are LOCAL to that one invocation — they do NOT survive to the next fire of the same script. A pattern like:

```js
let bankId = null;
if (data.__event === 'ls:startup')  bankId = await ensureBank();
if (data.__event === 'MESSAGE_SENT' && bankId) { /* ... */ }
```

...does NOT work. The `ls:startup` fire writes to `bankId` and returns; the function instance is discarded; the next `MESSAGE_SENT` fire is a fresh `AsyncFunction` invocation with its own brand-new `bankId = null`. The two fires share no local state.

For state that needs to survive across fires, pick one of:

- **`globalThis.<key>`** — process-scoped, persists for the lifetime of the script-runner subprocess (i.e. until the extension reloads). Cheapest option; ideal for in-memory caches. Example: `globalThis.lsScoringBankId ??= await ensureBank();`. (Note: globalThis values survive *editor saves* too — see the saved memory note about globalThis-cache-invalidation traps if you cache anything keyed on script identity.)
- **`api.variables.{local,global,character,chat}`** — durable JSON-serialised stores with explicit scope semantics. Survives extension reloads.
- **Registered handlers** (`api.macros.register(...)`, `api.tools.register(...)`, `api.chat.registerContentProcessor(...)`, etc.) — these capture closures over the proxy and *do* survive across fires until the script is disabled or deleted. Useful for "subscriber-only" patterns where a script registers a handler in one fire and it fires later from a different source. **`api.broadcast.on(...)` is the one exception**: its subscriptions also persist between fires, but the owning script's next run clears them at its START and the body re-registers — so a re-firing script never stacks duplicate listeners, and a fire-once script (e.g. wired to `ls:startup`) keeps them until disabled or deleted.

**Common misconception**: "the local variable persists until the extension reloads." It does NOT. Each fire is its own scope. The boundary is per-fire, not per-extension-load.

**Three similar-sounding systems, three different problems** — keep them straight:

- **Editor-UI event wiring** — react to Lumiverse host *lifecycle* events (MESSAGE_SENT, GENERATION_ENDED, CHAT_CHANGED, ...). Configured per-script in the script editor.
- `api.broadcast.*` — real-time *script-to-script* pub/sub between user scripts running inside the same LumiScript extension. Use for custom in-extension messaging.
- `api.events.*` — *persistent log* of custom events (`track` / `query` / `replay` / `getLatestState`). Use for audit trails, state-resuming scripts, custom analytics. **NOT** for subscribing to host events.

**Lifecycle events (`ls:startup` / `ls:teardown` / `ls:reload`).** Three LumiScript-synthetic events that mark script-state transitions. `ls:startup` fires on cold-boot entry into active state (extension boot OR disable→enable transition). `ls:teardown` fires on exit (disable / delete). `ls:reload` fires on hot in-place body refresh (autosave-with-`// @ls:reload-on-edit`-directive OR manual Reload button click). The first two are symmetric subscription events — opt in via the editor's event-picker checkbox. **`ls:reload` is the exception**: it is NOT in the picker — it fires deterministically as a side-effect of the Reload button (always) or the autosave directive (always, for scripts that declared it). Parallel to the Run button: a user action, not a subscription. The body re-runs on all three events; branch on `data.__event` to differentiate handling. **Reload also wipes per-script state** (DOM, modals, widgets, drawer tabs, handler closures, interceptors, injections, ...) BEFORE the body re-runs, while preserving `api.scriptStorage`, `api.theme.*` contributions, and the worker's `script.require()` cache — so an `ls:reload` body run lands into a clean slate equivalent to a fresh `ls:startup`. Use `if (data.__event === "ls:startup")` branches for code that should run EXCLUSIVELY on cold boot (default-config seeding, persistent-data migrations) — those fires once per active-state entry, not on every Reload click. To make init code re-run on both events, branch on `(data.__event === "ls:startup" || data.__event === "ls:reload")` or put it at the top of the body un-gated. v1.0.0-rc.8+ for the wipe semantics.

**Sandbox hardening.** The script-runner sandbox locks down host capabilities that user scripts have no business reaching. Two layers gate this:

- **Dispatch-time source check.** Scripts containing any of the following patterns are REJECTED before they run; the editor console shows a `[security]` entry naming the rejected pattern:
  - `import('...')` / `await import('...')` — dynamic import. Use `script.require('library-name')` for inter-script dependencies (see the **Built-in Libraries** section).
  - bare `require('...')` — CommonJS-style global require. Same migration: `script.require('library-name')`. Note: `script.require(...)` and method-style `obj.require(...)` are NOT rejected (the source check uses `(?<!\.)` lookbehind to exclude method access).
  - `new Function('...')` / `Function('...')` — Function constructor. Define functions with normal syntax (`function foo() {}` / `const foo = () => {}`); same lookbehind exempts method-style `obj.Function(...)`.
  - `.constructor.constructor` — prototype-chain access to the Function constructor.
  - literal `globalThis.Bun` / `globalThis["Bun"]` — Bun runtime API. Use `api.utils.http.*` for HTTP, `api.files.*` (with `allowDangerous`) for filesystem.
  - literal `globalThis.process` / `globalThis["process"]` — host process. Use `api.enclave.*` for secrets, never read host env vars from a script.

- **Runtime globalThis lockdown.** At subprocess startup, every globalThis property not on the LumiScript allowlist is replaced with `undefined`. `typeof X` returns `'undefined'`; reading `X.method()` throws `TypeError`. Affects: `fetch`, `Worker`, `WebSocket`, `BroadcastChannel`, `XMLHttpRequest`, `EventSource`, `prompt`, `onerror`, `onmessage`, `postMessage`, `removeEventListener`, and Bun-specific Node-compat module globals (`fs`, `http`, `net`, `os`, `tls`, `vm`, `worker_threads`, `child_process`, `ffi`, `sqlite`, etc.). Standard ES built-ins (Object, Array, Promise, JSON, Math, Date, RegExp, Map, Set, etc.), timers (`setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `queueMicrotask`, `structuredClone`), cancellation primitives (`AbortController`, `AbortSignal`), `crypto`, `WebAssembly`, `performance`, `Buffer`, base64 codecs (`atob`, `btoa`), web data carriers (Blob, File, FileReader, FormData, Headers, Request, Response), event types (Event, EventTarget, CustomEvent), and streams (ReadableStream/WritableStream/TransformStream) are all left accessible. The canonical list is `SAFE_GLOBALS` in `src/script-runner/child-entry.ts`.

- **Layer-2 setTimeout/setInterval string-form rejection.** `setTimeout` and `setInterval` are whitelisted but monkey-patched to reject the string-form callback (the legacy `setTimeout('foo()', 100)` API that some runtimes still honour). Passing a string throws `TypeError: setTimeout requires a function callback (string form is not supported in the LumiScript sandbox)`. Always pass a function.

**Console rate-limit.** Unhandled rejections from a single script are rate-limited to **10 per 60s window**; further rejections drop silently with a `"N additional rejection(s) were suppressed"` summary on the next-window rejection. Prevents a runaway loop from filling the editor console + backend stderr with millions of lines. The 10-per-minute cap is intentional — most legitimate scripts produce ≪ 1 rejection/minute under normal operation.

---

## Lumiverse Events

| Event | Group | Payload shape |
| --- | --- | --- |
| `ls:startup` | LumiScript | `{ __event: "ls:startup" }` |
| `ls:teardown` | LumiScript | `{ reason: 'disabled' | 'deleted', scriptId, scriptName }` |
| `ls:reload` | LumiScript | `{ reason: 'autosave' | 'manual', previousCodeHash, currentCodeHash, previousLength, currentLength, triggeredAt }` |
| `MESSAGE_SENT` | Chat | `{ chatId, message: Message }` |
| `MESSAGE_EDITED` | Chat | `{ chatId, message: Message }` |
| `MESSAGE_DELETED` | Chat | `{ chatId, messageId }` |
| `MESSAGE_SWIPED` | Chat | `{ chatId, message: Message, action, swipeId, previousSwipeId? }` |
| `SWIPE_EDITED` | Chat | `{ chatId, message: Message, previousSwipeId }` |
| `CHARACTER_MESSAGE_RENDERED` | Chat | `{ chatId, messageId }` |
| `USER_MESSAGE_RENDERED` | Chat | `{ chatId, messageId }` |
| `GENERATION_STARTED` | Generation | `{ generationId, chatId, model }` |
| `GENERATION_ENDED` | Generation | `{ generationId, chatId, messageId, content }` |
| `GENERATION_STOPPED` | Generation | `{ generationId, chatId, content }` |
| `STREAM_TOKEN_RECEIVED` | Generation | `{ generationId, chatId, token }` |
| `CHAT_CHANGED` | Entities | `{ chat, changedFields }  // chat = the full updated Chat; chatId is `chat.id`, not flat` |
| `CHAT_SWITCHED` | Entities | `{ chatId: string | null }  // null on return-to-home — NO characterId on the payload` |
| `CHAT_FORKED` | Entities | `{ sourceChatId, forkedChatId, chat, branchId, forkedAtMessageId, forkedAtMessageIndex }` |
| `CHARACTER_CREATED` | Entities | `{ character: Character }` |
| `CHARACTER_EDITED` | Entities | `{ id, character: Character }` |
| `CHARACTER_DELETED` | Entities | `{ id }` |
| `CHARACTER_DUPLICATED` | Entities | `{ id, newId }` |
| `PERSONA_CHANGED` | Entities | `{ persona: Persona }` |
| `IMAGE_UPLOADED` | Images | `{ image }` |
| `IMAGE_DELETED` | Images | `{ id }` |
| `WORLD_INFO_ACTIVATED` | World Info | `{ entries: WorldInfoEntry[] }` |
| `WORLD_BOOK_CHANGED` | World Info | `{ id, worldBook: WorldInfo }` |
| `WORLD_BOOK_DELETED` | World Info | `{ id }` |
| `WORLD_BOOK_ENTRY_CHANGED` | World Info | `{ id, worldBookId, entry: WorldInfoEntry }` |
| `WORLD_BOOK_ENTRY_DELETED` | World Info | `{ id, worldBookId }` |
| `SETTINGS_UPDATED` | Settings | `{ key, value }` |
| `PRESET_CHANGED` | Settings | `{ presetId }` |
| `CONNECTION_PROFILE_LOADED` | Settings | `{ connectionId }` |
| `REGEX_SCRIPT_CHANGED` | Settings | `{ id, script: RegexScriptInfo }  // create / update / duplicate / reorder / enable / disable. Requires regex_scripts permission.` |
| `REGEX_SCRIPT_DELETED` | Settings | `{ id }  // Requires regex_scripts permission.` |
| `PERMISSION_CHANGED` | System | `{ extensionId, permission, granted, allGranted: string[] }` |

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
| `api.llm.generateStream` | `generation` |
| `api.llm.generateStructured` | `generation` |
| `api.llm.generateWithTools` | `generation` |
| `api.llm.dryRun` | `generation` |
| `api.connections.* (read-only)` | *none* |
| `api.webSearch.*` | `web_search` |
| `api.users.* (read-only)` | *none* |
| `api.version.* (read-only)` | *none* |

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
| `api.ui.mountApp` | `app_manipulation` |
| `api.ui.editText` | *none* |
| `api.ui.pushNotification` | `push_notification` |
| `api.ui.getPushStatus` | `push_notification` |
| `api.ui.createFloatWidget` | `ui_panels` |
| `api.ui.openDrawerTab / closeDrawer / openSettings / openCommandPalette / getDrawerTabs (navigation)` | *none* |
| `api.ui.pickFile (native file picker)` | *none* |
| `api.ui.events.* (reactive UI state)` | *none* |
| `api.ui.dom.*` | `app_manipulation` |
| `api.ui.components.*` | `app_manipulation` |

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
| `api.worldInfo.* (CRUD + getCapturedActive)` | `world_books` |
| `api.worldInfo.registerInterceptor / listInterceptors` | `generation` |
| `api.personas.*` | `personas` |
| `api.presets.*` | `presets` |
| `api.memories.* (Memory Cortex + chat memory)` | `memories` |
| `api.regexScripts.*` | `regex_scripts` |
| `api.images.*` | `images` |
| `api.imageGen.*` | `image_gen` |
| `api.oauth.*` | `oauth` |
| `api.theme.*` | `app_manipulation` |
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
| `api.rpc.*` | *none* |

---

## Sandbox hardening

The script-runner subprocess locks down host capabilities that user scripts have no business reaching. Two layers gate this — both are always on; there is no per-script opt-out. Cross-reference the `app_manipulation` and `cors_proxy` permissions in the **Permission Matrix** for how scripts opt in to specific surfaces that the sandbox otherwise denies.

### Layer 1 — dispatch-time source check

Scripts containing any of the patterns below are **rejected before they run**; the editor console shows a `[security]` entry naming the rejected pattern.

| Pattern | Why | Use instead |
| --- | --- | --- |
| `import('...')` | Dynamic import lets scripts pull untrusted modules at runtime, bypassing every other check. | `script.require('library-name')` for inter-script libraries — see the Built-in Libraries section. |
| `require('...')` | Bare CommonJS `require` would reach Node modules directly. | `script.require('library-name')`. Method-style access — `obj.require(...)` — is exempt via the source check's `(?<!\.)` lookbehind. |
| `new Function('...') / Function('...')` | Runtime-constructed code bypasses the dispatch-time source check. | Normal function syntax: `function foo() {}` / `const foo = () => {}`. Method-style `obj.Function(...)` is exempt. |
| `.constructor.constructor` | Prototype-chain path that reaches the Function constructor. | Same as above — define functions with normal syntax. |
| `globalThis.Bun / globalThis["Bun"]` | Direct access to the Bun runtime API. | `api.utils.http.*` for HTTP, `api.files.*` (with `allowDangerous`) for filesystem. |
| `globalThis.process / globalThis["process"]` | Direct access to the host process (env vars, exit, signals). | `api.enclave.*` for secrets, the `script.*` global for self-info. No script should ever read host env vars directly. |

### Layer 2 — runtime `globalThis` lockdown

At subprocess startup, every `globalThis` property NOT on the allowlist below is replaced with `undefined`. Reading a locked global returns `undefined` (so `typeof X === 'undefined'` evaluates naturally for feature-detect paths); reaching through to a method throws `TypeError: Cannot read properties of undefined`.

| Category | Available globals |
| --- | --- |
| ES standard | `isNaN` `isFinite` `parseInt` `parseFloat` `NaN` `Infinity` `undefined` `encodeURI` `encodeURIComponent` `decodeURI` `decodeURIComponent` `escape` `unescape`&lt;br&gt;&lt;br&gt;*Standard ES global functions + value constants. Pure, no capability surface.* |
| Core built-ins | `Object` `Array` `Number` `Boolean` `String` `Symbol` `Date` `RegExp` `Map` `Set` `WeakMap` `WeakSet` `WeakRef` `Promise` `Proxy` `Reflect` `JSON` `Math` `Intl` `BigInt` |
| Typed arrays + binary | `ArrayBuffer` `SharedArrayBuffer` `DataView` `Atomics` `Int8Array` `Uint8Array` `Uint8ClampedArray` `Int16Array` `Uint16Array` `Int32Array` `Uint32Array` `Float16Array` `Float32Array` `Float64Array` `BigInt64Array` `BigUint64Array` |
| Text + URL + base64 | `TextEncoder` `TextDecoder` `URL` `URLSearchParams` `URLPattern` `atob` `btoa`&lt;br&gt;&lt;br&gt;*Pure codecs and URL parsing — no I/O surface.* |
| Binary data carriers | `Blob` `File` `FileReader` `FormData`&lt;br&gt;&lt;br&gt;*In-memory only; filesystem access still gated by `api.files.*` + `allowDangerous`.* |
| HTTP message types | `Headers` `Request` `Response`&lt;br&gt;&lt;br&gt;*Structural types only. Outbound HTTP capability is `api.utils.http.*` (requires `cors_proxy` + `allowDangerous`).* |
| Streams | `ReadableStream` `WritableStream` `TransformStream` `ByteLengthQueuingStrategy` `CountQueuingStrategy` `CompressionStream` `DecompressionStream` `TextEncoderStream` `TextDecoderStream`&lt;br&gt;&lt;br&gt;*Pure data transforms. The dangerous part of streams is what you READ FROM or PIPE TO; those endpoints are separately gated.* |
| Web Crypto | `crypto` `Crypto` `CryptoKey` `SubtleCrypto`&lt;br&gt;&lt;br&gt;*Random bytes + `crypto.subtle.*` for signing / encryption. Also powers `api.utils.shortId` / `uuid`.* |
| Async + timers | `setTimeout` `setInterval` `clearTimeout` `clearInterval` `queueMicrotask` `setImmediate` `clearImmediate` `structuredClone` `reportError`&lt;br&gt;&lt;br&gt;*String-form `setTimeout('code', ms)` is rejected at the wrapper — must pass a function.* |
| Cancellation | `AbortController` `AbortSignal` |
| Errors + iteration | `Error` `TypeError` `RangeError` `ReferenceError` `SyntaxError` `URIError` `EvalError` `AggregateError` `Iterator` `DisposableStack` `AsyncDisposableStack` `SuppressedError` |
| Event types | `Event` `EventTarget` `CustomEvent` `MessageEvent` `ErrorEvent` `CloseEvent` `DOMException`&lt;br&gt;&lt;br&gt;*Pure data carriers, no capability.* |
| Function constructor | `Function`&lt;br&gt;&lt;br&gt;*Whitelisted on architectural necessity — Zod's schema compiler and Handlebars' template compiler both invoke `new Function(...)`. The dispatch-time source check still rejects literal `new Function(...)` / `Function(...)` in user-script source as defence-in-depth.* |
| Buffer | `Buffer`&lt;br&gt;&lt;br&gt;*Node-compat — user scripts can manipulate bytes; doesn't enable escape.* |
| Performance + measurement | `performance` `Performance` `PerformanceEntry` `PerformanceMark` `PerformanceMeasure` `PerformanceObserver` `PerformanceObserverEntryList` `PerformanceResourceTiming` `PerformanceServerTiming` `PerformanceTiming` |
| Realm + messaging | `ShadowRealm` `MessageChannel` `MessagePort`&lt;br&gt;&lt;br&gt;*`ShadowRealm` is whitelisted for experimentation; within a single subprocess `MessageChannel`/`MessagePort` can't reach anything dangerous.* |
| Misc benign | `globalThis` `console` `navigator` `WebAssembly` `FinalizationRegistry` `HTMLRewriter` `BuildError` `BuildMessage` `ResolveError` `ResolveMessage`&lt;br&gt;&lt;br&gt;*`navigator` is the read-only Bun metadata object (`userAgent`, `platform`, etc.) — library code feature-detects via it. `console` is per-run shadowed for capture, but kept on the allowlist so the binding exists in the brief window before the per-run preamble.* |
| Architectural necessity | `spindle` `process`&lt;br&gt;&lt;br&gt;*Both have known aliasing residuals documented in the security audit response. `spindle` is the host gateway — not present on the script-runner subprocess in production (only on the backend worker); whitelisted for test-infrastructure shape. `process` is whitelisted because Spindle's subprocess runtime uses the standard process lifecycle hooks internally; user-script access to bare `process` is closed by AsyncFunction parameter shadowing (Layer 1) and the dispatch-time source check (Layer 4).* |

Notable globals that are *not* on the allowlist (representative, not exhaustive): `fetch` (use `api.utils.http.*`), `Worker`, `WebSocket`, `EventSource`, `BroadcastChannel`, `XMLHttpRequest`, browser dialogs (`alert` / `prompt` / `confirm`), and Node-compat module globals reached via `globalThis` (`fs`, `http`, `net`, `tls`, `vm`, `worker_threads`, `child_process`, `sqlite`, etc.). The canonical list of accessible globals is `SAFE_GLOBALS` in `src/script-runner/child-entry.ts`.

---

## LumiScript Events

| Event | Payload fields | Emitted by |
| --- | --- | --- |
| `ls:tool:registered` | `{ name, scriptId }` | api.tools.register() |
| `ls:tool:unregistered` | `{ name, scriptId }` | api.tools.unregister() / auto-cleanup |
| `ls:tool:invoked` | `{ name, args, result, scriptId, callMs, councilMember? }` | api.tools.invoke() + host tool dispatch (Council / direct LLM) |
| `ls:macro:registered` | `{ name, scriptId, mode: 'push' | 'pull' }` | api.macros.register() |
| `ls:macro:unregistered` | `{ name, scriptId }` | api.macros.unregister() / auto-cleanup |
| `ls:collection:created` | `{ name, scope, scriptId, path }` | api.db.collection() |
| `ls:collection:dropped` | `{ name, scope, scriptId, path, deletedCount }` | api.db.drop() |
| `ls:collection:inserted` | `{ name, scope, scriptId, id, record }` | collection.insert() |
| `ls:collection:updated` | `{ name, scope, scriptId, count, filterKind: 'all' | 'object' | 'fn' }` | collection.update() (only when count &gt; 0) |
| `ls:collection:deleted` | `{ name, scope, scriptId, count, filterKind }` | collection.delete() / clear() (clear emits count=-1) |
| `ls:collection:size-warning` | `{ name, scope, scriptId, bytes }` | auto — collection exceeds 10 MB soft threshold |
| `ls:scriptStorage:set` | `{ scriptId, key, value }` | api.scriptStorage.set() |
| `ls:scriptStorage:delete` | `{ scriptId, key }` | api.scriptStorage.delete() (only when the key existed) |
| `ls:scriptStorage:clear` | `{ scriptId }` | api.scriptStorage.clear() / auto-cleanup on script disable / delete (only when the script HAD entries) |

*The `ls:` prefix is reserved for LumiScript engine events. Use any other name for custom events between scripts.*

---

## Directives

LumiScript **runtime directives** are special comments that change how the runtime treats your script. They live anywhere at line start in the script source and follow the form `// @ls:<directive-name>`. The `@ls:` prefix distinguishes runtime-active directives from passive frontmatter tags like `@description`, `@author`, `@version`, `@tags` — those are read by humans and the pack import/export tooling but don't affect runtime behavior. Detection happens at `update_script` time (each code save); no persistence, no schema change.

| Directive | Applies to | What it does |
| --- | --- | --- |
| `// @ls:reload-on-edit` | Enabled trigger scripts (libraries are loaded on-demand and ignore the directive). | Opts the script INTO automatic hot-reload after a code save. Without this directive, the script's closures stay stale until the next real trigger fire or until the user clicks the Reload button on the editor topbar. Add the directive to scripts whose module-scope code is idempotent and cheap (no expensive LLM calls, no duplicate DB writes, no leaked timers). The body re-runs end-to-end on each edit ~500ms after the autosave settles. |

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
| `swipeDates` | `number[]` | Per-swipe creation timestamps (unix epoch seconds), aligned with swipes. |
| `extra` | `Record<string, unknown>` | Host-maintained bag: reasoning text/duration, attachments, hidden flag, etc. Keys depend on host build — treat as opaque. Empty object on older hosts. |

### Message

*The RAW host message record delivered as `data.message` by chat events (MESSAGE_SENT, MESSAGE_EDITED, MESSAGE_SWIPED, SWIPE_EDITED). Snake_case — distinct from the camelCase `ChatMessage` DTO returned by api.chat.getMessages(). Most importantly it uses `is_user` (boolean), NOT `role`.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Message identifier. |
| `content` | `string` | Plain-text message content. |
| `is_user` | `boolean` | True for a user message, false for an assistant message. There is NO `role` field — use this. |
| `name` | `string` | Sender display name. |
| `swipe_id` | `number` | Index of the active swipe variant. |
| `swipes` | `string[]` | All swipe variants. |
| `swipe_dates` | `number[]` | Per-swipe creation timestamps (unix epoch seconds), aligned with swipes. |
| `extra` | `Record<string, unknown>` | Host-maintained bag (reasoning, attachments, hidden flag, etc.). Treat as opaque. |

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
| `triggerGeneration?` | `boolean` | When true, the host triggers a normal LLM continuation after the message is appended (full preset / persona / world info / regex / character card / streaming pipeline — same as the user pressing Enter on an empty input bar). Use for click-to-respond UIs where the script wants the LLM to immediately reply to its appended message. |
| `generation?` | `ChatGenerationOptions` | Per-call overrides for the triggered generation (connection / persona / preset / parameters / target character / council retention). Only consulted when triggerGeneration is true; silently ignored otherwise. Each field is optional and falls through to the active chat's defaults when omitted. |

### ChatGenerationOptions

*Per-call generation overrides for api.chat.sendMessage(content, { triggerGeneration: true, generation: ... }). Mirrors the host's ChatAppendGenerationOptionsDTO 1:1 in camelCase. Each field is optional; omitted fields fall through to the active chat's resolved defaults (same as a manual UI generation). Use this when a tool script needs to deviate from the user's normal chat configuration for a single triggered generation.*

| Field | Type | Description |
| --- | --- | --- |
| `connectionId?` | `string` | Override which connection profile to use. Falls back to the user's default connection. |
| `personaId?` | `string` | Override which persona to use. Falls back to the user's active persona setting. |
| `personaAddonStates?` | `Record<string, boolean>` | Per-addon enable/disable map for the chosen persona. Keys are addon ids; values are booleans. Omitted addons inherit chat-level state. |
| `presetId?` | `string` | Override which preset to use. Falls back to the active preset setting (activeLoomPresetId), then to the connection's attached preset. |
| `forcePresetId?` | `boolean` | When true, forces the supplied presetId over a connection-bound preset. Currently only consulted by the host's impersonation oneliner pipeline; triggerGeneration runs as generation_type "normal" where this field is a silent no-op. Exposed for fidelity with the host DTO. |
| `parameters?` | `Record<string, unknown>` | Per-call parameter overrides (temperature, max_tokens, top_p, etc.) layered on the resolved preset's parameters. Provider-specific keys accepted; forwarded verbatim. |
| `targetCharacterId?` | `string` | For group chats only: which character should respond. Falls back to the chat's character_id. |
| `retainCouncil?` | `boolean` | When true, retains council-tool results from the previous generation rather than re-running them. Useful for cheap regenerate-style flows where the council context hasn't changed. Default false. |

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
| `origin` | `'create' | 'update' | 'swipe_add' | 'swipe_update' | 'render'` | Which path triggered this invocation. 'create' includes auto-greetings. 'render' fires on per-message display rendering — non-persisting, fires often, returned extra ignored. |
| `swipeIndex?` | `number` | Set for 'swipe_update' only — zero-based index of the swipe being rewritten. |
| `userId` | `string` | Owning user id for the write. |

### MessageContentProcessorResult

*Return value of a registerContentProcessor handler. Return undefined / void to pass through, or a partial patch. content replaces the stored content. extra shallow-merges into existing — keys you omit are PRESERVED. extra is IGNORED on swipe origins (swipes share the parent message's extra) and on 'render' (no row to mutate). Return ONLY keys you mutated; pristine initial.extra keys are NOT round-tripped to avoid re-stamping unchanged keys on every write.*

| Field | Type | Description |
| --- | --- | --- |
| `content?` | `string` | Replaces the stored content for downstream processors and the DB write. On 'render', feeds the display-regex pass before paint. |
| `extra?` | `Record<string, unknown>` | Delta keys to shallow-merge. Ignored on swipe origins and 'render'. |

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

### MountAppOptions

*Options for api.ui.mountApp(). All optional.*

| Field | Type | Description |
| --- | --- | --- |
| `className?` | `string` | CSS class applied to the mount container. |
| `position?` | `'start' | 'end' | 'app-overlay'` | Where the portal sits: before / after the main view, or covering it ('app-overlay'). Default host-defined. |

### MountedAppHandle

*Returned by api.ui.mountApp(). A route-persistent full-bleed document.body portal. Body DOM is script-owned via root (DOMHandle); the root element carries data-ls-script + data-ls-mount so api.ui.dom.addStyle() @scope rules match content inside.*

| Field | Type | Description |
| --- | --- | --- |
| `mountId` | `string` | UUID identifying this mount. Available synchronously. |
| `root` | `DOMHandle` | DOMHandle bound to the mount's content container. Render + wire via api.ui.dom.*; calls are buffered until the frontend has created the mount. |
| `setVisible(visible)` | `(boolean) => void` | Show or hide the mount without destroying it. |
| `destroy()` | `() => void` | Remove the mount from the app shell. Idempotent — subsequent calls and method invocations are silent no-ops. |

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

### UIDrawerTab

*A drawer tab discoverable via api.ui.getDrawerTabs() — built-in or extension-contributed. The id is what you pass to api.ui.openDrawerTab().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable tab id (→ openDrawerTab(id)). |
| `shortName` | `string` | Short label shown beneath the sidebar icon. |
| `tabName` | `string` | Full title shown in menus and the command palette. |
| `tabDescription` | `string` | One-line description shown in the command palette. |
| `keywords` | `string[]` | Keywords used for command-palette fuzzy search. |
| `source` | `'builtin' | 'extension'` | Whether the tab is built into Lumiverse or contributed by an extension. |
| `extensionId?` | `string` | For extension-contributed tabs, the owning extension's identifier. |

### UISettingsTab

*A settings tab discoverable via api.ui.getSettingsTabs(). Role-restricted tabs are filtered out for users lacking the role. The id is what you pass to api.ui.openSettings().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable tab id (→ openSettings(id)). |
| `shortName` | `string` | Short label shown in the settings sidebar. |
| `tabName` | `string` | Full title shown in the settings header / command palette. |
| `tabDescription` | `string` | One-line description shown in the command palette. |
| `keywords` | `string[]` | Keywords used for command-palette fuzzy search. |
| `role?` | `'admin' | 'owner'` | Set when the tab is only visible to certain roles. |

### PickFileOptions

*Options for api.ui.pickFile().*

| Field | Type | Description |
| --- | --- | --- |
| `accept?` | `string[]` | File-type filters — extensions and/or MIME types (e.g. ['.json', 'application/json']). |
| `multiple?` | `boolean` | Allow selecting more than one file. Default: false. |
| `maxSizeBytes?` | `number` | Maximum size per file in bytes. pickFile() rejects if a selected file exceeds this. |

### PickedFile

*A file returned by api.ui.pickFile(). bytes is the raw Uint8Array — decode text via new TextDecoder().decode(bytes), or pass to api.images.upload / api.files.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Original file name. |
| `mimeType` | `string` | MIME type (falls back to 'application/octet-stream'). |
| `sizeBytes` | `number` | File size in bytes. |
| `bytes` | `Uint8Array` | Raw file contents. |

### UIKeyboardState

*Snapshot from api.ui.events.getKeyboardState() / onKeyboardChange().*

| Field | Type | Description |
| --- | --- | --- |
| `visible` | `boolean` | True when the host believes a virtual keyboard is currently visible. |
| `insetBottom` | `number` | Safe bottom inset in CSS pixels that keeps content above the keyboard. |
| `viewportWidth` | `number` | Current visual viewport width in CSS pixels. |
| `viewportHeight` | `number` | Current visual viewport height in CSS pixels. |

### UIDrawerState

*Snapshot from api.ui.events.getDrawerState() / onDrawerChange().*

| Field | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | Whether the side drawer is currently open. |
| `tabId` | `string | null` | Active drawer tab id, or null. |

### UISettingsState

*Snapshot from api.ui.events.getSettingsState() / onSettingsChange().*

| Field | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | Whether the settings modal is currently open. |
| `view` | `string` | Active settings view identifier. |

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

### DOMDelegateOptions

*Options for api.ui.dom.delegate(selector, event, handler, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `root?` | `'chat' | 'document'` | Where to attach the actual host-side capture listener. 'chat' (default): restricts matching to chat content; matches descendants of [data-message-id]. 'document': matches anywhere in the page (including Lumiverse's own UI surfaces). Both gate on app_manipulation. |
| `messageId?` | `string` | Limit matching to a specific message id. Has no effect when root is "document". |
| `preventDefault?` | `boolean | ConditionalPreventDefault` | When true, the frontend listener calls event.preventDefault() before dispatching on every selector match. Can also be a ConditionalPreventDefault object to fire only on specific key / button / modifier combinations (e.g. plain Enter on textarea while letting Shift+Enter through). Default: false. |
| `stopPropagation?` | `boolean` | When true, the frontend listener calls event.stopPropagation() after dispatching, preventing host-side and other delegation listeners from also reacting. Default: false. |

### DOMDelegatedEventData

*Event data delivered to handlers registered via api.ui.dom.delegate(). Extends DOMEventData with a serialized snapshot of the matched element + modifier-key state + optional message context.*

| Field | Type | Description |
| --- | --- | --- |
| `matched` | `{ tagName, classList, dataset, attributes, textContent, id?, value?, checked?, selectedIndex?, selectedText?, label? }` | Snapshot of the element matched by event.target.closest(selector). May be an ancestor of the literal event.target. Form-input fields (value/checked/selectedIndex/selectedText/label) populated only for matching element types. label is the trimmed text of the first associated &lt;label&gt; (input / textarea / select only — explicit "for=" or implicit wrapping). |
| `modifiers` | `{ ctrl, shift, alt, meta, button? }` | Modifier-key state at event time. button is populated for click events (0=left, 1=middle, 2=right). |
| `message?` | `{ id, role, swipeId }` | Populated when the matched element is inside an assistant or user message. role: 'user' for [data-part="user"], 'assistant' otherwise. swipeId is the active swipe at dispatch time, resolved backend-side via the host's chat history. Falls through with 0 if the chat closed between event fire and dispatch or the message left the history. |
| `(plus DOMEventData fields)` | `see DOMEventData` | Inherits type, targetId, targetValue, targetChecked, dataset, detail, clientX, clientY from DOMEventData (see above). |

### DOMHandle

*Returned by api.ui.dom.inject() and api.ui.dom.injectAtMessage(). Most methods are fire-and-forget; the exception is `read(options?)` which is async (it awaits a frontend roundtrip).*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique element ID (generated or from stable ID). |
| `update(html)` | `void` | Replace the inner HTML of the injected element. Sanitised via DOMPurify on the same FORBID_TAGS config as `api.ui.dom.inject` (`iframe` / `frame` / `object` / `embed` / `form` + default `on*` / `formaction` / `srcdoc` / `javascript:` strip). DOMPurify blocks XSS-via-tag-injection, but is not a substitute for thinking about trust — be deliberate about LLM-generated or externally-fetched HTML. |
| `remove()` | `void` | Remove the element from the DOM and detach all listeners. |
| `on(event, handler, options?)` | `() => void` | Attach a DOM event listener. Handler receives DOMEventData. Pass { preventDefault: true } to suppress the browser default synchronously (e.g. to block the native context menu on right-click). Returns an unsubscribe function. **For handlers that do async work, make the handler `async` and `await` everything** — the host keeps the per-fire activeRun alive across the handler's await chain, so dispatches inside the awaited chain land cleanly. A SYNC handler that kicks off async work fire-and-forget (e.g. `(ev) => { doAsync(); }` with no `await`) returns `undefined` immediately, the activeRun closes, and any `api.*` calls the lingering async work tries to make fail with `RunCompletedError: late api call … runIdSource=context`. Write `async (ev) => { await doAsync(); }` instead. |
| `makeDraggable(handleSelector?)` | `void` | Enable frontend-only drag. Optional CSS selector picks a drag handle child; the root element moves. Without a selector, the whole element is draggable. |
| `injectChild(target, html, options?)` | `DOMHandle` | Inject HTML as a descendant of this handle's bound element. Target selector resolved RELATIVE to this element via the backend's element-map ref. Use when the parent may be orphaned at inject time (drawer tabs, modal bodies pre-mount). Sanitised via DOMPurify on the same FORBID_TAGS config as `api.ui.dom.inject` (`iframe` / `frame` / `object` / `embed` / `form` + default `on*` / `formaction` / `srcdoc` / `javascript:` strip). |
| `read(options?)` | `Promise<SerializedDOMElement | null>` | Read a snapshot of this element's current DOM state (tag, attrs, text, childCount, optionally innerHTML). Returns `null` when the FE no longer has the element (host shell tore down a parent, etc.). Throws DomHandleReleasedError if the handle was already removed (`.remove()` or `api.ui.dom.cleanup()`). Async — uses the same request-response IPC pattern as api.ui.showContextMenu. Common uses: verify an injection rendered as expected, inspect script-controlled widget state, walk markup via `{ html: true }`. For form-control live values use `delegate(selector, 'input', ...)` instead — `.value` is a DOM property, not an attribute. |

### MountedComponentHandle

*Returned synchronously by api.ui.components.mountBadge / mountSpinner (display-only components). Methods are fire-and-forget.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique component ID (host-assigned). |
| `update(patch)` | `void` | Merge a partial of the original mount options into the live component. Pass only the fields to change. Fire-and-forget (no round-trip). |
| `destroy()` | `void` | Unmount the component and release host resources. The container element you mounted into is left in place. Idempotent. |

### MountedValueComponentHandle

*Generic `MountedValueComponentHandle<TOptions, TValue>`. Returned by interactive mounts (api.ui.components.mountSwitch → boolean, mountTextInput → string). Extends MountedComponentHandle with an async getValue().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique component ID. |
| `update(patch)` | `void` | Merge a partial of the mount options into the live component. Fire-and-forget. |
| `destroy()` | `void` | Unmount + release. Also drops the component's registered callbacks. Idempotent. |
| `getValue()` | `Promise<TValue>` | Read the component's current value. ASYNC here (a frontend round-trip across the worker boundary), unlike the host's synchronous getValue(). Same reason DOMHandle.read() is async. Auto-controlled state lives host-side — you don't need to mirror it. |

### SpindleBadgeOptions

*Options for api.ui.components.mountBadge().*

| Field | Type | Description |
| --- | --- | --- |
| `text?` | `string` | Badge text. Default "". |
| `color?` | `'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'` | Accent color. Default 'neutral'. |
| `size?` | `'sm' | 'md' | 'pill'` | Visual size. Default 'md'. |

### SpindleSpinnerOptions

*Options for api.ui.components.mountSpinner().*

| Field | Type | Description |
| --- | --- | --- |
| `size?` | `number` | Diameter in CSS pixels. Default 16. |
| `fast?` | `boolean` | Use the faster rotation variant. Default false. |

### SpindleSwitchOptions

*Options for api.ui.components.mountSwitch(). onChange fires into your script on every toggle.*

| Field | Type | Description |
| --- | --- | --- |
| `checked?` | `boolean` | Initial state. Default false. |
| `onChange?` | `(checked: boolean) => void` | Fired on every toggle with the new state. Can be async; the host keeps the per-fire run alive across awaits. |
| `size?` | `'sm' | 'md'` | Visual size. Default 'md'. |
| `disabled?` | `boolean` | Disable user interaction. Default false. |
| `ariaLabel?` | `string` | Accessible label. |

### SpindleTextInputOptions

*Options for api.ui.components.mountTextInput(). onChange fires on every user change.*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `string` | Initial value. Default "". |
| `onChange?` | `(value: string) => void` | Fired on every user change with the full current text. Can be async. |
| `placeholder?` | `string` | Placeholder text. |
| `autoFocus?` | `boolean` | Focus on mount. Default false. |
| `disabled?` | `boolean` | Disable user interaction. Default false. |
| `className?` | `string` | Additional CSS class on the wrapper. |
| `ariaLabel?` | `string` | Accessible label. |

### SpindleTextAreaOptions

*Options for api.ui.components.mountTextArea(). Like SpindleTextInputOptions plus rows.*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `string` | Initial value. Default "". |
| `onChange?` | `(value: string) => void` | Fired on every user change. Can be async. |
| `placeholder?` | `string` | Placeholder text. |
| `rows?` | `number` | Visible rows. Default 4. |
| `disabled?` | `boolean` | Disable user interaction. Default false. |
| `className?` | `string` | Additional CSS class. |
| `ariaLabel?` | `string` | Accessible label. |

### SpindleNumericInputOptions

*Options for api.ui.components.mountNumericInput(). Value is number | null (null = empty when allowEmpty).*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `number | null` | Initial value. null = empty. Default null. |
| `onChange?` | `(value: number | null) => void` | Fired on every user change. |
| `allowEmpty?` | `boolean` | Allow null (empty) as a valid value. Default false. |
| `integer?` | `boolean` | Restrict to integers. Default false. |
| `min?` | `number` | Lower bound. |
| `max?` | `number` | Upper bound. |
| `step?` | `number` | Native step size. |
| `placeholder?` | `string` | Placeholder text. |
| `disabled?` | `boolean` | Disable user interaction. Default false. |

### SpindleNumberStepperOptions

*Options for api.ui.components.mountNumberStepper(). Like SpindleNumericInputOptions minus integer; step defaults to 1.*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `number | null` | Initial value. null = empty. Default null. |
| `onChange?` | `(value: number | null) => void` | Fired on every user change. |
| `allowEmpty?` | `boolean` | Allow null (empty). Default false. |
| `min?` | `number` | Lower bound. |
| `max?` | `number` | Upper bound. |
| `step?` | `number` | Step size. Default 1. |
| `placeholder?` | `string` | Placeholder text. |
| `disabled?` | `boolean` | Disable user interaction. Default false. |

### SpindleCheckboxOptions

*Options for api.ui.components.mountCheckbox().*

| Field | Type | Description |
| --- | --- | --- |
| `checked?` | `boolean` | Initial state. Default false. |
| `onChange?` | `(checked: boolean) => void` | Fired on every toggle. |
| `label?` | `string` | Label rendered next to the checkbox. |
| `hint?` | `string` | Helper text under the label. |
| `disabled?` | `boolean` | Disable user interaction. Default false. |

### SpindleRangeSliderOptions

*Options for api.ui.components.mountRangeSlider(). onCommit fires once when a drag/tap ends; onDragValue fires live during a drag.*

| Field | Type | Description |
| --- | --- | --- |
| `min` | `number` | REQUIRED. Inclusive lower bound. |
| `max` | `number` | REQUIRED. Inclusive upper bound. |
| `value?` | `number` | Initial committed value. Default min. |
| `step?` | `number` | Snap increment. Default 1. |
| `integer?` | `boolean` | Round to integers. Default false. |
| `onCommit?` | `(value: number) => void` | Fired once when the gesture ends (NOT during drag). |
| `onDragValue?` | `(value: number | null) => void` | Fired with the live value during a drag; null if the gesture ends without committing. |
| `label?` | `string` | Renders a header with label + live value. |
| `hint?` | `string` | Helper text under the header. Ignored without label. |
| `format?` | `SpindleRangeSliderFormat` | { decimals?, prefix?, suffix? } for the header value. Ignored without label. |
| `disabled?` | `boolean` | Dim the track and ignore input. Default false. |
| `className?` | `string` | Additional CSS class on the track area. |

### SpindleSelectOption

*A single option in api.ui.components.mountSelect() / mountMultiSelect().*

| Field | Type | Description |
| --- | --- | --- |
| `value` | `string` | Stable value emitted to onChange. |
| `label` | `string` | Display label. |
| `sublabel?` | `string` | Secondary text beneath the label. |
| `group?` | `string` | Group key — shared-group options cluster under a header. |
| `leading?` | `SpindleSelectOptionLeading` | Leading cell: { type: "image"\|"icon-svg"\|"icon-url"\|"swatch"\|"initial", ... }. |
| `disabled?` | `boolean` | Render as disabled. |

### SpindleSelectOptions

*Options for api.ui.components.mountSelect() (single-select). Extends SpindleSelectOptionsBase (options, placeholder, searchPlaceholder, searchThreshold, emptyMessage, noResultsMessage, triggerLabel, triggerIcon, portal, align, maxHeight, minWidth, disabled, className).*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `string` | Currently selected value. |
| `onChange?` | `(value: string) => void` | Fired when the user picks an option. |
| `options?` | `SpindleSelectOption[]` | Available choices. |
| `clearable?` | `boolean` | Show a pinned "None" option that emits onChange(""). |
| `clearLabel?` | `string` | Label for the clear option. Default "None". |

### SpindleMultiSelectOptions

*Options for api.ui.components.mountMultiSelect(). Same base as SpindleSelectOptions but value/onChange use string[].*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `string[]` | Currently selected values. |
| `onChange?` | `(value: string[]) => void` | Fired when the selection changes. |
| `options?` | `SpindleSelectOption[]` | Available choices. |

### SpindleFolderDropdownOptions

*Options for api.ui.components.mountFolderDropdown().*

| Field | Type | Description |
| --- | --- | --- |
| `folders?` | `string[]` | Available folder names. |
| `value?` | `string` | Currently selected folder. |
| `onChange?` | `(folder: string) => void` | Fired when the user picks a folder. |
| `onCreateFolder?` | `(name: string) => void` | Fired when the user creates a folder inline. |
| `placeholder?` | `string` | Placeholder when no folder is selected. |
| `disabled?` | `boolean` | Disable interaction. |

### SpindleModelComboboxOptions

*Options for api.ui.components.mountModelCombobox(). Connection-bound mode (connection) is recommended; manual mode uses models + onRefresh.*

| Field | Type | Description |
| --- | --- | --- |
| `value?` | `string` | Currently entered model ID. |
| `onChange?` | `(value: string) => void` | Fired on every change. |
| `connection?` | `{ kind: "llm"|"image"|"tts"|"embedding"; id? }` | Bind to a host-managed connection; host fetches + updates the model list. embedding is manual-mode-only. |
| `models?` | `string[]` | Manual mode: explicit model list. |
| `modelLabels?` | `Record<string, string>` | Manual mode: id → human label. |
| `loading?` | `boolean` | Manual mode: show the refresh spinner. |
| `onRefresh?` | `() => void` | Manual mode: invoked on refresh click. |
| `appearance?` | `'compact' | 'standard' | 'editor'` | Visual density. Default 'compact'. |
| `placeholder?` | `string` | Placeholder text. |

### SpindlePaginationOptions

*Options for api.ui.components.mountPagination(). Fully controlled — currentPage/totalPages/onPageChange are REQUIRED; call handle.update({currentPage}) after navigating.*

| Field | Type | Description |
| --- | --- | --- |
| `currentPage` | `number` | REQUIRED. Current page index (1-based). |
| `totalPages` | `number` | REQUIRED. Total page count. |
| `onPageChange` | `(page: number) => void` | REQUIRED. Fired when the user clicks a page. |
| `perPage?` | `number` | Current per-page selection (omit to hide the selector). |
| `perPageOptions?` | `number[]` | Page-size choices. |
| `onPerPageChange?` | `(n: number) => void` | Fired when the user changes per-page. |
| `totalItems?` | `number` | Total item count for the "Showing X–Y of N" summary. |

### SpindleCloseButtonOptions

*Options for api.ui.components.mountCloseButton().*

| Field | Type | Description |
| --- | --- | --- |
| `onClick?` | `() => void` | Click handler. |
| `size?` | `'sm' | 'md'` | Visual size. Default 'md'. |
| `variant?` | `'subtle' | 'solid'` | Visual variant. Default 'subtle'. |
| `position?` | `'static' | 'absolute'` | Positioning behavior. Default 'static'. |
| `iconSize?` | `number` | Icon size override in CSS pixels. |

### SpindleCollapsibleSectionOptions

*Options for api.ui.components.mountCollapsibleSection(). title is REQUIRED.*

| Field | Type | Description |
| --- | --- | --- |
| `title` | `string` | REQUIRED. Header text. |
| `iconSvg?` | `string` | Inline SVG icon next to the title. |
| `iconUrl?` | `string` | Icon image URL. Mutually exclusive with iconSvg. |
| `badge?` | `string | number` | Optional badge text next to the title. |
| `defaultExpanded?` | `boolean` | Initial expanded state. Default true. |
| `onToggle?` | `(expanded: boolean) => void` | Fired whenever the user toggles the section. |

### MountedCollapsibleSectionHandle

*Returned by api.ui.components.mountCollapsibleSection(). The host owns the header chrome; your script owns the body.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique component ID. |
| `body` | `DOMHandle` | The section body — a DOMHandle your script owns. Use body.inject(...)/update(...)/on(...) to fill + wire it, exactly like any injected element. |
| `update(patch)` | `void` | Merge a partial of the mount options (title/badge/etc.) into the live section. Fire-and-forget. |
| `destroy()` | `void` | Unmount the section + release. Idempotent. |
| `isExpanded()` | `Promise<boolean>` | Read the current expanded state. ASYNC (a frontend round-trip), like getValue(). |
| `expand()` | `void` | Open the section. Fire-and-forget. |
| `collapse()` | `void` | Close the section. Fire-and-forget. |
| `toggle()` | `void` | Flip the section. Fire-and-forget. |

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
| `key?` | `string` | KeyboardEvent.key — the value of the key pressed, modifier-aware ('Enter', 'Escape', 'a', 'A', 'ArrowUp', 'Shift'). Populated only for keydown / keyup / keypress events. Use this to distinguish e.g. Enter-to-submit on a text input. |
| `code?` | `string` | KeyboardEvent.code — physical key on the keyboard, layout-independent ('Enter', 'KeyA' regardless of shift, 'ArrowUp', 'ShiftLeft'). Populated only for keydown / keyup / keypress events. Use this for physical-position bindings (e.g. WASD). |

### DOMListenOptions

*Options bag for DOMHandle.on(event, handler, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `preventDefault?` | `boolean | ConditionalPreventDefault` | When true, the frontend listener calls event.preventDefault() synchronously before dispatching to the script handler. Must be set at registration time — the async worker-boundary dispatch returns too late to preventDefault from inside the handler body. Can also be a ConditionalPreventDefault object to fire only on specific key / button / modifier combinations. Default: false. |

### DOMReadOptions

*Options bag for DOMHandle.read(options?). All fields optional — `read()` with no argument returns a baseline snapshot.*

| Field | Type | Description |
| --- | --- | --- |
| `html?` | `boolean` | Also include `innerHTML` in the returned snapshot. Default false — keeps the IPC payload small for the common case (verify attrs, check text content). Set true when the script needs to traverse the descendant markup (e.g. parse a rendered subtree via DOMParser). |

### SerializedDOMElement

*Snapshot returned by DOMHandle.read(). Frontend-built serialization of the element bound to the handle.

Which element gets snapshotted depends on the shape of what the script injected: for the common single-root case the user's root element is returned directly (e.g. `inject('<button class="x">Hi</button>')` → `tag: 'button'`); for multi-root or text-only content the snapshot falls back to LumiScript's wrapper (`tag: 'div'`, accurate `childCount`). Either way, internal `data-ls-*` and `data-spindle-ext` wrapper attributes are stripped from the `attrs` map.

Deliberate omissions: computed styles, bounding rect, recursive child snapshots, property snapshots (`.value` / `.checked`). Form-control live values can be read via `delegate(selector, 'input', ...)` event handlers; for deep markup traversal, request `{ html: true }` and parse client-side.*

| Field | Type | Description |
| --- | --- | --- |
| `tag` | `string` | Lowercase tag name (e.g. 'div', 'button'). |
| `attrs` | `Record<string, string>` | All attributes set on the element, keyed by lowercased attribute name. Includes class, id, style, data-*, aria-*, etc. Internal `data-ls-*` / `data-spindle-ext` wrapper attributes are stripped. Empty object if no attributes set. |
| `text` | `string` | Element's textContent — concatenated text from this element and all descendants. Empty string if no text content. Includes text inside hidden-via-CSS elements (matches textContent semantics, not visibility). Use `delegate(...)` events for live form-control values like input.value (which are properties, not attributes). |
| `childCount` | `number` | Number of direct ELEMENT children (text nodes and comment nodes are NOT counted). Use the `html` option to inspect the full subtree. |
| `html?` | `string` | Element's innerHTML. Present only when read({ html: true }) was passed. Reflects whatever the frontend currently has — including any host-side modifications (e.g. Lumiverse markdown rendering) that mutated the originally-injected HTML. |

### ConditionalPreventDefault

*Predicate-based preventDefault rule for DOMDelegateOptions / DOMListenOptions. Fires event.preventDefault() only when the event matches all provided filters (AND semantics). Each filter is optional; empty {} = always match (equivalent to `preventDefault: true`). Filters are evaluated synchronously frontend-side at fire time. Common shapes: { onKeys: ['Enter'], whenModifiers: { exclude: ['shift'] } } (plain Enter, not Shift+Enter); { onKeys: ['s', 'S'], whenModifiers: { require: ['ctrl'] } } (Ctrl+S override); { onButtons: [2] } (right-click only).*

| Field | Type | Description |
| --- | --- | --- |
| `onKeys?` | `string[]` | KeyboardEvent.key value(s) — OR-matched within the array. Non-keyboard events skipped (preventDefault does NOT fire) when this is set. |
| `onCodes?` | `string[]` | KeyboardEvent.code value(s) — physical key, layout-independent. Same keyboard-only semantics as onKeys. Use for physical-position bindings (e.g. WASD). |
| `onButtons?` | `number[]` | MouseEvent.button value(s) — 0=left, 1=middle, 2=right, 3=back, 4=forward. Non-mouse events skipped when set. |
| `whenModifiers?` | `{ require?, exclude? }` | Modifier-key constraint. ALL of require must be held; NONE of exclude may be held. Values: shift / ctrl / alt / meta. Applies to KeyboardEvent and MouseEvent. |

### LLMMessage

*A single message in the messages array passed to api.llm.generate / generateStructured / generateWithTools.*

| Field | Type | Description |
| --- | --- | --- |
| `role` | `'system' | 'user' | 'assistant'` | Message sender role. |
| `content` | `string | LlmMessagePart[]` | Plain string (simple case) OR an array of parts. Parts let scripts thread native tool_use / tool_result payloads through an agentic loop instead of text-encoding them. |
| `reasoning_content?` | `string` | Thinking-mode reasoning content from the previous assistant turn, echoed back on the next request. REQUIRED by DeepSeek thinking-mode models on tool-call continuations (the API returns 400 invalid_request_error: "The 'reasoning_content' in the thinking mode must be passed back to the API." without it). Plain-text continuations and non-thinking models don't need it. Other providers routing DeepSeek (NanoGPT, OpenRouter) inherit the requirement; providers without thinking mode ignore the field. Copy from LLMRawResult.reasoning_content after each generateWithTools call. |

### LlmMessagePart

*A single content part inside an LLMMessage. Discriminated union — switch on the `type` field. Mirrors the host's LlmMessagePartDTO.*

| Field | Type | Description |
| --- | --- | --- |
| `{ type: 'text', text }` | `` | A plain text segment. |
| `{ type: 'image', data, mime_type }` | `` | Base64-encoded image. Consumed only by connections whose model supports image input. |
| `{ type: 'audio', data, mime_type }` | `` | Base64-encoded audio. Consumed only by connections whose model supports audio input. |
| `{ type: 'tool_use', id, name, input }` | `` | A tool call the LLM is invoking. Re-pair with a matching tool_result in the next user turn (tool_result.tool_use_id === this.id). |
| `{ type: 'tool_result', tool_use_id, content, is_error? }` | `` | Result of a tool call, paired by tool_use_id. Set is_error=true to signal failure (model adapts retry/abandon strategy). |
| `cache_control? (all variants)?` | `` | Provider-specific cache hint (e.g. Anthropic ephemeral). Most callers leave undefined. |

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
| `reasoning?` | `GenerationReasoningOverride` | Per-request reasoning/thinking control (host 0.5.x+). source: 'inherit' (default — use the connection's bindings) \| 'off' (force no reasoning) \| 'custom' (use the effort/thinkingDisplay fields). Rides beside parameters on the request, not inside the sampler bag. |

### Connection

*Read-only view of an LLM connection profile (api.connections.*). snake_case, mirrors the host ConnectionProfileDTO. NEVER contains the API key — only has_api_key. id/name map to LLMOptions.connectionId/connectionName.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Stable connection ID (→ LLMOptions.connectionId). |
| `name` | `string` | Human-readable name (→ LLMOptions.connectionName). |
| `provider` | `string` | Provider identifier (e.g. "anthropic", "openai"). |
| `api_url` | `string` | Provider API base URL. |
| `model` | `string` | Model identifier. |
| `preset_id` | `string | null` | Bound generation preset ID, or null. |
| `is_default` | `boolean` | Whether this is the user's default connection. |
| `has_api_key` | `boolean` | Whether a key is stored. NEVER the key itself. |
| `metadata` | `Record<string, unknown>` | Raw provider-specific metadata bag (provider-quirk flags, etc.). |
| `reasoning_bindings` | `ConnectionReasoningBindings | null` | Typed reasoning bindings (a settings snapshot + optional promptBias), or null when the connection has none. |
| `created_at` | `number` | Unix-ms creation timestamp. |
| `updated_at` | `number` | Unix-ms last-update timestamp. |

### GenerationReasoningOverride

*Per-request reasoning control, passed as LLMOptions.reasoning (host 0.5.x+). Resolved by the 'source' discriminator; rides beside parameters on the request, not inside the sampler bag. Mirrors the host GenerationReasoningOverrideDTO.*

| Field | Type | Description |
| --- | --- | --- |
| `source?` | `'inherit' | 'off' | 'custom'` | How the backend resolves reasoning. 'inherit' (default; same as omitting reasoning): use the connection's reasoning_bindings, else the user's global setting. 'off': force the provider's no-reasoning switch, even if parameters carry a thinking block. 'custom': use the fields below for this call only. |
| `apiReasoning?` | `boolean` | Master switch — whether the provider emits thinking. Meaningful with source: 'custom' (default true). |
| `effort?` | `ReasoningEffort` | Effort tier: 'auto' \| 'none' \| 'minimal' \| 'low' \| 'medium' \| 'high' \| 'max' \| 'xhigh'. source: 'custom' only (default 'auto'). |
| `thinkingDisplay?` | `ThinkingDisplay` | How thinking is surfaced: 'auto' \| 'summarized' \| 'omitted'. Anthropic-only. source: 'custom' only (default 'auto'). |

### ConnectionReasoningBindings

*Typed value of Connection.reasoning_bindings (api.connections.*). Read-only snapshot of the reasoning settings bound to a profile; these override the user's global reasoning settings on this connection. Mirrors the host ConnectionReasoningBindingsDTO.*

| Field | Type | Description |
| --- | --- | --- |
| `settings` | `ReasoningSettings` | Reasoning settings snapshot: { apiReasoning, reasoningEffort, thinkingDisplay, prefix, suffix, autoParse, keepInHistory }. Only apiReasoning/reasoningEffort/thinkingDisplay affect the provider request; prefix/suffix/autoParse/keepInHistory drive the delimited-reasoning parser. |
| `promptBias?` | `string` | Optional "Start Reply With" assistant prefill captured with the snapshot; overrides the user's global promptBias for this connection. |

### WebSearchOptions

*Passed to api.webSearch.query().*

| Field | Type | Description |
| --- | --- | --- |
| `query` | `string` | Free-text query (required). Trimmed by the host; empty is rejected. |
| `count?` | `number` | Desired result count. Clamped to maxResultCount; omit for defaultResultCount. |
| `scrape?` | `boolean` | Default true → scrape top results + assemble context. false → only results (no documents/context). |

### WebSearchResponse

*Returned by api.webSearch.query(). documents/context are omitted when scrape:false.*

| Field | Type | Description |
| --- | --- | --- |
| `query` | `string` | The (trimmed) query that ran. |
| `results` | `WebSearchResult[]` | Normalized results { title, url, snippet, engine?, score? }. |
| `documents?` | `WebSearchDocument[]` | Per-result scraped content { ..., content?, contentLength?, sourceType?, error? }. Absent when scrape:false. |
| `context?` | `string` | Pre-assembled prompt-ready context (query + scraped docs). Absent when scrape:false. |

### WebSearchSettings

*Returned by api.webSearch.getSettings(). Safe view — NEVER the API key (only hasApiKey).*

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Whether web search is configured + enabled. Check before query(). |
| `provider` | `string` | Provider identifier (currently 'searxng'). |
| `apiUrl` | `string` | Provider API base URL. |
| `hasApiKey` | `boolean` | Whether a key is stored. NEVER the key itself. |
| `defaultResultCount` | `number` | Result count when query.count is omitted. |
| `maxResultCount` | `number` | Upper bound (count is clamped to this). |
| `maxPagesToScrape` | `number` | How many top results get scraped when scrape:true. |
| `maxCharsPerPage` | `number` | Per-page scraped-text character cap. |
| `language` | `string` | Search language code. |
| `safeSearch` | `0 | 1 | 2` | SafeSearch: 0 off, 1 moderate, 2 strict. |
| `engines` | `string[]` | Provider engines to query. |
| `requestTimeoutMs` | `number` | Per-request timeout in ms. |

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
| `reasoning_content?` | `string` | Thinking-mode reasoning content from this turn. Present on tool-call iterations against DeepSeek-thinking models. Copy onto the assistant turn you append to history before the next call (set LLMMessage.reasoning_content). Other providers ignore it. |

### LLMRawResultStructured

*Generic type `LLMRawResultStructured<T>`. Return type of `api.llm.generateWithTools(messages, tools, opts, schema)` — the structured-output overload. On intermediate steps only `tool_calls` is set. On the final step only `content` is set, typed as `T` (the schema-parsed result).*

| Field | Type | Description |
| --- | --- | --- |
| `content?` | `T` | Final step: JSON-parsed and Zod-validated result typed as T (the schema you passed as the 4th arg to generateWithTools). |
| `tool_calls?` | `ToolCall[]` | Intermediate steps: function calls requested by the LLM. When present, content is absent. |
| `reasoning_content?` | `string` | Thinking-mode reasoning content from this turn. Same semantics as LLMRawResult.reasoning_content — copy onto the next assistant turn for DeepSeek-thinking tool loops. |

### StreamChunk

*One chunk yielded by api.llm.generateStream. Discriminated union — switch on the `type` field. snake_case throughout, mirroring LLMRawResult and the upstream StreamChunkDTO.*

| Field | Type | Description |
| --- | --- | --- |
| `{ type: 'token', token }` | `` | Incremental visible content chunk. Concatenate token across all token chunks to assemble the streamed text. |
| `{ type: 'reasoning', token }` | `` | Incremental chain-of-thought chunk. Thinking-mode models only (DeepSeek-thinking, Anthropic extended-thinking, …). Other providers skip these. |
| `{ type: 'done', content, reasoning?, finish_reason, tool_calls?, usage? }` | `` | Terminal chunk emitted exactly once on successful completion. content is the full aggregated text; reasoning the full aggregated reasoning (when present); finish_reason is 'stop' \| 'length' \| 'tool_calls' \| 'content_filter' \| provider-specific; tool_calls is set when finish_reason === 'tool_calls'; usage is { prompt_tokens, completion_tokens, total_tokens } when the provider reports it. Breaking out of the for await loop before this arrives means you won't see it. |

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
| `retrievalMode?` | `'vector' | 'recency' | 'empty' | 'disabled'` | How chunks were retrieved (real vector search vs recency fallback). Absent until the chat-memory cache is populated. |
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
| `responseType?` | `'text' | 'arraybuffer'` | Decoding hint for the response body. 'text' (default) yields a string; 'arraybuffer' yields a Uint8Array of the raw response bytes (LumiScript decodes the host's base64 transport transparently). Use 'arraybuffer' when fetching images, PDFs, or any binary payload destined for api.images.upload / api.utils.image.* / api.files.*. |

### HttpResponse

*Returned by api.utils.http.* methods. Response body is capped at 25 MB by the Lumiverse cors_proxy — requests for larger payloads reject with an upstream error.*

| Field | Type | Description |
| --- | --- | --- |
| `status` | `number` | HTTP status code (e.g. 200, 404). |
| `statusText` | `string` | HTTP status text (e.g. "OK", "Not Found"). |
| `headers` | `Record<string, string>` | Response headers. |
| `body` | `string | Uint8Array` | Response body. `string` when the request's responseType was 'text' or omitted; `Uint8Array` when 'arraybuffer'. Use JSON.parse on string bodies for JSON; pipe Uint8Array bodies into api.images.upload or api.utils.image.detectMime. |

### TempWriteOptions

*Passed to api.files.tempWrite / tempWriteBinary (path, data, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `ttlMs?` | `number` | Time-to-live in milliseconds. If omitted the file persists until deleted or restart. |
| `reservationId?` | `string` | Charge this write against a tempRequestBlock reservation, so a large write can't fail partway through on a full pool. |

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

### TempRequestBlockOptions

*Passed to api.files.tempRequestBlock(sizeBytes, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `ttlMs?` | `number` | Time-to-live for the reservation in milliseconds. |
| `reason?` | `string` | Free-text reason recorded with the reservation (diagnostics only). |

### TempReservation

*Returned by api.files.tempRequestBlock(). Pass reservationId to tempWrite/tempWriteBinary options, or to tempReleaseBlock.*

| Field | Type | Description |
| --- | --- | --- |
| `reservationId` | `string` | The reservation handle. |
| `sizeBytes` | `number` | The reserved size in bytes. |
| `expiresAt` | `string` | ISO 8601 timestamp when the reservation expires if unused. |

### TempPoolStatus

*Returned by api.files.tempGetPoolStatus(). Global = across all extensions; extension* = this extension only.*

| Field | Type | Description |
| --- | --- | --- |
| `globalMaxBytes` | `number` | Total ephemeral pool size across all extensions. |
| `globalUsedBytes` | `number` | Bytes currently stored across all extensions. |
| `globalReservedBytes` | `number` | Bytes currently reserved (not yet written) across all extensions. |
| `globalAvailableBytes` | `number` | Bytes still available globally (max − used − reserved). |
| `extensionMaxBytes` | `number` | This extension's ephemeral quota. |
| `extensionUsedBytes` | `number` | Bytes this extension is currently storing. |
| `extensionReservedBytes` | `number` | Bytes this extension currently has reserved. |
| `extensionAvailableBytes` | `number` | Bytes this extension still has available. |
| `fileCount` | `number` | Number of ephemeral files this extension currently holds. |
| `fileCountMax` | `number` | Maximum file count allowed for this extension. |

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
| `mesExample` | `string` | Example dialogue. Free-form text shown to the LLM as an example of how the character speaks. |
| `creatorNotes` | `string` | Free-form notes from the character author (usage guidance, change history, etc.). Not shown to the LLM. |
| `systemPrompt` | `string` | Character-level system prompt. |
| `postHistoryInstructions` | `string` | Instructions appended after chat history. |
| `tags` | `string[]` | Searchable tags. |
| `alternateGreetings` | `string[]` | Additional greeting variants. |
| `creator` | `string` | Creator name / attribution string. |
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
| `mesExample?` | `string` | Example dialogue. |
| `creatorNotes?` | `string` | Free-form notes from the character author (not shown to the LLM). |
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
| `mesExample?` | `string` | Example dialogue. |
| `creatorNotes?` | `string` | Free-form notes from the character author (not shown to the LLM). |
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
| `score` | `number | null` | Vector distance (lower = more similar). null for keyword-only / recency-fallback hits — do not treat a missing score as a zero-distance match. |
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
| `retrievalMode?` | `'vector' | 'recency' | 'empty' | 'disabled'` | How chunks were retrieved (vector search vs recency fallback). Absent until the chat-memory cache is populated. |

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

### WorldInfoInterceptorEntry

*Subset of WorldInfoEntry exposed to a registerInterceptor handler. Read-only — to mutate, return a result patch from the handler.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Entry UUID. |
| `worldBookId` | `string` | Parent world book UUID. |
| `comment` | `string` | Author-facing comment / label for the entry. |
| `disabled` | `boolean` | Stored disabled flag (or accumulated disable from earlier handlers in the chain). |
| `constant` | `boolean` | Always-active flag. |
| `extensions` | `Record<string, unknown>` | Per-extension namespace metadata stored on the entry. |
| `key` | `readonly string[]` | Primary trigger keywords. |
| `keysecondary` | `readonly string[]` | Secondary trigger keywords. |
| `position` | `number` | Injection position. |
| `depth` | `number` | Injection depth. |
| `priority` | `number` | Activation priority. |
| `probability` | `number` | Activation probability (0–100). |
| `useProbability` | `boolean` | Whether probability gating applies. |
| `content` | `string` | Entry text content (reflects mutations from earlier handlers in the chain). |

### WorldInfoInterceptorMessage

*One chat message exposed to a registerInterceptor handler.*

| Field | Type | Description |
| --- | --- | --- |
| `role` | `'system' | 'user' | 'assistant'` | Message role. |
| `content` | `string` | Message content. |

### WorldInfoInterceptorCtx

*Passed to a registerInterceptor handler. All fields readonly. Persist cross-turn state via api.chats.update(chatId, { metadata: ... }) — chatMetadata here is a snapshot.*

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | `string` | Active chat id. |
| `characterId` | `string` | Active character id. |
| `userId?` | `string` | Owning user id. Pass to operator-scoped Spindle calls. |
| `entries` | `readonly WorldInfoInterceptorEntry[]` | Candidate entries with prior handlers' mutations applied. |
| `messages` | `readonly WorldInfoInterceptorMessage[]` | Chat-history snapshot. |
| `chatTurn` | `number` | Turn number for this chat. |
| `chatMetadata` | `Record<string, unknown>` | Chat-level metadata snapshot. Read-only. |

### WorldInfoInterceptorResult

*Return value of a registerInterceptor handler. Return undefined / void / omit all four arrays for full pass-through. Vote-off precedence: once any handler in the chain votes disabled for an id, no later enabled or forced vote can revive it. mutated is last-write-wins per id.*

| Field | Type | Description |
| --- | --- | --- |
| `disabled?` | `readonly string[]` | Entry ids to force-disable. Wins against any later enabled / forced vote. |
| `enabled?` | `readonly string[]` | Entry ids to un-disable (overrides stored disabled). No effect on entries any handler voted disabled. |
| `forced?` | `readonly string[]` | Entry ids to force-activate (sets constant=true for this turn). No effect if voted disabled. Independent of enabled — to revive a stored-disabled entry, vote BOTH enabled and forced. |
| `mutated?` | `readonly { id: string; content: string }[]` | Per-entry content overrides for this turn only. Stored entry unchanged. Last-write-wins per id. |

### WorldInfoInterceptorOptions

*Passed to api.worldInfo.registerInterceptor(handler, options?).*

| Field | Type | Description |
| --- | --- | --- |
| `id?` | `string` | Stable identifier. Re-registration with the same id replaces the prior entry. Auto-generated ('auto-1', etc.) when omitted. |
| `priority?` | `number` | Lower runs first. Default 100. Tie-broken by registration order. Each handler sees prior handlers' decisions applied to the entry list. |
| `timeoutMs?` | `number` | Per-invocation soft timeout (ms). Default 2000. Host's outer 10s budget is shared across all extensions; keep handlers fast — the chain fires before activation, prompt assembly, and the LLM call. |

### RegisteredWorldInfoInterceptorInfo

*Returned by api.worldInfo.listInterceptors(). Diagnostic surface — un-gated.*

| Field | Type | Description |
| --- | --- | --- |
| `scriptId` | `string` | Owning script id. |
| `scriptName` | `string` | Owning script display name. |
| `id` | `string` | Resolved entry id (auto-generated or user-provided). |
| `priority` | `number` | Effective priority value. |
| `timeoutMs` | `number` | Effective per-invocation timeout (ms). |

### RegexScriptInfo

*Snapshot of a regex find/replace script. Returned by api.regexScripts.list / get / findByName / getActive / create / update. Field names are camelCase translations of the underlying snake_case host DTO.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique row id. |
| `name` | `string` | Display name shown in the regex panel. |
| `scriptId` | `string` | Stable, normalized identifier (lowercase + underscores) for cross-instance references. Distinct from id. |
| `findRegex` | `string` | Pattern compiled with the JavaScript regex engine. |
| `replaceString` | `string` | Replacement template. Supports $1 / $&amp; / $&lt;name&gt; capture references. |
| `flags` | `string` | Any subset of "gimsu". |
| `placement` | `RegexPlacement[]` | Which message roles the rule applies to. |
| `scope` | `RegexScope` | Scope tier: 'global' \| 'character' \| 'chat'. |
| `scopeId` | `string | null` | Required when scope is non-global; null otherwise. |
| `target` | `RegexTarget` | When the rule fires: 'prompt' (during assembly) \| 'response' (after LLM stream) \| 'display' (per render). |
| `minDepth` | `number | null` | Lower bound on chat-history depth (0 = latest), or null for unbounded. |
| `maxDepth` | `number | null` | Upper bound on chat-history depth, or null for unbounded. |
| `trimStrings` | `string[]` | Additional substrings stripped from output after the regex pass. |
| `runOnEdit` | `boolean` | Re-run the rule when a message is edited. |
| `substituteMacros` | `RegexMacroMode` | How CBS / {{...}} macros inside the rule resolve: 'none' \| 'raw' \| 'escaped'. |
| `disabled` | `boolean` | When true, the rule is registered but not active. |
| `sortOrder` | `number` | Lower values run earlier within the same scope tier. |
| `description` | `string` | Free-form note. |
| `folder` | `string` | Folder label shown in the regex panel. |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata namespaced to the creating extension. |
| `createdAt` | `number` | Unix epoch seconds. |
| `updatedAt` | `number` | Unix epoch seconds. |

### RegexScriptListOptions

*Filter options for api.regexScripts.list().*

| Field | Type | Description |
| --- | --- | --- |
| `scope?` | `'global' | 'character' | 'chat'` | Filter to a single scope. Omit to include all scopes. |
| `scopeId?` | `string` | Required when scope is 'character' or 'chat'. Ignored otherwise. |
| `target?` | `'prompt' | 'response' | 'display'` | Filter by execution target. |
| `limit?` | `number` | Page size. Default 50, max 200. |
| `offset?` | `number` | Pagination offset. |

### RegexScriptActiveOptions

*Required + optional fields for api.regexScripts.getActive(). Mirrors the resolution Lumiverse uses internally during a generation: only enabled rules, only rules whose target matches, only rules whose scope applies.*

| Field | Type | Description |
| --- | --- | --- |
| `target` | `'prompt' | 'response' | 'display'` | Required. The execution target to resolve for. |
| `characterId?` | `string` | Include character-scoped rules attached to this character. |
| `chatId?` | `string` | Include chat-scoped rules attached to this chat. |

### RegexScriptCreateInput

*Passed to api.regexScripts.create(input). Only name and findRegex are required; everything else gets host-side defaults.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Display name. |
| `findRegex` | `string` | Pattern (JavaScript regex). |
| `replaceString?` | `string` | Replacement template. Default empty string. |
| `flags?` | `string` | Any subset of "gimsu". Default "gi". |
| `placement?` | `RegexPlacement[]` | Default ["ai_output"]. |
| `scope?` | `RegexScope` | Default 'global'. |
| `scopeId?` | `string | null` | Required when scope is non-global. |
| `target?` | `RegexTarget` | Default 'response'. |
| `minDepth?` | `number | null` | Lower depth bound. |
| `maxDepth?` | `number | null` | Upper depth bound. |
| `trimStrings?` | `string[]` | Additional substrings stripped from output. |
| `runOnEdit?` | `boolean` | Re-run on edit. |
| `substituteMacros?` | `RegexMacroMode` | How CBS / {{...}} macros inside the rule resolve. Default 'none'. |
| `disabled?` | `boolean` | Create as disabled. |
| `sortOrder?` | `number` | Default 0. |
| `description?` | `string` | Free-form note. |
| `folder?` | `string` | Folder label. |
| `metadata?` | `Record<string, unknown>` | Arbitrary metadata. |
| `scriptId?` | `string` | Stable identifier. Normalized to lowercase + underscores by the host. |

### RegexScriptUpdateInput

*Passed to api.regexScripts.update(scriptId, input). Same shape as RegexScriptCreateInput but ALL fields optional.*

| Field | Type | Description |
| --- | --- | --- |
| `(all RegexScriptCreateInput fields, all optional)?` | `—` | Only the fields you provide are updated; omitted fields are left unchanged. |

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
| `genderIdentity` | `0 | 1 | 2` | 0 = unspecified, 1 = feminine, 2 = masculine. (Note: upstream council.md docs describe a wider 4-value range; LumiScript matches the actual typed surface — type-vs-doc inconsistency tracked upstream.) |

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

*Parameter passed to tool handler callbacks registered via api.tools.register(). Always carries the well-known Lumiverse fields (context / __userId / __deadlineMs) on a host invocation; your registration-schema parameters are filled only on the DIRECT paths (api.tools.invoke + api.llm.generateWithTools), NOT on the Council path — see the [key] field.*

| Field | Type | Description |
| --- | --- | --- |
| `context?` | `string` | Formatted chat context provided by Lumiverse (character info, world info, recent messages). |
| `__userId?` | `string` | User ID of the invoking user. Use for scoped api.* operations inside the handler. |
| `__deadlineMs?` | `number` | Timestamp (ms) by which the handler must return a result. |
| `[key]?` | `unknown` | Tool-specific parameters from your registration schema — available as additional fields ONLY on the direct paths (api.tools.invoke + api.llm.generateWithTools), where the caller/model supplies them. On the Council path they are absent: the host invokes extension tools with just context + __deadlineMs (no sidecar LLM fills your schema), so read args.context and decide the values yourself. |

### ToolInvocationContext

*Optional third parameter passed to tool handlers. Populated when the host invokes the tool (Council / direct-LLM function-call); undefined when invoked via api.tools.invoke() (script-to-script). The Council-path fields (requestId, councilMember, contextMessages) are populated together; the script-to-script path leaves them all undefined.*

| Field | Type | Description |
| --- | --- | --- |
| `requestId?` | `string` | Host-side correlation id for this invocation. Useful for matching handler-side logs against Lumiverse server logs. |
| `councilMember?` | `CouncilMemberContext` | Personality snapshot of the Council member that triggered the invocation. Populated only when the tool ran as part of a Council execution cycle; undefined for inline function-calling, api.tools.invoke(), and older hosts. |
| `contextMessages?` | `LLMMessage[]` | Structured chat context for Council invocations — same content as args.context but with role boundaries preserved. Prefer this over args.context when available — the ls:council-prompt helper's buildCouncilMessages uses it automatically when passed via the contextMessages option. Multi-part (text+image) content is flattened to its text portion before delivery. Undefined for non-Council paths / older hosts. |

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

### DatabankScope

***Enum**: `'global' | 'character' | 'chat'`. Activation scope for a databank. There are EXACTLY THREE values — there is no `'script'` scope. `'global'` is unscoped (available everywhere); `'character'` is keyed by a character UUID via `scopeId`; `'chat'` is keyed by a chat UUID via `scopeId`. `scopeId` is REQUIRED for `'character'` and `'chat'`, omitted (or null) for `'global'`. Scope cannot be changed after creation — pick the right one up front.*

| Field | Type | Description |
| --- | --- | --- |

### DatabankDocumentStatus

***Enum**: `'pending' | 'processing' | 'ready' | 'error'`. Ingestion lifecycle of an uploaded document. New uploads land as `'pending'` and progress through `'processing'` to `'ready'` (success) or `'error'` (terminal failure). `documents.getContent()` returns null for anything other than `'ready'`; `documents.waitUntilReady()` polls until ready and throws on `'error'` or timeout.*

| Field | Type | Description |
| --- | --- | --- |

### DatabankInfo

*Returned by api.databanks.get / findByName / create / update; entries inside list().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Databank ID. |
| `name` | `string` | Display name. |
| `description` | `string` | Free-form description; empty string if unset. |
| `scope` | `DatabankScope` | Activation scope: 'global' \| 'character' \| 'chat'. |
| `scopeId` | `string | null` | Owner key for 'character' (character UUID) or 'chat' (chat UUID) scopes. null for 'global'. |
| `enabled` | `boolean` | Whether the databank participates in retrieval. |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata bag. |
| `documentCount?` | `number` | Number of documents in the databank. May be omitted on bulk list responses for performance. |
| `createdAt` | `number` | Creation timestamp (ms since epoch). |
| `updatedAt` | `number` | Last-modified timestamp (ms since epoch). |

### DatabankCreateInput

*Passed to api.databanks.create(input). Validates host-side — invalid scope or missing scopeId rejects the call.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Display name for the new databank. |
| `description?` | `string` | Free-form description. |
| `scope` | `DatabankScope` | Activation scope. MUST be one of 'global' \| 'character' \| 'chat' — see DatabankScope. There is no 'script' scope. |
| `scopeId?` | `string | null` | Owner key. REQUIRED when scope is 'character' or 'chat' (character UUID or chat UUID respectively). Omit (or pass null) when scope is 'global'. |

### DatabankUpdateInput

*Passed to api.databanks.update(databankId, input). Scope cannot be changed after creation — there are no scope/scopeId fields here on purpose.*

| Field | Type | Description |
| --- | --- | --- |
| `name?` | `string` | New display name. |
| `description?` | `string` | New description. |
| `enabled?` | `boolean` | Whether this databank participates in retrieval. |

### DatabankDocumentInfo

*Returned by api.databanks.documents.get / findByName / create / update / waitUntilReady; entries inside documents.list().*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Document ID. |
| `databankId` | `string` | Parent databank ID. |
| `name` | `string` | Display name. |
| `slug` | `string` | URL-safe slug derived from name. Regenerated on rename. |
| `mimeType` | `string` | MIME type recorded at upload. |
| `fileSize` | `number` | Size in bytes. |
| `contentHash` | `string` | Content fingerprint (hash). Use to detect external content changes between uploads. |
| `totalChunks` | `number` | Number of chunks the document was split into for embedding. |
| `status` | `DatabankDocumentStatus` | Ingestion lifecycle: 'pending' \| 'processing' \| 'ready' \| 'error'. |
| `errorMessage` | `string | null` | Human-readable error description when status is 'error'. null otherwise. |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata bag. |
| `createdAt` | `number` | Upload timestamp (ms since epoch). |
| `updatedAt` | `number` | Last-modified timestamp (ms since epoch). |

### DatabankDocumentCreateInput

*Passed to api.databanks.documents.create(databankId, input). Upload returns immediately with status='pending' — use waitUntilReady() to await ingestion. Max size 10 MB.*

| Field | Type | Description |
| --- | --- | --- |
| `data` | `string | Uint8Array` | Document content. string values are UTF-8 encoded internally; pass Uint8Array directly for already-binary sources. |
| `filename` | `string` | Original filename including extension. Supported extensions: .txt .md .markdown .csv .tsv .json .xml .html .htm .yaml .yml .log .rst .rtf. |
| `mimeType?` | `string` | Optional MIME type recorded on the document. Derived from filename extension when omitted. |
| `name?` | `string` | Display name override. Defaults to filename minus the extension. |

### DatabankDocumentUpdateInput

*Passed to api.databanks.documents.update(documentId, input). The URL-safe slug regenerates automatically from the new name.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | New display name. |

### DatabankWaitUntilReadyOptions

*Optional polling parameters for api.databanks.documents.waitUntilReady(documentId, options?). Throws on timeout, error status, or document deletion.*

| Field | Type | Description |
| --- | --- | --- |
| `timeoutMs?` | `number` | Max wait in ms. Default 60_000 (60s). Throws on timeout. |
| `pollIntervalMs?` | `number` | Poll interval in ms. Default 500. |

### CortexQuery

*Input to api.memories.cortex.query(). chatId + queryText are required; the active userId is folded in by LumiScript.*

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | `string` | The chat to retrieve from. |
| `queryText` | `string` | Free-text retrieval query. |
| `entityFilter?` | `string[]` | Restrict to memories mentioning these entity names. |
| `timeRange?` | `{ start?: number; end?: number }` | Restrict to a time window (Unix ms). |
| `emotionalContext?` | `EmotionalTag[]` | Bias scoring toward emotional tags (e.g. 'betrayal', 'fury', 'grief'). |
| `generationType?` | `string` | Host hint for retrieval tuning. |
| `topK?` | `number` | Number of memories to return. |
| `includeConsolidations?` | `boolean` | Include narrative-arc consolidations in the candidate pool. |
| `includeRelationships?` | `boolean` | Include the active relationship edges in the result. |
| `excludeMessageIds?` | `string[]` | Exclude chunks tied to these message ids. |

### CortexResult

*Returned by api.memories.cortex.query() / getCached(). The same shape the host uses internally during prompt assembly.*

| Field | Type | Description |
| --- | --- | --- |
| `memories` | `CortexMemory[]` | Ranked memories: { source ("chunk"\|"consolidation"), sourceId, content, finalScore, components, emotionalTags, entityNames, messageRange, timeRange }. |
| `entityContext` | `EntitySnapshot[]` | Entities in context: { id, name, type, status, description, lastSeenAt, mentionCount, topFacts, emotionalProfile, relationships }. |
| `activeRelationships` | `RelationEdge[]` | Active edges: { sourceName, targetName, type, label, strength, sentiment }. |
| `arcContext` | `string | null` | The current narrative arc summary, or null. |
| `stats` | `CortexStats` | Retrieval diagnostics: { candidatePoolSize, vectorSearchResults, entitiesMatched, scoreFusionApplied, topScore, retrievalTimeMs, timedOut?, aborted? }. |

### LinkedCortexResult

*Returned by api.memories.cortex.queryLinked() / getCachedLinked(). Attached vaults + interlink targets.*

| Field | Type | Description |
| --- | --- | --- |
| `vaults` | `VaultCortexData[]` | Per attached vault: { vaultId, vaultName, sourceChatId?, entities, relations, memories?, arcContext? }. |
| `interlinks` | `InterlinkCortexData[]` | Per interlinked chat: { targetChatId, targetChatName, result: CortexResult }. |

### MemoryCortexConfig

*Returned by api.memories.cortex.getConfig(); patch with putConfig(). Permissive — only top-level toggles are typed; advanced + host-added fields pass through the index signature.*

| Field | Type | Description |
| --- | --- | --- |
| `enabled` | `boolean` | Master Memory Cortex toggle. |
| `entityTracking` | `boolean` | Whether entity extraction runs. |
| `entityExtractionMode` | `string` | e.g. 'heuristic' / 'sidecar'. |
| `salienceScoring` | `boolean` | Whether per-chunk salience scoring runs. |
| `[advanced]?` | `unknown` | retrieval / decay / consolidation / entityPruning / sidecar tuning + any host-added fields pass through unchanged. |

### ChatChunk

*Returned by api.memories.chatMemory.listChunks(). A vectorized chat chunk — the {{memories}} retrieval unit.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Chunk id. |
| `chatId` | `string` | Owning chat. |
| `content` | `string` | Chunk text. |
| `messageIds` | `string[]` | Source message ids (startMessageId..endMessageId). |
| `tokenCount` | `number` | Approx token count. |
| `vectorizedAt` | `number | null` | When embedded (Unix ms), or null if pending. |
| `retrievalCount` | `number` | How many times retrieved. |

### ChatMemoryWarmupResult

*Returned by api.memories.chatMemory.warm().*

| Field | Type | Description |
| --- | --- | --- |
| `status` | `'skipped' | 'complete' | 'rebuilding' | 'queued' | 'error'` | 'skipped' (e.g. vectorization disabled), etc. |
| `reason?` | `string` | Human-readable detail (e.g. 'chat_vectorization_disabled'). |
| `rebuilt?` | `boolean` | Whether chunks were rebuilt. |
| `vectorizationsQueued?` | `number` | How many vectorizations were queued. |

### CortexUsageStats

*Returned by api.memories.stats.usage(). Host gc fields (mention counts, last GC, etc.) pass through.*

| Field | Type | Description |
| --- | --- | --- |
| `entityCount` | `number` | Tracked entities. |
| `relationCount` | `number` | Relation edges. |
| `salienceRecordCount` | `number` | Per-chunk salience records. |
| `consolidationCount` | `number` | Narrative-arc consolidations. |

### CortexIngestionStatus

*Returned by api.memories.stats.ingestionStatus(), or null when never ingested.*

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | `string` | The chat. |
| `status` | `'idle' | 'processing' | 'complete' | 'error'` | Overall ingestion status. |
| `phase` | `'queued'|'font'|'heuristics'|'sidecar'|'persisting'|'complete'|'error'` | Current pipeline phase. |
| `pendingJobs` | `number` | Queued ingestion jobs. |
| `timings?` | `CortexIngestionTimings | null` | Last per-phase timings. |

### CortexIngestionTelemetry

*Returned by api.memories.stats.ingestionTelemetry().*

| Field | Type | Description |
| --- | --- | --- |
| `samples` | `number` | Number of ingestion samples averaged. |
| `last` | `CortexIngestionTimings | null` | The most recent ingestion timing sample. |
| `averages` | `{ fontMs, heuristicMs, sidecarMs, graphMs, dbMs, totalMs }` | Per-phase average ms over recent ingestions. |

### MemoryEntity

*A tracked entity in the cortex graph. Returned by api.memories.entities.* and inside CortexResult.entityContext (as the lighter EntitySnapshot).*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Entity id. |
| `chatId` | `string` | Owning chat. |
| `name` | `string` | Canonical name. |
| `entityType` | `EntityType` | 'character' \| 'location' \| 'item' \| 'faction' \| 'concept' \| 'event'. |
| `aliases` | `string[]` | Known aliases (matched by findByName / upsert). |
| `description` | `string` | Entity description. |
| `status` | `EntityStatus` | 'active' \| 'inactive' \| 'deceased' \| 'destroyed' \| 'unknown'. |
| `facts` | `string[]` | Up to 20 most-recent facts. |
| `emotionalValence` | `Record<string, number>` | Running emotional-valence map. |
| `mentionCount` | `number` | Total mentions. |
| `salienceAvg` | `number` | Average salience (orders list()). |
| `confidence` | `'confirmed' | 'provisional'` | Promotion confidence. |
| `…?` | `more` | Plus firstSeen*/lastSeen*, statusChangedAt, factExtraction*, salienceBreakdown, recentMentionCount, metadata, createdAt, updatedAt, userEditedAt — see the host DTO. |

### MemoryEntityUpsert

*Input to api.memories.entities.upsert(). Matches the extractor shape so a script can replay its own NER results.*

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` | Canonical name (matched against existing names + aliases). |
| `type` | `EntityType` | 'character' \| 'location' \| 'item' \| 'faction' \| 'concept' \| 'event'. |
| `aliases?` | `string[]` | Alternate names. |
| `confidence?` | `number` | Raw [0,1] extractor confidence; below the configured threshold the host drops it. |
| `role?` | `MentionRole` | 'subject' \| 'object' \| 'present' \| 'referenced' \| 'absent'. |
| `provisional?` | `boolean` | Mark as needing corroboration before promotion. |

### MemoryRelation

*A typed relation edge. Returned by api.memories.relations.*.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Edge id. |
| `sourceEntityId` | `string` | Source entity id. |
| `targetEntityId` | `string` | Target entity id. |
| `relationType` | `RelationType` | 'ally' \| 'enemy' \| 'lover' \| 'rival' \| 'owns' \| 'member_of' \| 'located_in' \| … \| 'custom'. |
| `relationLabel` | `string | null` | Free-text label (e.g. "duel pending"). |
| `strength` | `number` | Edge strength. |
| `sentiment` | `number` | Edge sentiment [-1, 1]. |
| `status` | `RelationStatus` | 'active' \| 'broken' \| 'dormant' \| 'former'. |
| `…?` | `more` | Plus evidenceChunkIds, edgeSalience, decayRate, contradictionFlag, supersededBy, arcIds, timestamps — see the host DTO. |

### MemoryRelationUpsert

*Input to api.memories.relations.upsert(). Uses entity NAMES — both endpoints must already exist in the graph or the edge is silently dropped.*

| Field | Type | Description |
| --- | --- | --- |
| `source` | `string` | Source entity name (resolved to id server-side). |
| `target` | `string` | Target entity name. |
| `type` | `RelationType` | Relation type (e.g. 'rival', 'ally', 'custom'). |
| `label` | `string` | Free-text label. |
| `sentiment` | `number` | Sentiment [-1, 1]. |

### MemoryConsolidation

*A narrative-arc consolidation. Returned by api.memories.consolidations.list / latestArc.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Consolidation id. |
| `tier` | `number` | Arc tier (1 = scene, 2 = chapter, …). |
| `title` | `string | null` | Arc title, or null. |
| `summary` | `string` | Compressed summary text. |
| `entityIds` | `string[]` | Entities featured in the arc. |
| `emotionalTags` | `EmotionalTag[]` | Dominant emotional tags. |
| `…?` | `more` | Plus sourceChunkIds, messageRange*, timeRange*, salienceAvg, tokenCount, vectorizedAt, timestamps. |

### MemorySalience

*A per-chunk salience record. Returned by api.memories.salience.list.*

| Field | Type | Description |
| --- | --- | --- |
| `chunkId` | `string` | The scored chunk. |
| `score` | `number` | Salience score. |
| `scoreSource` | `'heuristic' | 'sidecar'` | How it was scored. |
| `emotionalTags` | `EmotionalTag[]` | Emotional tags detected. |
| `narrativeFlags` | `NarrativeFlag[]` | e.g. 'first_meeting', 'death', 'confession'. |
| `statusChanges` | `{ entity, change, detail }[]` | Detected entity status changes. |
| `scoredAt` | `number` | When scored (Unix ms). Orders list(). |

### Vault

*A frozen cortex snapshot. Returned by api.memories.vaults.list / create; inside VaultWithContents.vault.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Vault id. |
| `name` | `string` | Vault name. |
| `description` | `string` | Vault description. |
| `sourceChatId` | `string | null` | The chat snapshotted, or null. |
| `sourceChatName` | `string | null` | Source chat name. |
| `entityCount` | `number` | Entities in the snapshot. |
| `relationCount` | `number` | Relations in the snapshot. |
| `chunkCount` | `number` | Chunks copied. |
| `createdAt` | `number` | Unix-ms creation timestamp. |

### VaultCreate

*Input to api.memories.vaults.create().*

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | `string` | The chat to snapshot. |
| `name` | `string` | Vault name. |
| `description?` | `string` | Optional description. |

### ChatLink

*A vault attach or chat interlink. Returned by api.memories.links.list / attach.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Link id. |
| `chatId` | `string` | The chat the link is attached to. |
| `linkType` | `'vault' | 'interlink'` | Link kind. |
| `vaultId` | `string | null` | Attached vault id (vault links). |
| `targetChatId` | `string | null` | Interlinked chat id (interlinks). |
| `label` | `string` | Link label. |
| `enabled` | `boolean` | Whether the link is active. |
| `…?` | `more` | Plus vaultName, vaultEntityCount/RelationCount, targetChatName, targetChatExists, priority, createdAt. |

### ChatLinkAttach

*Input to api.memories.links.attach(). Provide vaultId for a vault attach, or targetChatId for an interlink.*

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | `string` | The chat to attach to. |
| `linkType` | `'vault' | 'interlink'` | Link kind. |
| `vaultId?` | `string` | Vault to attach (linkType: vault). |
| `targetChatId?` | `string` | Chat to interlink (linkType: interlink). |
| `label?` | `string` | Optional label. |
| `bidirectional?` | `boolean` | Interlinks only — also create the reverse link on the target chat. |

### ImageInfo

*Returned by api.images.upload / uploadFromDataUrl / get. Camel-case mirror of ImageDTO from Spindle.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Canonical image id — the handle accepted by api.images.get / api.theme.extractColors / api.imageGen img2img / spindle.characters.setAvatar. |
| `originalFilename` | `string` | Original filename preserved at upload time. |
| `mimeType` | `string` | Image MIME type (image/png, image/jpeg, image/webp, image/gif, image/bmp). |
| `width` | `number | null` | Pixel width if the host could derive it from the upload. |
| `height` | `number | null` | Pixel height if the host could derive it from the upload. |
| `hasThumbnail` | `boolean` | Whether the host has generated a thumbnail variant for this image. |
| `url` | `string` | Relative authenticated URL for this image, already sized to specificity. |
| `specificity` | `string` | Image specificity flag — 'full' / 'sm' / 'lg'. |
| `ownerExtensionIdentifier` | `string | null` | Which extension uploaded the image — null for user-uploaded. |
| `ownerCharacterId` | `string | null` | Character ownership tag if set at upload time. |
| `ownerChatId` | `string | null` | Chat ownership tag if set at upload time. |
| `createdAt` | `number` | Creation timestamp (Unix ms). |

### ImageUploadInput

*Passed to api.images.upload(input).*

| Field | Type | Description |
| --- | --- | --- |
| `data` | `Uint8Array` | Raw image bytes. Source via api.utils.http.* with responseType:'arraybuffer', api.utils.image.dataUrlToBytes, api.files.*, etc. |
| `filename?` | `string` | Optional filename to preserve when storing. |
| `mimeType?` | `string` | Optional content type override. Defaults to image/png when not inferable host-side. |
| `ownerCharacterId?` | `string` | Optional character ownership tag for the persisted image. |
| `ownerChatId?` | `string` | Optional chat ownership tag for the persisted image. |

### ImageUploadFromDataUrlOptions

*Passed to api.images.uploadFromDataUrl(dataUrl, options?). The data URL itself carries the bytes + MIME; these options only set ownership / display metadata.*

| Field | Type | Description |
| --- | --- | --- |
| `originalFilename?` | `string` | Original filename to preserve on the persisted image. |
| `ownerCharacterId?` | `string` | Optional character ownership tag. |
| `ownerChatId?` | `string` | Optional chat ownership tag. |

### ImageGenInput

*Passed to api.imageGen.generate(input). Mirrors ImageGenRequestDTO with camel-case field names on the LumiScript surface.*

| Field | Type | Description |
| --- | --- | --- |
| `prompt` | `string` | Text prompt for image generation. Required. |
| `connectionId?` | `string` | Connection profile to use. When omitted, uses the user's default image-gen connection (set via the Lumiverse UI). Look up via api.imageGen.listConnections(). |
| `negativePrompt?` | `string` | Negative prompt — provider-dependent support. |
| `model?` | `string` | Override the connection profile's model. Look up via api.imageGen.getModels(connectionId). |
| `parameters?` | `Record<string, unknown>` | Provider-specific parameters (width, height, steps, cfg_scale, etc.). Validate against the provider's `parameters` schema from getProviders() if your script accepts user input. For img2img / inpainting providers, pass arrays of imageId strings under the image_array-typed parameter (e.g. `{ input_images: [imageId, ...] }`). Merged with the connection's defaultParameters host-side. |
| `ownerCharacterId?` | `string` | Tag the persisted result with a character ownership marker. |
| `ownerChatId?` | `string` | Tag the persisted result with a chat ownership marker. |

### ImageGenResult

*Returned by api.imageGen.generate(input). The `imageId` is the integration seam — pass to api.images.get / api.theme.extractColors / spindle.characters.setAvatar. Use `imageDataUrl` for inline rendering (no auth needed) or `imageUrl` for push-notification image fields.*

| Field | Type | Description |
| --- | --- | --- |
| `imageDataUrl` | `string` | Generated image as a base64 data URL — directly assignable to &lt;img src&gt;. Available immediately regardless of host-side persistence success. |
| `model` | `string` | Model that was actually used (may differ from input if `model` was omitted and the connection's default applied). |
| `provider` | `string` | Provider id that handled the generation. |
| `imageId?` | `string` | Canonical image id in Lumiverse's image table. Pass to api.images.get, api.theme.extractColors, spindle.characters.setAvatar, etc. Present when host-side persistence succeeded (the typical case). When absent, use imageDataUrl for inline rendering. |
| `imageUrl?` | `string` | Public unauthenticated URL for the persisted image. Auth-free so push-notification clients can render it without an auth header: api.ui.pushNotification(title, body, { image: result.imageUrl }) — pushNotification is positional (title, body, options?), NOT object-form. |

### ImageGenProviderInfo

*Returned by api.imageGen.getProviders(). Each provider declares its capability schema; drive dynamic parameter UIs from `capabilities.parameters`.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Provider id (e.g. "nanogpt", "openai", "stability"). |
| `name` | `string` | Human-readable provider name. |
| `capabilities.parameters` | `Record<string, ImageGenParameterSchema>` | Per-parameter contract — validate args before generate() to surface errors fast. |
| `capabilities.apiKeyRequired` | `boolean` | Whether the provider requires an API key on the connection profile. |
| `capabilities.modelListStyle` | `'static' | 'dynamic' | 'google'` | How models are listed. Static providers expose them under capabilities.staticModels; dynamic providers fetch from upstream via api.imageGen.getModels(connectionId). |
| `capabilities.staticModels?` | `Array<{ id: string; label: string }>` | Populated when modelListStyle === 'static'. |
| `capabilities.defaultUrl` | `string` | Provider's default API URL — used as a placeholder when creating new connection profiles. |

### ImageGenConnectionInfo

*Returned by api.imageGen.listConnections() / getConnection(). API keys are NEVER exposed — only `hasApiKey: boolean` indicates presence.*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Connection profile id. |
| `name` | `string` | User-assigned connection name. |
| `provider` | `string` | Provider id this connection talks to. |
| `apiUrl` | `string` | API URL configured on the connection. |
| `model` | `string` | Default model on the connection. |
| `isDefault` | `boolean` | Whether this is the user's default image-gen connection — used by generate() when connectionId is omitted. |
| `hasApiKey` | `boolean` | Whether the user has supplied an API key for this connection. The key itself is never exposed. |
| `defaultParameters` | `Record<string, unknown>` | Per-connection default parameter values — merged with the request's `parameters` at generate() time. |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata attached to the connection. |
| `createdAt` | `number` | Creation timestamp (Unix ms). |
| `updatedAt` | `number` | Last update timestamp (Unix ms). |

### ImageGenParameterSchema

*One parameter's contract within an ImageGenProviderInfo.capabilities.parameters record. Use to drive dynamic parameter UIs or validate user-supplied args before calling generate().*

| Field | Type | Description |
| --- | --- | --- |
| `type` | `'number' | 'integer' | 'boolean' | 'string' | 'select' | 'image_array'` | Parameter primitive. `select` has a fixed enum (see options); `image_array` takes arrays of imageId strings (img2img / inpainting providers). |
| `default?` | `unknown` | Default value when the user omits the parameter. |
| `min?` | `number` | Minimum value for numeric parameters. |
| `max?` | `number` | Maximum value for numeric parameters. |
| `step?` | `number` | Step granularity for numeric parameters — useful for slider UIs. |
| `description` | `string` | Human-readable description — surface to users in your parameter UI. |
| `required?` | `boolean` | Whether the parameter must be supplied (no default applies). |
| `options?` | `Array<{ id: string; label: string }>` | Enum entries for select-typed parameters. |
| `group?` | `string` | Optional grouping label — UI may render parameters with the same group together. |

### ColorRGB

*RGB color value, 0–255 per channel. Used in ColorExtractionInfo.dominant / regions.* / average.*

| Field | Type | Description |
| --- | --- | --- |
| `r` | `number` | Red channel, 0–255. |
| `g` | `number` | Green channel, 0–255. |
| `b` | `number` | Blue channel, 0–255. |

### ColorHSL

*HSL color value. Used in ColorExtractionInfo.dominantHsl + ThemePaletteConfig.accent + ThemeInfo.accent. Drop-in compatible across all three — the typical pipeline is `extractColors(imageId).then(p => applyPalette({accent: p.dominantHsl}))`.*

| Field | Type | Description |
| --- | --- | --- |
| `h` | `number` | Hue, 0–360 degrees. |
| `s` | `number` | Saturation, 0–100 percent. |
| `l` | `number` | Lightness, 0–100 percent. |

### ColorExtractionInfo

*Returned by api.theme.extractColors(imageId). `dominantHsl` is the ready-to-pass accent for api.theme.applyPalette({accent: ...}).*

| Field | Type | Description |
| --- | --- | --- |
| `dominant` | `ColorRGB` | Dominant color of the full image, in RGB. |
| `regions` | `{ top: ColorRGB; center: ColorRGB; bottom: ColorRGB; left: ColorRGB; right: ColorRGB }` | Per-region dominant colors. Useful for asymmetric layouts (e.g. character portrait centered with background dominant on edges). |
| `flatness` | `{ top: number; center: number; bottom: number; left: number; right: number; full: number }` | Per-region + full-image flatness score (0 = highly variegated, 1 = uniform). Use to detect "all one color" cases. |
| `average` | `ColorRGB` | Arithmetic mean RGB across the full image. |
| `isLight` | `boolean` | Whether the dominant color is perceived as light (luminance &gt; 152). Useful for picking complementary foreground colors. |
| `dominantHsl` | `ColorHSL` | HSL representation of dominant — drop-in for api.theme.applyPalette({accent: ...}). |

### ThemeOverride

*Passed to api.theme.apply(overrides). Two-axis: `variables` applies regardless of mode, `variablesByMode` applies per dark/light at apply time. LumiScript maintains per-script attribution — multiple scripts' apply() calls merge with per-key last-applied-wins semantics.*

| Field | Type | Description |
| --- | --- | --- |
| `variables?` | `Record<string, string>` | Flat CSS variable map applied regardless of the current mode. Keys are `--lumiverse-*` variable names (or any custom prefix). |
| `variablesByMode?` | `{ dark?: Record<string, string>; light?: Record<string, string> }` | Mode-keyed overrides. The host picks `dark` or `light` at apply time based on the user's current mode. Mode-specific values take precedence over flat `variables` for the same key. |

### ThemePaletteConfig

*Passed to api.theme.applyPalette(palette | null). Lumiverse generates the full coherent variable set from the accent — preserves the user's glass / radius / font / UI-scale settings. Across LumiScript scripts: most-recent-script-wins. Pass `null` to drop this script's palette contribution.*

| Field | Type | Description |
| --- | --- | --- |
| `accent` | `ColorHSL` | Primary accent color in HSL. Drop-in compatible with the dominantHsl returned by api.theme.extractColors. |

### ThemeInfo

*Returned by api.theme.getCurrent(). Read-only snapshot of the user's current theme configuration (NOT including any extension overrides).*

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Theme id (e.g. "lumiverse-purple"). |
| `name` | `string` | Theme display name. |
| `mode` | `'light' | 'dark'` | Resolved color mode. |
| `accent` | `ColorHSL` | Primary accent. |
| `enableGlass` | `boolean` | Whether glassmorphic backdrop-filter tokens are enabled. |
| `radiusScale` | `number` | Border radius multiplier. |
| `fontScale` | `number` | Font-size multiplier. |
| `uiScale` | `number` | Overall UI scale multiplier. |
| `characterAware` | `boolean` | Whether the theme adapts to the active character's avatar palette automatically (host-side feature, independent of api.theme.extractColors). |

### ThemeVariablesConfig

*Passed to api.theme.generateVariables(config). Mirrors the inputs that Lumiverse's theme engine uses to produce the full set of ~80+ CSS variables. The result can be passed to apply({variables}) for a complete coherent override, or tweaked individually before applying.*

| Field | Type | Description |
| --- | --- | --- |
| `accent` | `ColorHSL` | Primary accent color in HSL. |
| `mode` | `'dark' | 'light'` | Resolved color mode. |
| `enableGlass?` | `boolean` | Enable glassmorphic backdrop-filter tokens. Default: true. |
| `radiusScale?` | `number` | Border radius multiplier. Default: 1. |
| `fontScale?` | `number` | Font-size multiplier. Default: 1. |
| `uiScale?` | `number` | Overall UI scale multiplier. Default: 1. |
| `baseColors?` | `Record<string, string>` | Optional base colors override (advanced — typically not needed; the accent + mode produce a coherent set on their own). |
| `statusColors?` | `Record<string, string>` | Optional status colors override (success / warning / error / info — advanced). |

---

## API Functions

### api.chat

| Method | Arguments | Description |
| --- | --- | --- |
| `getMessages` | options? | Get messages in the current chat. Pass `{ last: N }` for the N most recent or `{ first: N }` for the N oldest (omit for the full message list). Requires chat_mutation permission. |
| `sendMessage` | content, options? | Append a new message. Options: role, metadata, triggerGeneration (when true, fires the host's full chat-orchestration pipeline after the append — same effect as the user pressing Enter on an empty input bar), generation (per-call ChatGenerationOptions overrides — connectionId / personaId / presetId / parameters / etc., consulted only when triggerGeneration is true). Requires chat_mutation permission. |
| `editMessage` | id, contentOrPatch | Edit a message by ID. Pass a string to replace the active swipe's content, or a MessagePatch to update swipes / swipeId / swipeDates / reasoning / metadata. Patches touching swipe-shaped fields fire SWIPE_EDITED alongside MESSAGE_EDITED. |
| `deleteMessage` | id | Delete a message by ID. |
| `getChatId` | — | Return the active chat ID, or null. |
| `getMetadata` | key | Get a metadata value from the current chat. Requires chats permission (note: distinct from chat_mutation — chats gates session-level fields, chat_mutation gates message content). |
| `setMetadata` | key, value | Set a metadata key (read-modify-write). Requires chats permission. |
| `inject` | id, content, options? | Register a prompt injection. Options: mode, role, depth, ephemeral. |
| `removeInjection` | id | Remove one injection by ID. |
| `getInjections` | — | List all active injections across all scripts. |
| `clearInjections` | — | Remove all injections from this script. Requires interceptor permission. |
| `clearAllInjections` | — | Remove ALL injections across all scripts (cross-script wipe — use sparingly). Requires interceptor permission + allowDangerous. |
| `registerContentProcessor` | handler, options? | Register a handler that fires on chat message origin events — `create` (user/assistant message write), `update`, `swipe_add`, `swipe_update`, auto-inserted greetings on the write side, AND on per-message display rendering (`render`). Return a patch { content?, extra? } to transform what gets stored or shown. Options: id, priority (default 100), origin filter, timeoutMs (default 2000). NOT invoked for api.chat.* mutations (loop safety). `extra` is IGNORED on swipe origins (swipes share the parent message's extra) and on `render` (no row to mutate). Returns handle { id, remove }. Requires chat_mutation permission. |
| `listContentProcessors` | — | List all currently registered message content processors across all scripts. |
| `setMessageHidden` | id, hidden | Mark a single message as hidden or visible. Hidden messages are excluded from vector retrieval but still included in prompt assembly. Toggle pattern: pass `true` to hide, `false` to unhide. Persists on the message — survives reloads. Requires chat_mutation permission. |
| `setMessagesHidden` | ids, hidden | Bulk variant of `setMessageHidden`. Max 500 IDs per call. Same hidden-flag semantics (excluded from vector retrieval, still included in prompt assembly). Requires chat_mutation permission. |
| `isMessageHidden` | id | Check whether a message is hidden. Returns false for messages that have never had the flag set (default state). Requires chat_mutation permission. |

### api.llm

| Method | Arguments | Description |
| --- | --- | --- |
| `generate` | messages, options? | Generate a text response from the LLM. |
| `generateStream` | messages, options? | Streaming variant of generate. Async iterator of StreamChunk values (token / reasoning / done). Break out of for await or pass options.signal to cancel. |
| `generateStructured` | messages, schema, options? | Generate and parse a structured JSON response against a Zod or JSON Schema. |
| `generateWithTools` | messages, tools, options?, schema? | Generate with tool schemas. Returns text or function calls for an agentic loop. |
| `dryRun` | options? | Assemble the full prompt without calling the LLM. Returns messages, token counts, WI stats. |

### api.connections

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | — | List the user's LLM connection profiles (read-only; never includes API keys — only has_api_key). Returns Connection[]. Free tier. Pair with api.ui.components.mountSelect/mountModelCombobox for pickers. |
| `get` | connectionId | Get a connection profile by ID, or null if not found/accessible. Returns Connection \| null. |
| `getDefault` | — | Get the user's default connection (is_default, or the first available), or null. |
| `findByName` | name | Find a connection by name (case-insensitive), or null. The id/name map to api.llm options.connectionId/connectionName. |

### api.webSearch

| Method | Arguments | Description |
| --- | --- | --- |
| `query` | options | Search the user's configured provider (SearXNG). options: { query (required), count?, scrape? (default true) }. Returns WebSearchResponse { query, results: WebSearchResult[], documents?, context? }. With scrape (default) you also get scraped documents + a prompt-ready context block; scrape:false returns only results (titles/URLs/snippets). Rejects "Web search is disabled" if no provider configured. Requires web_search. |
| `getSettings` | — | Read the safe web-search config (NEVER the API key — only hasApiKey). Returns WebSearchSettings { enabled, provider, apiUrl, defaultResultCount, maxResultCount, maxPagesToScrape, maxCharsPerPage, language, safeSearch, engines, hasApiKey, requestTimeoutMs }. Branch on enabled before query(). Requires web_search. |

### api.users

| Method | Arguments | Description |
| --- | --- | --- |
| `isVisible` | — | True if the active user has the app visible in at least one session; false if every session is hidden/backgrounded or there is no open session. Returns Promise&lt;boolean&gt;. Free tier. Use to gate push notifications (when hidden) vs. in-app UI (when visible). |
| `getRole` | — | The active user's Lumiverse role: 'operator' \| 'admin' \| 'user' (internal owners report as operator). Returns Promise&lt;UserRole&gt;. Free tier. |

### api.version

| Method | Arguments | Description |
| --- | --- | --- |
| `getBackend` | — | The running Lumiverse backend server's semantic version string (e.g. '1.2.0'). Returns Promise&lt;string&gt;. Free tier. Pair with feature gating / compatibility checks. |
| `getFrontend` | — | The running Lumiverse frontend bundle's semantic version string. Returns Promise&lt;string&gt;. Free tier. |

### api.variables.local / .global / .character / .chat

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
| `uuid` | — | Generate a UUID v4 string. Cryptographically random (uses crypto.randomUUID). |
| `shortId` | — | Generate a short random ID (8 chars, URL-safe). Cryptographically random (derived from crypto.randomUUID). |
| `wait` | ms | Pause execution for ms milliseconds. |
| `random.int` | min, max | Random integer in [min, max] inclusive. **NOT cryptographically secure** — uses Math.random for gameplay/UI use cases. For tokens or security-sensitive identifiers use api.utils.uuid / shortId or globalThis.crypto.getRandomValues. |
| `random.float` | min, max | Random float in [min, max). **NOT cryptographically secure** (Math.random — see random.int). |
| `random.pick` | array | Pick a random element from an array. **NOT cryptographically secure** (Math.random — see random.int). |
| `random.bool` | — | Random true/false. **NOT cryptographically secure** (Math.random — see random.int). |
| `random.chance` | probability | Returns true with probability p (0–1). **NOT cryptographically secure** (Math.random — see random.int). |
| `random.shuffle` | array | Return a shuffled copy of the array. **NOT cryptographically secure** (Math.random — see random.int). |
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
| `mountApp` | options? | Mount a route-persistent, full-bleed document.body portal — full-screen overlays or persistent chrome beyond dock / drawer / float. options: { className?, position? ('start'\|'end'\|'app-overlay') }. Body DOM is fully script-owned via handle.root (DOMHandle); render + wire it via api.ui.dom.*. Returns MountedAppHandle { mountId, root, setVisible, destroy }. Requires app_manipulation. |
| `registerDrawerTab` | options | Register a tab in the ViewportDrawer sidebar. Body DOM is script-owned via handle.root (DOMHandle). Tabs auto-appear in the command palette (Ctrl+K) searchable by title, shortName, description terms, keywords, and the extension name. Limits: 1 tab per script (LumiScript-enforced), 4 total across all LumiScript scripts (Spindle host cap), 8 global. Returns DrawerTabHandle { tabId, root, setTitle, setShortName, setBadge, activate, onActivate, destroy }. Free-tier. |
| `editText` | title?, value?, options? | Open the native Lumiverse expanded text editor with macro syntax highlighting. Blocks until close. Returns edited text or null if cancelled. Options: placeholder. |
| `pushNotification` | title, body, options? | Send an OS push notification. Only delivered when app is unfocused. Returns { sent }. Options: tag (dedup), url, icon, rawTitle, image. Requires push_notification. |
| `getPushStatus` | — | Check if push notifications are available. Returns { available, subscriptionCount }. Requires push_notification. |
| `getDrawerTabs` | — | List discoverable drawer tabs (built-in + extension-contributed) visible to the user. Returns UIDrawerTab[] { id, shortName, tabName, tabDescription, keywords, source ("builtin"\|"extension"), extensionId? }. Pair with openDrawerTab(id) to build a custom jump-to picker. Free-tier. |
| `getSettingsTabs` | — | List discoverable settings tabs visible to the user (role-restricted tabs are filtered out). Returns UISettingsTab[] { id, shortName, tabName, tabDescription, keywords, role? }. Free-tier. |
| `openDrawerTab` | tabId | Open the drawer to a specific tab id (built-in or extension-contributed — ids from getDrawerTabs). Resolves once the host dispatches the navigation; the frontend applies it asynchronously. Free-tier. |
| `closeDrawer` | — | Close the drawer if it is currently open. Free-tier. |
| `openSettings` | viewId? | Open the settings modal to a tab id (e.g. 'connections', 'display' — ids from getSettingsTabs). Omit viewId to land on 'display'. Free-tier. |
| `closeSettings` | — | Close the settings modal if it is currently open. Free-tier. |
| `openCommandPalette` | — | Open the command palette overlay (the Ctrl+K surface). Free-tier. |
| `closeCommandPalette` | — | Close the command palette overlay if it is currently open. Free-tier. |
| `pickFile` | options? | Open the browser's native file picker and return the selected file(s). options: { accept? (string[] of extensions/MIME types), multiple? (default false), maxSizeBytes? }. Returns Promise&lt;PickedFile[]&gt; where PickedFile is { name, mimeType, sizeBytes, bytes: Uint8Array }. Resolves [] if the user cancels; REJECTS if a file exceeds maxSizeBytes (mirrors the host throw). The native dialog is the user-action gate, so free-tier. Feed bytes into api.images.upload / api.db / api.files; decode text via new TextDecoder().decode(file.bytes). |

### api.ui.events

| Method | Arguments | Description |
| --- | --- | --- |
| `getKeyboardState` | — | The current virtual-keyboard snapshot. Returns Promise&lt;UIKeyboardState&gt; { visible, insetBottom, viewportWidth, viewportHeight }. Free-tier. Resolves from a backend cache the frontend keeps fresh. |
| `onKeyboardChange` | handler | Subscribe to keyboard visibility / safe-area changes. handler receives UIKeyboardState. Returns an unsubscribe fn. Free-tier. The subscription keeps the script alive while registered and is torn down on disable. Primary use: mobile-safe widget positioning (reposition on insetBottom). |
| `getDrawerState` | — | The current side-drawer snapshot. Returns Promise&lt;UIDrawerState&gt; { open, tabId }. Free-tier. |
| `onDrawerChange` | handler | Subscribe to drawer open/close + tab changes. handler receives UIDrawerState. Returns an unsubscribe fn. Free-tier. |
| `getSettingsState` | — | The current settings-modal snapshot. Returns Promise&lt;UISettingsState&gt; { open, view }. Free-tier. |
| `onSettingsChange` | handler | Subscribe to settings open/close + active-view changes. handler receives UISettingsState. Returns an unsubscribe fn. Free-tier. |

### api.ui.dom

| Method | Arguments | Description |
| --- | --- | --- |
| `inject` | target, html, options? | Inject sanitized HTML at a CSS selector. Returns DOMHandle { id, update, remove, on }. Options object (single arg — NOT `inject(target, html, position, options)`): `position` (default "beforeend"), `id` (stable ID for idempotent injection — re-firing with the same id triggers in-place innerHTML update via dom_update IPC instead of a fresh insert). **Note**: when the injected HTML contains an inline `<style>` block (the host-CSS-targeting pattern — see api.ui.dom NAMESPACE_CONCEPTS), do NOT use `id`-dedup. The dom_update path replaces wrapper innerHTML, and browsers don't reliably reactivate `<style>` blocks added that way — second fire silently loses every CSS rule. Pattern for inline-style scripts that re-fire: drop `id`, call `api.ui.dom.cleanup()` at body start instead. Requires app_manipulation. |
| `injectAtMessage` | messageId, html, options? | Inject sanitized HTML into a message bubble. Waits up to 5 s for the element if not yet rendered. Options: position ("footer" default / "header"), id (stable ID). Returns DOMHandle. Requires app_manipulation. |
| `addStyle` | css, opts? | Add a `<style>` element scoped to this script via `@scope ([data-ls-script="<id>"])`. Returns `{ remove() }`. Use `--lumiverse-*` CSS variables for theming. Pass `{ id: 'foo' }` for idempotent re-injection — calling `addStyle` again with the same id removes the prior stylesheet first (useful for dev-iteration where the CSS source changes between fires). Without an id, every call adds a fresh stylesheet. **Scope limitation**: rules ONLY match descendants of script-injected DOM. Cannot reach host elements (chat input bar, message bubbles, toolbar buttons, the body, etc.) because `@scope` excludes everything outside the script's wrappers. To style host UI, include an inline `<style>` block inside an `inject()` HTML payload instead — CSS rules in a `<style>` element are document-global regardless of where the tag sits. **Top-level at-rules** (`@font-face`, `@keyframes`) are likewise dropped here — they're invalid nested inside `@scope`, so the browser silently discards them; deliver those via an inline `<style>` block too, never `addStyle`. See api.ui.dom NAMESPACE_CONCEPTS for the full pattern. Requires app_manipulation permission. |
| `delegate` | selector, event, handler, options? | Attach an event-delegated listener at a known root, matching descendants by CSS selector. Lets scripts react to clicks/changes on DOM the script didn't inject — e.g. interactive elements emitted by the LLM in chat-message content. Single host-side capture listener per (root, event) tuple regardless of how many scripts subscribe; selector matching happens frontend-side via event.target.closest(). Default scope (options.root: "chat") restricts matching to chat content; "document" matches anywhere on the page. Returns an unsubscribe function. Requires app_manipulation. |
| `cleanup` | — | Remove all DOM injections, styles, and delegations created by THIS script (other scripts' DOM is untouched). Auto-fired on script disable / delete — manual call is for re-fire scenarios where you want to wipe and rebuild from scratch. **Canonical use**: at the top of a script body that combines re-firing triggers (`ls:startup` + `CHAT_SWITCHED` + manual Run) with inline `<style>` blocks in injected HTML. Calling `cleanup()` then `inject(...)` guarantees a fresh-inject path on every fire — which parses `<style>` correctly — instead of dom_update-via-id-dedup which doesn't reactivate inline styles. Requires app_manipulation. |

### api.ui.components

| Method | Arguments | Description |
| --- | --- | --- |
| `mountBadge` | target, options? | Mount a themed host badge into a script-owned slot. `target` is a DOMHandle (inject an empty container via api.ui.dom.inject first). Options: text, color ("neutral"\|"primary"\|"success"\|"warning"\|"danger"\|"info"), size ("sm"\|"md"\|"pill"). Returns MountedComponentHandle { id, update(patch), destroy() } synchronously. update/destroy are fire-and-forget. Requires app_manipulation. |
| `mountSpinner` | target, options? | Mount a themed loading spinner into a script-owned slot (DOMHandle target). Options: size (px, default 16), fast (boolean). Returns MountedComponentHandle. Requires app_manipulation. |
| `mountSwitch` | target, options? | Mount a themed toggle switch into a script-owned slot (DOMHandle target). Options: checked, onChange(checked:boolean), size ("sm"\|"md"), disabled, ariaLabel. Returns MountedValueComponentHandle { id, update, destroy, getValue(): Promise&lt;boolean&gt; } — getValue() is ASYNC (a frontend round-trip), unlike the host's sync getValue. onChange fires into your script on every toggle. Requires app_manipulation. |
| `mountTextInput` | target, options? | Mount a themed single-line text input into a script-owned slot (DOMHandle target). Options: value, onChange(value:string), placeholder, autoFocus, disabled, className, ariaLabel. Returns MountedValueComponentHandle { ..., getValue(): Promise&lt;string&gt; } (async getValue). onChange fires on every user change. Requires app_manipulation. |
| `mountTextArea` | target, options? | Mount a themed multi-line text editor (DOMHandle target). Options: value, onChange(value:string), placeholder, rows (default 4), disabled, className, ariaLabel. Returns MountedValueComponentHandle (getValue(): Promise&lt;string&gt;). Requires app_manipulation. |
| `mountNumericInput` | target, options? | Mount a themed validated number input (DOMHandle target). Options: value (number\|null), onChange(value:number\|null), allowEmpty, integer, min, max, step, placeholder, disabled. Returns MountedValueComponentHandle (getValue(): Promise&lt;number\|null&gt;). Requires app_manipulation. |
| `mountNumberStepper` | target, options? | Mount a themed number input with +/- buttons (DOMHandle target). Like mountNumericInput minus integer; step defaults to 1. Returns MountedValueComponentHandle (getValue(): Promise&lt;number\|null&gt;). Requires app_manipulation. |
| `mountCheckbox` | target, options? | Mount a themed checkbox (DOMHandle target). Options: checked, onChange(checked:boolean), label, hint, disabled. Returns MountedValueComponentHandle (getValue(): Promise&lt;boolean&gt;). Requires app_manipulation. |
| `mountRangeSlider` | target, options | Mount a themed touch-friendly range slider (DOMHandle target). options is REQUIRED (min + max are mandatory). Options: min (required), max (required), value, step, integer, onCommit(v:number) [once per gesture], onDragValue(v:number\|null) [live], label, hint, format ({decimals,prefix,suffix}), disabled, className. Returns MountedValueComponentHandle (getValue(): Promise&lt;number&gt;). Requires app_manipulation. |
| `mountSelect` | target, options? | Mount a themed searchable single-select dropdown (DOMHandle target). Options: options (SpindleSelectOption[]), value, onChange(value:string), placeholder, searchPlaceholder, clearable, clearLabel, leading cells, grouping, portal/align/maxHeight/minWidth, disabled, etc. Returns MountedValueComponentHandle (getValue(): Promise&lt;string&gt;). Requires app_manipulation. |
| `mountMultiSelect` | target, options? | Mount a themed searchable multi-select (DOMHandle target). Like mountSelect but value/onChange use string[]. Returns MountedValueComponentHandle (getValue(): Promise&lt;string[]&gt;). Requires app_manipulation. |
| `mountFolderDropdown` | target, options? | Mount a themed folder picker with inline create-folder (DOMHandle target). Options: folders (string[]), value, onChange(folder:string), onCreateFolder(name:string), placeholder, disabled. Returns MountedValueComponentHandle (getValue(): Promise&lt;string&gt;). Requires app_manipulation. |
| `mountModelCombobox` | target, options? | Mount the themed connection-aware model picker (DOMHandle target). Connection-bound mode: pass connection {kind:"llm"\|"image"\|"tts"\|"embedding", id?} and the host manages the model list. Manual mode: pass models[] + onRefresh. Other options: value, onChange(model:string), appearance, placeholder, etc. Returns MountedValueComponentHandle (getValue(): Promise&lt;string&gt;). NOTE: the handle's refresh() method is a deferred follow-up; connection-bound mode auto-manages the list without it. Requires app_manipulation. |
| `mountPagination` | target, options | Mount themed page navigation (DOMHandle target). options is REQUIRED (currentPage, totalPages, onPageChange(page:number) are mandatory). Optional: perPage, perPageOptions, onPerPageChange(n:number), totalItems. Fully controlled — call handle.update({currentPage}) after navigation. Returns MountedComponentHandle (no getValue). Requires app_manipulation. |
| `mountCloseButton` | target, options? | Mount a themed close (X) button (DOMHandle target). Options: onClick(), size ("sm"\|"md"), variant ("subtle"\|"solid"), position ("static"\|"absolute"), iconSize. Returns MountedComponentHandle (no getValue). Requires app_manipulation. |
| `mountCollapsibleSection` | target, options | Mount a collapsible section (DOMHandle target). options is REQUIRED (title is mandatory). Options: title (required), iconSvg, iconUrl, badge, defaultExpanded (default true), onToggle(expanded:boolean). The host owns the header chrome; the returned MountedCollapsibleSectionHandle adds: body (a DOMHandle you inject/update content into), isExpanded(): Promise&lt;boolean&gt;, expand(), collapse(), toggle(). Requires app_manipulation. |

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
| `tempWrite` | path, data, options? | Write UTF-8 text. Options: { ttlMs?, reservationId? } — ttlMs sets expiry; reservationId charges the write against a tempRequestBlock reservation. |
| `tempReadBinary` | path | Read a file as raw bytes. Returns Promise&lt;Uint8Array&gt;. Pair with tempWriteBinary for caching images / PDFs / other binary blobs within quota. |
| `tempWriteBinary` | path, data, options? | Write raw bytes (Uint8Array). Options: { ttlMs?, reservationId? }, same as tempWrite. Bytes cross the IPC intact (no base64). |
| `tempDelete` | path | Delete a file. |
| `tempList` | prefix? | List files under a prefix. |
| `tempStat` | path | Get file metadata (sizeBytes, createdAt, expiresAt?). |
| `tempClearExpired` | — | Remove all expired files. Returns count removed. |
| `tempGetPoolStatus` | — | Read the ephemeral-storage quota snapshot. Returns TempPoolStatus — global + this-extension max/used/reserved/available bytes plus fileCount / fileCountMax. Check available before a large write. |
| `tempRequestBlock` | sizeBytes, options? | Reserve sizeBytes of quota up front (so a large write can't fail partway). Options: { ttlMs?, reason? }. Returns TempReservation { reservationId, sizeBytes, expiresAt } — pass reservationId to tempWrite/tempWriteBinary options, or tempReleaseBlock to free it. |
| `tempReleaseBlock` | reservationId | Release a reservation from tempRequestBlock you did not use. |

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
| `registerInterceptor` | handler, options? | Register a handler that runs BEFORE world info activation. Returns disable / enable / force / mutate decisions for the candidate entries. Returns handle { id, remove }. Multiple handlers compose by priority; vote-off precedence on disabled. 2s soft timeout (configurable). Requires generation. |
| `listInterceptors` | — | Sync read of all currently-registered world-info interceptors. Diagnostic surface. Returns RegisteredWorldInfoInterceptorInfo[]. |

### api.databanks

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List databanks (paginated). Options: limit, offset, scope, scopeId. Returns { data: DatabankInfo[], total }. Requires databanks permission. |
| `get` | databankId | Get a databank by ID. Returns null if not found. Requires databanks permission. |
| `findByName` | name, scope? | Find the first databank whose display name exactly matches (case-sensitive) within an optional scope. Convenience over list(). Returns null if no match. Requires databanks permission. |
| `create` | input | Create a new databank. `input.scope` must be one of `'global' | 'character' | 'chat'` (DatabankScope) — `'script'` is NOT a valid scope. `scopeId` is REQUIRED for `'character'` and `'chat'` scopes; omit for `'global'`. Requires databanks permission. |
| `update` | databankId, input | Update a databank (name / description / enabled). Scope cannot be changed after creation. Requires databanks permission. |
| `delete` | databankId | Delete a databank and all its documents. Returns true if deleted. Requires databanks permission. |
| `documents.list` | databankId, options? | List documents inside a databank (paginated). Returns { data: DatabankDocumentInfo[], total }. Requires databanks permission. |
| `documents.get` | documentId | Get a document by ID. Returns null if not found. Requires databanks permission. |
| `documents.findByName` | databankId, name | Find the first document whose display name exactly matches inside a databank. Returns null if no match. Requires databanks permission. |
| `documents.create` | databankId, input | Upload a document. **Required input fields**: `data` (`string | Uint8Array` — NOT `content`) and `filename` (string with extension, e.g. `'notes.md'`). **Optional**: `mimeType`, `name` (display override). Returns immediately with `status: 'pending'` — ingestion (chunking + vectorisation) runs async. Use `waitUntilReady()` or poll `get()` to await completion. Max size 10 MB; supported extensions in DatabankDocumentCreateInput. Requires databanks permission. |
| `documents.update` | documentId, input | Update document display name (URL slug regenerates). Requires databanks permission. |
| `documents.delete` | documentId | Delete a document. Returns true if deleted. Requires databanks permission. |
| `documents.getContent` | documentId | Read the document's ingested text content. Returns `{ content: string }` on success, or `null` if the document does not exist OR has not finished processing — check `status === 'ready'` via `get()` first, or call `waitUntilReady()` to block. Requires databanks permission. |
| `documents.reprocess` | documentId | Reset a document to `status: 'pending'`, drop its vectors, and re-queue for full reingestion. Useful after upstream content changes or when ingestion errored. Requires databanks permission. |
| `documents.waitUntilReady` | documentId, options? | Poll until the document reaches `status: 'ready'`. Throws on error/timeout/deletion. Default 60s timeout, 500ms poll interval — override via DatabankWaitUntilReadyOptions. Use after `create()` or `reprocess()` to await ingestion. Requires databanks permission. |

### api.memories.cortex

| Method | Arguments | Description |
| --- | --- | --- |
| `getConfig` | — | Get the Memory Cortex configuration (MemoryCortexConfig — permissive; advanced/host-added fields pass through). Requires memories permission. |
| `putConfig` | patch | Patch the Memory Cortex configuration (deep merge; unspecified fields untouched). Returns the updated config. Requires memories permission. |
| `query` | query | Fused-score retrieval (semantic + salience + recency + reinforcement + emotional + entity). query: CortexQuery { chatId (required), queryText (required), entityFilter?, timeRange?, emotionalContext?, generationType?, topK?, includeConsolidations?, includeRelationships?, excludeMessageIds? }. Returns CortexResult { memories, entityContext, activeRelationships, arcContext, stats }. Server-cached ~5 min per chat + query shape. Requires memories permission. |
| `queryLinked` | chatId, options? | Resolve every attached vault + interlink target in parallel. options: { queryText? } — pass queryText to rank by relevance. Returns LinkedCortexResult { vaults, interlinks }. Requires memories permission. |
| `getCached` | chatId | Read the warm cortex cache without re-running retrieval. Returns CortexResult or null (no/expired cache). Requires memories permission. |
| `getCachedLinked` | chatId | Read the cached linked-cortex result. Returns LinkedCortexResult or null. Requires memories permission. |
| `invalidateCache` | chatId | Drop the warm cortex cache for a chat. Requires memories permission. |
| `invalidateLinkedCache` | chatId | Drop the warm linked-cortex cache for a chat. Requires memories permission. |

### api.memories.entities

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | chatId, options? | List entities for a chat. options: { activeOnly? (default true), limit? }. Ordered by salience. Returns MemoryEntity[]. Requires memories permission. |
| `get` | entityId | Get an entity by id, or null if not found / not owned. Requires memories permission. |
| `findByName` | chatId, name | Find an entity by canonical name OR known alias, or null. Requires memories permission. |
| `upsert` | chatId, entity, options? | Smart-merge upsert against canonical name + aliases. entity: MemoryEntityUpsert { name, type ("character"\|"location"\|"item"\|"faction"\|"concept"\|"event"), aliases?, confidence?, role?, provisional? }. options: { chunkId?, createdAt? } attribute the mention. Returns the merged MemoryEntity. Requires memories permission. |
| `updateStatus` | entityId, patch | Update status. patch: { status ('active'\|'inactive'\|'deceased'\|'destroyed'\|'unknown'), statusChangedAt? }. Returns MemoryEntity. Requires memories permission. |
| `addFacts` | entityId, facts | Append facts (string[]); deduplicated, keeps the most recent 20. Returns MemoryEntity. Requires memories permission. |
| `getFacts` | entityId | Read an entity's facts (string[]; tagged branch facts stripped). Requires memories permission. |
| `updateEmotionalValence` | entityId, valence | Replace the running emotional-valence map (Record&lt;string, number&gt;, e.g. { betrayal: 0.6, grief: 0.4 }). Returns MemoryEntity. Requires memories permission. |

### api.memories.relations

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | chatId | Active relation edges for a chat (excludes superseded / merged). Returns MemoryRelation[]. Requires memories permission. |
| `listAll` | chatId | Every relation edge including superseded / merged — for diagnostics. Requires memories permission. |
| `forEntity` | chatId, entityId | Active edges incident to one entity. Requires memories permission. |
| `forEntities` | chatId, entityIds, options? | Active edges across a set of entity ids. options: { limit? }. Requires memories permission. |
| `upsert` | chatId, relation, options? | Upsert a relation by entity NAMES (not ids — the host resolves them). relation: MemoryRelationUpsert { source, target, type (RelationType), label, sentiment }. BOTH endpoints must already exist in the graph (call entities.upsert first) — returns the row or null if silently dropped. options: { chunkId? } attributes evidence. Requires memories permission. |

### api.memories.consolidations

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | chatId, options? | List narrative-arc consolidations (compressed summaries). options: { tier? } (1 = scene, 2 = chapter, …). Ordered most-recent first. Returns MemoryConsolidation[]. Requires memories permission. |
| `latestArc` | chatId | The most recent arc across all tiers, or null. Requires memories permission. |
| `run` | chatId | Trigger a background EXTRACTIVE consolidation pass (heuristic only — no sidecar LLM). Fire-and-forget: returns immediately; new arcs surface via list() once the job completes. Requires memories permission. |

### api.memories.salience

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | chatId, options? | Per-chunk salience records, ordered by scoredAt desc. options: { limit? (max 500/page), offset? }. Returns MemorySalience[] { chunkId, score, scoreSource, emotionalTags, narrativeFlags, statusChanges, hasDialogue/Action/InternalThought, wordCount, scoredAt }. Requires memories permission. |

### api.memories.vaults

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | — | All vaults owned by the active user (Vault[]). Requires memories permission. |
| `get` | vaultId | A vault with its entities + relations (VaultWithContents), or null if not found / not owned. Requires memories permission. |
| `getChunks` | vaultId | The chunk snapshot copied into the vault at creation (VaultChunk[]). Requires memories permission. |
| `create` | input | Snapshot a chat into a new vault. input: VaultCreate { chatId, name, description? }. Entities + relations copy synchronously; LanceDB chunks copy in the background (queryable structural-only until done). Returns Vault. Requires memories permission. |
| `rename` | vaultId, name | Rename a vault. Returns true if renamed. Requires memories permission. |
| `delete` | vaultId | Delete a vault + its chunks + attached links. Returns true if deleted. Requires memories permission. |
| `reindex` | vaultId | Re-run the LanceDB chunk copy from the source chat (e.g. after an embedding-model swap). Returns VaultReindexResult { mode, chunkCount }. Requires memories permission. |

### api.memories.links

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | chatId | All links attached to a chat — vault attaches + interlinks (ChatLink[]). Requires memories permission. |
| `attach` | input | Attach a vault as read-only knowledge, or interlink two chats. input: ChatLinkAttach { chatId, linkType ('vault'\|'interlink'), vaultId? (for vault), targetChatId? (for interlink), label?, bidirectional? (interlinks — also creates the reverse link) }. Returns the created ChatLink(s). Requires memories permission. |
| `remove` | chatId, linkId | Remove a link. Returns true if removed. Requires memories permission. |
| `toggle` | chatId, linkId, enabled | Enable / disable a link without removing it. Returns true if toggled. Requires memories permission. |

### api.memories.chatMemory

| Method | Arguments | Description |
| --- | --- | --- |
| `listChunks` | chatId | All vectorized chunks for a chat, oldest first (ChatChunk[]). The raw index behind the {{memories}} macro. Requires memories permission. |
| `get` | chatId, options? | Top-K hybrid (vector + BM25) retrieval. options: { topK? }. Returns ChatMemoryResult { chunks, formatted, count, enabled, queryPreview, settingsSource, chunksAvailable, chunksPending } — same payload as the {{memories}} macro (equivalent to api.chats.getMemories but under the memories permission). Requires memories permission. |
| `warm` | chatId, options? | Rebuild stale chunks + queue pending vectorizations. options: { force? }. Returns ChatMemoryWarmupResult { status, reason?, rebuilt?, vectorizationsQueued? }. No-op (status:'skipped') when chat vectorization is disabled. Requires memories permission. |
| `invalidate` | chatId | Drop the cached {{memories}} retrieval result for a chat. Requires memories permission. |

### api.memories.stats

| Method | Arguments | Description |
| --- | --- | --- |
| `usage` | chatId | Entity / relation / consolidation / salience counts (CortexUsageStats; host gc fields pass through). Requires memories permission. |
| `ingestionStatus` | chatId | Live ingestion phase + pending job count (CortexIngestionStatus), or null when the chat was never ingested. Requires memories permission. |
| `ingestionTelemetry` | chatId | Last sample + per-phase averages over recent ingestions (CortexIngestionTelemetry). Requires memories permission. |

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
| `switchActive` | personaId | Switch the active persona. Pass `personaId: string` to activate a persona, or `null` to deactivate. |
| `getWorldBook` | personaId | Get the world book attached to a persona. |

### api.presets

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List user presets (paginated). Options: `{ limit?, offset? }`. Defaults: limit 50, max 200. Returns `{ data: Preset[], total }`. Requires presets permission. |
| `get` | presetId | Get a preset by ID. Returns `null` if not found. Requires presets permission. |
| `create` | input | Create a new preset. `input.name` and `input.provider` are required (`provider` is typically `'loom'` for native Lumiverse presets). All other fields optional with host defaults (`engine: 'classic'`, empty parameters / prompt_order / prompts / metadata). Requires presets permission. |
| `update` | presetId, input | Update a preset. All fields optional. When `prompt_order` or `metadata` is updated, Lumiverse prunes stale `metadata.promptVariables` entries that no longer correspond to a variable definition on a block. Requires presets permission. |
| `delete` | presetId | Delete a preset. Returns `true` if deleted. Requires presets permission. |
| `blocks.list` | presetId | Return the preset's ordered prompt blocks (`PromptBlock[]`), including structural category-marker blocks. Requires presets permission. |
| `blocks.get` | presetId, blockId | Get a block by ID. Returns `null` if not found. Requires presets permission. |
| `blocks.create` | presetId, input, options? | Create a prompt block. `options.index` inserts at a specific zero-based position within the preset's `prompt_order`; omitted appends to the end. Block ops update the parent preset's `prompt_order` array and trigger the normal preset update flow. Requires presets permission. |
| `blocks.update` | presetId, blockId, input | Update a block. All fields except `id` are optional. Requires presets permission. |
| `blocks.delete` | presetId, blockId | Delete a block. Returns `true` if deleted. Requires presets permission. |
| `categories.list` | presetId | Return host-derived category groupings (`PromptBlockCategoryGroup[]`) for the preset's ordered blocks. Categories aren't separate records — they're structural prompt blocks with `marker === 'category'`, and a group's children are the following non-category blocks until the next category marker. The first group may have `categoryBlock: null` if normal blocks appear before any category marker. To create / update / delete a category, use `blocks.*` with `marker: 'category'`. Requires presets permission. |

### api.regexScripts

| Method | Arguments | Description |
| --- | --- | --- |
| `list` | options? | List regex find/replace scripts (paginated). Options: scope, scopeId (required for character/chat scope), target ('prompt'\|'response'\|'display'), limit (max 200), offset. Returns { data: RegexScriptInfo[], total }. |
| `get` | scriptId | Get a single regex script by id. Returns null if not found. |
| `findByName` | name, scope? | Find the first regex script whose name exactly matches. Convenience over list() — pages through. O(scripts) worst case. |
| `getActive` | options | Resolve enabled rules that would actually fire for the given target + character/chat context, merged across global + character + chat scopes and ordered by scope tier then sortOrder. Mirrors Lumiverse's internal resolution. Required: target. Optional: characterId, chatId. |
| `create` | input | Create a new regex script. name and findRegex are required; everything else gets host-side defaults (placement: ['ai_output'], scope: 'global', target: 'response', flags: 'gi', etc.). |
| `update` | scriptId, input | Update a regex script. All fields optional; only provided fields are touched. Throws if the script is not found. |
| `delete` | scriptId | Delete a regex script. Returns true if the row was deleted. |

### api.images

| Method | Arguments | Description |
| --- | --- | --- |
| `upload` | input | Upload raw image bytes to Lumiverse's image store. `input.data` is a Uint8Array (source via api.utils.http.* with responseType:'arraybuffer', api.utils.image.dataUrlToBytes, api.files.*, etc.). Optional: filename, mimeType, ownerCharacterId, ownerChatId. Returns the ImageInfo whose `id` can be passed to api.theme.extractColors or stored on a character avatar. Requires images permission. |
| `uploadFromDataUrl` | dataUrl, options? | Convenience: upload from a `data:image/...;base64,...` data URL. Optional options: originalFilename, ownerCharacterId, ownerChatId. Returns ImageInfo. Requires images permission. |
| `get` | imageId | Look up an image by id. Returns ImageInfo or null. Requires images permission. |
| `delete` | imageId | Delete an image by id. Returns `true` if a row was removed. Requires images permission. |

### api.imageGen

| Method | Arguments | Description |
| --- | --- | --- |
| `generate` | input | Generate an image. `input.prompt` required; optional: connectionId (default: user's default connection), negativePrompt, model, parameters (provider-specific — validate against the provider's `parameters` schema from getProviders() if your script accepts user input), ownerCharacterId, ownerChatId. Returns ImageGenResult { imageDataUrl, model, provider, imageId?, imageUrl? } — `imageId` is the canonical handle accepted by api.images.get / api.theme.extractColors / characters.setAvatar; `imageUrl` is an auth-free public URL suitable for api.ui.pushNotification(title, body, { image: result.imageUrl }) — pushNotification is positional, NOT object-form. For img2img / inpainting, pass `parameters: { input_images: [imageId, ...] }`. Requires image_gen permission. |
| `getProviders` | — | List all image-generation providers available on this Lumiverse install along with their capability schemas. Each provider's `capabilities.parameters` describes the supported `parameters` for generate() calls against that provider's connections — use to drive dynamic parameter UIs. Requires image_gen permission. |
| `listConnections` | — | List the user's image-gen connection profiles. API keys are never exposed — only `hasApiKey: boolean`. Use to populate a connection picker UI. Requires image_gen permission. |
| `getConnection` | connectionId | Get a single image-gen connection profile by id. Returns ImageGenConnectionInfo or null. Requires image_gen permission. |
| `getModels` | connectionId | List the models available on a connection profile. For dynamic-list providers, this fetches live from the upstream API (network round-trip). Static-list providers return their capabilities.staticModels directly. Returns Array&lt;{id, label}&gt;. Requires image_gen permission. |

### api.oauth

| Method | Arguments | Description |
| --- | --- | --- |
| `onCallback` | handler | Register a callback handler for this extension's OAuth redirect URL. Handler receives the URL query params as Record&lt;string, string&gt;; optional return { html } becomes the response body shown in the user's browser tab. **Single handler per extension** (host stores in a module-scope ref; last-wins). LumiScript emits a `spindle.log.warn` on cross-script or same-script-re-register collisions — non-terminating; the host's last-wins behavior is preserved. Returns a sync unsubscribe fn. Requires oauth permission. |
| `getCallbackUrl` | — | Get the host-relative callback URL path (e.g. `/api/spindle-oauth/lumiscript/callback`). Stable per-extension; use as the `redirect_uri` in your authorize URL construction. Async on the LumiScript side due to IPC boundary even though the host method is sync. Requires oauth permission. |
| `createState` | — | Mint a CSRF state nonce. Pass to your authorize URL as `state=...`; the host verifies the returned state at callback time and rejects mismatches before invoking your handler. Requires oauth permission. |

### api.theme

| Method | Arguments | Description |
| --- | --- | --- |
| `apply` | overrides | Apply CSS variable overrides on top of the user's current theme. `overrides.variables` is a flat map applied regardless of mode; `overrides.variablesByMode.{dark,light}` is mode-selected at apply time by the host. LumiScript maintains per-script attribution — multiple scripts' apply calls merge with per-key last-applied-wins semantics. Requires app_manipulation permission. |
| `applyPalette` | palette | Apply a palette-driven theme. Pass `palette: ThemePaletteConfig` where `palette.accent` is `{h, s, l}` and Lumiverse generates the full variable set coherently, preserving the user's glass/radius/font/UI-scale. Pass `null` to drop this script's palette contribution. Across LumiScript scripts: most-recent-script-wins. Requires app_manipulation permission. |
| `clear` | — | Drop this script's contributions from the per-script override registry, re-merge, push the post-clear result to spindle.theme.{apply,applyPalette}. Auto-called on script disable / delete. Requires app_manipulation permission. |
| `getCurrent` | — | Get a read-only snapshot of the user's current theme configuration (NOT including any extension overrides). Returns ThemeInfo with id, name, mode ('light' \| 'dark'), accent (HSL), enableGlass, radiusScale, fontScale, uiScale, characterAware. Requires app_manipulation permission. |
| `extractColors` | imageId | Extract a color palette from an image stored in Lumiverse's image system. `imageId` is a host-side UUID (sources: `character.imageId`, `api.images.upload(...).id`). Returns ColorExtractionInfo with dominant + per-region RGB + flatness scores + isLight + dominantHsl (ready to pass to applyPalette). Throws if the id is unknown. Requires app_manipulation permission. |
| `generateVariables` | config | Generate the full set of Lumiverse CSS variables from a theme config without applying them. Pass the result to apply({variables}) for a complete coherent override (or tweak individual keys before applying). config.accent + config.mode required; glass/radius/font/UI-scale/baseColors/statusColors optional. Requires app_manipulation permission. |

### api.council

| Method | Arguments | Description |
| --- | --- | --- |
| `getSettings` | — | Get the user's full Council settings: mode flag, members[], tool-execution settings (timeout, sidecar context window, etc.). Returns CouncilSettings verbatim. No permission required. |
| `getMembers` | — | Get the user's currently-assigned Council members with full Lumia context (role + chance from the assignment, plus avatar / definition / personality / behavior from the source Lumia item). Returns CouncilMemberContext[]. Inside a tool handler, prefer the ctx.councilMember arg passed automatically — this method is for inspecting Council state OUTSIDE a tool execution cycle. |
| `getAvailableLumiaItems` | — | Get all Lumia items available across the user's installed packs. Superset of getMembers() — includes items not currently assigned. Returns LumiItem[] (camelCase mapping of the upstream snake_case DTO). |

### api.tools

| Method | Arguments | Description |
| --- | --- | --- |
| `register` | name, def, handler | Register an LLM tool. Handler receives (args, api, ctx?) and must return a string. ctx is populated when the host invokes the tool (Council / direct LLM) — read ctx.councilMember to personalise output per Council member, ctx.requestId to correlate with host-side logging. |
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

### api.rpc

| Method | Arguments | Description |
| --- | --- | --- |
| `sync` | channel, value, options? | Publish the latest value on a channel for cross-extension consumption. Endpoints are auto-namespaced as `lumiscript.<scriptSlug>.<channel>` — `scriptSlug` auto-derives from the calling script's name, overridable via `options.as`. `options.policy` controls cross-extension permission delegation: omit for legacy "requester must hold every gated permission the owner has" guard, `{ requires: [] }` for public/narrow endpoints, `{ requires: ['name'] }` to scope delegated permissions explicitly. Returns the fully-qualified endpoint string. Free tier. Endpoints auto-unregister on script disable / delete / stale-after-re-run. |
| `handle` | channel, handler, options? | Register an on-demand handler for a channel. Handler receives `RpcRequestContext { endpoint, requesterExtensionId, effectivePermissions }` and returns the response value (sync or async). `effectivePermissions` lists the gated permissions available to THIS delegated call per the endpoint's `options.policy`. Same `lumiscript.<scriptSlug>.<channel>` namespacing + `options.policy` semantics as `sync`. Returns the fully-qualified endpoint string. Free tier. |
| `read` | endpoint | Read a value from another extension's published endpoint. Pass the full `<extensionId>.<channel>` path. Throws on missing endpoint. For cross-extension data sharing — use `api.broadcast` for in-extension pub/sub instead. |
| `unregister` | channel, options? | Remove a channel previously published by the calling script via `sync` or `handle`. Idempotent — no-op if the channel isn't registered. Pass the same `options.as` you used at registration time if any. |

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

### api.scriptStorage

| Method | Arguments | Description |
| --- | --- | --- |
| `get` | key, defaultValue? | Read a value. Returns `defaultValue` (or `undefined` if not provided) when the key is missing. Generic type hint via `get<T>(...)` for IDE completion — the runtime doesn't enforce T. |
| `set` | key, value | Write a value. Overwrites any prior value at the key. Fires `ls:scriptStorage:set` with `{ scriptId, key, value }`. Throws "capacity exceeded" if the JSON-serialised total would cross the 1 MB per-script cap (use `api.variables.*` or `api.db.*` for storage at this scale). Value must be JSON-serialisable. |
| `delete` | key | Remove a key. Returns `true` if it existed (and fires `ls:scriptStorage:delete` with `{ scriptId, key }`), `false` if it didn't (no broadcast). |
| `has` | key | Check whether a key exists. Returns true for keys with any value including 0 / false / null / "". |
| `clear` | — | Remove every entry for this script. Fires `ls:scriptStorage:clear` with `{ scriptId }` if at least one entry existed; no broadcast for an already-empty storage. |
| `keys` | — | List the current keys. Order is insertion-order (Map semantics). |

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
| `floatingButton` | label, options? | Fixed-position action button. Returns DOMHandle. Options: { position?, icon?, variant?, size?, draggable?, id?, className? }. Pass `draggable: true` to make the button user-repositionable; the new position persists per-script via api.scriptStorage. |
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
