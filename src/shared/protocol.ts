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
	edit?: 'register-nest-module';
}

export interface ValidationStep {
	id: string;
	title: string;
	status: StepStatus;
	detail?: string;
	fix?: StepFix;
}

export interface DetectedApp {
	kind: 'nest' | 'expo';
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
	expo?: DetectedApp;
	canStart: boolean;
}

// ---------- Traffic (must match the API's NestRnLensEvent) ----------

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
}

// ---------- Session ----------

export type ServiceName = 'api' | 'metro';

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
	appName: string;
	apiName: string;
	previewUrl: string;
	services: Record<ServiceName, ServiceState>;
	logs: LogLine[];
	traffic: NestRnLensEvent[];
}

// ---------- Messages ----------

export type HostToHome =
	| { type: 'validation'; result: ValidationResult }
	| { type: 'session'; running: boolean };

export type HomeToHost =
	| { type: 'ready' }
	| { type: 'revalidate' }
	| { type: 'start' }
	| { type: 'stop' }
	| { type: 'showPanel' }
	| { type: 'runFix'; stepId: string };

export type HostToSession =
	| { type: 'init'; snapshot: SessionSnapshot }
	| { type: 'service'; service: ServiceName; state: ServiceState }
	| { type: 'logs'; lines: LogLine[] }
	| { type: 'traffic'; event: NestRnLensEvent }
	| { type: 'reloadPreview' };

export type SessionToHost =
	| { type: 'ready' }
	| { type: 'openFile'; path: string; line: number }
	| { type: 'openHandler'; controller: string; handler: string }
	| { type: 'openExternal' }
	| { type: 'restart' }
	| { type: 'stop' };
