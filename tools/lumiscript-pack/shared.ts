import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export const PACK_FORMAT = 'lumiscript-pack-v1';
export const MANIFEST_FORMAT = 'lumiscript-manifest-v1';

export type ScriptType = 'trigger' | 'library';

export interface ScriptBindingEntry {
  type: 'character' | 'chat';
  characterId?: string;
  chatId?: string;
  displayName: string;
}

export interface ScriptMetadata {
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
}

export interface ScriptPackEntry {
  name: string;
  code: string;
  type: ScriptType;
  triggers?: string[];
  bindings?: ScriptBindingEntry[];
  folder?: string;
  metadata?: ScriptMetadata;
}

export interface ScriptPack {
  format: typeof PACK_FORMAT;
  exportedAt: string;
  scripts: ScriptPackEntry[];
}

export interface ManifestEntry {
  name: string;
  file: string;
  type: ScriptType;
  triggers?: string[];
  bindings?: ScriptBindingEntry[];
  folder?: string;
  metadata?: ScriptMetadata;
}

export interface Manifest {
  format: typeof MANIFEST_FORMAT;
  sourcePack?: string;
  sourceFormat?: string;
  exportedAt?: string;
  convertedAt?: string;
  scripts: ManifestEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isScriptType(value: unknown): value is ScriptType {
  return value === 'trigger' || value === 'library';
}

function optionalString(value: unknown, path: string, errors: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(`${path} must be a string`);
    return undefined;
  }

  return value;
}

function optionalStringArray(value: unknown, path: string, errors: string[]): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    errors.push(`${path} must be an array of strings`);
    return undefined;
  }

  return value;
}

function normalizeMetadata(value: unknown, path: string, errors: string[]): ScriptMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return undefined;
  }

  const metadata: ScriptMetadata = {};
  const description = optionalString(value.description, `${path}.description`, errors);
  const author = optionalString(value.author, `${path}.author`, errors);
  const version = optionalString(value.version, `${path}.version`, errors);
  const tags = optionalStringArray(value.tags, `${path}.tags`, errors);

  if (description !== undefined) metadata.description = description;
  if (author !== undefined) metadata.author = author;
  if (version !== undefined) metadata.version = version;
  if (tags !== undefined) metadata.tags = tags;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeBindings(value: unknown, path: string, errors: string[]): ScriptBindingEntry[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return undefined;
  }

  const bindings: ScriptBindingEntry[] = [];

  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;

    if (!isRecord(item)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }

    if (item.type !== 'character' && item.type !== 'chat') {
      errors.push(`${itemPath}.type must be "character" or "chat"`);
      return;
    }

    const binding: ScriptBindingEntry = {
      type: item.type,
      displayName: typeof item.displayName === 'string' ? item.displayName : '',
    };
    const characterId = optionalString(item.characterId, `${itemPath}.characterId`, errors);
    const chatId = optionalString(item.chatId, `${itemPath}.chatId`, errors);

    if (characterId !== undefined) binding.characterId = characterId;
    if (chatId !== undefined) binding.chatId = chatId;

    bindings.push(binding);
  });

  return bindings;
}

function normalizeScriptEntry(raw: unknown, path: string, codeField: 'code' | 'file', errors: string[]) {
  if (!isRecord(raw)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  if (typeof raw.name !== 'string' || raw.name.length < 1 || raw.name.length > 200) {
    errors.push(`${path}.name must be a non-empty string up to 200 characters`);
  }

  if (typeof raw[codeField] !== 'string' || raw[codeField].length < (codeField === 'file' ? 1 : 0)) {
    errors.push(`${path}.${codeField} must be a string${codeField === 'file' ? ' with content' : ''}`);
  }

  if (!isScriptType(raw.type)) {
    errors.push(`${path}.type must be "trigger" or "library"`);
  }

  const triggers = optionalStringArray(raw.triggers, `${path}.triggers`, errors);
  const bindings = normalizeBindings(raw.bindings, `${path}.bindings`, errors);
  const folder = optionalString(raw.folder, `${path}.folder`, errors);
  const metadata = normalizeMetadata(raw.metadata, `${path}.metadata`, errors);

  if (typeof raw.name !== 'string' || typeof raw[codeField] !== 'string' || !isScriptType(raw.type)) {
    return null;
  }

  const entry: Record<string, unknown> = {
    name: raw.name,
    [codeField]: raw[codeField],
    type: raw.type,
  };

  if (triggers !== undefined) entry.triggers = triggers;
  if (bindings !== undefined) entry.bindings = bindings;
  if (folder !== undefined) entry.folder = folder;
  if (metadata !== undefined) entry.metadata = metadata;

  return entry;
}

function ensureScriptCount(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return false;
  }

  if (value.length < 1 || value.length > 100) {
    errors.push(`${path} must contain 1 to 100 scripts`);
    return false;
  }

  return true;
}

