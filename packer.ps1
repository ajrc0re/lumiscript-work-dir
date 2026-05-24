<#
.SYNOPSIS
Toggles between unpacking and packing LumiScript archives for this work directory.

.DESCRIPTION
packer.ps1 is a convenience wrapper around the repo-local tools in
tools/lumiscript-pack. It does not require a separate LumiScript checkout.

Default toggle behavior:

- If ./unpacked/manifest.json exists, pack ./unpacked into
  ./zips/to-be-imported.lumiscript.zip.
- If ./unpacked/manifest.json does not exist, unpack
  ./zips/trigger.lumiscript.zip into ./unpacked. If trigger.lumiscript.zip is
  absent, fall back to ./zips/export.lumiscript.zip.

.PARAMETER Action
Selects the operation to run.

Valid values:
- toggle: Pack when ./unpacked/manifest.json exists; otherwise unpack.
- pack: Require ./unpacked/manifest.json and write ./zips/to-be-imported.lumiscript.zip.
- unpack: Refresh ./unpacked from ./zips/trigger.lumiscript.zip or ./zips/export.lumiscript.zip.
- validate: Validate local tool and command paths.

The default value is toggle.

.EXAMPLE
.\packer.ps1

Runs the default toggle action.

.EXAMPLE
.\packer.ps1 -Action pack

Explicitly packs ./unpacked into ./zips/to-be-imported.lumiscript.zip.

.EXAMPLE
.\packer.ps1 -Action unpack

Explicitly unpacks ./zips/trigger.lumiscript.zip or ./zips/export.lumiscript.zip
into ./unpacked.
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

$ToolsDir = Join-Path $WorkDir 'tools/lumiscript-pack'
$Pack2Js = Join-Path $ToolsDir 'pack2js.ts'
$Js2Pack = Join-Path $ToolsDir 'js2pack.ts'
$UnpackedDir = Join-Path $WorkDir 'unpacked'
$ManifestPath = Join-Path $UnpackedDir 'manifest.json'
$ExportsDir = Join-Path $WorkDir 'zips'
$PrimaryExportZip = Join-Path $ExportsDir 'trigger.lumiscript.zip'
$FallbackExportZip = Join-Path $ExportsDir 'export.lumiscript.zip'
$ImportZip = Join-Path $ExportsDir 'to-be-imported.lumiscript.zip'

function Assert-Command {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found on PATH."
    }
}

function Assert-LocalTools {
    Assert-Command -Name 'bun'
    Assert-Command -Name 'zip'
    Assert-Command -Name 'unzip'

    if (-not (Test-Path -LiteralPath $Pack2Js -PathType Leaf) -or
        -not (Test-Path -LiteralPath $Js2Pack -PathType Leaf)) {
        throw "Expected repo-local LumiScript tools under '$ToolsDir'."
    }
}

function Get-ExportZip {
    if (Test-Path -LiteralPath $PrimaryExportZip -PathType Leaf) {
        return $PrimaryExportZip
    }

    if (Test-Path -LiteralPath $FallbackExportZip -PathType Leaf) {
        return $FallbackExportZip
    }

    throw "Cannot unpack because neither '$PrimaryExportZip' nor '$FallbackExportZip' exists."
}

function Invoke-Bun {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & bun @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: bun $($Arguments -join ' ')"
    }
}

Assert-LocalTools

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
        Write-Host "Repo-local LumiScript tools are available: $ToolsDir"
        Write-Host "Unpacked directory: $UnpackedDir"
        Write-Host "Import zip: $ImportZip"

        if (Test-Path -LiteralPath $PrimaryExportZip -PathType Leaf) {
            Write-Host "Export zip: $PrimaryExportZip"
        }
        elseif (Test-Path -LiteralPath $FallbackExportZip -PathType Leaf) {
            Write-Host "Export zip: $FallbackExportZip"
        }
        else {
            Write-Host "Export zip: missing"
        }
    }

    'pack' {
        if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
            throw "Cannot pack because '$ManifestPath' does not exist."
        }

        New-Item -ItemType Directory -Force -Path $ExportsDir | Out-Null

        Write-Host "Packing $UnpackedDir into $ImportZip"
        Invoke-Bun -Arguments @(
            $Js2Pack,
            $UnpackedDir,
            '--output',
            $ImportZip
        )
    }

    'unpack' {
        $ExportZip = Get-ExportZip

        Write-Host "Unpacking $ExportZip into $UnpackedDir"
        Invoke-Bun -Arguments @(
            $Pack2Js,
            $ExportZip,
            $UnpackedDir,
            '--force'
        )
    }
}
