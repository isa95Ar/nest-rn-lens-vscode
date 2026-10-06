interface VsCodeApi<State> {
	postMessage(message: unknown): void;
	getState(): State | undefined;
	setState(state: State): State;
}

declare function acquireVsCodeApi<State>(): VsCodeApi<State>;

/**
 * Typed bridge to the extension host. `acquireVsCodeApi` may only be called
 * once per page, so each webview creates one channel at startup.
 */
export function createChannel<Incoming extends { type: string }, Outgoing, State = unknown>(
	incomingTypes: Incoming['type'][],
) {
	const api = acquireVsCodeApi<State>();
	const known = new Set<string>(incomingTypes);

	return {
		post: (message: Outgoing) => api.postMessage(message),
		listen(handler: (message: Incoming) => void) {
			// The app preview iframe can post messages too; only accept ours.
			const listener = (event: MessageEvent) => {
				if (known.has(event.data?.type)) {
					handler(event.data as Incoming);
				}
			};
			window.addEventListener('message', listener);
			return () => window.removeEventListener('message', listener);
		},
		getState: () => api.getState(),
		// VS Code's setState returns the state object. Swallow it: returned from a
		// useEffect, React would call it as the cleanup and crash the whole view.
		setState: (state: State): void => {
			api.setState(state);
		},
	};
}