export function parseJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${path}: ${message}`);
  }
}

export function validateScriptPack(raw: unknown): ScriptPack {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    throw new Error('Pack must be an object');
  }

  if (raw.format !== PACK_FORMAT) {
    errors.push(`format must be "${PACK_FORMAT}"`);
  }

  if (typeof raw.exportedAt !== 'string') {
    errors.push('exportedAt must be a string');
  }

  const scripts: ScriptPackEntry[] = [];
  if (ensureScriptCount(raw.scripts, 'scripts', errors) && Array.isArray(raw.scripts)) {
    raw.scripts.forEach((script, index) => {
      const entry = normalizeScriptEntry(script, `scripts[${index}]`, 'code', errors);
      if (entry) {
        scripts.push(entry as unknown as ScriptPackEntry);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return {
    format: PACK_FORMAT,
    exportedAt: raw.exportedAt as string,
    scripts,
  };
}

export function validateManifest(raw: unknown): Manifest {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    throw new Error('Manifest must be an object');
  }

  if (raw.format !== MANIFEST_FORMAT) {
    errors.push(`format must be "${MANIFEST_FORMAT}"`);
  }

  const scripts: ManifestEntry[] = [];
  if (ensureScriptCount(raw.scripts, 'scripts', errors) && Array.isArray(raw.scripts)) {
    raw.scripts.forEach((script, index) => {
      const entry = normalizeScriptEntry(script, `scripts[${index}]`, 'file', errors);
      if (entry) {
        scripts.push(entry as unknown as ManifestEntry);
      }
    });
  }

  const manifest: Manifest = {
    format: MANIFEST_FORMAT,
    scripts,
  };

  const sourcePack = optionalString(raw.sourcePack, 'sourcePack', errors);
  const sourceFormat = optionalString(raw.sourceFormat, 'sourceFormat', errors);
  const exportedAt = optionalString(raw.exportedAt, 'exportedAt', errors);
  const convertedAt = optionalString(raw.convertedAt, 'convertedAt', errors);

  if (sourcePack !== undefined) manifest.sourcePack = sourcePack;
  if (sourceFormat !== undefined) manifest.sourceFormat = sourceFormat;
  if (exportedAt !== undefined) manifest.exportedAt = exportedAt;
  if (convertedAt !== undefined) manifest.convertedAt = convertedAt;

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return manifest;
}

function runCommand(command: string, args: string[], options: { cwd?: string } = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Failed to run ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : '';
    throw new Error(`${command} exited with status ${result.status}${stderr}`);
  }

  return result.stdout;
}

export function readPackJsonText(inputPath: string): string {
  const resolvedInput = resolve(inputPath);

  if (resolvedInput.toLowerCase().endsWith('.json')) {
    return readFileSync(resolvedInput, 'utf8');
  }

  if (!resolvedInput.toLowerCase().endsWith('.zip')) {
    throw new Error(`Unsupported input extension for ${resolvedInput}; expected .zip or .json`);
  }

  const listing = runCommand('unzip', ['-Z1', resolvedInput]);
  const packKey = listing
    .split(/\r?\n/)
    .find((key) => key === 'pack.json' || key.endsWith('/pack.json'));

  if (!packKey) {
    throw new Error(`${resolvedInput} does not contain pack.json`);
  }

  return runCommand('unzip', ['-p', resolvedInput, packKey]);
}

export function writePackZip(pack: ScriptPack, outputPath: string) {
  const resolvedOutput = resolve(outputPath);
  const tempDir = mkdtempSync(join(tmpdir(), 'lumiscript-pack-'));

  mkdirSync(dirname(resolvedOutput), { recursive: true });

  try {
    writeFileSync(join(tempDir, 'pack.json'), JSON.stringify(pack, null, 2), 'utf8');

    if (existsSync(resolvedOutput)) {
      unlinkSync(resolvedOutput);
    }

    runCommand('zip', ['-q', '-j', resolvedOutput, 'pack.json'], { cwd: tempDir });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
