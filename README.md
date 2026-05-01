# LumiScript Work Directory

This folder is a small workspace for editing LumiScript exports outside the app.
It keeps unpacked script files and local reference docs in one place, while the
configured LumiScript storage folder holds exported and rebuilt zip files.

## Contents

- `packer.ps1` - preferred wrapper. It toggles between unpacking and packing.
- `packer.sh` - Bash wrapper with the same path config and toggle behavior.
- `lumiscript-root.conf` - absolute path to the LumiScript extension directory.
  The configured directory must contain `repo/` and `storage/`.
- `zips/` - legacy local zip scratch space. The wrappers now use the configured
  `storage/exports/` directory.
- `unpacked/` - unpacked scripts are written here. Edit the `.js` files and
  `manifest.json` here.
- `docs/cli-tools.md` - detailed documentation for `pack2js` and `js2pack`.
- `docs/lumiscript-reference-*.md` - local LumiScript API/reference notes.

## How It Works

LumiScript packs are `.lumiscript.zip` files. The repo includes two Bun tools:

- `pack2js` expands a pack into `manifest.json` plus one `.js` file per script.
- `js2pack` rebuilds a `.lumiscript.zip` from that unpacked directory.

`packer.ps1` and `packer.sh` read `lumiscript-root.conf`, validate that
`LUMISCRIPT_ROOT` contains `repo/` and `storage/`, and run those tools from
`LUMISCRIPT_ROOT/repo` while keeping editable script files inside this
`work-dir` folder.

Default toggle behavior:

- If `unpacked/manifest.json` exists, it packs `unpacked/` into
  `storage/exports/to-be-imported.lumiscript.zip`.
- If `unpacked/manifest.json` is missing, it unpacks
  `storage/exports/trigger.lumiscript.zip` into `unpacked/`.

## How To Use

1. Export scripts from LumiScript.
2. Confirm `work-dir/lumiscript-root.conf` points to the LumiScript extension
   directory. The path must contain `repo/` and `storage/`.
3. Place the exported file at `storage/exports/trigger.lumiscript.zip`.
4. Run:

   ```powershell
   .\work-dir\packer.ps1
   ```

5. Edit the files in `work-dir/unpacked/`.
6. Run the same command again to build
   `storage/exports/to-be-imported.lumiscript.zip`.
7. Import `to-be-imported.lumiscript.zip` back into LumiScript.

You can also force a specific action:

```powershell
.\work-dir\packer.ps1 -Action unpack
.\work-dir\packer.ps1 -Action pack
.\work-dir\packer.ps1 -Action validate
```

Run this for built-in help:

```powershell
Get-Help .\work-dir\packer.ps1 -Full
```
