<#
.SYNOPSIS
Toggles between unpacking and packing LumiScript archives for this work directory.

.DESCRIPTION
packer.ps1 is a convenience wrapper around the LumiScript CLI tools documented in
docs/cli-tools.md. By default, it acts as a toggle:

- If ./unpacked/manifest.json exists, it packs ./unpacked into the configured
  LumiScript storage exports directory by running scripts/js2pack.ts.
- If ./unpacked/manifest.json does not exist, it unpacks the configured storage
  export zip into ./unpacked by running scripts/pack2js.ts.

The script reads lumiscript-root.conf from its own directory, validates that the
configured LUMISCRIPT_ROOT contains repo/ and storage/, then runs Bun from the
configured repository root so the CLI tools can find their project dependencies
and source files. The unpack action uses --force because the target directory is
fixed.

.PARAMETER Action
Selects the operation to run.

Valid values:
- toggle: Pack when ./unpacked/manifest.json exists; otherwise unpack.
- pack: Require ./unpacked/manifest.json and write storage/exports/to-be-imported.lumiscript.zip.
- unpack: Require storage/exports/trigger.lumiscript.zip and refresh ./unpacked.
- validate: Validate lumiscript-root.conf, repo/, storage/, and CLI script paths.

The default value is toggle.

.EXAMPLE
.\packer.ps1

Runs the default toggle action. With a manifest present, this builds
storage/exports/to-be-imported.lumiscript.zip. Without a manifest, this expands
storage/exports/trigger.lumiscript.zip into ./unpacked.

.EXAMPLE
.\packer.ps1 -Action pack

Explicitly packs ./unpacked into storage/exports/to-be-imported.lumiscript.zip.
This fails if ./unpacked/manifest.json is missing.

.EXAMPLE
.\packer.ps1 -Action unpack

Explicitly unpacks storage/exports/trigger.lumiscript.zip into ./unpacked. This
fails if storage/exports/trigger.lumiscript.zip is missing.

.EXAMPLE
.\packer.ps1 -Action validate

Validates configured paths without packing or unpacking files.

.INPUTS
None. This script does not accept pipeline input.

.OUTPUTS
None. The script writes status messages to the host, creates or refreshes files
under ./unpacked, and writes packed exports under storage/exports.

.NOTES
Requires lumiscript-root.conf in this directory. LUMISCRIPT_ROOT must point to a
directory containing repo/ and storage/.
#>

param(
    [ValidateSet('toggle', 'pack', 'unpack', 'validate')]
    [string]$Action = 'toggle'
)

$ErrorActionPreference = 'Stop'

$WorkDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($WorkDir)) {
    $WorkDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$ConfigPath = Join-Path $WorkDir 'lumiscript-root.conf'

function Get-LumiScriptRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing config file '$Path'."
    }

    $root = $null
    foreach ($RawLine in Get-Content -LiteralPath $Path) {
        $Line = $RawLine.Trim()
        if ($Line.Length -eq 0 -or $Line.StartsWith('#')) {
            continue
        }
        if ($Line -match '^LUMISCRIPT_ROOT\s*=\s*(.+)$') {
            $root = $Matches[1].Trim()
            if (($root.StartsWith('"') -and $root.EndsWith('"')) -or
                ($root.StartsWith("'") -and $root.EndsWith("'"))) {
                $root = $root.Substring(1, $root.Length - 2)
            }
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($root)) {
        throw "'$Path' must define LUMISCRIPT_ROOT."
    }
    if (-not [System.IO.Path]::IsPathRooted($root)) {
        throw "LUMISCRIPT_ROOT must be an absolute path; got '$root'."
    }

    $ResolvedRoot = [System.IO.Path]::GetFullPath($root)
    $RequiredDirs = @('repo', 'storage')
    foreach ($RequiredDir in $RequiredDirs) {
        $Candidate = Join-Path $ResolvedRoot $RequiredDir
        if (-not (Test-Path -LiteralPath $Candidate -PathType Container)) {
            throw "LUMISCRIPT_ROOT '$ResolvedRoot' must contain repo/ and storage/ directories."
        }
    }

    return $ResolvedRoot
}

$LumiScriptRoot = Get-LumiScriptRoot -Path $ConfigPath
$RepoRoot = Join-Path $LumiScriptRoot 'repo'
$storageDir = Join-Path $LumiScriptRoot 'storage'
$exportsDir = Join-Path $storageDir 'exports'
$ScriptsDir = Join-Path $RepoRoot 'scripts'
$UnpackedDir = Join-Path $WorkDir 'unpacked'
$ManifestPath = Join-Path $UnpackedDir 'manifest.json'
$ExportZip = Join-Path $exportsDir 'trigger.lumiscript.zip'
$ImportZip = Join-Path $exportsDir 'to-be-imported.lumiscript.zip'

function Invoke-LumiScriptTool {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    Push-Location -LiteralPath $RepoRoot
    try {
        & bun @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE`: bun $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $ScriptsDir 'pack2js.ts') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $ScriptsDir 'js2pack.ts') -PathType Leaf)) {
    throw "Expected LumiScript CLI tools under '$ScriptsDir'. Check LUMISCRIPT_ROOT in '$ConfigPath'."
}

$ResolvedAction = $Action
if ($Action -eq 'toggle') {
    if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
        $ResolvedAction = 'pack'
    }
    else {
        $ResolvedAction = 'unpack'
    }
}

switch ($ResolvedAction) {
    'validate' {
        Write-Host "LUMISCRIPT_ROOT is valid: $LumiScriptRoot"
        Write-Host "Repo root: $RepoRoot"
        Write-Host "Storage root: $storageDir"
    }

    'pack' {
        if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
            throw "Cannot pack because '$ManifestPath' does not exist."
        }

        New-Item -ItemType Directory -Force -Path $exportsDir | Out-Null

        Write-Host "Packing $UnpackedDir into $ImportZip"
        Invoke-LumiScriptTool -Arguments @(
            'scripts/js2pack.ts',
            $UnpackedDir,
            '--output',
            $ImportZip
        )
    }

    'unpack' {
        if (-not (Test-Path -LiteralPath $ExportZip -PathType Leaf)) {
            throw "Cannot unpack because '$ExportZip' does not exist."
        }

        Write-Host "Unpacking $ExportZip into $UnpackedDir"
        Invoke-LumiScriptTool -Arguments @(
            'scripts/pack2js.ts',
            $ExportZip,
            $UnpackedDir,
            '--force'
        )
    }
}
