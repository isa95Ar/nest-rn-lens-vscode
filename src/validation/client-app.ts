import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', '.expo', 'dist', 'build', 'ios', 'android', 'coverage', '.turbo']);
const MAX_FILES = 3000;

/**
 * The port `next dev` will use: an explicit `-p` / `--port` in the dev script
 * wins; otherwise NestRN Lens passes `fallback` through the PORT variable.
 */
export function nextDevPort(devScript: string | undefined, fallback: number): { port: number; explicit: boolean } {
	const explicit = devScript?.match(/(?:^|\s)(?:-p|--port)(?:\s+|=)(\d+)/)?.[1];
	return explicit ? { port: Number(explicit), explicit: true } : { port: fallback, explicit: false };
}

/** First source file in the app that mentions `text`, relative to the app folder. */
export function findInSources(appDir: string, text: string): string | undefined {
	let seen = 0;
	const visit = (dir: string): string | undefined => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return undefined;
		}
		for (const entry of entries) {
			if (seen >= MAX_FILES) {
				return undefined;
			}
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
					const found = visit(path);
					if (found) {
						return found;
					}
				}
			} else if (SOURCE_FILE.test(entry.name)) {
				seen++;
				if (readFileSync(path, 'utf8').includes(text)) {
					return relative(appDir, path);
				}
			}
		}
		return undefined;
	};
	return visit(appDir);
}
