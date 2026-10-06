import { useEffect, useRef, useState } from 'react';
import { channel, type PersistedState } from './use-session';
import { clampZoom, type Zoom } from './zoom-controls';

/** Largest scale (max 1) at which a box fits inside the element's padding. */
export function useFitScale(ref: React.RefObject<HTMLElement | null>, width: number, height: number) {
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
	return Math.max(0.2, scale);
}

/**
 * Zoom for a preview: "fit" follows the panel, a number is a fixed scale.
 * Remembered per preview kind, so the phone and the browser keep their own.
 */
export function useZoom(
	canvas: React.RefObject<HTMLElement | null>,
	key: keyof Pick<PersistedState, 'zoom' | 'browserZoom'>,
	contentWidth: number,
	contentHeight: number,
) {
	const fit = useFitScale(canvas, contentWidth, contentHeight);
	const [zoom, setZoom] = useState<Zoom>(() => channel.getState()?.[key] ?? 'fit');
	const scale = zoom === 'fit' ? fit : zoom;

	useEffect(() => {
		channel.setState({ ...channel.getState(), [key]: zoom });
	}, [key, zoom]);
	usePinchZoom(canvas, scale, setZoom);

	return { zoom, scale, setZoom };
}

/**
 * Pinch on a trackpad (or Ctrl/Cmd + scroll) zooms the preview. Only works
 * over the stage background: over the app, its iframe gets the event.
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
