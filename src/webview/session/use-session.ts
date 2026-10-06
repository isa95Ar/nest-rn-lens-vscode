import { useEffect, useReducer } from 'react';
import type { ClientKind, HostToSession, SessionSnapshot, SessionToHost } from '../../shared/protocol';
import { createChannel } from '../vscode';
import type { Zoom } from './zoom-controls';

const MAX_LOGS = 2000;
const MAX_TRAFFIC = 500;

export interface PersistedState {
	dockHeight?: number;
	tab?: DockTab;
	/** Phone preview zoom (React Native). */
	zoom?: Zoom;
	/** Browser preview zoom (Next.js). */
	browserZoom?: Zoom;
	device?: BrowserDevice;
}

export type DockTab = 'traffic' | 'api' | 'app';

export type BrowserDevice = 'desktop' | 'tablet' | 'mobile';

/** Name of the client app's dev server. */
export function appLabel(kind: ClientKind) {
	return kind === 'next' ? 'Next.js' : 'Metro';
}

export const channel = createChannel<HostToSession, SessionToHost, PersistedState>([
	'init',
	'service',
	'logs',
	'traffic',
	'embed',
	'reloadPreview',
]);

export interface SessionState extends SessionSnapshot {
	ready: boolean;
	/** Bumped to reload the preview iframe. */
	previewKey: number;
}

const initial: SessionState = {
	ready: false,
	previewKey: 0,
	appKind: 'expo',
	appName: '',
	apiName: '',
	previewUrl: '',
	services: { api: { status: 'idle' }, app: { status: 'idle' } },
	logs: [],
	traffic: [],
};

type Action = HostToSession | { type: 'clear'; tab: DockTab } | { type: 'reloadPreview' };

function reducer(state: SessionState, action: Action): SessionState {
	switch (action.type) {
		case 'init':
			return { ...state, ...action.snapshot, ready: true };
		case 'service':
			return { ...state, services: { ...state.services, [action.service]: action.state } };
		case 'logs':
			return { ...state, logs: [...state.logs, ...action.lines].slice(-MAX_LOGS) };
		case 'traffic':
			return { ...state, traffic: [...state.traffic, action.event].slice(-MAX_TRAFFIC) };
		case 'embed':
			return { ...state, embedBlocked: action.blocked };
		case 'reloadPreview':
			return { ...state, previewKey: state.previewKey + 1 };
		case 'clear':
			return action.tab === 'traffic'
				? { ...state, traffic: [] }
				: { ...state, logs: state.logs.filter((line) => line.service !== action.tab) };
	}
}

export function useSession() {
	const [state, dispatch] = useReducer(reducer, initial);

	useEffect(() => {
		const stop = channel.listen(dispatch);
		channel.post({ type: 'ready' });
		return stop;
	}, []);

	return { state, dispatch };
}
