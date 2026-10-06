import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Finds where `Controller.handler` is defined in a Nest app's source, so a
 * Traffic row can jump to the code that answered the request.
 */
export function findHandler(appDir: string, controller: string, handler: string) {
	const classPattern = new RegExp(`class\\s+${escape(controller)}\\b`);
	const methodPattern = new RegExp(`^\\s*(?:async\\s+)?${escape(handler)}\\s*\\(`);

	for (const file of sourceFiles(join(appDir, 'src'))) {
		const lines = readFileSync(file, 'utf8').split('\n');
		const classLine = lines.findIndex((line) => classPattern.test(line));
		if (classLine === -1) {
			continue;
		}
		const methodLine = lines.findIndex((line, i) => i > classLine && methodPattern.test(line));
		return { path: file, line: (methodLine === -1 ? classLine : methodLine) + 1 };
	}
	return undefined;
}

function* sourceFiles(dir: string): Generator<string> {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory() && entry.name !== 'node_modules') {
			yield* sourceFiles(path);
		} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
			yield path;
		}
	}
}

function escape(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
