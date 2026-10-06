import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import type { ClientKind } from '../shared/protocol';
import { readJson, type PackageJson } from './workspace';

export type EditResult = { ok: true; file: string; line: number } | { ok: false; reason: string; file?: string };

const MAIN_FILES = ['src/main.ts', 'src/main.js'];

// ---------- CORS ----------

/**
 * Adds a development-only `app.enableCors()` right after the
 * `const app = await NestFactory.create(...)` statement in the API's main.ts.
 */
export function enableCors(apiDir: string): EditResult {
	const file = MAIN_FILES.map((name) => join(apiDir, name)).find((path) => existsSync(path));
	if (!file) {
		return { ok: false, reason: `No src/main.ts in ${basename(apiDir)}.` };
	}
	const source = readFileSync(file, 'utf8');
	if (/\benableCors\s*\(/.test(source)) {
		return { ok: true, file, line: lineOf(source, source.search(/\benableCors\s*\(/)) };
	}

	const create = /^([ \t]*)(?:const|let|var)\s+(\w+)\s*=\s*await\s+NestFactory\s*\.\s*create\b/m.exec(source);
	if (!create) {
		return { ok: false, file, reason: `Couldn't find "const app = await NestFactory.create(…)" in ${relative(apiDir, file)}. Add app.enableCors() after it by hand.` };
	}
	const [, indent, appVar] = create;
	const open = source.indexOf('(', create.index + create[0].length);
	const close = open === -1 ? -1 : matchingParen(source, open);
	if (close === -1) {
		return { ok: false, file, reason: `Couldn't read the NestFactory.create(…) call in ${relative(apiDir, file)}.` };
	}
	// End of the statement: the rest of that line.
	const lineEnd = source.indexOf('\n', close);
	const at = lineEnd === -1 ? source.length : lineEnd;
	const unit = indentUnit(source);
	const block = [
		'',
		`${indent}// Lets browser apps (Next.js, Expo web) call the API in development.`,
		`${indent}if (process.env.NODE_ENV !== 'production') {`,
		`${indent}${unit}${appVar}.enableCors();`,
		`${indent}}`,
	].join('\n');
	const edited = source.slice(0, at) + block + source.slice(at);
	writeFileSync(file, edited);
	return { ok: true, file, line: lineOf(edited, at + 1) };
}

// ---------- Client ----------

export interface ClientSetup {
	kind: ClientKind;
	appDir: string;
	/** Name of the app in the traffic log. */
	appName: string;
	apiPort: number;
}

/**
 * Adds a small dev-only module that tags every request to the API (matched by
 * port) with the NestRN Lens headers, and loads it once at the app's entry,
 * so none of the app's own fetch calls need to change.
 */
export function addClient(setup: ClientSetup): EditResult {
	return setup.kind === 'next' ? addNextClient(setup) : addExpoClient(setup);
}

function addNextClient({ appDir, appName, apiPort }: ClientSetup): EditResult {
	const routerDir = ['src/app', 'app'].map((dir) => join(appDir, dir)).find((dir) => existsSync(dir));
	const layout = routerDir && ['layout.tsx', 'layout.jsx', 'layout.js'].map((name) => join(routerDir, name)).find((path) => existsSync(path));
	if (!routerDir || !layout) {
		return { ok: false, reason: 'Only the Next.js App Router is supported: no app/layout.tsx found.' };
	}

	const ext = layout.endsWith('.tsx') ? 'tsx' : 'jsx';
	const component = join(routerDir, `nest-rn-lens.${ext}`);
	writeFileSync(component, nextClientSource(appName, apiPort, ext === 'tsx'));

	const source = readFileSync(layout, 'utf8');
	if (/<NestRnLens\s*\/>/.test(source)) {
		return { ok: true, file: layout, line: lineOf(source, source.search(/<NestRnLens\s*\/>/)) };
	}
	const body = /<body\b[^>]*>/.exec(source);
	if (!body) {
		return { ok: false, file: component, reason: `Created ${relative(appDir, component)}, but couldn't find <body> in ${relative(appDir, layout)}. Render <NestRnLens /> inside it by hand.` };
	}
	const indent = lineIndent(source, body.index) + indentUnit(source);
	const at = body.index + body[0].length;
	let edited = `${source.slice(0, at)}\n${indent}<NestRnLens />${source.slice(at)}`;
	edited = addImport(edited, `import { NestRnLens } from './nest-rn-lens';`);
	writeFileSync(layout, edited);
	return { ok: true, file: layout, line: lineOf(edited, edited.search(/<NestRnLens\s*\/>/)) };
}

function addExpoClient({ appDir, appName, apiPort }: ClientSetup): EditResult {
	const entry = expoEntry(appDir);
	if (!entry) {
		return { ok: false, reason: "Couldn't find the app's entry file (app/_layout.tsx, or the \"main\" file in package.json)." };
	}
	const ts = /\.tsx?$/.test(entry);
	// Not inside Expo Router's app/ folder: every file there becomes a route.
	const srcDir = existsSync(join(appDir, 'src')) ? join(appDir, 'src') : appDir;
	const module = join(srcDir, `nest-rn-lens.${ts ? 'ts' : 'js'}`);
	writeFileSync(module, expoClientSource(appName, apiPort, ts));

	let specifier = relative(dirname(entry), module).replace(/\\/g, '/').replace(/\.(ts|js)$/, '');
	if (!specifier.startsWith('.')) {
		specifier = `./${specifier}`;
	}
	const source = readFileSync(entry, 'utf8');
	if (source.includes(`'${specifier}'`)) {
		return { ok: true, file: entry, line: 1 };
	}
	// First import, so it runs before any other module can make a request.
	const edited = `// Dev only: tags API requests for NestRN Lens. Keep it first.\nimport '${specifier}';\n${source}`;
	writeFileSync(entry, edited);
	return { ok: true, file: entry, line: 2 };
}

/** Expo Router's root layout, or the file in package.json "main". */
function expoEntry(appDir: string): string | undefined {
	const layouts = ['src/app/_layout.tsx', 'app/_layout.tsx', 'src/app/_layout.jsx', 'app/_layout.jsx', 'src/app/_layout.js', 'app/_layout.js'];
	const layout = layouts.map((path) => join(appDir, path)).find((path) => existsSync(path));
	if (layout) {
		return layout;
	}
	const main = readJson<PackageJson>(join(appDir, 'package.json'))?.main;
	if (!main || main.includes('node_modules') || main.startsWith('expo/')) {
		// "expo/AppEntry" loads App.tsx.
		return ['App.tsx', 'App.jsx', 'App.js'].map((name) => join(appDir, name)).find((path) => existsSync(path));
	}
	const base = join(appDir, main).replace(/\.(js|jsx|ts|tsx)$/, '');
	return ['.ts', '.tsx', '.js', '.jsx'].map((ext) => base + ext).find((path) => existsSync(path));
}

// ---------- Generated code ----------

function nextClientSource(appName: string, apiPort: number, ts: boolean): string {
	const t = (type: string) => (ts ? type : '');
	return `'use client';

// NestRN Lens (development only): adds the x-nest-rn-lens-* headers to every
// request the browser sends to your API, so each one shows up with this app's
// name and the page it came from. Rendered once in the root layout.

const API_PORT = '${apiPort}';
const APP_NAME = '${appName}';

let installed = false;

function install() {
  if (installed || typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return;
  }
  installed = true;
  const original = window.fetch;
  window.fetch = (input${t(': RequestInfo | URL')}, init${t('?: RequestInit')}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (portOf(url) !== API_PORT) {
      return original(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('x-nest-rn-lens-app', APP_NAME);
    headers.set('x-nest-rn-lens-caller', window.location.pathname);
    return original(input, { ...init, headers });
  };
}

function portOf(url${t(': string')}) {
  return /^https?:\\/\\/[^/?#]+:(\\d+)/.exec(url)?.[1] ?? '';
}

// Runs when this module loads, before any page code makes a request.
install();

export function NestRnLens() {
  return null;
}
`;
}

function expoClientSource(appName: string, apiPort: number, ts: boolean): string {
	const t = (type: string) => (ts ? type : '');
	return `// NestRN Lens (development only): adds the x-nest-rn-lens-app header to every
// request this app sends to your API, so each one shows up with the app's name.
// Imported first in the app's entry file.

const API_PORT = '${apiPort}';
const APP_NAME = '${appName}';

if (__DEV__) {
  const original = globalThis.fetch;
  globalThis.fetch = (input${t(': RequestInfo | URL')}, init${t('?: RequestInit')}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (portOf(url) !== API_PORT) {
      return original(input, init);
    }
    const headers = new Headers(init?.headers);
    headers.set('x-nest-rn-lens-app', APP_NAME);
    return original(input, { ...init, headers });
  };
}

function portOf(url${t(': string')}) {
  return /^https?:\\/\\/[^/?#]+:(\\d+)/.exec(url)?.[1] ?? '';
}

export {};
`;
}

// ---------- Text helpers ----------

/** Index of the parenthesis closing the one at `open`, skipping strings. */
function matchingParen(source: string, open: number): number {
	let depth = 0;
	for (let i = open; i < source.length; i++) {
		const char = source[i];
		if (char === '"' || char === "'" || char === '`') {
			const end = source.indexOf(char, i + 1);
			i = end === -1 ? source.length : end;
		} else if (char === '(') {
			depth++;
		} else if (char === ')' && --depth === 0) {
			return i;
		}
	}
	return -1;
}

function addImport(source: string, statement: string): string {
	const imports = [...source.matchAll(/^import[\s\S]*?from\s*['"][^'"]+['"];?[^\S\n]*$|^import\s+['"][^'"]+['"];?[^\S\n]*$/gm)];
	const last = imports.at(-1);
	if (!last || last.index === undefined) {
		return `${statement}\n${source}`;
	}
	const end = last.index + last[0].length;
	return `${source.slice(0, end)}\n${statement}${source.slice(end)}`;
}

function lineIndent(source: string, index: number): string {
	const lineStart = source.lastIndexOf('\n', index) + 1;
	return source.slice(lineStart).match(/^[ \t]*/)![0];
}

function indentUnit(source: string): string {
	if (/^\t/m.test(source)) {
		return '\t';
	}
	const widths = [...source.matchAll(/^( +)\S/gm)].map((m) => m[1].length);
	return ' '.repeat(widths.length ? Math.min(...widths) : 2);
}

function lineOf(source: string, index: number): number {
	return source.slice(0, Math.max(0, index)).split('\n').length;
}
