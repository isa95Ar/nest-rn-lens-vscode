import type { NestRnLensEvent } from '../../shared/protocol';

/** Floating summary of the session's traffic, top-left of the stage. */
export function Stats({ traffic }: { traffic: NestRnLensEvent[] }) {
	const count = traffic.length;
	const errors = traffic.filter((e) => e.status >= 400).length;
	const avg = count ? Math.round(traffic.reduce((sum, e) => sum + e.durationMs, 0) / count) : 0;
	const routes = new Set(traffic.map((e) => `${e.target.method} ${e.target.route}`)).size;

	return (
		<div className="stats">
			<Stat label="Requests" value={count} />
			<Stat label="Routes" value={routes} />
			<Stat label="Avg" value={count ? `${avg}ms` : '–'} />
			<Stat label="Errors" value={errors} tone={errors ? 'error' : undefined} />
		</div>
	);
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'error' }) {
	return (
		<div className={`stat${tone ? ` stat--${tone}` : ''}`}>
			<span className="stat__value">{value}</span>
			<span className="stat__label">{label}</span>
		</div>
	);
}
