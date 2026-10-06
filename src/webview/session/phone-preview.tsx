import { useEffect, useRef, useState } from 'react';
import { BootScreen, EmbedBlocked } from './app-screens';
import { useZoom } from './scaling';
import { Stats } from './stats';
import type { SessionState } from './use-session';
import { ZoomControls } from './zoom-controls';

// iPhone 15-ish logical size.
const SCREEN = { width: 393, height: 852 };
const BEZEL = 12;
const PHONE = { width: SCREEN.width + BEZEL * 2, height: SCREEN.height + BEZEL * 2 };

/** The Expo app's web build in a phone frame, for React Native sessions. */
export function PhonePreview({ state }: { state: SessionState }) {
	const canvas = useRef<HTMLDivElement>(null);
	const { zoom, scale, setZoom } = useZoom(canvas, 'zoom', PHONE.width, PHONE.height);
	const app = state.services.app;
	const live = app.status === 'running' || app.status === 'attached';

	return (
		<section className="stage">
			<Stats traffic={state.traffic} />
			<ZoomControls zoom={zoom} scale={scale} onChange={setZoom} />
			{/* Scrolls when zoomed in past the panel size. */}
			<div className="stage__canvas" ref={canvas}>
				{/* Scaled with transform, not CSS zoom: VS Code doesn't pass zoom into
				    the app iframe, which then gets a narrow viewport instead of shrinking.
				    transform doesn't resize the layout box, so the slot reserves the
				    scaled size and the phone is drawn inside it. */}
				<div className="phone-slot" style={{ width: PHONE.width * scale, height: PHONE.height * scale }}>
					<div className="phone" style={{ width: PHONE.width, height: PHONE.height, transform: `scale(${scale})` }}>
						<div className="phone__screen">
							<StatusBar />
							<div className="phone__viewport">
								{state.embedBlocked ? (
									<EmbedBlocked reason={state.embedBlocked} />
								) : live && state.previewUrl ? (
									<iframe
										key={state.previewKey}
										src={state.previewUrl}
										title={`${state.appName} preview`}
										allow="clipboard-read; clipboard-write"
									/>
								) : (
									<BootScreen kind="expo" status={app.status} detail={app.detail} appName={state.appName} skeleton />
								)}
							</div>
							<div className="phone__home-indicator" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function StatusBar() {
	const time = useClock();
	return (
		<div className="phone__status-bar">
			<span className="phone__time">{time}</span>
			<span className="phone__island" />
			<span className="phone__indicators" aria-hidden="true">
				<svg width="18" height="11" viewBox="0 0 18 11">
					<rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor" />
					<rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor" />
					<rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor" />
					<rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor" />
				</svg>
				<svg width="26" height="12" viewBox="0 0 26 12">
					<rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke="currentColor" opacity="0.4" fill="none" />
					<rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" />
					<rect x="24" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
				</svg>
			</span>
		</div>
	);
}

function useClock() {
	const format = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
	const [time, setTime] = useState(format);
	useEffect(() => {
		const timer = setInterval(() => setTime(format()), 10_000);
		return () => clearInterval(timer);
	}, []);
	return time;
}
