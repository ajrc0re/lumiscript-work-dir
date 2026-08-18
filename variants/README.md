# Greeting Inspector runtime variants

Two separately importable builds are kept in this workspace:

- `unpacked/` is the unchanged current/control source.
- `variants/quickjs-compatible/` is the QuickJS-compatible A/B test source.

The generated imports are:

- `zips/greeting-inspector-current.lumiscript.zip`
- `zips/greeting-inspector-quickjs-compatible.lumiscript.zip`

## Important: enable only one copy

Both variants use the same Greeting Inspector variables, injections, and UI IDs.
Do not enable both scripts at the same time. Disable the current script before
enabling `Greeting_Inspector_QuickJS_Compatible`.

The engine setting is global. The QuickJS-compatible build intentionally runs
under either engine, so use that one build for the fairest A/B test and switch
only **Settings -> Script Execution -> Engine** between `AsyncFunction` and
`QuickJS`. Reload the script after each switch if it has not re-armed yet.

## What differs in the QuickJS-compatible build

Functional behavior is unchanged. The test build only:

1. Captures the body event payload in `RUN_DATA`, avoiding QuickJS's empty
   handler-time `data` environment.
2. Logs the actual engine reported by `api.utils.getEngine()` when available.
3. Logs body-run and UI-action duration in milliseconds.
4. Uses a distinct script name and version so the test build is recognizable.

Look for `run start`, `run complete`, `ui action complete`, `engine`, and
`durationMs` in the Greeting Inspector debug log or editor console. A reported
`asyncfn` while QuickJS is selected means that run degraded to the fallback
engine.

For a meaningful comparison, repeat the same actions several times under each
engine after one warm-up run: Refresh, open each picker, toggle auto prompt,
drag/click the floating controls, Force, Undo, and process a normal generation.
