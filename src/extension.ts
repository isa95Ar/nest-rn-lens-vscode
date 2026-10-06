import { basename } from 'node:path';
import * as vscode from 'vscode';
import { HomeViewProvider } from './home-view';
import { Session } from './session/session';
import { SessionPanel } from './session/session-panel';
import type { ClientKind, HomeToHost, StepFix, ValidationResult } from './shared/protocol';
import { addClient, enableCors, type EditResult } from './validation/app-fixes';
import { registerNestModule } from './validation/nest-module';
import { validateWorkspace } from './validation/validate';
import { detectPackageManager } from './validation/workspace';

// Short pause per step so the checklist animates instead of flashing.
const STEP_DELAY_MS = 180;
const TARGET_KEY = 'nestRnLens.target';
const GUIDE_URL = 'https://github.com/isa95Ar/nest-rn-lens-vscode#integrate-your-app-step-by-step';

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
			vscode.commands.registerCommand('nestRnLens.showGuide', () => this.showGuide()),
			vscode.workspace.onDidChangeWorkspaceFolders(() => this.validate()),
			this,
		);
	}

	validate(): Promise<ValidationResult> {
		const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
		const config = vscode.workspace.getConfiguration('nestRnLens');
		this.validating = validateWorkspace(
			folders,
			(result) => {
				this.validation = result;
				this.home.post({ type: 'validation', result });
			},
			{
				target: this.context.workspaceState.get<ClientKind>(TARGET_KEY),
				apiPort: config.get('apiPort', 3000),
				webPort: config.get('webPort', 3001),
				stepDelayMs: STEP_DELAY_MS,
			},
		).finally(() => (this.validating = undefined));
		return this.validating;
	}

	/** Which app to track when the monorepo has both a React Native and a Next.js app. */
	private async setTarget(target: ClientKind) {
		await this.context.workspaceState.update(TARGET_KEY, target);
		await this.validate();
	}

	async start() {
		if (this.panel) {
			this.panel.reveal();
			return;
		}
		const result = this.validation?.phase === 'done' ? this.validation : await (this.validating ?? this.validate());
		if (!result.canStart || !result.root || !result.nest || !result.client) {
			this.home.reveal();
			void vscode.window.showWarningMessage('NestRN Lens: fix the failed checks before launching.');
			return;
		}

		const config = vscode.workspace.getConfiguration('nestRnLens');
		const session = new Session({
			root: result.root,
			pm: detectPackageManager(result.root),
			nest: result.nest,
			client: result.client,
			apiPort: config.get('apiPort', 3000),
			metroPort: config.get('metroPort', 8081),
			webPort: config.get('webPort', 3001),
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

	/** The setup guide lives in the sidebar. */
	showGuide() {
		this.home.reveal();
		this.home.post({ type: 'showGuide' });
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
			case 'setTarget':
				if (!this.session) {
					void this.setTarget(message.target);
				}
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
			case 'openGuideOnline':
				void vscode.env.openExternal(vscode.Uri.parse(GUIDE_URL));
				break;
		}
	}

	private applyEdit(edit: NonNullable<StepFix['edit']>): EditResult | undefined {
		const { nest, client, target } = this.validation ?? {};
		switch (edit) {
			case 'register-nest-module':
				return nest && registerNestModule(nest.dir, basename(nest.dir));
			case 'enable-cors':
				return nest && enableCors(nest.dir);
			case 'add-client':
				return (
					client &&
					target &&
					addClient({
						kind: target,
						appDir: client.dir,
						appName: basename(client.dir),
						apiPort: vscode.workspace.getConfiguration('nestRnLens').get('apiPort', 3000),
					})
				);
		}
	}

	/**
	 * Runs a step's fix: its command in a visible task, then its code edit,
	 * then re-checks the workspace.
	 */
	private async runFix(stepId: string) {
		const fix = this.validation?.steps.find((s) => s.id === stepId)?.fix;
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

		const result = fix.edit && this.applyEdit(fix.edit);
		if (result?.ok) {
			// Show the change instead of editing silently.
			const position = new vscode.Position(result.line - 1, 0);
			await vscode.window.showTextDocument(vscode.Uri.file(result.file), {
				selection: new vscode.Range(position, position),
				preview: false,
			});
		} else if (result) {
			void vscode.window.showWarningMessage(`NestRN Lens: ${result.reason}`);
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
