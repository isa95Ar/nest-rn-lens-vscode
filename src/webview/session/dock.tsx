import { useState } from 'react';
import { ActivityIcon, SearchIcon, ServerIcon, TerminalIcon, TrashIcon } from '../components/icons';
import { LogView } from './log-view';
import { RequestDetails } from './request-details';
import { TrafficTable } from './traffic-table';
import { appLabel, channel, type DockTab, type SessionState } from './use-session';

interface DockProps {
	state: SessionState;
	height: number;
	onClear: (tab: DockTab) => void;
}

export function Dock({ state, height, onClear }: DockProps) {
	// "metro" is the tab id saved by version 0.1.
	const [tab, setTab] = useState<DockTab>(() => {
		const saved = channel.getState()?.tab as DockTab | 'metro' | undefined;
		return saved === 'metro' ? 'app' : (saved ?? 'traffic');
	});
	const [filter, setFilter] = useState('');
	const [selectedId, setSelectedId] = useState<string>();
	const selected = state.traffic.find((event) => event.id === selectedId);

	const selectTab = (next: DockTab) => {
		setTab(next);
		channel.setState({ ...channel.getState(), tab: next });
	};

	const counts = {
		traffic: state.traffic.length,
		api: state.logs.filter((l) => l.service === 'api').length,
		app: state.logs.filter((l) => l.service === 'app').length,
	};

	return (
		<section className="dock" style={{ height }}>
			<nav className="dock__bar">
				<div className="tabs" role="tablist">
					<Tab id="traffic" active={tab} count={counts.traffic} onSelect={selectTab} icon={<ActivityIcon size={13} />}>
						Traffic
					</Tab>
					<Tab id="api" active={tab} count={counts.api} onSelect={selectTab} icon={<ServerIcon size={13} />}>
						API
					</Tab>
					<Tab id="app" active={tab} count={counts.app} onSelect={selectTab} icon={<TerminalIcon size={13} />}>
						{appLabel(state.appKind)}
					</Tab>
				</div>
				<div className="dock__tools">
					<label className="search">
						<SearchIcon size={12} />
						<input
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder={tab === 'traffic' ? 'Filter routes, screens…' : 'Filter logs…'}
							spellCheck={false}
						/>
					</label>
					<button className="icon-button" title="Clear" aria-label="Clear" onClick={() => onClear(tab)}>
						<TrashIcon size={13} />
					</button>
				</div>
			</nav>

			<div className="dock__content" role="tabpanel">
				{tab === 'traffic' ? (
					<div className="traffic-split">
						<TrafficTable
							traffic={state.traffic}
							filter={filter}
							apiState={state.services.api}
							selectedId={selected?.id}
							onSelect={(id) => setSelectedId(id === selectedId ? undefined : id)}
						/>
						{selected && <RequestDetails event={selected} onClose={() => setSelectedId(undefined)} />}
					</div>
				) : (
					<LogView lines={state.logs} service={tab} filter={filter} serviceState={state.services[tab]} />
				)}
			</div>
		</section>
	);
}

function Tab({
	id,
	active,
	count,
	icon,
	onSelect,
	children,
}: {
	id: DockTab;
	active: DockTab;
	count: number;
	icon: React.ReactNode;
	onSelect: (tab: DockTab) => void;
	children: React.ReactNode;
}) {
	return (
		<button role="tab" aria-selected={active === id} className="tab" onClick={() => onSelect(id)}>
			{icon}
			{children}
			{count > 0 && <span className="tab__count">{count > 999 ? '999+' : count}</span>}
		</button>
	);
}
