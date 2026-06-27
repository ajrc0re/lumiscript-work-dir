### Update 0.27.1

Added `api.ui.dom.delegate()`

New event-delegation surface for reacting to user interactions with DOM that the script didn't inject, e.g. interactive elements emitted by the LLM into chat-message content.

Single host-side capture listener per `(root, event)` tuple regardless of how many scripts subscribe; selector matching happens FE-side via `event.target.closest()`. BE resolves the active `swipeId` from chat history before dispatching to the script handler. Gated by `app_manipulation` (same as the rest of `api.ui.dom.*`).

### Update 0.27.2

`api.chat.inject`/`removeInjection`/`clearInjections`/`clearAllInjections` now fire `pushInjections()` so the `LumiScriptPanel`'s Active Injections section updates without waiting for a manual refresh. Wired via a new `onInjectionsChanged` callback on `APIBuildDeps`, parallel to the existing `onToolsChanged` seam.

### Update 0.27.3

Added key/code/label fields to DOM event data

### Update 0.27.4

`api.chat.sendMessage` can now trigger an LLM continuation immediately after the message lands: `await api.chat.sendMessage('Yes', { triggerGeneration: true });`, same effect as the user pressing Enter on an empty input bar

### Update 0.27.5

1. Conditional `preventDefault` on DOM events. `DOMDelegateOptions.preventDefault` and `DOMListenOptions.preventDefault` now accept a `ConditionalPreventDefault` object in addition to the existing boolean, which fires `event.preventDefault()` only when the event matches specific key/button/modifier filters:

```js
api.ui.dom.delegate('textarea', 'keydown', handler, {
  preventDefault: {
    onKeys: ['Enter'],
    whenModifiers: { exclude: ['shift'] },
  },
});
```

1. Script editor init-failure detection. The Monaco script editor now surfaces a friendly troubleshooting overlay if it either (a) fails to mount within 15 seconds, or (b) doesn't receive focus when you click into it. Previously the failure mode was completely silent, you'd see a blank editor with no clue what went wrong. The overlay includes state-specific remediation steps (Monaco CDN check for mount failures, Windows font cache fix for Firefox-specific input failures, etc.) and a Dismiss button if it false-positives.

### Update 0.28.0

Diagnostics panel

Settings -> Support -> View Diagnostics opens a modal with a runtime state snapshot organised by section:

- LumiScript: version, minimum-host requirement, granted permissions
- Script-runner subprocess: alive/heartbeat/restart count + last reason/memory/CPU time (queried from the child via IPC using standard Node-compat `process.memoryUsage()`/`process.cpuUsage()`)
- Active context: chat/character/user/persona/preset resolution; flags the chat-open-but-character-missing race we patched in v0.23.3
- Registrations: counts across every engine registry (scripts/triggers/macros/tools/RPC/DOM/drawer tabs/float widgets/modals/input-bar actions/etc.)
- Storage: userStorage round-trip probe
- Editor/Monaco: `document.fonts` state, blob-URL worker support, Monaco CDN reachability

### Update 0.29.0

Native tool support

`LLMMessage.content` widened to accept native `tool_use`/`tool_result` parts in addition to plain strings. Agentic-loop scripts can now thread tool calls through providers as first-class signals instead of text-encoded `[Tool: X]`/`[Result]: ...` pseudo-turns. Providers understand the parts shape natively, improving model adherence and reducing the chance of the model getting confused by its own scaffolding text.

```js
api.tools.register('lookup_price', {
  display_name: 'Lookup Price',
  description: 'Returns the current price of an item. Supported items: apple, banana, cherry.',
  parameters: {
    type: 'object',
    properties: {
      item: { type: 'string', description: 'Item name (apple / banana / cherry)' }
    },
    required: ['item']
  },
  council_eligible: false,
}, async function(args) {
  let prices = { apple: 1.20, banana: 0.50, cherry: 3.00 };
  let price = prices[String(args.item).toLowerCase()];
  return price !== undefined ? String(price) : 'unknown';
});

console.log('Registered lookup_price');

let tools = api.tools.list().map(function(t) {
  return { name: t.name, description: t.description, parameters: t.parameters };
});

let PriceSummarySchema = z.object({
  items: z.array(z.object({
    name:  z.string(),
    price: z.number(),
  })),
  total: z.number(),
});

let messages = [
  { role: 'system', content: 'You are a shopping assistant. Use lookup_price to fetch each price, then return a JSON summary with each item and a total.' },
  { role: 'user',   content: 'What are the prices of apple and banana? Give me a structured summary with a total.' }
];

let maxTurns = 6;
let finalResult = null;

for (let turn = 0; turn < maxTurns; turn++) {
  console.log('Turn ' + (turn + 1));

  let result = await api.llm.generateWithTools(
    messages, tools, { connectionName: 'NanoKimi' }, PriceSummarySchema
  );

  if (!result.tool_calls || result.tool_calls.length === 0) {
    finalResult = result.content;
    console.log('Final content type: ' + typeof finalResult);
    console.log('Final content: ' + JSON.stringify(finalResult));

    break;
  }

  for (let i = 0; i < result.tool_calls.length; i++) {
    let call = result.tool_calls[i];
    console.log('  → ' + call.name + '(' + JSON.stringify(call.args) + ')');
    let toolResult = await api.tools.invoke(call.name, call.args);
    console.log('    = ' + toolResult);
    messages = messages.concat([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: call.call_id, name: call.name, input: call.args }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: call.call_id, content: toolResult }],
      },
    ]);
  }
}

if (finalResult === null) {
  console.log('FAIL: no structured result after ' + maxTurns + ' turns');
} else if (typeof finalResult === 'object' && finalResult !== null) {
  console.log('PASS: content is a parsed object');
  console.log('total: ' + finalResult.total);
  if (Array.isArray(finalResult.items) && typeof finalResult.total === 'number') {
    console.log('PASS: schema shape is correct');
  } else {
    console.log('WARN: schema shape unexpected — ' + JSON.stringify(finalResult));
  }
} else {
  console.log('FAIL: content is not an object (type=' + typeof finalResult + ')');
}

api.tools.unregister('lookup_price');
console.log('After unregister: ' + api.tools.list().length + ' tools');
```

