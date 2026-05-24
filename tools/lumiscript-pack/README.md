# Repo-Local LumiScript Pack Tools

This directory contains the self-contained pack/unpack workflow used by this
work directory. It replaces the old dependency on an external LumiScript root.

## Commands

Pack an expanded `unpacked/` directory:

```sh
bun tools/lumiscript-pack/js2pack.ts unpacked --output zips/to-be-imported.lumiscript.zip
```

Unpack a LumiScript export into `unpacked/`:

```sh
bun tools/lumiscript-pack/pack2js.ts zips/trigger.lumiscript.zip unpacked --force
```

The scripts preserve the same two artifact formats as LumiScript:

- `lumiscript-pack-v1`: a zip containing `pack.json`
- `lumiscript-manifest-v1`: an expanded directory with `manifest.json` plus one
  JavaScript file per script

Runtime requirements are local Bun plus the system `zip` and `unzip` commands.
