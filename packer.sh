#!/usr/bin/env bash
#
# packer.sh — toggle between unpacking and packing LumiScript archives.
#
# Bash equivalent of packer.ps1. By default, acts as a toggle:
#
#   - If ./unpacked/manifest.json exists, packs ./unpacked into the configured
#     LumiScript storage exports directory by running scripts/js2pack.ts.
#   - If ./unpacked/manifest.json does not exist, unpacks the configured
#     storage export zip into ./unpacked by running scripts/pack2js.ts.
#
# Usage:
#   ./packer.sh             # toggle (default)
#   ./packer.sh pack        # explicitly pack
#   ./packer.sh unpack      # explicitly unpack
#   ./packer.sh validate    # validate configured paths only
#   ./packer.sh -h          # this help
#
# Requires lumiscript-root.conf in this directory. LUMISCRIPT_ROOT must point to
# a directory containing repo/ and storage/.

set -euo pipefail

show_help() {
  awk '
    NR < 3 { next }
    /^#/ {
      sub(/^# ?/, "")
      print
      next
    }
    { exit }
  ' "$0"
}

action="${1:-toggle}"
case "$action" in
  toggle|pack|unpack|validate) ;;
  -h|--help) show_help; exit 0 ;;
  *) echo "Error: unknown action '$action'. Valid: toggle, pack, unpack, validate." >&2; exit 2 ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_path="$script_dir/lumiscript-root.conf"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

read_lumiscript_root() {
  if [[ ! -f "$config_path" ]]; then
    echo "Error: missing config file '$config_path'." >&2
    exit 1
  fi

  local line value root=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    value="$(trim "$line")"
    if [[ -z "$value" || "$value" == \#* ]]; then
      continue
    fi
    if [[ "$value" =~ ^LUMISCRIPT_ROOT[[:space:]]*=(.*)$ ]]; then
      root="$(trim "${BASH_REMATCH[1]}")"
      if [[ "$root" == \"*\" && "$root" == *\" ]]; then
        root="${root:1:${#root}-2}"
      elif [[ "$root" == \'*\' && "$root" == *\' ]]; then
        root="${root:1:${#root}-2}"
      fi
      break
    fi
  done < "$config_path"

  if [[ -z "$root" ]]; then
    echo "Error: '$config_path' must define LUMISCRIPT_ROOT." >&2
    exit 1
  fi
  if [[ "$root" != /* ]]; then
    echo "Error: LUMISCRIPT_ROOT must be an absolute path; got '$root'." >&2
    exit 1
  fi
  if [[ ! -d "$root/repo" || ! -d "$root/storage" ]]; then
    echo "Error: LUMISCRIPT_ROOT '$root' must contain repo/ and storage/ directories." >&2
    exit 1
  fi

  printf '%s' "$root"
}

lumiscript_root="$(read_lumiscript_root)"
repo_root="$lumiscript_root/repo"
storage_dir="$lumiscript_root/storage"
exports_dir="$storage_dir/exports"
scripts_dir="$repo_root/scripts"
unpacked_dir="$script_dir/unpacked"
manifest_path="$unpacked_dir/manifest.json"
export_zip="$exports_dir/trigger.lumiscript.zip"
import_zip="$exports_dir/to-be-imported.lumiscript.zip"

if [[ ! -f "$scripts_dir/pack2js.ts" || ! -f "$scripts_dir/js2pack.ts" ]]; then
  echo "Error: expected LumiScript CLI tools under '$scripts_dir'." >&2
  echo "Check LUMISCRIPT_ROOT in '$config_path'." >&2
  exit 1
fi

if [[ "$action" == "toggle" ]]; then
  if [[ -f "$manifest_path" ]]; then
    action="pack"
  else
    action="unpack"
  fi
fi

case "$action" in
  validate)
    echo "LUMISCRIPT_ROOT is valid: $lumiscript_root"
    echo "Repo root: $repo_root"
    echo "Storage root: $storage_dir"
    ;;
  pack)
    if [[ ! -f "$manifest_path" ]]; then
      echo "Error: cannot pack because '$manifest_path' does not exist." >&2
      exit 1
    fi
    mkdir -p "$exports_dir"
    echo "Packing $unpacked_dir into $import_zip"
    cd "$repo_root"
    bun scripts/js2pack.ts "$unpacked_dir" --output "$import_zip"
    ;;
  unpack)
    if [[ ! -f "$export_zip" ]]; then
      echo "Error: cannot unpack because '$export_zip' does not exist." >&2
      exit 1
    fi
    echo "Unpacking $export_zip into $unpacked_dir"
    cd "$repo_root"
    bun scripts/pack2js.ts "$export_zip" "$unpacked_dir" --force
    ;;
esac