### Update 0.30.0

Meet Lisa, your in-app code assistant!

LumiScript now ships with a built-in code assistant. Her name is Lisa, she lives inside the extension, and she knows the LumiScript API surface intimately.

**Where to find her**

- **LumiScript Settings -> Assistant -> Ask Lisa**
- **Script editor topbar** - chat icon next to the Run button. One click from any open script

**What she does well**

- Answers questions about LumiScript APIs (the full `api.*` surface), built-in libraries (`ls:icons`, `ls:components`,  etc.)
- Writes complete scripts to your spec
- Looks up method signatures, type definitions, and permission requirements via her `lookup_api` tool, backed by a corpus index that's drift-validated at build time

**Configurable from LumiScript Settings -> Assistant**

- **Tool iterations** (default 8) - raise if Lisa hits the ceiling on hard questions; lower if your model thrashes
- **Generation defaults** - temperature/top P/max tokens/parallel tool calls. Leave blank to inherit your connection's preset
- **Reset** - one-click clear of all generation overrides
- **Clear all threads** - deletes all chats with her, confirmation asked first

**Per-thread Markdown export**

Each thread carries a Download button that emits a fully-formatted `.md` file: title, timestamps, reasoning blockquotes, tool call/result pairs with pretty-printed JSON, and answers with proper syntax highlighting. Drop it straight into a support report here when something goes sideways.

**Connection recommendations**

Smart thinking-capable models (Claude 4.6+, GLM 5.1, Kimi 2.5/2.6, DeepSeek V4, etc.) produce dramatically better tool-routing behaviour. For providers that choke on parallel tool calls (some Mistral configurations, certain self-hosted setups), uncheck **Parallel tool calls** in Settings and Lisa will request serialised tool calls instead. Personal recommendation: GLM 5.1.

**Persistence**

Threads persist per-user at `Lumiverse/data/users/<UID>/extensions/lumiscript/assistant/threads/`.

**Permissions**

No new permissions required. Lisa runs entirely inside LumiScript using what the extension already has.

Be nice to her and let me know what works well and what doesn't!

### Update 0.30.1

Adds a sixth section to the Diagnostics report covering Lisa

- Initialised: bootstrap lifecycle marker (info; false is normal until first IPC)
- Corpus loaded: fail on 0, pass with entry count otherwise, single highest-value check as empty corpus = `lookup_api` silently returns nothing and Lisa shrugs (best-case scenario) or hallucinates, the poor gal
- Thread storage: index-load + per-thread readability + on-disk bytes, fail on index unreadable, warn on partial readability, pass on full
- LLM connections: pass with default-connection details, warn on zero (Lisa unable to run)
- Generation defaults: info dump of any active overrides (temperature/top P/max tokens/parallel tool calls)
- Tool iterations ceiling: info

### Update 1.0.0-rc.1

The first release candidate for v1.0 is out. This is the big runtime-isolation rework: your scripts now run across a pool of supervised script-runner subprocesses (4 by default). The main guarantee: *one runaway script can no longer block any other script's execution.*

**What's new for script authors**

