import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';

interface HtmlOptions {
	title: string;
	/** Bundle name in dist/webview, e.g. "home". */
	script: string;
	/** Stylesheets in media/. */
	styles: string[];
	/** Origins the page may embed in an iframe (the app preview). */
	frameSources?: string[];
}

export function webviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, options: HtmlOptions) {
	const nonce = randomBytes(16).toString('base64');
	const asset = (...path: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...path));
	const frames = options.frameSources?.join(' ') ?? "'none'";

	const csp = [
		"default-src 'none'",
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`font-src ${webview.cspSource}`,
		`img-src ${webview.cspSource} https: data:`,
		`script-src 'nonce-${nonce}'`,
		`frame-src ${frames}`,
	].join('; ');

	return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	${options.styles.map((file) => `<link rel="stylesheet" href="${asset('media', file)}" />`).join('\n\t')}
	<title>${options.title}</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${asset('dist', 'webview', `${options.script}.js`)}"></script>
</body>
</html>`;
}
