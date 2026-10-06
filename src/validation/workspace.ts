import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export interface PackageJson {
	name?: string;
	version?: string;
	main?: string;
	workspaces?: string[] | { packages?: string[] };
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

export interface WorkspacePackage {
	dir: string;
	relativeDir: string;
	pkg: PackageJson;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'ios', 'android']);

export function readJson<T>(file: string): T | undefined {
	try {
		return JSON.parse(readFileSync(file, 'utf8')) as T;
	} catch {
		return undefined;
	}
}

/** Finds the Turborepo root: a workspace folder, or a folder up to two levels below it. */
export function findTurboRoot(folders: string[], maxDepth = 2): string | undefined {
	let level = folders;
	for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
		const found = level.find((dir) => existsSync(join(dir, 'turbo.json')));
		if (found) {
			return found;
		}
		level = level.flatMap(subdirectories);
	}
	return undefined;
}

export function detectPackageManager(root: string): PackageManager {
	if (existsSync(join(root, 'pnpm-lock.yaml'))) {
		return 'pnpm';
	}
	if (existsSync(join(root, 'yarn.lock'))) {
		return 'yarn';
	}
	return 'npm';
}

/** Workspace globs from package.json "workspaces" or pnpm-workspace.yaml. */
export function workspacePatterns(root: string): string[] {
	const pkg = readJson<PackageJson>(join(root, 'package.json'));
	const workspaces = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
	if (workspaces?.length) {
		return workspaces;
	}

	const pnpmFile = join(root, 'pnpm-workspace.yaml');
	if (!existsSync(pnpmFile)) {
		return [];
	}
	return readFileSync(pnpmFile, 'utf8')
		.split('\n')
		.map((line) => line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/)?.[1])
		.filter((pattern): pattern is string => !!pattern);
}

/** Expands simple workspace globs ("apps/*", "packages/**", "tools/cli"). */
export function listWorkspacePackages(root: string): WorkspacePackage[] {
	const dirs = new Set<string>();
	for (const pattern of workspacePatterns(root)) {
		if (pattern.startsWith('!')) {
			continue;
		}
		const base = join(root, pattern.replace(/\/\*\*?$/, ''));
		if (pattern.endsWith('/**')) {
			subdirectories(base).forEach((dir) => {
				dirs.add(dir);
				subdirectories(dir).forEach((nested) => dirs.add(nested));
			});
		} else if (pattern.endsWith('/*')) {
			subdirectories(base).forEach((dir) => dirs.add(dir));
		} else {
			dirs.add(base);
		}
	}

	return [...dirs]
		.map((dir) => ({ dir, pkg: readJson<PackageJson>(join(dir, 'package.json')) }))
		.filter((entry): entry is { dir: string; pkg: PackageJson } => !!entry.pkg)
		.map(({ dir, pkg }) => ({ dir, pkg, relativeDir: relative(root, dir) }))
		.sort((a, b) => a.relativeDir.localeCompare(b.relativeDir));
}

export function dependsOn(pkg: PackageJson, name: string): boolean {
	return !!(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
}

/** Version of `name` that Node would resolve from `fromDir`, walking up to `root`. */
export function installedVersion(name: string, fromDir: string, root: string): string | undefined {
	let dir = fromDir;
	while (true) {
		const pkg = readJson<PackageJson>(join(dir, 'node_modules', name, 'package.json'));
		if (pkg?.version) {
			return pkg.version;
		}
		if (dir === root || dirname(dir) === dir) {
			return undefined;
		}
		dir = dirname(dir);
	}
}

/** Every installed copy of `name` between `fromDir` and `root` (an app should see only one). */
export function installedCopies(name: string, fromDir: string, root: string): string[] {
	const versions = new Set<string>();
	let dir = fromDir;
	while (true) {
		const pkg = readJson<PackageJson>(join(dir, 'node_modules', name, 'package.json'));
		if (pkg?.version) {
			versions.add(pkg.version);
		}
		if (dir === root || dirname(dir) === dir) {
			return [...versions];
		}
		dir = dirname(dir);
	}
}

export function majorVersion(version: string | undefined): number | undefined {
	const major = version?.match(/(\d+)/)?.[1];
	return major ? Number(major) : undefined;
}

function subdirectories(dir: string): string[] {
	try {
		return readdirSync(dir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name))
			.map((entry) => join(dir, entry.name));
	} catch {
		return [];
	}
}
