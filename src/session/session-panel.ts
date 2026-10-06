import * as vscode from 'vscode';
import type {
	HostToSession,
	NestRnLensEvent,
	LogLine,
	ServiceName,
	ServiceState,
	SessionToHost,
} from '../shared/protocol';
import { webviewHtml } from '../webview-html';
import { findHandler } from './find-handler';
import type { Session } from './session';

/** Editor panel with the app preview on top and logs below. */
export class SessionPanel {
	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];
	private previewUrl?: string;

	constructor(
		private readonly session: Session,
		private readonly nestDir: string,
		private readonly extensionUri: vscode.Uri,
		private readonly onClosed: () => void,
	) {
		this.panel = vscode.window.createWebviewPanel('nestRnLens.session', `NestRN Lens · ${session.snapshot().appName}`, vscode.ViewColumn.Active, {
			enableScripts: true,
			// Keeps logs and the running app alive when the tab is in the background.
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media'), vscode.Uri.joinPath(extensionUri, 'dist')],
		});
		this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'nest-rn-lens.svg');

		this.panel.webview.onDidReceiveMessage((message: SessionToHost) => this.onMessage(message), null, this.disposables);
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

		const onService = (service: ServiceName, state: ServiceState) => this.post({ type: 'service', service, state });
		const onLogs = (lines: LogLine[]) => this.post({ type: 'logs', lines });
		const onTraffic = (event: NestRnLensEvent) => this.post({ type: 'traffic', event });
		session.on('service', onService);
		session.on('logs', onLogs);
		session.on('traffic', onTraffic);
		this.disposables.push({
			dispose: () => {
				session.off('service', onService);
				session.off('logs', onLogs);
				session.off('traffic', onTraffic);
			},
		});

		void this.render();
	}

	reveal() {
		this.panel.reveal();
	}

	dispose() {
		this.disposables.forEach((d) => d.dispose());
		this.disposables.length = 0;
		this.onClosed();
	}

	close() {
		this.panel.dispose();
	}

	private async render() {
		// Maps localhost to a reachable URL in remote setups (SSH, Codespaces).
		const external = await vscode.env.asExternalUri(vscode.Uri.parse(this.session.previewUrl));
		this.previewUrl = external.toString(true).replace(/\/$/, '');
		const origin = new URL(this.previewUrl).origin;

		this.panel.webview.html = webviewHtml(this.panel.webview, this.extensionUri, {
			title: 'NestRN Lens session',
			script: 'session',
			styles: ['base.css', 'session.css'],
			frameSources: [origin, 'http://localhost:*', 'http://127.0.0.1:*'],
		});
	}

	private async onMessage(message: SessionToHost) {
		switch (message.type) {
			case 'ready':
				this.post({ type: 'init', snapshot: this.session.snapshot(this.previewUrl) });
				break;
			case 'openFile':
				await openAt(message.path, message.line);
				break;
			case 'openHandler': {
				const location = findHandler(this.nestDir, message.controller, message.handler);
				if (location) {
					await openAt(location.path, location.line);
				} else {
					void vscode.window.showWarningMessage(`Couldn't find ${message.controller}.${message.handler} in the API source.`);
				}
				break;
			}
			case 'openExternal':
				await vscode.env.openExternal(vscode.Uri.parse(this.session.previewUrl));
				break;
			case 'restart':
				await this.session.restart();
				this.post({ type: 'reloadPreview' });
				break;
			case 'stop':
				this.close();
				break;
		}
	}

	private post(message: HostToSession) {
		void this.panel.webview.postMessage(message);
	}
}

async function openAt(path: string, line: number) {
	const position = new vscode.Position(Math.max(0, line - 1), 0);
	await vscode.window.showTextDocument(vscode.Uri.file(path), {
		selection: new vscode.Range(position, position),
		viewColumn: vscode.ViewColumn.Beside,
		preview: false,
	});
}
