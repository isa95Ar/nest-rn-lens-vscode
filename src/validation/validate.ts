import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import type { DetectedApp, ValidationResult, ValidationStep } from '../shared/protocol';
import { findRootModule, isRegistered, NEST_PACKAGE } from './nest-module';
import {
	dependsOn,
	detectPackageManager,
	findTurboRoot,
	installedCopies,
	installedVersion,
	listWorkspacePackages,
	majorVersion,
	type PackageManager,
	type WorkspacePackage,
} from './workspace';

// Expo configures Metro for monorepos automatically from SDK 52.
const MIN_EXPO_SDK = 52;
const METRO_CONFIG_FILES = ['metro.config.js', 'metro.config.cjs', 'metro.config.mjs', 'metro.config.ts'];

const STEPS: Pick<ValidationStep, 'id' | 'title'>[] = [
	{ id: 'turbo', title: 'Turborepo workspace' },
	{ id: 'apps', title: 'NestJS API and React Native app' },
	{ id: 'nest-interceptor', title: '@nest-rn-lens/nest in the API' },
	{ id: 'expo', title: 'Expo SDK' },
	{ id: 'metro', title: 'Metro bundler config' },
	{ id: 'react', title: 'Single copy of React' },
	{ id: 'web', title: 'In-editor preview support' },
	{ id: 'client', title: 'App sends the calling screen' },
];

type StepOutcome = Pick<ValidationStep, 'status' | 'detail' | 'fix'>;

interface Context {
	root?: string;
	pm: PackageManager;
	nest?: WorkspacePackage;
	expo?: WorkspacePackage;
}

const CHECKS: Record<string, (ctx: Context, folders: string[]) => StepOutcome> = {
	turbo(ctx, folders) {
		ctx.root = findTurboRoot(folders);
		if (!ctx.root) {
			return { status: 'fail', detail: 'No turbo.json found in this workspace.' };
		}
		ctx.pm = detectPackageManager(ctx.root);
		const turbo = installedVersion('turbo', ctx.root, ctx.root);
		if (!turbo) {
			return {
				status: 'fail',
				detail: 'turbo.json found, but turbo is not installed.',
				fix: { label: 'Install dependencies', summary: `${ctx.pm} install`, command: `${ctx.pm} install`, cwd: ctx.root },
			};
		}
		return { status: 'pass', detail: `turbo ${turbo} · ${ctx.pm} workspaces` };
	},

	apps(ctx) {
		const packages = listWorkspacePackages(ctx.root!);
		ctx.nest = packages.find((p) => dependsOn(p.pkg, '@nestjs/core'));
		ctx.expo = packages.find((p) => dependsOn(p.pkg, 'react-native'));
		const found = [ctx.nest, ctx.expo].filter(Boolean).map((p) => `${p!.pkg.name} (${p!.relativeDir})`);

		if (!ctx.nest || !ctx.expo) {
			const missing = [!ctx.nest && 'a NestJS app', !ctx.expo && 'a React Native app'].filter(Boolean);
			return {
				status: 'fail',
				detail: `Missing ${missing.join(' and ')}.${found.length ? ` Found ${found.join(', ')}.` : ''}`,
			};
		}
		return { status: 'pass', detail: found.join(' · ') };
	},

	'nest-interceptor'(ctx) {
		const { dir, pkg, relativeDir } = ctx.nest!;
		const add = { npm: 'npm install', yarn: 'yarn add', pnpm: 'pnpm add' }[ctx.pm];
		const installAndRegister = {
			label: 'Install and register',
			summary: `${add} ${NEST_PACKAGE}, then add it to the root module`,
			command: `${add} ${NEST_PACKAGE}`,
			cwd: dir,
			edit: 'register-nest-module' as const,
		};

		if (!dependsOn(pkg, NEST_PACKAGE)) {
			return {
				status: 'fail',
				detail: 'Not installed. The Traffic tab is built from what this interceptor reports.',
				fix: installAndRegister,
			};
		}
		const version = installedVersion(NEST_PACKAGE, dir, ctx.root!);
		if (!version) {
			return {
				status: 'fail',
				detail: 'Listed in package.json but not installed.',
				fix: { ...installAndRegister, label: 'Install', summary: `${ctx.pm} install`, command: `${ctx.pm} install`, cwd: ctx.root! },
			};
		}

		const rootModule = findRootModule(dir);
		if (!rootModule) {
			return {
				status: 'fail',
				detail: "Installed, but the root module wasn't found. Add NestRnLensModule.forRoot({ app: 'api' }) to the imports of the module you pass to NestFactory.create().",
			};
		}
		const moduleFile = relative(dir, rootModule);
		if (!isRegistered(rootModule)) {
			return {
				status: 'fail',
				detail: `Installed (v${version}) but not registered in ${moduleFile}.`,
				fix: {
					label: `Add to ${basename(rootModule)}`,
					summary: `Adds NestRnLensModule.forRoot() to the imports in ${relativeDir}/${moduleFile}`,
					cwd: dir,
					edit: 'register-nest-module',
				},
			};
		}
		return { status: 'pass', detail: `v${version} · registered in ${relativeDir}/${moduleFile}` };
	},

	expo(ctx) {
		const { dir, pkg } = ctx.expo!;
		if (!dependsOn(pkg, 'expo')) {
			return { status: 'fail', detail: 'Only Expo apps are supported for now.' };
		}
		const version = installedVersion('expo', dir, ctx.root!);
		if (!version) {
			return {
				status: 'fail',
				detail: 'expo is listed but not installed.',
				fix: { label: 'Install dependencies', summary: `${ctx.pm} install`, command: `${ctx.pm} install`, cwd: ctx.root! },
			};
		}
		const sdk = majorVersion(version)!;
		if (sdk < MIN_EXPO_SDK) {
			return { status: 'fail', detail: `SDK ${sdk} found. NestRN Lens needs SDK ${MIN_EXPO_SDK}+ for monorepo support in Metro.` };
		}
		return { status: 'pass', detail: `SDK ${sdk} (expo ${version})` };
	},

	metro(ctx) {
		const { dir } = ctx.expo!;
		const file = METRO_CONFIG_FILES.find((name) => existsSync(join(dir, name)));
		if (!file) {
			return { status: 'pass', detail: "Expo's default config (monorepo-aware)" };
		}
		const source = readFileSync(join(dir, file), 'utf8');
		if (!source.includes('expo/metro-config')) {
			return {
				status: 'fail',
				detail: `${file} doesn't extend expo/metro-config, so Metro won't resolve packages from the monorepo root. Start it from getDefaultConfig(__dirname).`,
			};
		}
		return { status: 'pass', detail: `${file} extends expo/metro-config` };
	},

	react(ctx) {
		// npm workspaces can hoist a newer react/react-dom (pulled in as a peer
		// dependency) next to the version the app pins.
		for (const name of ['react', 'react-dom']) {
			const versions = installedCopies(name, ctx.expo!.dir, ctx.root!);
			if (versions.length > 1) {
				const expected = ctx.expo!.pkg.dependencies?.[name] ?? versions[0];
				return {
					status: 'fail',
					detail: `Found ${name} ${versions.join(' and ')}. Two copies break hooks. Add "overrides": { "${name}": "${expected}" } to the root package.json, then delete node_modules and reinstall.`,
				};
			}
		}
		const version = installedVersion('react', ctx.expo!.dir, ctx.root!);
		return { status: 'pass', detail: version ? `react ${version}` : 'react not installed yet' };
	},

	web(ctx) {
		const { dir } = ctx.expo!;
		const missing = ['react-dom', 'react-native-web'].filter((name) => !installedVersion(name, dir, ctx.root!));
		if (missing.length) {
			const expo = { npm: 'npx expo', yarn: 'yarn expo', pnpm: 'pnpm expo' }[ctx.pm];
			return {
				status: 'fail',
				detail: `The preview runs the app's web build inside VS Code. Missing ${missing.join(' and ')}.`,
				fix: { label: 'Install', summary: `${expo} install ${missing.join(' ')}`, command: `${expo} install ${missing.join(' ')}`, cwd: dir },
			};
		}
		return { status: 'pass', detail: 'react-native-web installed' };
	},

	client(ctx) {
		const { dir, pkg, relativeDir } = ctx.expo!;
		if (dependsOn(pkg, '@nest-rn-lens/react-native')) {
			return { status: 'pass', detail: '@nest-rn-lens/react-native' };
		}
		// Until @nest-rn-lens/react-native is published, apps can carry a local
		// copy of the fetch wrapper (the sample app does).
		const sources = ['src/isalens/isalens-fetch.ts', 'src/nest-rn-lens/fetch.ts'];
		const local = sources.find((file) => existsSync(join(dir, file)));
		if (local) {
			return { status: 'pass', detail: `Using the local fetch wrapper in ${relativeDir}/${dirname(local)}` };
		}
		return {
			status: 'warn',
			detail: 'Requests will show up, but without the screen that made them. Send the x-nest-rn-lens-* headers (see the README).',
		};
	},
};

