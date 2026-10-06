import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export const NEST_PACKAGE = '@nest-rn-lens/nest';

const MAIN_FILES = ['src/main.ts', 'src/main.js'];
const FALLBACK_ROOT_MODULES = ['src/app.module.ts', 'src/app.module.js'];
const REGISTERED = /NestRnLensModule\s*\.\s*forRoot\s*\(/;

/**
 * Finds the file of the module passed to NestFactory.create() in main.ts,
 * falling back to Nest's default src/app.module.ts.
 */
export function findRootModule(appDir: string): string | undefined {
	for (const mainFile of MAIN_FILES) {
		const mainPath = join(appDir, mainFile);
		if (!existsSync(mainPath)) {
			continue;
		}
		const main = readFileSync(mainPath, 'utf8');
		const moduleName = main.match(/NestFactory\s*\.\s*create\s*(?:<[^>]*>)?\s*\(\s*(\w+)/)?.[1];
		const importPath = moduleName && findImportPath(main, moduleName);
		const file = importPath && resolveSource(dirname(mainPath), importPath);
		if (file) {
			return file;
		}
	}
	return FALLBACK_ROOT_MODULES.map((file) => join(appDir, file)).find((file) => existsSync(file));
}

export function isRegistered(rootModule: string): boolean {
	return REGISTERED.test(readFileSync(rootModule, 'utf8'));
}

export type RegisterResult =
	| { ok: true; file: string; line: number }
	| { ok: false; reason: string };

/**
 * Adds `NestRnLensModule.forRoot({ app })` to the root module's imports.
 * Edits text, not an AST, so it only touches code it fully recognizes and
 * otherwise explains what to add by hand.
 */
export function registerNestModule(appDir: string, appName: string): RegisterResult {
	const file = findRootModule(appDir);
	if (!file) {
		return { ok: false, reason: 'Could not find the root module (looked at src/main.ts and src/app.module.ts).' };
	}
	const source = readFileSync(file, 'utf8');
	if (REGISTERED.test(source)) {
		return { ok: true, file, line: lineOf(source, source.search(REGISTERED)) };
	}

	const call = `NestRnLensModule.forRoot({ app: '${appName.replace(/'/g, "\\'")}' })`;
	const decorator = source.match(/@Module\s*\(\s*\{/);
	if (!decorator || decorator.index === undefined) {
		return { ok: false, reason: `No @Module({ … }) found in ${relative(appDir, file)}.` };
	}
	const objectStart = decorator.index + decorator[0].length;

	let edited: string;
	const imports = findTopLevelKey(source, objectStart, 'imports');
	if (imports) {
		const at = imports.arrayStart + 1;
		const rest = source.slice(at);
		const isEmpty = /^\s*\]/.test(rest);
		const indent = lineIndent(source, imports.keyStart) + indentUnit(source);
		const multiline = /^\s*\n/.test(rest);
		edited = isEmpty
			? `${source.slice(0, at)}${call}${source.slice(at)}`
			: multiline
				? `${source.slice(0, at)}\n${indent}${call},${source.slice(at)}`
				: `${source.slice(0, at)}${call}, ${source.slice(at)}`;
	} else {
		const isEmptyObject = /^\s*\}/.test(source.slice(objectStart));
		const indent = lineIndent(source, decorator.index) + indentUnit(source);
		edited = isEmptyObject
			? `${source.slice(0, objectStart)}\n${indent}imports: [${call}],\n${source.slice(objectStart).replace(/^\s*/, '')}`
			: `${source.slice(0, objectStart)}\n${indent}imports: [${call}],${source.slice(objectStart)}`;
	}

	edited = addImport(edited, `import { NestRnLensModule } from '${NEST_PACKAGE}';`);
	writeFileSync(file, edited);
	return { ok: true, file, line: lineOf(edited, edited.search(REGISTERED)) };
}

/**
 * Finds `key: [` directly inside the object literal that starts at
 * `objectStart` (just after its `{`), skipping nested objects, arrays, calls,
 * strings and comments.
 */
function findTopLevelKey(source: string, objectStart: number, key: string) {
	let depth = 0;
	for (let i = objectStart; i < source.length; i++) {
		const char = source[i];
		if (char === '"' || char === "'" || char === '`') {
			i = skipString(source, i);
		} else if (source.startsWith('//', i)) {
			i = source.indexOf('\n', i);
			if (i === -1) {
				return undefined;
			}
		} else if (source.startsWith('/*', i)) {
			i = source.indexOf('*/', i) + 1;
			if (i === 0) {
				return undefined;
			}
		} else if ('{[('.includes(char)) {
			depth++;
		} else if ('}])'.includes(char)) {
			if (depth === 0) {
				return undefined; // end of the decorator object
			}
			depth--;
		} else if (depth === 0 && source.startsWith(key, i) && !/[\w$]/.test(source[i - 1] ?? '')) {
			const match = new RegExp(`^${key}\\s*:\\s*\\[`).exec(source.slice(i));
			if (match) {
				return { keyStart: i, arrayStart: i + match[0].length - 1 };
			}
		}
	}
	return undefined;
}

/** Index of the closing quote of the string that opens at `start`. */
function skipString(source: string, start: number): number {
	const quote = source[start];
	for (let i = start + 1; i < source.length; i++) {
		if (source[i] === '\\') {
			i++;
		} else if (source[i] === quote) {
			return i;
		}
	}
	return source.length;
}

/** Puts the import after the last existing import (or at the top). */
function addImport(source: string, statement: string): string {
	const imports = [...source.matchAll(/^import[\s\S]*?from\s*['"][^'"]+['"];?[^\S\n]*$/gm)];
	const last = imports.at(-1);
	if (!last || last.index === undefined) {
		return `${statement}\n${source}`;
	}
	const end = last.index + last[0].length;
	return `${source.slice(0, end)}\n${statement}${source.slice(end)}`;
}

function findImportPath(source: string, name: string): string | undefined {
	const pattern = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]([^'"]+)['"]`);
	return source.match(pattern)?.[1];
}

/** "./app.module.js" → the .ts (or .js) file on disk. */
function resolveSource(fromDir: string, specifier: string): string | undefined {
	if (!specifier.startsWith('.')) {
		return undefined;
	}
	const base = resolve(fromDir, specifier).replace(/\.(js|ts|mjs|cjs)$/, '');
	return ['.ts', '.js', '.mts', '.mjs'].map((ext) => base + ext).find((file) => existsSync(file));
}

/** Leading whitespace of the line that contains `index`. */
function lineIndent(source: string, index: number): string {
	const lineStart = source.lastIndexOf('\n', index) + 1;
	return source.slice(lineStart).match(/^[ \t]*/)![0];
}

/** The file's indentation unit: a tab, or the smallest run of leading spaces. */
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