- Multi-worker dispatch. Scripts get assigned to one of worker subprocesses (configurable 1–16 in settings). Cross-worker handler routing through `api.broadcast` and `api.rpc` is automatic. If a subscriber lives on a different worker than the emitter, the host routes the call across processes for you. Memory pressure triggers LRU eviction; idle workers (30 min default) get torn down and respawned on demand.
- Hot-reload-on-edit (opt-in). Add `// @ls:reload-on-edit` to the top of a script body and code edits re-run the body inside the same worker (~500ms debounce), refreshing the closures of registered handlers. The editor top bar's Reload button works regardless of the directive.
- Lifecycle events, cleaner shape. `ls:startup` now fires both at LumiScript boot and on the disabled→enabled toggle. Symmetric partner to `ls:teardown` (which fires on disable/delete). Use `ls:startup` for tool registration, cache pre-warming, broadcast subscription setup, anything that needs to run whenever a script enters its running state.
- Master toggle off cleans up everything. When you toggle LumiScript off via the master switch, all per-script registrations (tools, macros, RPC endpoints, DOM injections, modals, input-bar actions, float widgets, drawer tabs) get torn down for every enabled script. Previously only Spindle event subscriptions cleared, and the rest leaked until the extension fully reloaded.
- Diagnostics panel, per-worker breakdown. Memory, eviction counts, script-to-worker assignments, IPC throughput, restart count + last reason. Useful for understanding what your scripts are actually doing.

**This is an RC, please use it and report what breaks.** Structural work is done and stress-tested but real-world usage will surface things test scripts won't. If anything goes sideways, let me know.

### Update 1.0.0-rc.2

**Cross-extension RPC permission delegation**

- `api.rpc.sync()` and `api.rpc.handle()` accept a new `options.policy`:
  - omit → legacy "requester inherits every owner permission" guard (default; backward-compatible — pre-RC2 callers see no change)
  - `{ requires: [] }` → readable without delegating any owner permissions; for intentionally narrow / public endpoints
  - `{ requires: ['name'] }` → both owner AND requester must hold the named permission; gated api.* calls inside the handler are limited to declared permissions
- Handlers now receive `effectivePermissions: readonly string[]` on the `RpcRequestContext` — informational signal for handler logic; the host enforces the actual restriction

**World Info events**

- Four new Spindle events emitted on world-book mutations:
  - `WORLD_BOOK_CHANGED`: book created/updated/any entry mutation in this book/bulk-entry ops/reorder/imports
  - `WORLD_BOOK_DELETED`: book actually deleted
  - `WORLD_BOOK_ENTRY_CHANGED`: entry created or updated (not fired during bulk imports, subscribe to `WORLD_BOOK_CHANGED` in addition if you need to catch imported entries)
  - `WORLD_BOOK_ENTRY_DELETED`: entry actually deleted
- New "World Info" event group in the editor; `WORLD_INFO_ACTIVATED` moved into it from Settings

**`api.presets.*` generation preset CRUD**

- Full CRUD over user generation presets via Spindle's new `spindle.presets.*` surface. A preset is the complete prompt configuration: sampler/provider parameters, ordered prompt blocks (with roles/positions/depth), prompt behavior settings, metadata
- Three sub-namespaces:
  - `api.presets.*`: preset CRUD (list/get/create/update/delete)
  - `api.presets.blocks.*`: prompt-block CRUD within a preset (`create` accepts `options.index` for ordered insertion)
  - `api.presets.categories.*`: host-derived category grouping view (read-only; mutate categories via `blocks.*` with `marker: 'category'`)
- Categories aren't separate records, they're structural prompt blocks with `marker === 'category'`, with following non-category blocks as children until the next category marker. `categoryMode` is `'radio'` (one enabled child) or `'checkbox'` (many)
- Use cases: rotate prompt blocks based on chat context, toggle radio-category options on character state changes, snapshot presets to JSON for backup/share, build ephemeral per-chat presets and clean up via `ls:teardown`
- Requires the new `presets` permission

**Worker-isolation hardening**

- `process.on('unhandledRejection', ...)` guard in the script-runner subprocess. Pre-RC2, a detached promise rejection inside a user-script body (canonically an un-awaited `(async () => { … })()` IIFE that awaits a rejecting api call) crashed the entire shared worker via Bun's default unhandled-rejection-exits-process behaviour. Co-located scripts' handler closures (macros, tools, broadcast subscriptions, RPC handlers) were orphaned in the auto-respawn, violating the v1.0 worker-isolation contract.
- Survival strategy: log to backend stderr (audit trail) + attribute via WeakMap populated at the api-proxy's reject-call site + route to the originating script's editor console as an error entry. Worker stays alive; co-located scripts keep their registered handlers.

**Diagnostics panel enhancements**

- New "Lumiverse backend version" + "Lumiverse frontend version" info rows in Section A, probed via Spindle's new `spindle.version.*` free-tier surface
- "Minimum Lumiverse host version" row promoted from info to pass/warn based on `backend >= minimum` comparison
- "Subprocess alive" message reframed to pool-aware ("Running — N workers alive")
- Per-worker script assignments now visible as a hover tooltip on the Workers table's Scripts column AND as a new "Script assignments by worker" row (the latter carries through to the Markdown export so support reports include the breakdown)

This is a release candidate, report any issues observed in real-world and just any Weird Shit™ in general

### Update 1.0.0-rc.3

