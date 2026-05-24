#!/usr/bin/env bash
#
# packer.sh - toggle between unpacking and packing LumiScript archives.
#
# This wrapper is self-contained within this repository:
#
#   - If ./unpacked/manifest.json exists, it packs ./unpacked into
#     ./zips/to-be-imported.lumiscript.zip.
#   - If ./unpacked/manifest.json does not exist, it unpacks
#     ./zips/trigger.lumiscript.zip into ./unpacked. If trigger.lumiscript.zip
#     is absent, it falls back to ./zips/export.lumiscript.zip.
#
# Usage:
#   ./packer.sh             # toggle (default)
#   ./packer.sh pack        # explicitly pack
#   ./packer.sh unpack      # explicitly unpack
#   ./packer.sh validate    # validate local tool paths only
#   ./packer.sh -h          # this help

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
tools_dir="$script_dir/tools/lumiscript-pack"
pack2js="$tools_dir/pack2js.ts"
js2pack="$tools_dir/js2pack.ts"
unpacked_dir="$script_dir/unpacked"
manifest_path="$unpacked_dir/manifest.json"
exports_dir="$script_dir/zips"
primary_export_zip="$exports_dir/trigger.lumiscript.zip"
fallback_export_zip="$exports_dir/export.lumiscript.zip"
import_zip="$exports_dir/to-be-imported.lumiscript.zip"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Error: required command '$command_name' was not found on PATH." >&2
    exit 1
  fi
}

validate_paths() {
  require_command bun
  require_command zip
  require_command unzip

  if [[ ! -f "$pack2js" || ! -f "$js2pack" ]]; then
    echo "Error: expected repo-local LumiScript tools under '$tools_dir'." >&2
    exit 1
  fi
}

choose_export_zip() {
  if [[ -f "$primary_export_zip" ]]; then
    printf '%s' "$primary_export_zip"
    return
  fi

  if [[ -f "$fallback_export_zip" ]]; then
    printf '%s' "$fallback_export_zip"
    return
  fi

  echo "Error: cannot unpack because neither '$primary_export_zip' nor '$fallback_export_zip' exists." >&2
  exit 1
}

validate_paths

if [[ "$action" == "toggle" ]]; then
  if [[ -f "$manifest_path" ]]; then
    action="pack"
  else
    action="unpack"
  fi
fi

case "$action" in
  validate)
    echo "Repo-local LumiScript tools are available: $tools_dir"
    echo "Unpacked directory: $unpacked_dir"
    echo "Import zip: $import_zip"
    if [[ -f "$primary_export_zip" ]]; then
      echo "Export zip: $primary_export_zip"
    elif [[ -f "$fallback_export_zip" ]]; then
      echo "Export zip: $fallback_export_zip"
    else
      echo "Export zip: missing"
    fi
    ;;
  pack)
    if [[ ! -f "$manifest_path" ]]; then
      echo "Error: cannot pack because '$manifest_path' does not exist." >&2
      exit 1
    fi
    mkdir -p "$exports_dir"
    echo "Packing $unpacked_dir into $import_zip"
    bun "$js2pack" "$unpacked_dir" --output "$import_zip"
    ;;
  unpack)
    export_zip="$(choose_export_zip)"
    echo "Unpacking $export_zip into $unpacked_dir"
    bun "$pack2js" "$export_zip" "$unpacked_dir" --force
    ;;
esac
