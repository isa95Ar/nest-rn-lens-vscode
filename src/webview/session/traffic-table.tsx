import type { NestRnLensEvent, ServiceState } from '../../shared/protocol';
import { ActivityIcon, ArrowRightIcon, CodeIcon } from '../components/icons';
import { channel } from './use-session';

interface TrafficTableProps {
	traffic: NestRnLensEvent[];
	filter: string;
	apiState: ServiceState;
}

export function TrafficTable({ traffic, filter, apiState }: TrafficTableProps) {
	const query = filter.trim().toLowerCase();
	const rows = traffic
		.filter((e) => !query || searchText(e).includes(query))
		.reverse(); // newest first

	if (traffic.length === 0) {
		return (
			<div className="empty">
				<span className="empty__icon">
					<ActivityIcon size={20} />
				</span>
				{apiState.status === 'attached' ? (
					<>
						<strong>The API was already running</strong>
						<p>NestRN Lens can only read traffic from an API it started. Stop the one in your terminal, then restart the session.</p>
					</>
				) : (
					<>
						<strong>No requests yet</strong>
						<p>Use the app. Every API call shows up here with the screen that made it and the handler that answered.</p>
					</>
				)}
			</div>
		);
	}

	return (
		<div className="traffic" role="table" aria-label="API traffic">
			<div className="traffic__row traffic__row--head" role="row">
				<span role="columnheader">Time</span>
				<span role="columnheader">Method</span>
				<span role="columnheader">Route</span>
				<span role="columnheader">Status</span>
				<span role="columnheader">Duration</span>
				<span role="columnheader">From</span>
				<span role="columnheader">Handled by</span>
			</div>
			{rows.map((event) => (
				<TrafficRow key={event.id} event={event} />
			))}
			{rows.length === 0 && <p className="traffic__none">No requests match “{filter}”.</p>}
		</div>
	);
}

function TrafficRow({ event }: { event: NestRnLensEvent }) {
	const { source, target } = event;
	const caller = source.caller ? parseCaller(source.caller) : undefined;

	return (
		<div className="traffic__row" role="row" title={event.error}>
			<span className="mono muted">{formatTime(event.timestamp)}</span>
			<span>
				<span className={`method method--${target.method.toLowerCase()}`}>{target.method}</span>
			</span>
			<span className="traffic__route" title={target.path}>
				<span className="mono">{target.route}</span>
				{target.path !== target.route && <span className="mono muted traffic__path">{target.path}</span>}
			</span>
			<span>
				<span className={`status status--${Math.floor(event.status / 100)}xx`}>{event.status}</span>
			</span>
			<span className={`mono duration duration--${speed(event.durationMs)}`}>{event.durationMs}ms</span>
			<span className="traffic__source">
				<span className="platform">{source.app} · {source.platform}</span>
				{caller ? (
					<button
						className="code-link"
						title={`Open ${source.caller}`}
						onClick={() => channel.post({ type: 'openFile', path: caller.path, line: caller.line })}
					>
						<CodeIcon size={11} /> {caller.short}
					</button>
				) : (
					<span className="muted small">unknown screen</span>
				)}
			</span>
			<span className="traffic__handler">
				<ArrowRightIcon size={11} className="muted" />
				<button
					className="code-link"
					title={`Open ${target.controller}.${target.handler}`}
					onClick={() => channel.post({ type: 'openHandler', controller: target.controller, handler: target.handler })}
				>
					<span>
						{target.controller}.<strong>{target.handler}</strong>
					</span>
				</button>
			</span>
		</div>
	);
}

function parseCaller(caller: string) {
	const match = caller.match(/^(.*):(\d+)$/);
	const path = match?.[1] ?? caller;
	const line = Number(match?.[2] ?? 1);
	// "…/src/screens/pokemon-detail/index.tsx" → "pokemon-detail/index.tsx:23"
	const short = `${path.split('/').slice(-2).join('/')}:${line}`;
	return { path, line, short };
}

function searchText(event: NestRnLensEvent) {
	const { source, target } = event;
	return [target.method, target.route, target.path, event.status, source.caller, source.app, target.controller, target.handler]
		.join(' ')
		.toLowerCase();
}

function speed(ms: number) {
	return ms < 100 ? 'fast' : ms < 500 ? 'ok' : 'slow';
}

function formatTime(timestamp: number) {
	return new Date(timestamp).toLocaleTimeString([], { hour12: false });
}
