import type { ReactNode, SVGProps } from 'react';

// Stroke icons in the Lucide style (24×24 grid), drawn with currentColor.
function icon(children: ReactNode) {
	return function Icon({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
				{...props}
			>
				{children}
			</svg>
		);
	};
}

export const CheckIcon = icon(<path d="M20 6 9 17l-5-5" />);
export const XIcon = icon(
	<>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</>,
);
export const AlertIcon = icon(
	<>
		<path d="M12 8v5" />
		<path d="M12 16.5h.01" />
	</>,
);
export const PlayIcon = icon(<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />);
export const StopIcon = icon(<rect width="13" height="13" x="5.5" y="5.5" rx="2" />);
export const RefreshIcon = icon(
	<>
		<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
		<path d="M21 3v5h-5" />
		<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
		<path d="M8 16H3v5" />
	</>,
);
export const ReloadIcon = icon(
	<>
		<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
		<path d="M21 3v5h-5" />
	</>,
);
export const ExternalIcon = icon(
	<>
		<path d="M15 3h6v6" />
		<path d="M10 14 21 3" />
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
	</>,
);
export const ServerIcon = icon(
	<>
		<rect width="20" height="8" x="2" y="2" rx="2" />
		<rect width="20" height="8" x="2" y="14" rx="2" />
		<path d="M6 6h.01" />
		<path d="M6 18h.01" />
	</>,
);
export const PhoneIcon = icon(
	<>
		<rect width="14" height="20" x="5" y="2" rx="2" />
		<path d="M12 18h.01" />
	</>,
);
export const BrowserIcon = icon(
	<>
		<rect width="20" height="16" x="2" y="4" rx="2" />
		<path d="M2 9h20" />
		<path d="M6 6.5h.01" />
		<path d="M9 6.5h.01" />
	</>,
);
export const TabletIcon = icon(
	<>
		<rect width="16" height="20" x="4" y="2" rx="2" />
		<path d="M12 18h.01" />
	</>,
);
export const HomeIcon = icon(
	<>
		<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
		<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
	</>,
);
export const LayersIcon = icon(
	<>
		<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
		<path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
		<path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
	</>,
);
export const ActivityIcon = icon(<path d="M22 12h-4l-3 9L9 3l-3 9H2" />);
export const TerminalIcon = icon(
	<>
		<path d="m4 17 6-6-6-6" />
		<path d="M12 19h8" />
	</>,
);
export const SearchIcon = icon(
	<>
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.5-3.5" />
	</>,
);
export const TrashIcon = icon(
	<>
		<path d="M3 6h18" />
		<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
		<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
	</>,
);
export const ArrowRightIcon = icon(
	<>
		<path d="M5 12h14" />
		<path d="m12 5 7 7-7 7" />
	</>,
);
export const ArrowDownIcon = icon(
	<>
		<path d="M12 5v14" />
		<path d="m19 12-7 7-7-7" />
	</>,
);
export const MinusIcon = icon(<path d="M5 12h14" />);
export const PlusIcon = icon(
	<>
		<path d="M5 12h14" />
		<path d="M12 5v14" />
	</>,
);
export const FitIcon = icon(
	<>
		<path d="M8 3H5a2 2 0 0 0-2 2v3" />
		<path d="M21 8V5a2 2 0 0 0-2-2h-3" />
		<path d="M3 16v3a2 2 0 0 0 2 2h3" />
		<path d="M16 21h3a2 2 0 0 0 2-2v-3" />
	</>,
);
export const CodeIcon = icon(
	<>
		<path d="m16 18 6-6-6-6" />
		<path d="m8 6-6 6 6 6" />
	</>,
);
