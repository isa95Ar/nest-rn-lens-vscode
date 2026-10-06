import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import type {
	DetectedApp,
	NestRnLensEvent,
	LogLevel,
	LogLine,
	ServiceName,
	ServiceState,
	SessionSnapshot,
} from '../shared/protocol';
import { readJson, type PackageJson, type PackageManager } from '../validation/workspace';
import { DevProcess } from './dev-process';
import { isMetroReady, isPortInUse, waitUntil } from './net';

const MAX_LOGS = 2000;
const MAX_TRAFFIC = 500;
const START_TIMEOUT_MS = 120_000;
// The API's reporter logs every event as "[NestRnLens] {json}" at debug level.
const NEST_RN_LENS_EVENT = /\[NestRnLens\]\s+(\{.*\})\s*$/;

export interface SessionOptions {
	root: string;
	pm: PackageManager;
	nest: DetectedApp;
	expo: DetectedApp;
	apiPort: number;
	metroPort: number;
}

interface SessionEvents {
	service: [ServiceName, ServiceState];
	logs: [LogLine[]];
	traffic: [NestRnLensEvent];
}

/**
 * Runs the NestJS API and Metro for one NestRN Lens session, keeps recent logs and
 * traffic in memory, and reports changes. Knows nothing about VS Code.
 */
export class Session extends EventEmitter<SessionEvents> {
	readonly services: Record<ServiceName, ServiceState> = {
		api: { status: 'idle' },
		metro: { status: 'idle' },
	};
	private readonly processes: Partial<Record<ServiceName, DevProcess>> = {};
	private readonly logs: LogLine[] = [];
	private readonly traffic: NestRnLensEvent[] = [];
	private pendingLogs: LogLine[] = [];
	private flushTimer?: NodeJS.Timeout;
	private nextLogId = 1;
	private abort = new AbortController();

	constructor(private readonly options: SessionOptions) {
		super();
	}

	get previewUrl() {
		return `http://localhost:${this.options.metroPort}`;
	}

	snapshot(previewUrl = this.previewUrl): SessionSnapshot {
		return {
			appName: this.options.expo.name,
			apiName: this.options.nest.name,
			previewUrl,
			services: { ...this.services },
			logs: [...this.logs],
			traffic: [...this.traffic],
		};
	}

	async start() {
		this.abort = new AbortController();
		await Promise.all([this.startApi(), this.startMetro()]);
	}

	async stop() {
		this.abort.abort();
		await Promise.all(Object.values(this.processes).map((p) => p?.stop()));
		for (const name of Object.keys(this.services) as ServiceName[]) {
			if (this.services[name].status !== 'attached') {
				this.setService(name, { status: 'stopped' });
			}
		}
		this.flushLogs();
	}

	async restart() {
		await this.stop();
		await this.start();
	}

	private startApi() {
		const { nest, pm, apiPort } = this.options;
		const scripts = readJson<PackageJson>(join(nest.dir, 'package.json'))?.scripts ?? {};
		const script = ['dev', 'start:dev', 'start'].find((name) => scripts[name]) ?? 'start';

		return this.startService('api', {
			port: apiPort,
			isReady: () => isPortInUse(apiPort),
			command: pm,
			args: ['run', script],
			cwd: nest.dir,
			// Plain text logs are easier to parse; PORT keeps API and session in sync.
			env: { NO_COLOR: '1', FORCE_COLOR: '0', PORT: String(apiPort) },
		});
	}

	private startMetro() {
		const { expo, pm, metroPort } = this.options;
		const exec = { npm: ['npx', 'expo'], yarn: ['yarn', 'expo'], pnpm: ['pnpm', 'exec', 'expo'] }[pm];

		return this.startService('metro', {
			port: metroPort,
			isReady: () => isMetroReady(metroPort),
			command: exec[0],
			args: [...exec.slice(1), 'start', '--port', String(metroPort)],
			cwd: expo.dir,
			env: { BROWSER: 'none', EXPO_NO_TELEMETRY: '1' },
		});
	}

	private async startService(
		name: ServiceName,
		opts: { port: number; isReady: () => Promise<boolean>; command: string; args: string[]; cwd: string; env: Record<string, string> },
	) {
		this.setService(name, { status: 'starting' });

		// Something is already listening (e.g. `npm run dev` in a terminal). Use it
		// instead of failing on the port, but we can't see its output.
		if (await isPortInUse(opts.port)) {
			this.setService(name, {
				status: 'attached',
				detail: `Port ${opts.port} was already in use, so NestRN Lens is using that server. Its logs show up in your terminal, not here.`,
			});
			return;
		}

		const proc = new DevProcess();
		this.processes[name] = proc;
		proc.on('line', (line) => this.onLine(name, line));
		proc.on('exit', (code) => {
			if (this.abort.signal.aborted) {
				return;
			}
			this.setService(name, { status: 'error', detail: `Exited with code ${code ?? 'unknown'}. Check the logs below.` });
		});
		this.log(name, 'info', `$ ${opts.command} ${opts.args.join(' ')}`);
		proc.start(opts);

		const ready = await waitUntil(opts.isReady, { timeoutMs: START_TIMEOUT_MS, signal: this.abort.signal });
		if (ready && proc.running) {
			this.setService(name, { status: 'running', detail: `localhost:${opts.port}` });
		} else if (proc.running && !this.abort.signal.aborted) {
			this.setService(name, { status: 'error', detail: `Not answering on port ${opts.port} after ${START_TIMEOUT_MS / 1000}s.` });
		}
	}

	private onLine(service: ServiceName, text: string) {
		if (service === 'api') {
			const json = text.match(NEST_RN_LENS_EVENT)?.[1];
			if (json) {
				try {
					this.addTraffic(JSON.parse(json) as NestRnLensEvent);
					return; // the reporter also logs a readable line, so skip the JSON one
				} catch {
					// Not an event after all; log it as text.
				}
			}
		}
		this.log(service, levelOf(text), text);
	}

	private addTraffic(event: NestRnLensEvent) {
		this.traffic.push(event);
		if (this.traffic.length > MAX_TRAFFIC) {
			this.traffic.shift();
		}
		this.emit('traffic', event);
	}

	private log(service: ServiceName, level: LogLevel, text: string) {
		const line: LogLine = { id: this.nextLogId++, service, level, text, time: Date.now() };
		this.logs.push(line);
		if (this.logs.length > MAX_LOGS) {
			this.logs.splice(0, this.logs.length - MAX_LOGS);
		}
		// Metro can print hundreds of lines at once; send them in batches.
		this.pendingLogs.push(line);
		this.flushTimer ??= setTimeout(() => this.flushLogs(), 100);
	}

	private flushLogs() {
		clearTimeout(this.flushTimer);
		this.flushTimer = undefined;
		if (this.pendingLogs.length) {
			this.emit('logs', this.pendingLogs);
			this.pendingLogs = [];
		}
	}

	private setService(name: ServiceName, state: ServiceState) {
		this.services[name] = state;
		this.emit('service', name, state);
	}
}

function levelOf(text: string): LogLevel {
	if (/\b(ERROR|Error:|error:|ERR!|failed)\b/.test(text)) {
		return 'error';
	}
	if (/\b(WARN|warn|Warning)\b/.test(text)) {
		return 'warn';
	}
	if (/\b(DEBUG|VERBOSE)\b/.test(text)) {
		return 'debug';
	}
	return 'info';
}
