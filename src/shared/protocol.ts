// Messages between the extension host and its webviews. Types only, so both
// the Node side and the browser side can import this file.

// ---------- Validation ----------

export type StepStatus = 'pending' | 'running' | 'pass' | 'warn' | 'fail';

export interface StepFix {
	label: string;
	/** What the fix does, shown under the button. */
	summary: string;
	/** Shell command, run in a visible VS Code task. */
	command?: string;
	cwd: string;
	/** Code change to make after the command succeeds. */
	edit?: 'register-nest-module' | 'enable-cors' | 'add-client';
}

export interface ValidationStep {
	id: string;
	title: string;
	status: StepStatus;
	detail?: string;
	fix?: StepFix;
}

/** The client app a session tracks: a React Native (Expo) app or a Next.js app. */
export type ClientKind = 'expo' | 'next';

export interface DetectedApp {
	kind: 'nest' | ClientKind;
	name: string;
	dir: string;
	/** Relative to the Turborepo root, e.g. "apps/api". */
	relativeDir: string;
}

export interface ValidationResult {
	phase: 'validating' | 'done';
	root?: string;
	steps: ValidationStep[];
	nest?: DetectedApp;
	/** Every client app found, so the sidebar can offer a choice when there are two. */
	clients: Partial<Record<ClientKind, DetectedApp>>;
	/** The client app being checked and launched. */
	target?: ClientKind;
	client?: DetectedApp;
	canStart: boolean;
}

// ---------- Traffic (must match the API's NestRnLensEvent) ----------

/** A request or response body, as captured by @nest-rn-lens/nest 0.2+. */
export interface CapturedBody {
	size: number;
	value?: unknown;
	truncated?: boolean;
	preview?: string;
	summary?: string;
}

export interface NestRnLensEvent {
	id: string;
	traceId: string;
	timestamp: number;
	durationMs: number;
	source: { app: string; caller?: string; platform: string };
	target: {
		app: string;
		method: string;
		path: string;
		route: string;
		controller: string;
		handler: string;
	};
	status: number;
	error?: string;
	/** Absent with @nest-rn-lens/nest older than 0.2, or with captureBodies: false. */
	request?: {
		headers: Record<string, string>;
		query?: unknown;
		params?: unknown;
		body?: CapturedBody;
	};
	response?: { body?: CapturedBody };
}

// ---------- Session ----------

/** "app" is Metro for React Native and next dev for Next.js. */
export type ServiceName = 'api' | 'app';

export type ServiceStatus = 'idle' | 'starting' | 'running' | 'attached' | 'stopped' | 'error';

export interface ServiceState {
	status: ServiceStatus;
	detail?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogLine {
	id: number;
	service: ServiceName;
	level: LogLevel;
	text: string;
	time: number;
}

export interface SessionSnapshot {
	appKind: ClientKind;
	appName: string;
	apiName: string;
	previewUrl: string;
	services: Record<ServiceName, ServiceState>;
	logs: LogLine[];
	traffic: NestRnLensEvent[];
	/** Set when the app refuses to be shown in a frame (X-Frame-Options or CSP). */
	embedBlocked?: string;
}

// ---------- Messages ----------

export type HostToHome =
	| { type: 'validation'; result: ValidationResult }
	| { type: 'session'; running: boolean }
	| { type: 'showGuide' };

export type HomeToHost =
	| { type: 'ready' }
	| { type: 'revalidate' }
	| { type: 'start' }
	| { type: 'stop' }
	| { type: 'showPanel' }
	| { type: 'runFix'; stepId: string }
	| { type: 'setTarget'; target: ClientKind }
	| { type: 'openGuideOnline' };

export type HostToSession =
	| { type: 'init'; snapshot: SessionSnapshot }
	| { type: 'service'; service: ServiceName; state: ServiceState }
	| { type: 'logs'; lines: LogLine[] }
	| { type: 'traffic'; event: NestRnLensEvent }
	| { type: 'embed'; blocked?: string }
	| { type: 'reloadPreview' };

export type SessionToHost =
	| { type: 'ready' }
	| { type: 'openFile'; path: string; line: number }
	| { type: 'openHandler'; controller: string; handler: string }
	| { type: 'openExternal' }
	| { type: 'showGuide' }
	| { type: 'restart' }
	| { type: 'stop' };
