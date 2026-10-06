import * as vscode from 'vscode';
import type { HomeToHost, HostToHome } from './shared/protocol';
import { webviewHtml } from './webview-html';

/** The sidebar view: workspace validation and the Launch button. */
export class HomeViewProvider implements vscode.WebviewViewProvider {
	static readonly viewId = 'nestRnLens.home';
	private view?: vscode.WebviewView;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly onMessage: (message: HomeToHost) => void,
	) {}

	resolveWebviewView(view: vscode.WebviewView) {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media'), vscode.Uri.joinPath(this.extensionUri, 'dist')],
		};
		view.webview.html = webviewHtml(view.webview, this.extensionUri, {
			title: 'NestRN Lens',
			script: 'home',
			styles: ['base.css', 'home.css'],
		});
		view.webview.onDidReceiveMessage(this.onMessage);
		view.onDidDispose(() => (this.view = undefined));
	}

	post(message: HostToHome) {
		void this.view?.webview.postMessage(message);
	}

	reveal() {
		void vscode.commands.executeCommand(`${HomeViewProvider.viewId}.focus`);
	}
}