/**
 * Checks that the workspace is a Turborepo with a NestJS API and an Expo app.
 * Calls `onUpdate` after every step so the UI can show progress.
 */
export async function validateWorkspace(
	folders: string[],
	onUpdate: (result: ValidationResult) => void,
	stepDelayMs = 0,
): Promise<ValidationResult> {
	const steps: ValidationStep[] = STEPS.map((step) => ({ ...step, status: 'pending' }));
	const ctx: Context = { pm: 'npm' };
	const emit = (phase: ValidationResult['phase']) => {
		const result: ValidationResult = {
			phase,
			root: ctx.root,
			steps: steps.map((s) => ({ ...s })),
			nest: ctx.nest && toApp('nest', ctx.nest),
			expo: ctx.expo && toApp('expo', ctx.expo),
			canStart: phase === 'done' && steps.every((s) => s.status === 'pass' || s.status === 'warn'),
		};
		onUpdate(result);
		return result;
	};

	let blocked = false;
	for (const step of steps) {
		if (blocked) {
			step.detail = 'Skipped';
			continue;
		}
		step.status = 'running';
		emit('validating');
		await delay(stepDelayMs);

		let outcome: StepOutcome;
		try {
			outcome = CHECKS[step.id](ctx, folders);
		} catch (error) {
			outcome = { status: 'fail', detail: error instanceof Error ? error.message : String(error) };
		}
		Object.assign(step, outcome);
		// Later steps need the root and both apps.
		blocked = (step.id === 'turbo' || step.id === 'apps') && outcome.status === 'fail';
	}
	return emit('done');
}

function toApp(kind: DetectedApp['kind'], { dir, pkg, relativeDir }: WorkspacePackage): DetectedApp {
	return { kind, name: pkg.name ?? relativeDir, dir, relativeDir };
}

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
