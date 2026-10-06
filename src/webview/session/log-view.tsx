import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LogLine, ServiceName, ServiceState } from '../../shared/protocol';
import { ArrowDownIcon, TerminalIcon } from '../components/icons';

// Rendering more lines than this gets slow; older ones stay in memory.
const MAX_RENDERED = 1000;

interface LogViewProps {
	lines: LogLine[];
	service: ServiceName;
	filter: string;
	serviceState: ServiceState;
}

export function LogView({ lines, service, filter, serviceState }: LogViewProps) {
	const scroller = useRef<HTMLDivElement>(null);
	const [follow, setFollow] = useState(true);
	const query = filter.trim().toLowerCase();
	const visible = lines
		.filter((line) => line.service === service && (!query || line.text.toLowerCase().includes(query)))
		.slice(-MAX_RENDERED);

	// Stick to the bottom while following, like a terminal.
	useLayoutEffect(() => {
		if (follow && scroller.current) {
			scroller.current.scrollTop = scroller.current.scrollHeight;
		}
	}, [visible.length, follow]);

	useEffect(() => {
		setFollow(true);
	}, [service]);

	const onScroll = () => {
		const el = scroller.current!;
		setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
	};

	if (visible.length === 0) {
		return (
			<div className="empty">
				<span className="empty__icon">
					<TerminalIcon size={20} />
				</span>
				<strong>{query ? 'No matching lines' : 'No output yet'}</strong>
				<p>{serviceState.status === 'attached' ? serviceState.detail : 'Logs appear here as soon as the process prints something.'}</p>
			</div>
		);
	}

	return (
		<div className="logs-wrap">
			<div className="logs" ref={scroller} onScroll={onScroll}>
				{visible.map((line) => (
					<div key={line.id} className={`log log--${line.level}`}>
						<span className="log__time">{new Date(line.time).toLocaleTimeString([], { hour12: false })}</span>
						<span className="log__text">{line.text}</span>
					</div>
				))}
			</div>
			{!follow && (
				<button className="follow-button" onClick={() => setFollow(true)}>
					<ArrowDownIcon size={12} /> Latest
				</button>
			)}
		</div>
	);
}