Two long-lived-script issues surfaced from hands-on testing after RC2's worker pool shipped:

- **Eviction respects script registrations.** Workers hosting a script that registered a tool, macro, drawer tab, input bar action, RPC endpoint, world-info interceptor, content processor, macro interceptor, float widget, or advanced modal are now exempt from idle and memory eviction. Pre-fix, after 30 min idle the worker would be reaped and the registration would silently stop firing, where host-side it still looked alive but the handler closure had died with the worker.
- **DOM handle re-attachment after worker respawn.** Scripts that re-inject DOM under the same `stableId` after their worker was evicted and respawned now correctly resolve to the same handle on both sides.

Diagnostics panel adds an "Eviction-exempt scripts (registrations)" row showing which scripts are pinning which workers and what kinds of registrations they hold.

### Update 1.0.0-rc.4

Three anti-eviction pinning gaps surfaced from testing after RC3 shipped, now fixed:

- **DOM event listeners now pin their worker.** Pre-rc.4 a script that injected an interactive UI element with `handle.on('click', ...)` event listeners but didn't also register a tool/macro/drawer tab was evictable. After the TTL the worker would die, the DOM stayed on screen, but clicks did nothing, as the click handler closures had died with the worker. Interactive UI now stays interactive across the idle threshold.
- **Cross-script user-event broadcasts now pin too.** Scripts that subscribe to non-`ls:*` broadcasts emitted from other scripts need their worker alive to receive them. Pre-rc.4 the worker could die and forwarded broadcasts silently dropped. Engine-lifecycle `ls:*` subscriptions (e.g. `ls:startup`) are explicitly not counted, those only fire as side-effects of local activity, so they don't motivate keeping a worker warm.
- **`DOMHandle.remove()` cleanup is now symmetric.** When a script removes a DOM element via `handle.remove()`, the event listeners attached to that element (and any descendants) are now properly cleaned up parent-side. Without this, the new pin signal would have accumulated orphan entries from removed elements, falsely keeping scripts pinned past their UI lifecycle.

### Update 1.0.0-rc.5

**New API surfaces**

- `api.images.*`: persist image bytes to Lumiverse's image store. `upload(bytes)` and `uploadFromDataUrl(dataUrl)` both return an `ImageInfo` whose `id` is the canonical handle for `api.theme.extractColors`, character avatars, and databank document attachments. Requires the `images` permission.
- `api.imageGen.*`: generate images against the user's configured image-gen connection profiles. `generate({prompt, ...})` returns `{imageDataUrl, imageId?, imageUrl?, model, provider}` — the `imageId` integrates cleanly with `api.images.*`, `api.theme.extractColors`, and `spindle.characters.setAvatar`. img2img/inpainting via `parameters.input_images: [imageId, ...]`. Provider/connection/model metadata via `getProviders`, `listConnections`, `getConnection`, `getModels` for dynamic parameter UIs. Requires the `image_gen` permission.
- `api.oauth.*`: the only inbound-HTTP hook Spindle exposes. `onCallback(handler)` registers the redirect-URL handler (single handler per extension, last-wins, non-terminating warning on collisions), `getCallbackUrl()` returns the URL path for use as `redirect_uri`, `createState()` mints a CSRF nonce. Everything beyond these primitives (authorize-URL construction, token exchange, persistence) is script-owned — pair with `api.utils.http` and `api.enclave`. Requires the `oauth` permission.
- `api.theme.*`: manipulate the Lumiverse theme from a script. `apply(overrides)` for raw CSS variable overrides + mode-keyed variants, `applyPalette({accent: hsl})` for host-generated coherent ~80-variable palettes, `extractColors(imageId)` to derive a palette from a stored image (pairs with `applyPalette`), `getCurrent()` to read the user's base theme, `generateVariables(config)` to compute the full variable map without applying, `clear()` to drop the script's contributions. Per-script attribution: multiple scripts can apply themes concurrently with per-key last-applied-wins. Auto-cleared on script disable. Requires the `app_manipulation` permission. Mutating calls auto-retry transparently if a non-committing macro resolution is in flight.

**HTTP surface extension**

`api.utils.http.*` now supports binary responses. `HttpRequestOptions.responseType: 'arraybuffer'` returns the response body as a `Uint8Array` instead of a string — pipes directly into `api.images.upload`, `api.utils.image.detectMime`, or `api.files.*`. LumiScript transparently decodes the host's base64 transport, so user scripts see raw bytes.

**Regression fix: DOMHandle handler-fire**

`DOMHandle.update/.remove/.makeDraggable/.injectChild` called from inside `handle.on(event, cb)` body silently no-oped. Root cause: the proxy used plain `dispatch` (no `targetHandle` in the IPC envelope) AND the host's `resolveActiveRun` denied `'context'`-source fallback even for persistent handles. The handler's transient activeRun was dropped before the IPC arrived, the request bailed with `RunCompletedError`, the proxy's `.catch(() => {})` swallowed the failure silently. Fix: proxy routes all DOMHandle methods through `dispatchOnHandle` with the persistent handle as the dispatch target; the host's fallback rule extended to allow `'context'` source on persistent handles.

