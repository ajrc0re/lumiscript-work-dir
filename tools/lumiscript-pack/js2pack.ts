#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  PACK_FORMAT,
  type Manifest,
  type ScriptMetadata,
  type ScriptPack,
  type ScriptPackEntry,
  parseJsonFile,
  validateManifest,
  validateScriptPack,
  writePackZip,
} from './shared.ts';

interface Frontmatter {
  name?: string;
  type?: string;
  triggers?: string[];
  folder?: string;
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
}

const DIRECTIVE_RE = /^\/\/\s*@(\w+)\s+(.*)/;

function parseFrontmatter(code: string): Frontmatter {
  const frontmatter: Frontmatter = {};

  for (const line of code.split('\n')) {
    const trimmed = line.trim();

    if (trimmed !== '' && !trimmed.startsWith('//')) {
      break;
    }

    const match = trimmed.match(DIRECTIVE_RE);

    if (!match) {
      continue;
    }

    const key = match[1];
    const value = match[2].trim();

    if (!value) {
      continue;
    }

    if (key === 'name') frontmatter.name = value;
    if (key === 'type') frontmatter.type = value;
    if (key === 'triggers') frontmatter.triggers = value.split(',').map((item) => item.trim()).filter(Boolean);
    if (key === 'folder') frontmatter.folder = value;
    if (key === 'description') frontmatter.description = value;
    if (key === 'author') frontmatter.author = value;
    if (key === 'version') frontmatter.version = value;
    if (key === 'tags') frontmatter.tags = value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return frontmatter;
}

function printUsage(exitCode = 1): never {
  console.log(`
Usage: bun tools/lumiscript-pack/js2pack.ts <directory> [--name <pack-name>] [--output <path>]

Arguments:
  <directory>      Path to folder containing .js script files
  --name <name>    Pack name for default output filename
  --output <path>  Output ZIP path
`);
  process.exit(exitCode);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printUsage(0);
}

if (args.length === 0) {
  printUsage(1);
}

let dirPath = '';
let packName = '';
let outputPath = '';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--name' && args[i + 1]) {
    packName = args[++i];
    continue;
  }

  if (arg === '--output' && args[i + 1]) {
    outputPath = args[++i];
    continue;
  }

  if (!arg.startsWith('-') && !dirPath) {
    dirPath = arg;
    continue;
  }

  console.error(`Unknown argument: ${arg}`);
  printUsage();
}

if (!dirPath) {
  console.error('Error: directory path is required');
  printUsage();
}

const resolvedDir = resolve(dirPath);

try {
  if (!statSync(resolvedDir).isDirectory()) {
    console.error(`Error: not a directory: ${resolvedDir}`);
    process.exit(1);
  }
} catch {
  console.error(`Error: path does not exist: ${resolvedDir}`);
  process.exit(1);
}

function buildEntriesFromManifest(dir: string, manifest: Manifest): ScriptPackEntry[] {
  const entries: ScriptPackEntry[] = [];

  for (const script of manifest.scripts) {
    const filePath = resolve(dir, script.file);

    if (!existsSync(filePath)) {
      console.error(`Error: manifest entry "${script.name}" references missing file: ${script.file}`);
      process.exit(1);
    }

    const entry: ScriptPackEntry = {
      name: script.name,
      code: readFileSync(filePath, 'utf8'),
      type: script.type,
    };

    if (script.triggers?.length) entry.triggers = script.triggers;
    if (script.bindings?.length) entry.bindings = script.bindings;
    if (script.folder) entry.folder = script.folder;
    if (script.metadata && Object.keys(script.metadata).length > 0) entry.metadata = script.metadata;

    entries.push(entry);

    const triggers = script.triggers?.length ? `, triggers: ${script.triggers.join(', ')}` : '';
    console.log(`  + ${script.name} (${script.type}${triggers})`);
  }

  const referenced = new Set(manifest.scripts.map((script) => script.file));
  const orphans = readdirSync(dir).filter((file) => file.endsWith('.js') && !referenced.has(file));

  if (orphans.length > 0) {
    console.log(`\nNote: ${orphans.length} .js file(s) not referenced by manifest.json:`);
    for (const file of orphans.slice(0, 10)) {
      console.log(`  - ${file}`);
    }
    if (orphans.length > 10) {
      console.log(`  ... and ${orphans.length - 10} more`);
    }
  }

  return entries;
}

function buildEntriesFromFrontmatter(dir: string): ScriptPackEntry[] {
  const jsFiles = readdirSync(dir).filter((file) => file.endsWith('.js')).sort();

  if (jsFiles.length === 0) {
    console.error(`Error: no .js files found in ${dir}`);
    process.exit(1);
  }

  return jsFiles.map((filename) => {
    const code = readFileSync(resolve(dir, filename), 'utf8');
    const frontmatter = parseFrontmatter(code);
    const metadata: ScriptMetadata = {};

    if (frontmatter.description) metadata.description = frontmatter.description;
    if (frontmatter.author) metadata.author = frontmatter.author;
    if (frontmatter.version) metadata.version = frontmatter.version;
    if (frontmatter.tags) metadata.tags = frontmatter.tags;

    const entry: ScriptPackEntry = {
      name: frontmatter.name ?? filename.replace(/\.js$/, ''),
      code,
      type: frontmatter.type === 'library' ? 'library' : 'trigger',
    };

    if (frontmatter.triggers?.length) entry.triggers = frontmatter.triggers;
    if (frontmatter.folder) entry.folder = frontmatter.folder;
    if (Object.keys(metadata).length > 0) entry.metadata = metadata;

    const triggers = frontmatter.triggers?.length ? `, triggers: ${frontmatter.triggers.join(', ')}` : '';
    console.log(`  + ${entry.name} (${entry.type}${triggers})`);

    return entry;
  });
}

const manifestPath = resolve(resolvedDir, 'manifest.json');
let entries: ScriptPackEntry[];

if (existsSync(manifestPath)) {
  const manifest = validateManifest(parseJsonFile(manifestPath));
  console.log(`Using manifest.json as source of truth (${manifest.scripts.length} script${manifest.scripts.length === 1 ? '' : 's'}).`);
  entries = buildEntriesFromManifest(resolvedDir, manifest);
} else {
  console.log('No manifest.json found; parsing frontmatter from .js files.');
  entries = buildEntriesFromFrontmatter(resolvedDir);
}

const pack = validateScriptPack({
  format: PACK_FORMAT,
  exportedAt: new Date().toISOString(),
  scripts: entries,
}) as ScriptPack;

const resolvedName = packName || basename(resolvedDir);
const resolvedOutput = outputPath ? resolve(outputPath) : resolve(`${resolvedName}.lumiscript.zip`);

writePackZip(pack, resolvedOutput);

const sizeKB = (statSync(resolvedOutput).size / 1024).toFixed(1);
console.log(`\nOK: ${entries.length} script${entries.length === 1 ? '' : 's'} -> ${resolvedOutput} (${sizeKB} KB)`);
