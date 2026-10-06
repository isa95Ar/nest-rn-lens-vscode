//@ts-check
'use strict';

const path = require('path');

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const tsRule = (configFile) => ({
	test: /\.tsx?$/,
	exclude: /node_modules/,
	use: [{ loader: 'ts-loader', options: { configFile } }],
});

/** Runs in VS Code's Node extension host: validation, processes, panels. */
/** @type WebpackConfig */
const extensionConfig = {
	mode: 'none',
	target: 'node',
	entry: { extension: './src/extension.ts' },
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'dist'),
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: '../[resource-path]',
	},
	resolve: { extensions: ['.ts', '.js'] },
	module: { rules: [tsRule(path.join(__dirname, 'tsconfig.json'))] },
	externals: { vscode: 'commonjs vscode' },
	devtool: 'nosources-source-map',
	infrastructureLogging: { level: 'log' },
};

/** Runs inside the webviews (a browser): the React UIs. */
/** @type WebpackConfig */
const webviewConfig = {
	mode: 'none',
	target: 'web',
	entry: {
		home: './src/webview/home/main.tsx',
		session: './src/webview/session/main.tsx',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'dist', 'webview'),
	},
	resolve: { extensions: ['.tsx', '.ts', '.js'] },
	module: { rules: [tsRule(path.join(__dirname, 'src', 'webview', 'tsconfig.json'))] },
	performance: { hints: false },
	devtool: 'nosources-source-map',
};

module.exports = (_env, argv) => {
	// React needs NODE_ENV to pick its dev or production build.
	const mode = argv.mode ?? 'development';
	webviewConfig.plugins = [
		new (require('webpack').DefinePlugin)({ 'process.env.NODE_ENV': JSON.stringify(mode) }),
	];
	return [extensionConfig, webviewConfig];
};
