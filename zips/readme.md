Local LumiScript zip workspace.

The packer wrappers use this directory directly:

- `trigger.lumiscript.zip` for unpacking
- `to-be-imported.lumiscript.zip` for packing

If `trigger.lumiscript.zip` is absent, the wrappers fall back to
`export.lumiscript.zip`.
