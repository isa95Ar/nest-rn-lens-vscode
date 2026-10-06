import type { ServiceState } from '../../shared/protocol';
import { ArrowRightIcon, ExternalIcon, PhoneIcon, RefreshIcon, ReloadIcon, ServerIcon, StopIcon } from '../components/icons';
import { Logo } from '../components/logo';
import { channel, type SessionState } from './use-session';

const STATUS_LABEL: Record<ServiceState['status'], string> = {
	idle: 'Idle',
	starting: 'Starting',
	running: 'Running',
	attached: 'External',
	stopped: 'Stopped',
	error: 'Error',
};

export function Toolbar({ state, onReload }: { state: SessionState; onReload: () => void }) {
	return (
		<header className="toolbar">
			<div className="toolbar__title">
				<Logo size={22} />
				<span className="toolbar__app">
					<PhoneIcon size={13} /> {state.appName || '…'}
				</span>
				<ArrowRightIcon size={12} className="muted" />
				<span className="toolbar__app">
					<ServerIcon size={13} /> {state.apiName || '…'}
				</span>
			</div>

			<div className="toolbar__services">
				<ServicePill name="Metro" state={state.services.metro} />
				<ServicePill name="API" state={state.services.api} />
			</div>

			<div className="toolbar__actions">
				<IconButton label="Reload app" onClick={onReload}>
					<ReloadIcon size={14} />
				</IconButton>
				<IconButton label="Open in browser" onClick={() => channel.post({ type: 'openExternal' })}>
					<ExternalIcon size={14} />
				</IconButton>
				<IconButton label="Restart API and Metro" onClick={() => channel.post({ type: 'restart' })}>
					<RefreshIcon size={14} />
				</IconButton>
				<button className="button button--danger button--small" onClick={() => channel.post({ type: 'stop' })}>
					<StopIcon size={12} /> Stop
				</button>
			</div>
		</header>
	);
}

function ServicePill({ name, state }: { name: string; state: ServiceState }) {
	return (
		<span className={`pill pill--${state.status}`} title={state.detail}>
			<span className="pill__dot" />
			{name}
			<span className="pill__status">{STATUS_LABEL[state.status]}</span>
		</span>
	);
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return (
		<button className="icon-button" onClick={onClick} title={label} aria-label={label}>
			{children}
		</button>
	);
}