### Update 1.0.0-rc.6

**State-sync-on-respawn for child-side caches**

Closes the long-standing eviction-asymmetry issue that motivated the RC3 alias-storage hotfix. When the script-runner subprocess is evicted + respawned, the parent's DOM registry survives but the proxy's child-side stable-id cache (`domStableIdToElementId`) dies with the worker. Pre-RC6, the divergence was papered over by storing DOM handles under both the canonical id and the proxy's regenerated id: bounded alias accumulation per `stableId` × eviction cycle. RC6 ships the architecturally clean replacement: when the parent dispatches a script to a worker that hasn't seen it before (cold spawn/post-respawn/post-rebalance), it sends a `script-state-sync` IPC carrying the parent's view of the script's stable-id mappings BEFORE the run-script IPC. The proxy seeds its cache from the snapshot, so the proxy and parent agree on every elementId by construction. Bun's IPC is FIFO per channel, so ordering is guaranteed without an ack handshake. The RC3 alias-storage hotfix stays in place for one more release.

**`DOMHandle.read(options?)`**

Read-side parity for the DOM injection surface. `read()` returns a `SerializedDOMElement` snapshot of the handle's current state (`{ tag, attrs, text, childCount, html? }`) or `null` if the FE no longer has the element. The `html: true` option includes `innerHTML` for full-markup inspection. The snapshot descends past LumiScript's wrapper to return the user's element directly for single-root injections; falls back to the wrapper for multi-root or text-only content (with internal `data-ls-*` attributes stripped). First DOMHandle method that awaits an FE roundtrip, uses the same request-response correlation pattern as `api.ui.showContextMenu`. Throws `DomHandleReleasedError` after `.remove()` (matches sibling methods); resolves to `null` cleanly for the live-DOM-vanished race.

**`api.scriptStorage`**

Closes the "where does my script keep its session state?" UX gap. Per-script in-memory key/value store with six methods (`get<T>`/`set`/`delete`/`has`/`clear`/`keys`). Free tier, no permission required. Differentiates from `api.variables.local` (which is disk-persisted) by being explicitly session-scoped: survives worker eviction/respawn and script edits, cleared on script disable/delete, lost on full backend restart. 1 MB cap per script on the JSON-serialised total, throws cleanly with a migration hint to `api.variables.*` or `api.db.*` if a script needs storage at meaningful scale. Mutations fire `ls:scriptStorage:set`/`:delete`/`:clear` broadcasts, so debug + admin tooling can react without polling. Replaces the verbose `globalThis.__lumiscript_script_<scriptId>_*` convention; the convention continues to work for back-compat.

**`api.ui.dom.cleanup()` cascade**

Closes the explicit RC4 follow-up. Pre-RC6, calling `api.ui.dom.cleanup()` to bulk-tear-down a script's DOM mid-session left orphan entries in the parent's `handlerCleanups` map, its `unsub()` was a no-op (the FE listener was already gone) but the entry itself stayed, falsely inflating the eviction-pinning policy's `handlerClosures` count. RC6 adds a `dropAllDomListenerHandlersForScript` cascade in `handleDomCleanupRequest`, mirroring the rc.4 `DOMHandle.remove()` cascade but at script scope. Same `kind='domEventListener'`-only boundary, delegates remain explicit (selector-keyed reverse index TBD).

### Update 1.0.0-rc.7

**Audit-response RC**

The quality + security audits landed. 11 of 13 quality findings closed; full security-audit closed.

**Behavioural changes to know:**

- `DOMHandle.update()`/`injectChild()` HTML is now DOMPurify-sanitised, inline event handlers (`onclick=…`, etc.) silently stripped, with a `[security]` note in the script's editor console. Migrate to `handle.on(event, fn)` event delegation.
- `import()`, `require()`, `new Function()`, `.constructor.constructor`, literal `globalThis.Bun`, and literal `globalThis.process` are rejected at dispatch with a clear `[security]` console entry. `script.require('lib')` and method-style `obj.require(...)` continue to work.
- `globalThis.process`/`globalThis.fetch` runtime access returns `undefined`.
- `api.broadcast.emit` capped at 1 MB payload + 100/sec sustained (1000 burst) per script. Throws on cap with a migration hint to `api.db.*` for high-volume data.
- Quality fixes: `api.json.merge` is now actually deep; `api.db.collection.find` matches by structural deep-equality (key-order independent, NaN-aware); `api.json.sort` sorts numbers numerically; `api.json.set/get` reject `__proto__`/`prototype`/`constructor` path segments.

