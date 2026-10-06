import { useState } from 'react';
import { ActivityIcon, SearchIcon, ServerIcon, TerminalIcon, TrashIcon } from '../components/icons';
import { LogView } from './log-view';
import { TrafficTable } from './traffic-table';
import { channel, type DockTab, type SessionState } from './use-session';

interface DockProps {
	state: SessionState;
	height: number;
	onClear: (tab: DockTab) => void;
}

export function Dock({ state, height, onClear }: DockProps) {
	const [tab, setTab] = useState<DockTab>(() => channel.getState()?.tab ?? 'traffic');
	const [filter, setFilter] = useState('');

	const selectTab = (next: DockTab) => {
		setTab(next);
		channel.setState({ ...channel.getState(), tab: next });
	};

	const counts = {
		traffic: state.traffic.length,
		api: state.logs.filter((l) => l.service === 'api').length,
		metro: state.logs.filter((l) => l.service === 'metro').length,
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
					<Tab id="metro" active={tab} count={counts.metro} onSelect={selectTab} icon={<TerminalIcon size={13} />}>
						Metro
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
					<TrafficTable traffic={state.traffic} filter={filter} apiState={state.services.api} />
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
