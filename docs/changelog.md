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
2. Script editor init-failure detection. The Monaco script editor now surfaces a friendly troubleshooting overlay if it either (a) fails to mount within 15 seconds, or (b) doesn't receive focus when you click into it. Previously the failure mode was completely silent, you'd see a blank editor with no clue what went wrong. The overlay includes state-specific remediation steps (Monaco CDN check for mount failures, Windows font cache fix for Firefox-specific input failures, etc.) and a Dismiss button if it false-positives.


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

* Multi-worker dispatch. Scripts get assigned to one of worker subprocesses (configurable 1–16 in settings). Cross-worker handler routing through `api.broadcast` and `api.rpc` is automatic. If a subscriber lives on a different worker than the emitter, the host routes the call across processes for you. Memory pressure triggers LRU eviction; idle workers (30 min default) get torn down and respawned on demand.
* Hot-reload-on-edit (opt-in). Add `// @ls:reload-on-edit` to the top of a script body and code edits re-run the body inside the same worker (~500ms debounce), refreshing the closures of registered handlers. The editor top bar's Reload button works regardless of the directive.
* Lifecycle events, cleaner shape. `ls:startup` now fires both at LumiScript boot and on the disabled→enabled toggle. Symmetric partner to `ls:teardown` (which fires on disable/delete). Use `ls:startup` for tool registration, cache pre-warming, broadcast subscription setup, anything that needs to run whenever a script enters its running state.
* Master toggle off cleans up everything. When you toggle LumiScript off via the master switch, all per-script registrations (tools, macros, RPC endpoints, DOM injections, modals, input-bar actions, float widgets, drawer tabs) get torn down for every enabled script. Previously only Spindle event subscriptions cleared, and the rest leaked until the extension fully reloaded.
* Diagnostics panel, per-worker breakdown. Memory, eviction counts, script-to-worker assignments, IPC throughput, restart count + last reason. Useful for understanding what your scripts are actually doing.

**This is an RC, please use it and report what breaks.** Structural work is done and stress-tested but real-world usage will surface things test scripts won't. If anything goes sideways, let me know.



### Update 1.0.0-rc.2

**Cross-extension RPC permission delegation**
* `api.rpc.sync()` and `api.rpc.handle()` accept a new `options.policy`:
  - omit → legacy "requester inherits every owner permission" guard (default; backward-compatible — pre-RC2 callers see no change)
  - `{ requires: [] }` → readable without delegating any owner permissions; for intentionally narrow / public endpoints
  - `{ requires: ['name'] }` → both owner AND requester must hold the named permission; gated api.* calls inside the handler are limited to declared permissions
* Handlers now receive `effectivePermissions: readonly string[]` on the `RpcRequestContext` — informational signal for handler logic; the host enforces the actual restriction

**World Info events**
* Four new Spindle events emitted on world-book mutations:
  - `WORLD_BOOK_CHANGED`: book created/updated/any entry mutation in this book/bulk-entry ops/reorder/imports
  - `WORLD_BOOK_DELETED`: book actually deleted
  - `WORLD_BOOK_ENTRY_CHANGED`: entry created or updated (not fired during bulk imports, subscribe to `WORLD_BOOK_CHANGED` in addition if you need to catch imported entries)
  - `WORLD_BOOK_ENTRY_DELETED`: entry actually deleted
* New "World Info" event group in the editor; `WORLD_INFO_ACTIVATED` moved into it from Settings

**`api.presets.*` generation preset CRUD**
* Full CRUD over user generation presets via Spindle's new `spindle.presets.*` surface. A preset is the complete prompt configuration: sampler/provider parameters, ordered prompt blocks (with roles/positions/depth), prompt behavior settings, metadata
* Three sub-namespaces:
  - `api.presets.*`: preset CRUD (list/get/create/update/delete)
  - `api.presets.blocks.*`: prompt-block CRUD within a preset (`create` accepts `options.index` for ordered insertion)
  - `api.presets.categories.*`: host-derived category grouping view (read-only; mutate categories via `blocks.*` with `marker: 'category'`)
