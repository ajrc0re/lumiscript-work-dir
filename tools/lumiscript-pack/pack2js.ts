#!/usr/bin/env bun
import { basename, extname, resolve } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {
  MANIFEST_FORMAT,
  type ManifestEntry,
  parseJsonFile,
  readPackJsonText,
  validateScriptPack,
} from './shared.ts';

function printUsage(exitCode = 1): never {
  console.log(`
Usage: bun tools/lumiscript-pack/pack2js.ts <input> <output-dir> [--force]

Arguments:
  <input>       Path to a .lumiscript.zip OR a bare pack.json file
  <output-dir>  Directory to write .js files and manifest.json into

Options:
  --force       Overwrite files in an existing output directory
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

const force = args.includes('--force');
const positional = args.filter((arg) => !arg.startsWith('-'));

if (positional.length !== 2) {
  console.error('Error: exactly two positional arguments required: input and output-dir');
  printUsage();
}

const [inputPath, outputDir] = positional as [string, string];
const resolvedInput = resolve(inputPath);
const resolvedOutputDir = resolve(outputDir);

try {
  if (!statSync(resolvedInput).isFile()) {
    console.error(`Error: input is not a file: ${resolvedInput}`);
    process.exit(1);
  }
} catch {
  console.error(`Error: input file does not exist: ${resolvedInput}`);
  process.exit(1);
}

const extension = extname(resolvedInput).toLowerCase();

if (extension !== '.zip' && extension !== '.json') {
  console.error(`Error: unsupported input extension "${extension}". Expected .zip or .json.`);
  process.exit(1);
}

if (existsSync(resolvedOutputDir) && !force) {
  console.error(`Error: output path already exists: ${resolvedOutputDir}`);
  console.error('Pass --force to overwrite files in that directory.');
  process.exit(1);
}

let rawPack: unknown;

try {
  rawPack = extension === '.json'
    ? parseJsonFile(resolvedInput)
    : JSON.parse(readPackJsonText(resolvedInput));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}

let pack;

try {
  pack = validateScriptPack(rawPack);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: pack failed validation:\n${message}`);
  process.exit(1);
}

mkdirSync(resolvedOutputDir, { recursive: true });

const usedSlugs = new Set<string>();

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'script';
}

function uniqueSlug(name: string): string {
  const base = slugify(name);

  if (!usedSlugs.has(base)) {
    return base;
  }

  for (let index = 2; index < 10000; index++) {
    const candidate = `${base}-${index}`;

    if (!usedSlugs.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not generate a unique slug for "${name}"`);
}

const manifestEntries: ManifestEntry[] = [];

for (const script of pack.scripts) {
  const slug = uniqueSlug(script.name);
  usedSlugs.add(slug);

  const filename = `${slug}.js`;
  writeFileSync(resolve(resolvedOutputDir, filename), script.code, 'utf8');

  const entry: ManifestEntry = {
    name: script.name,
    file: filename,
    type: script.type,
  };

  if (script.triggers?.length) entry.triggers = script.triggers;
  if (script.bindings?.length) entry.bindings = script.bindings;
  if (script.folder) entry.folder = script.folder;
  if (script.metadata && Object.keys(script.metadata).length > 0) entry.metadata = script.metadata;

  manifestEntries.push(entry);

  const triggers = entry.triggers?.length ? `, triggers: ${entry.triggers.join(', ')}` : '';
  console.log(`  + ${filename} <- ${script.name} (${script.type}${triggers})`);
}

const manifest = {
  format: MANIFEST_FORMAT,
  sourcePack: basename(resolvedInput),
  sourceFormat: pack.format,
  exportedAt: pack.exportedAt,
  convertedAt: new Date().toISOString(),
  scripts: manifestEntries,
};

writeFileSync(resolve(resolvedOutputDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

if (force) {
  const expected = new Set(manifestEntries.map((entry) => entry.file).concat('manifest.json'));
  const unexpected = readdirSync(resolvedOutputDir).filter((file) => !expected.has(file));

  if (unexpected.length > 0) {
    console.log(`\nNote: ${unexpected.length} pre-existing file(s) in the output directory were not overwritten:`);
    for (const file of unexpected.slice(0, 10)) {
      console.log(`  - ${file}`);
    }
    if (unexpected.length > 10) {
      console.log(`  ... and ${unexpected.length - 10} more`);
    }
  }
}

console.log(`\nOK: ${manifestEntries.length} script${manifestEntries.length === 1 ? '' : 's'} + manifest.json -> ${resolvedOutputDir}`);
