import type { NestRnLensEvent, ServiceState } from '../../shared/protocol';
import { ActivityIcon, ArrowRightIcon, BrowserIcon, CodeIcon } from '../components/icons';
import { channel } from './use-session';

interface TrafficTableProps {
	traffic: NestRnLensEvent[];
	filter: string;
	apiState: ServiceState;
	selectedId?: string;
	onSelect: (id: string) => void;
}

export function TrafficTable({ traffic, filter, apiState, selectedId, onSelect }: TrafficTableProps) {
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
		// With a row selected, the details pane takes the right side: keep only the key columns.
		<div className={`traffic${selectedId ? ' traffic--compact' : ''}`} role="table" aria-label="API traffic">
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
				<TrafficRow key={event.id} event={event} selected={event.id === selectedId} onSelect={onSelect} />
			))}
			{rows.length === 0 && <p className="traffic__none">No requests match “{filter}”.</p>}
		</div>
	);
}

function TrafficRow({
	event,
	selected,
	onSelect,
}: {
	event: NestRnLensEvent;
	selected: boolean;
	onSelect: (id: string) => void;
}) {
	const { source, target } = event;
	const caller = source.caller ? parseCaller(source.caller) : undefined;

	return (
		<div
			className="traffic__row traffic__row--clickable"
			role="row"
			aria-selected={selected}
			tabIndex={0}
			title={event.error}
			onClick={() => onSelect(event.id)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onSelect(event.id);
				}
			}}
		>
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
				{caller?.kind === 'file' ? (
					<button
						className="code-link"
						title={`Open ${source.caller}`}
						onClick={(e) => {
							e.stopPropagation(); // open the file, don't select the row
							channel.post({ type: 'openFile', path: caller.path, line: caller.line });
						}}
					>
						<CodeIcon size={11} /> {caller.short}
					</button>
				) : caller?.kind === 'page' ? (
					<span className="page-ref" title={`Page ${caller.path}`}>
						<BrowserIcon size={11} /> {caller.path}
					</span>
				) : (
					<span className="muted small">unknown screen</span>
				)}
			</span>
			<span className="traffic__handler">
				<ArrowRightIcon size={11} className="muted" />
				<button
					className="code-link"
					title={`Open ${target.controller}.${target.handler}`}
					onClick={(e) => {
						e.stopPropagation();
						channel.post({ type: 'openHandler', controller: target.controller, handler: target.handler });
					}}
				>
					<span>
						{target.controller}.<strong>{target.handler}</strong>
					</span>
				</button>
			</span>
		</div>
	);
}

/**
 * A caller is either a source location from React Native ("/…/screens/list.tsx:23",
 * opens in the editor) or the page a web app was on ("/pokemon/25").
 */
function parseCaller(caller: string) {
	const match = caller.match(/^(.*):(\d+)$/);
	if (!match) {
		return { kind: 'page' as const, path: caller };
	}
	const [, path, line] = match;
	// "…/src/screens/pokemon-detail/index.tsx" → "pokemon-detail/index.tsx:23"
	const short = `${path.split('/').slice(-2).join('/')}:${line}`;
	return { kind: 'file' as const, path, line: Number(line), short };
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
