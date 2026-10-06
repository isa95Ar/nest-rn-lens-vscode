import { useEffect, useRef, useState } from 'react';
import { AlertIcon } from '../components/icons';
import { Stats } from './stats';
import { channel, type SessionState } from './use-session';
import { clampZoom, ZoomControls, type Zoom } from './zoom-controls';

// iPhone 15-ish logical size.
const SCREEN = { width: 393, height: 852 };
const BEZEL = 12;
const PHONE = { width: SCREEN.width + BEZEL * 2, height: SCREEN.height + BEZEL * 2 };

export function PhonePreview({ state }: { state: SessionState }) {
	const canvas = useRef<HTMLDivElement>(null);
	const fit = useFitScale(canvas, PHONE.width, PHONE.height);
	const [zoom, setZoom] = useState<Zoom>(() => channel.getState()?.zoom ?? 'fit');
	const scale = zoom === 'fit' ? fit : zoom;
	const metro = state.services.metro;
	const live = metro.status === 'running' || metro.status === 'attached';

	useEffect(() => {
		channel.setState({ ...channel.getState(), zoom });
	}, [zoom]);
	usePinchZoom(canvas, scale, setZoom);

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
								{live && state.previewUrl ? (
									<iframe
										key={state.previewKey}
										src={state.previewUrl}
										title={`${state.appName} preview`}
										allow="clipboard-read; clipboard-write"
									/>
								) : (
									<BootScreen status={metro.status} detail={metro.detail} appName={state.appName} />
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

function BootScreen({ status, detail, appName }: { status: string; detail?: string; appName: string }) {
	if (status === 'error' || status === 'stopped') {
		return (
			<div className="boot boot--error">
				<span className="boot__error-icon">
					<AlertIcon size={22} strokeWidth={2.5} />
				</span>
				<strong>{status === 'error' ? "Metro didn't start" : 'Metro stopped'}</strong>
				<p>{detail ?? 'Restart the session to run it again.'}</p>
			</div>
		);
	}
	return (
		<div className="boot">
			<div className="boot__spinner" />
			<strong>Starting {appName || 'your app'}</strong>
			<p>Metro is bundling the web build…</p>
			<div className="boot__skeleton" aria-hidden="true">
				<span />
				<span />
				<span />
				<span />
			</div>
		</div>
	);
}

/** Largest scale (max 1) at which a box fits inside the element's padding. */
function useFitScale(ref: React.RefObject<HTMLElement | null>, width: number, height: number) {
	const [scale, setScale] = useState(1);
	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}
		const observer = new ResizeObserver(([entry]) => {
			const { width: w, height: h } = entry.contentRect;
			setScale(Math.min(1, h / height, w / width));
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref, width, height]);
	return Math.max(0.3, scale);
}

/**
 * Pinch on a trackpad (or Ctrl/Cmd + scroll) zooms the preview. Only works
 * over the stage background: over the phone, the app's iframe gets the event.
 */
function usePinchZoom(ref: React.RefObject<HTMLElement | null>, scale: number, setZoom: (zoom: Zoom) => void) {
	const current = useRef(scale);
	current.current = scale;
	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) {
				return;
			}
			event.preventDefault();
			setZoom(clampZoom(current.current * Math.exp(-event.deltaY * 0.01)));
		};
		// Non-passive, so preventDefault can stop the page from scrolling.
		element.addEventListener('wheel', onWheel, { passive: false });
		return () => element.removeEventListener('wheel', onWheel);
	}, [ref, setZoom]);
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
