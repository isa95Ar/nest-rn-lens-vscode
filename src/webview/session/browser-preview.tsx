import { useRef, useState } from 'react';
import { BrowserIcon, HomeIcon, PhoneIcon, ReloadIcon, TabletIcon } from '../components/icons';
import { BootScreen, EmbedBlocked } from './app-screens';
import { useZoom } from './scaling';
import { Stats } from './stats';
import { channel, type BrowserDevice, type SessionState } from './use-session';
import { ZoomControls } from './zoom-controls';

const DEVICES: Record<BrowserDevice, { label: string; width: number; height: number; icon: React.ReactNode }> = {
	desktop: { label: 'Desktop', width: 1280, height: 800, icon: <BrowserIcon size={14} /> },
	tablet: { label: 'Tablet', width: 820, height: 1180, icon: <TabletIcon size={14} /> },
	mobile: { label: 'Mobile', width: 390, height: 844, icon: <PhoneIcon size={14} /> },
};

const BAR_HEIGHT = 44;

/** The web app in a browser window, for Next.js sessions. */
export function BrowserPreview({ state }: { state: SessionState }) {
	const canvas = useRef<HTMLDivElement>(null);
	const [device, setDevice] = useState<BrowserDevice>(() => channel.getState()?.device ?? 'desktop');
	const size = DEVICES[device];
	const frame = { width: size.width, height: size.height + BAR_HEIGHT };
	const { zoom, scale, setZoom } = useZoom(canvas, 'browserZoom', frame.width, frame.height);

	// A cross-origin page can't tell us where it navigated, so the address bar
	// is for going to a path, not for following clicks inside the page.
	const [path, setPath] = useState('/');
	const [draft, setDraft] = useState('/');
	const [reloads, setReloads] = useState(0);

	const app = state.services.app;
	const live = app.status === 'running' || app.status === 'attached';
	const origin = state.previewUrl.replace(/^https?:\/\//, '');

	const go = (next: string) => {
		const normalized = next.startsWith('/') ? next : `/${next}`;
		setPath(normalized);
		setDraft(normalized);
		setReloads((n) => n + 1);
	};

	const pickDevice = (next: BrowserDevice) => {
		setDevice(next);
		channel.setState({ ...channel.getState(), device: next });
	};

	return (
		<section className="stage">
			<Stats traffic={state.traffic} />
			<ZoomControls zoom={zoom} scale={scale} onChange={setZoom}>
				{(Object.keys(DEVICES) as BrowserDevice[]).map((id) => (
					<button
						key={id}
						role="radio"
						aria-checked={device === id}
						aria-label={DEVICES[id].label}
						className="icon-button"
						title={`${DEVICES[id].label} (${DEVICES[id].width}×${DEVICES[id].height})`}
						onClick={() => pickDevice(id)}
					>
						{DEVICES[id].icon}
					</button>
				))}
			</ZoomControls>
			<div className="stage__canvas" ref={canvas}>
				{/* transform doesn't resize the layout box, so the slot reserves the scaled size. */}
				<div className="window-slot" style={{ width: frame.width * scale, height: frame.height * scale }}>
					<div className="window" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
						<div className="window__bar" style={{ height: BAR_HEIGHT }}>
							<span className="window__dots" aria-hidden="true">
								<span />
								<span />
								<span />
							</span>
							<button className="window__button" title="Home" aria-label="Home" onClick={() => go('/')}>
								<HomeIcon size={15} />
							</button>
							<button className="window__button" title="Reload" aria-label="Reload" onClick={() => setReloads((n) => n + 1)}>
								<ReloadIcon size={15} />
							</button>
							<form
								className="window__address"
								onSubmit={(event) => {
									event.preventDefault();
									go(draft.trim() || '/');
								}}
							>
								<span className="window__origin">{origin}</span>
								<input
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									aria-label="Path"
									spellCheck={false}
								/>
							</form>
						</div>
						<div className="window__viewport">
							{state.embedBlocked ? (
								<EmbedBlocked reason={state.embedBlocked} />
							) : live && state.previewUrl ? (
								<iframe
									key={`${state.previewKey}-${reloads}`}
									src={`${state.previewUrl}${path}`}
									title={`${state.appName} preview`}
									allow="clipboard-read; clipboard-write"
								/>
							) : (
								<BootScreen kind="next" status={app.status} detail={app.detail} appName={state.appName} />
							)}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
