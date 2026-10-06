import { FitIcon, MinusIcon, PlusIcon } from '../components/icons';

/** 'fit' follows the panel size; a number is a fixed scale (1 = 100%). */
export type Zoom = 'fit' | number;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
const STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function clampZoom(scale: number) {
	return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)) * 100) / 100;
}

function step(scale: number, direction: 1 | -1) {
	return direction > 0
		? (STEPS.find((s) => s > scale + 0.001) ?? MAX_ZOOM)
		: ([...STEPS].reverse().find((s) => s < scale - 0.001) ?? MIN_ZOOM);
}

interface ZoomControlsProps {
	zoom: Zoom;
	/** The scale currently applied (resolves 'fit'). */
	scale: number;
	onChange: (zoom: Zoom) => void;
}

export function ZoomControls({ zoom, scale, onChange }: ZoomControlsProps) {
	return (
		<div className="zoom" role="toolbar" aria-label="Preview zoom">
			<button
				className="icon-button"
				title="Zoom out"
				aria-label="Zoom out"
				disabled={scale <= MIN_ZOOM}
				onClick={() => onChange(step(scale, -1))}
			>
				<MinusIcon size={14} />
			</button>
			<button className="zoom__value" title="Reset to 100%" onClick={() => onChange(1)}>
				{Math.round(scale * 100)}%
			</button>
			<button
				className="icon-button"
				title="Zoom in"
				aria-label="Zoom in"
				disabled={scale >= MAX_ZOOM}
				onClick={() => onChange(step(scale, 1))}
			>
				<PlusIcon size={14} />
			</button>
			<span className="zoom__divider" />
			<button
				className="icon-button"
				title="Fit to panel"
				aria-label="Fit to panel"
				aria-pressed={zoom === 'fit'}
				onClick={() => onChange('fit')}
			>
				<FitIcon size={14} />
			</button>
		</div>
	);
}