**Known residual:** aliased `globalThis.Bun`/`globalThis.process` access via `const g = globalThis; g.Bun…` still reaches the real value. Bun's `globalThis.Bun` is non-configurable (engine constraint); Spindle's runtime requires `process`. The proper closure is a true sandbox isolate (QuickJS-WASM or `ShadowRealm`), v1.1 spike planned.

**Path to v1.0:** RC8 is docs, RC9 is reserved for any audit follow-ups, then GA

### Update 1.0.0-rc.7.1

Focused between-RC patch covering two regressions surfaced after RC7

1. Startup blocker: Lumiverse's bundle scanner started matching Lisa corpus documentation strings (`Bun.write`, `process.env`) as if they were API calls, refusing extension startup with "blocked backend capabilities". Rephrased the matched REDIRECTS + cleaned related JSDoc and comments.
2. Cross-run-orphan late-warn: `db.collection` factory calls surfaced spurious `RunCompletedError` at end-of-run when paired chat events fire body runs ~10 ms apart. Writes were unaffected (existing persistent handle fallback covered Collection handle method calls); bare factory calls had no targetHandle to trigger fallback. Extended `resolveActiveRun` to cover handle-returning factory calls producing persistent kinds.

### Update 1.0.0-rc.7.2

1. Declare `requested_capabilities: ["dynamic_code_execution"]` in spindle.json — covers Handlebars's `new Function("")` capability
   probe used in template compilation. Did not declare `base64_decode`; refactored `base64ToUint8Array` from `Buffer.from(b64, 'base64')` to atob + char-code loop instead, following the docs' "only declare what you actually need" guidance.
