import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const IS_WINDOWS = process.platform === 'win32';

export interface DevProcessOptions {
	command: string;
	args: string[];
	cwd: string;
	env?: Record<string, string>;
}

/**
 * A long-running dev server (nest --watch, expo start). Emits each output line
 * without colors, and kills the whole process tree on stop, since npm/npx
 * spawn the real server as a child.
 */
export class DevProcess extends EventEmitter<{ line: [string]; exit: [number | null] }> {
	private child?: ChildProcess;

	start({ command, args, cwd, env }: DevProcessOptions) {
		this.child = spawn(command, args, {
			cwd,
			env: { ...process.env, ...env },
			// Own process group on macOS/Linux, so stop() can kill its children too.
			detached: !IS_WINDOWS,
			shell: IS_WINDOWS,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		this.pipe(this.child.stdout);
		this.pipe(this.child.stderr);
		this.child.on('error', (error) => this.emit('line', `Failed to start ${command}: ${error.message}`));
		this.child.on('exit', (code) => this.emit('exit', code));
	}

	get running() {
		return !!this.child && this.child.exitCode === null && this.child.signalCode === null;
	}

	stop(): Promise<void> {
		const child = this.child;
		if (!child?.pid || !this.running) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			const force = setTimeout(() => this.kill(child.pid!, 'SIGKILL'), 3000);
			child.once('exit', () => {
				clearTimeout(force);
				resolve();
			});
			this.kill(child.pid!, 'SIGTERM');
		});
	}

	private kill(pid: number, signal: NodeJS.Signals) {
		try {
			if (IS_WINDOWS) {
				spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
			} else {
				process.kill(-pid, signal);
			}
		} catch {
			// Already gone.
		}
	}

	private pipe(stream: NodeJS.ReadableStream | null) {
		let buffer = '';
		stream?.setEncoding('utf8');
		stream?.on('data', (chunk: string) => {
			buffer += chunk;
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				const clean = line.replace(ANSI, '').trimEnd();
				if (clean) {
					this.emit('line', clean);
				}
			}
		});
	}
}
