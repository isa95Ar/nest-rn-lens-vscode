import { useId } from 'react';

/**
 * The NestRN Lens mark: a lens (the ring) with the API traffic around it,
 * React blue fading to purple, and two NestJS red segments.
 */
export function Logo({ size = 28 }: { size?: number }) {
	const gradient = useId();
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
			<defs>
				<linearGradient id={gradient} x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
					<stop stopColor="#0a8dff" />
					<stop offset="0.65" stopColor="#3b82f6" />
					<stop offset="1" stopColor="#c0397a" />
				</linearGradient>
			</defs>
			<path d="M16 3A13 13 0 0 1 17.81 28.87" stroke={`url(#${gradient})`} strokeWidth="3" />
			<path d="M14.19 28.87A13 13 0 0 1 5.76 24" stroke="#f0245a" strokeWidth="3" />
			<path d="M4.32 21.7A13 13 0 0 1 3.01 16.45" stroke="#f0245a" strokeWidth="3" />
			{/* currentColor keeps the ring visible on light and dark themes. */}
			<circle cx="16" cy="16" r="5.2" stroke="currentColor" strokeWidth="4.2" />
		</svg>
	);
}