2. Add `atob` / `btoa` to `SAFE_GLOBALS` in `child-entry.ts`. Pure base64 codecs, zero capability surface, same shape as the already-whitelisted `TextEncoder`/`TextDecoder`. Library code feature-detects them (Zod's runtime detection etc.); the sandbox-escape test harness also depends on this for the new atob path.
3. Bump `minimum_lumiverse_version` 0.9.7 -> 0.9.9 (`requested_capabilities` is a 0.9.9 addition)

### Update 1.0.0-rc.8

This is the docs-cycle RC - the full v1.0 documentation (modulo the cookbook and tutorials, which are still being worked on) ships in this release, plus 3 engine bug fixes.

**Engine fixes**

1. **Async handlers now work properly.** If you wrote `handle.on('click', async () => { ... })` with any `await api.X(...)` calls inside, they were silently dropped pre-RC8. The engine wrapper resolved before your handler finished. Now they work as you'd expect. Affects `DOMHandle.on`, input-bar actions, float widgets, drawer tabs, advanced modals.

2. **Reload button now actually picks up your changes.** Pre-RC8, clicking Reload only wiped 5 of the 13 places scripts can register state — leftover DOM listeners, modals, widgets, and handlers from the previous body run kept firing alongside your fresh code. Now it's a full wipe + re-run; only `api.scriptStorage`, `api.theme.*` contributions, and the worker's `script.require()` cache survive across the reload. The "I changed my script, clicked Reload, but the changes don't take effect until I toggle the extension" workaround is no longer needed.

3. **Active-context-aware reads inside long-lived handlers now see fresh values.** If your script registered a tool/modal/widget handler while character A was active, then character B becomes active, calls like `api.variables.character.get('x')` inside that handler now return character B's value, not character A's. Was snapshotted at registration time pre-RC8.

**Docs**

`docs/` ships in this release. 12 guides (DOM injection, LLM, macros, tools, broadcast, OAuth, theme, image gen, world info, databanks, persistent events, cross-extension RPC), 4 concepts files (trigger model, permissions, storage, handler lifetime), getting-started, an index.

**Corpus**

Lots of Lisa-corpus updates flowing from the docs cycle: Sandbox hardening section, Trigger model section, lifecycle-event cross-references on `ls:startup`/`ls:teardown`/`ls:reload`, async-method indication in cheat-sheet method tables.

**Nothing should break.** No behavioural changes that affect existing scripts. The only thing users might notice as a delta is the Reload-button wipe doing more than it used to but the body re-runs immediately after, so any handlers you re-register come right back.

### Update 1.0.0-rc.9

The big feature and parity cycle before GA

- Spindle API parity is broadly complete — scripts now reach the full host surface (connections, web search, Memory Cortex, a route-persistent full-bleed surface, native file picker, keyboard/drawer/settings events, the 16 shared UI components)
- LLM streaming — `api.llm.generateStream`, token-by-token with mid-stream cancel
- Lisa got a lot smarter:
  - @-mention your scripts (and apply her edits back)
  - She remembers your preferences/project facts across chats (editable)
  - Attach reference files
- Under the hood: a full pre-1.0 API-stability audit — public API, saved-data formats, events, and permissions reviewed and locked for the semver-strict v1.0 commitment, so scripts you write today keep working through 1.0

### Update 1.1.0

Fixes the reported Lisa chat degradation (responsiveness drops during use and a "Server connection lost" disconnect, both on long/code-heavy threads) and folds in a few user-requested enhancements. All changes are internal to the assistant; no `api.*` surface change, so the GA stability lock holds.

**Load performance (the freeze + disconnect when opening a long thread):**

- Render bubble content on-visible: each message defers its markdown + syntax-highlight render until an `IntersectionObserver` reports it near the viewport (raw text shown as a cheap placeholder until then; the streaming and last bubbles render eagerly so the part you land on never flashes). Opening a code-heavy thread previously markdown-parsed and Prism-highlighted every bubble in one synchronous commit, resulting in seconds of main-thread freeze that also starved the WebSocket heartbeat (the disconnect). Mount cost is now bounded to the visible window regardless of thread length or per-message size.
- Fix loads-at-head on open: a load-keyed settle effect lands the view at the true tail despite content-visibility's height estimate (also fixes a latent no-scroll when switching to a same-length thread).

**Streaming/steady-state render (the responsiveness drops during use):**

- Kill the per-tick re-render storm: memoize the apply-context value (a churning `Provider` value was piercing `MarkdownContent`'s memo and re-running Prism on every code block at ~20 Hz), wrap `MessageBubble` in `React.memo`, and throttle reasoning tokens like content tokens. Also decouple the apply-context value from the `scripts` prop identity so an unrelated script autosave no longer re-highlights the open transcript.
- Batch streamed tokens backend-side (~30 Hz) instead of one WebSocket frame per token; add content-visibility to off-screen bubbles; gate auto-scroll on "near bottom" + defer to rAF (no forced reflow per flush).

**Backend correctness/cost:**

- Route every assistant->frontend message to the active user (was broadcasting Lisa's stream/threads/memory to all sessions on multi-user servers).
- Window the LLM context to the most recent turns (cut only at user-turn boundaries; full thread still persisted and displayed) so prompt cost and latency stop growing unbounded.
- Compact thread persistence; abort the in-flight turn when the modal closes.

**Edit & resend the last message:**

- Hover the last user message -> pencil -> inline edit -> regenerate. The backend trims the last exchange (`tool_use`/`tool_result` pairs kept intact) and re-runs with the edited content via a new `editLast` flag.

### Update 1.1.1

v1.1.0's history windowing was meant to bound only the prompt sent to the model, leaving the full thread persisted and displayed. It didn't because I'm too smart for my own good, apparently. Context management is being reworked but this will at least stopgap against threads with more than 48 messages being silently trimmed from the top.

### Update 1.2

A full rework of Lisa's LLM context handling, built on a model-facing vs display history split (`buildModelHistory`) that makes the v1.1 data-loss class structurally impossible.

- Token budget + gauge: windowHistory now bounds the prompt by a configurable token budget (`assistantContextTokens`, default 200K) instead of a fixed message count. A composer fullness gauge shows occupancy (persisted per-thread) with a click-popover breakdown — corpus/memories/chat/attachments.
- Auto + manual compaction: past ~85% full, Lisa folds the older turns into a prose handoff PRE-turn (no re-entrancy race), keeping recent turns verbatim; the full thread is never altered. "Compact now" button + an auto-compact toggle. Durable cross-session facts are harvested into memory, behind a new per-user memory write lock so the harvest can't race the remember tool.
- Prompt caching: the stable ~44K-token cheat-sheet prefix carries a `cache_control` breakpoint, so caching providers stop re-billing it every turn.
- Tool-result cap: one oversized tool result can no longer blow the context or the transcript.

### Update 1.3.0

This one pairs a big performance fix for browsing `api.db` collections with a broad reliability sweep under the hood

**Collection search, rebuilt**
Filtering records in Storage -> Inspect used to crawl (even a small collection could hang for a few seconds per keystroke), that's finally gone:

- Instant filtering: small collections now filter entirely in-browser, with no per-keystroke server round-trip, shallow, deep, and `jsonquery` modes all benefit
- Smooth scrolling: record bodies now render lazily as they come into view, so a filter that surfaces lots of records no longer stutters
- Match highlighting: your search term is now highlighted right inside the matching records, so you can see where it matched at a glance

**Stability & performance hardening**

- Closed a few concurrency races (rapid-fire assistant sends, memory consolidation vs. live edits)
- Plugged some slow resource leaks (timers, abort listeners, stream teardown) under sustained load
- Added a UI error boundary so a hiccup degrades gracefully instead of blanking the panel

### Update 1.3.1

A focused follow-up to the v1.3.0 performance & stability pass: faster `api.db`, a new collection-retention option, and a nicer Lisa apply flow

- Collections are now cached in memory, so back-to-back reads (`find`/`findOne`/`count`/`query`) skip the round-trip to storage. Database-heavy scripts feel noticeably snappier and the cache is memory-bounded, so it stays light no matter how many collections you touch.
- Collection retention (auto-pruning): Opt in per collection and old records prune themselves on insert, no more manual trimming if not needed (good for rolling logs, recent activity feeds, or any scratch state you don't want growing forever).
- Lisa gets diff previews on "Apply to script"

```js
// keep only the newest 500 records
await api.db.collection('eventlog', { retention: { maxRecords: 500 } });

// or drop anything older than 24h
await api.db.collection('recent', { retention: { maxAgeMs: 24 * 60 * 60 * 1000 } });
```

### Update 1.3.2

**`api.chat.onMessageTag` — react to tags the model writes**

Your scripts can now hook XML-style tags that appear in chat messages and run code when they show up. Perfect for inline interactivity: dice rolls, skill checks, trackers, scene/state triggers, custom widgets, anything keyed off what the model (or you) writes.

```js
// Fire whenever <dice>...</dice> shows up in a completed message
const off = api.chat.onMessageTag('dice', (ev) => {
  api.ui.toast(`🎲 rolled ${ev.content}`);
}, { removeFromMessage: true }); // ...and strip the tag from the bubble
// ev = { tagName, attrs, content, fullMatch, messageId, isUser, ... }
// call off() to unsubscribe
```

- Filter by attributes: `onMessageTag('roll', fn, { attrs: { type: 'd20' } })`
- Fires once per completed message (no mid-stream spam) and de-dupes across scroll/redraw
- Multiple scripts can hook the same tag, they all fire
- Requires the `chat_mutation` permission

**Lisa got smarter**

Lisa can now read your diagnostics, list your scripts, and read a script's source, so when you ask for help she reasons about your *actual* setup (granted permissions, errors, conflicts) instead of guessing.

**More reliability**

- Adopted ESLint with type-aware checks in manual builds and CI, a class of async bugs now gets caught automatically going forward
- Fixed: a command handler that throws no longer leaks an unhandled rejection
- Fixed: cold start is more resilient to storage hiccups

### Update 1.3.3

- `api.db.collection().drop()` now evicts the cached (scope, path) wrapper and releases its dispatcher persistent handle, not just the loaded-array data cache. A dropped collection no longer strands a stale wrapper + leaked handle; the next collection() call rebuilds a fresh wrapper (picking up any new schema instead of the pre-drop "first wins" one).
- `LumiScriptPanel` wraps its tab content in one keyed `<ErrorBoundary key={activeTab}>` so a render crash in a single tab (manage/status/storage) degrades to a localized fallback and recovers on tab switch, instead of blanking the whole dock.
- New `editorIntellisense` setting (default on) in Settings -> Editor toggle: when off, Monaco suppresses the autocomplete popup, trigger-char suggestions, signature help, and hover docs (syntax-error squiggles unaffected). Applied via reactive editor options, so it takes effect without a remount. Existing users default to on via the settings-store key merge.

### Update 1.4.0

You can now bundle LumiScript scripts into character cards!

**Authoring**

- Bundle into card button in the script-manager toolbar: pick scripts and a target character
- A new LumiScript tab (thanks <@944783522059673691> for the API) right inside the character editor: view a card's bundled scripts, delete them, add more from your library, or import them, all on the character you're editing

**Importing**

- Importing a card with bundled scripts raises a per-script consent modal: review each one, see its event hooks and any permissions it wants, pick what to install, everything lands disabled and never auto-runs; you read the code and enable it yourself
- Re-importing an updated card offers updates (newer version wins)
- Opening a chat with a character that bundles scripts you don't have in the library produces a Manage tab reminder; can be dismissed for the session; it's back next launch, and the editor tab's Import to library feature is always there if you decide to import them

**Safety**

- Nothing auto-enables, auto-runs, or self-grants a permission, the import side treats the card as untrusted JSON and clamps it defensively

For anyone interested, bundled scripts live in the card's `"extensions"` field, with the following schema:

```json
{
  "lumiscript": {
    "formatVersion": 1,
    "bundleCardId": "d61d4d25-9fb2-4654-8bd5-e576cb91dfff",
    "scripts": [
      {
        "bundleId": "02d6476e-45f9-4740-879b-4b33636423b4",
        "name": "x",
        "code": "console.log(data);\n",
        "type": "trigger",
        "triggers": [
          "MESSAGE_SENT"
        ]
      }
    ]
  }
}
```

### Update 1.4.2

Lisa's chat button now lives in the script-manager toolbar (right next to the bundle button), so it's where you're actually working. Removed the old one from extension settings, where nobody was looking for it.

### Update 1.5.0

- Lisa speaks CSS now! She knows Lumiverse's full `--lumiverse-*` theme element system, so she can actually help you theme the app, write `api.theme` calls, or hand-roll `addStyle` CSS against the real elements.
- Tidier code blocks in Lisa's chat: Copy/Apply moved into a clean header bar above the code (no more buttons overlapping the first line), with a language tag. Every block gets the toolbar now, even untagged ones.
- New theme element reference in the docs and cookbook.