* Categories aren't separate records, they're structural prompt blocks with `marker === 'category'`, with following non-category blocks as children until the next category marker. `categoryMode` is `'radio'` (one enabled child) or `'checkbox'` (many)
* Use cases: rotate prompt blocks based on chat context, toggle radio-category options on character state changes, snapshot presets to JSON for backup/share, build ephemeral per-chat presets and clean up via `ls:teardown`
* Requires the new `presets` permission

**Worker-isolation hardening**
* `process.on('unhandledRejection', ...)` guard in the script-runner subprocess. Pre-RC2, a detached promise rejection inside a user-script body (canonically an un-awaited `(async () => { … })()` IIFE that awaits a rejecting api call) crashed the entire shared worker via Bun's default unhandled-rejection-exits-process behaviour. Co-located scripts' handler closures (macros, tools, broadcast subscriptions, RPC handlers) were orphaned in the auto-respawn, violating the v1.0 worker-isolation contract.
* Survival strategy: log to backend stderr (audit trail) + attribute via WeakMap populated at the api-proxy's reject-call site + route to the originating script's editor console as an error entry. Worker stays alive; co-located scripts keep their registered handlers.

**Diagnostics panel enhancements**
* New "Lumiverse backend version" + "Lumiverse frontend version" info rows in Section A, probed via Spindle's new `spindle.version.*` free-tier surface
* "Minimum Lumiverse host version" row promoted from info to pass/warn based on `backend >= minimum` comparison
* "Subprocess alive" message reframed to pool-aware ("Running — N workers alive")
* Per-worker script assignments now visible as a hover tooltip on the Workers table's Scripts column AND as a new "Script assignments by worker" row (the latter carries through to the Markdown export so support reports include the breakdown)

This is a release candidate, report any issues observed in real-world and just any Weird Shit™ in general



### Update 1.0.0-rc.3

Two long-lived-script issues surfaced from hands-on testing after RC2's worker pool shipped:
* **Eviction respects script registrations.** Workers hosting a script that registered a tool, macro, drawer tab, input bar action, RPC endpoint, world-info interceptor, content processor, macro interceptor, float widget, or advanced modal are now exempt from idle and memory eviction. Pre-fix, after 30 min idle the worker would be reaped and the registration would silently stop firing, where host-side it still looked alive but the handler closure had died with the worker.
* **DOM handle re-attachment after worker respawn.** Scripts that re-inject DOM under the same `stableId` after their worker was evicted and respawned now correctly resolve to the same handle on both sides.

Diagnostics panel adds an "Eviction-exempt scripts (registrations)" row showing which scripts are pinning which workers and what kinds of registrations they hold.



### Update 1.0.0-rc.4

Three anti-eviction pinning gaps surfaced from testing after RC3 shipped, now fixed:
* **DOM event listeners now pin their worker.** Pre-rc.4 a script that injected an interactive UI element with `handle.on('click', ...)` event listeners but didn't also register a tool/macro/drawer tab was evictable. After the TTL the worker would die, the DOM stayed on screen, but clicks did nothing, as the click handler closures had died with the worker. Interactive UI now stays interactive across the idle threshold.
* **Cross-script user-event broadcasts now pin too.** Scripts that subscribe to non-`ls:*` broadcasts emitted from other scripts need their worker alive to receive them. Pre-rc.4 the worker could die and forwarded broadcasts silently dropped. Engine-lifecycle `ls:*` subscriptions (e.g. `ls:startup`) are explicitly not counted, those only fire as side-effects of local activity, so they don't motivate keeping a worker warm.
* **`DOMHandle.remove()` cleanup is now symmetric.** When a script removes a DOM element via `handle.remove()`, the event listeners attached to that element (and any descendants) are now properly cleaned up parent-side. Without this, the new pin signal would have accumulated orphan entries from removed elements, falsely keeping scripts pinned past their UI lifecycle.
