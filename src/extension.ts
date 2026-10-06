import { basename } from 'node:path';
import * as vscode from 'vscode';
import { HomeViewProvider } from './home-view';
import { Session } from './session/session';
import { SessionPanel } from './session/session-panel';
import type { HomeToHost, ValidationResult } from './shared/protocol';
import { registerNestModule } from './validation/nest-module';
import { validateWorkspace } from './validation/validate';
import { detectPackageManager } from './validation/workspace';

// Short pause per step so the checklist animates instead of flashing.
const STEP_DELAY_MS = 180;

class NestRnLens implements vscode.Disposable {
	private readonly home: HomeViewProvider;
	private validation?: ValidationResult;
	private validating?: Promise<ValidationResult>;
	private session?: Session;
	private panel?: SessionPanel;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.home = new HomeViewProvider(context.extensionUri, (message) => this.onHomeMessage(message));

		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(HomeViewProvider.viewId, this.home, {
				webviewOptions: { retainContextWhenHidden: true },
			}),
			vscode.commands.registerCommand('nestRnLens.revalidate', () => this.validate()),
			vscode.commands.registerCommand('nestRnLens.start', () => this.start()),
			vscode.commands.registerCommand('nestRnLens.stop', () => this.stop()),
			vscode.workspace.onDidChangeWorkspaceFolders(() => this.validate()),
			this,
		);
	}

	validate(): Promise<ValidationResult> {
		const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
		this.validating = validateWorkspace(
			folders,
			(result) => {
				this.validation = result;
				this.home.post({ type: 'validation', result });
			},
			STEP_DELAY_MS,
		).finally(() => (this.validating = undefined));
		return this.validating;
	}

	async start() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}
		const result = this.validation?.phase === 'done' ? this.validation : await (this.validating ?? this.validate());
		if (!result.canStart || !result.root || !result.nest || !result.expo) {
			this.home.reveal();
			void vscode.window.showWarningMessage('NestRN Lens: fix the failed checks before launching.');
			return;
		}

		const config = vscode.workspace.getConfiguration('nestRnLens');
		const session = new Session({
			root: result.root,
			pm: detectPackageManager(result.root),
			nest: result.nest,
			expo: result.expo,
			apiPort: config.get('apiPort', 3000),
			metroPort: config.get('metroPort', 8081),
		});
		this.session = session;
		this.panel = new SessionPanel(session, result.nest.dir, this.context.extensionUri, () => {
			// Closing the panel ends the session; nothing keeps running unseen.
			this.panel = undefined;
			this.session = undefined;
			void session.stop();
			this.home.post({ type: 'session', running: false });
		});
		this.home.post({ type: 'session', running: true });
		void session.start();
	}

	stop() {
		this.panel?.close();
	}

	dispose() {
		void this.session?.stop();
	}

	private onHomeMessage(message: HomeToHost) {
		switch (message.type) {
			case 'ready':
				this.home.post({ type: 'session', running: !!this.session });
				if (this.validation) {
					this.home.post({ type: 'validation', result: this.validation });
				} else {
					void this.validate();
				}
				break;
			case 'revalidate':
				void this.validate();
				break;
			case 'start':
				void this.start();
				break;
			case 'stop':
				this.stop();
				break;
			case 'showPanel':
				this.panel?.reveal();
				break;
			case 'runFix':
				void this.runFix(message.stepId);
				break;
		}
	}

	/**
	 * Runs a step's fix: its command in a visible task, then its code edit,
	 * then re-checks the workspace.
	 */
	private async runFix(stepId: string) {
		const fix = this.validation?.steps.find((s) => s.id === stepId)?.fix;
		const nest = this.validation?.nest;
		if (!fix) {
			return;
		}

		if (fix.command) {
			const exitCode = await runTask(fix.label, fix.command, fix.cwd);
			if (exitCode !== 0) {
				void vscode.window.showErrorMessage(
					`NestRN Lens: "${fix.command}" failed${exitCode === undefined ? '' : ` (exit code ${exitCode})`}. See the terminal for details.`,
				);
				await this.validate();
				return;
			}
		}

		if (fix.edit === 'register-nest-module' && nest) {
			const result = registerNestModule(nest.dir, basename(nest.dir));
			if (result.ok) {
				// Show the change instead of editing silently.
				const position = new vscode.Position(result.line - 1, 0);
				await vscode.window.showTextDocument(vscode.Uri.file(result.file), {
					selection: new vscode.Range(position, position),
					preview: false,
				});
			} else {
				void vscode.window.showWarningMessage(`NestRN Lens: ${result.reason}`);
			}
		}
		await this.validate();
	}
}

/** Runs a shell command in a visible terminal task. Resolves with its exit code. */
function runTask(name: string, command: string, cwd: string): Promise<number | undefined> {
	const task = new vscode.Task({ type: 'nestRnLens' }, vscode.TaskScope.Workspace, name, 'NestRN Lens', new vscode.ShellExecution(command, { cwd }));
	return new Promise((resolve) => {
		// Subscribed before starting, so a very fast command can't finish unseen.
		const listener = vscode.tasks.onDidEndTaskProcess((event) => {
			const ended = event.execution.task;
			if (ended.source === task.source && ended.name === task.name) {
				listener.dispose();
				resolve(event.exitCode);
			}
		});
		vscode.tasks.executeTask(task).then(undefined, () => {
			listener.dispose();
			resolve(undefined);
		});
	});
}

export function activate(context: vscode.ExtensionContext) {
	new NestRnLens(context);
}

export function deactivate() {}
