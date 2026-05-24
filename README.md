# LumiScript Work Directory

This folder is a self-contained workspace for editing LumiScript exports outside
the app. It keeps the pack/unpack tools, unpacked script files, local reference
docs, and import/export zips in this repository.

## Contents

- `packer.ps1` - PowerShell wrapper for packing and unpacking.
- `packer.sh` - shell wrapper with the same behavior.
- `tools/lumiscript-pack/` - repo-local Bun tools for converting between
  `.lumiscript.zip` packs and expanded script directories.
- `zips/` - local pack inputs and outputs.
- `unpacked/` - expanded scripts. Edit the `.js` files and `manifest.json` here.
- `docs/cli-tools.md` - upstream CLI tool notes for the LumiScript pack format.
- `docs/lumiscript-reference-*.md` - local LumiScript API/reference notes.

## How It Works

LumiScript packs are `.lumiscript.zip` files containing a `pack.json`.
The repo-local tools preserve the same two formats used by LumiScript:

- `pack2js` expands a pack into `manifest.json` plus one `.js` file per script.
- `js2pack` rebuilds a `.lumiscript.zip` from that expanded directory.

Default toggle behavior:

- If `unpacked/manifest.json` exists, `packer.ps1` and `packer.sh` pack
  `unpacked/` into `zips/to-be-imported.lumiscript.zip`.
- If `unpacked/manifest.json` is missing, they unpack
  `zips/trigger.lumiscript.zip` into `unpacked/`. If that source zip is absent,
  they fall back to `zips/export.lumiscript.zip`.

The wrappers no longer read `lumiscript-root.conf` or require an external
LumiScript checkout.

## How To Use

1. Put the exported LumiScript pack at `zips/trigger.lumiscript.zip`.
2. Run:

   ```powershell
   .\packer.ps1 -Action unpack
   ```

3. Edit files in `unpacked/`.
4. Run:

   ```powershell
   .\packer.ps1 -Action pack
   ```

5. Import `zips/to-be-imported.lumiscript.zip` back into LumiScript.

You can also use the shell wrapper:

```sh
./packer.sh unpack
./packer.sh pack
./packer.sh validate
```

The underlying tools can be run directly:

```sh
bun tools/lumiscript-pack/pack2js.ts zips/trigger.lumiscript.zip unpacked --force
bun tools/lumiscript-pack/js2pack.ts unpacked --output zips/to-be-imported.lumiscript.zip
```
