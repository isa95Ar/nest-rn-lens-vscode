import { useCallback, useRef, useState } from 'react';
import { Dock } from './dock';
import { PhonePreview } from './phone-preview';
import { Toolbar } from './toolbar';
import { channel, useSession } from './use-session';

const MIN_DOCK = 120;
const DEFAULT_DOCK = 280;

export function SessionApp() {
	const { state, dispatch } = useSession();
	const [dockHeight, setDockHeight] = useState(() => channel.getState()?.dockHeight ?? DEFAULT_DOCK);
	const layout = useRef<HTMLDivElement>(null);

	const startResize = useCallback((event: React.PointerEvent) => {
		const bottom = layout.current!.getBoundingClientRect().bottom;
		const max = layout.current!.clientHeight - 160;
		const onMove = (e: PointerEvent) => setDockHeight(Math.min(max, Math.max(MIN_DOCK, bottom - e.clientY)));
		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			document.body.classList.remove('resizing');
			setDockHeight((height) => {
				channel.setState({ ...channel.getState(), dockHeight: height });
				return height;
			});
		};
		event.preventDefault();
		document.body.classList.add('resizing');
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	}, []);

	return (
		<div className="session" ref={layout}>
			<Toolbar state={state} onReload={() => dispatch({ type: 'reloadPreview' })} />
			<PhonePreview state={state} />
			<div
				className="dock-resizer"
				role="separator"
				aria-orientation="horizontal"
				aria-label="Resize logs"
				onPointerDown={startResize}
			/>
			<Dock state={state} height={dockHeight} onClear={(tab) => dispatch({ type: 'clear', tab })} />
		</div>
	);
}
