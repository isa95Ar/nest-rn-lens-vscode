/** Animated loader: a scanning lens with request dots orbiting inside. */
export function LensLoader() {
	return (
		<div className="lens-loader" aria-hidden="true">
			<div className="lens-loader__ring" />
			<div className="lens-loader__glow" />
			<div className="lens-loader__orbit">
				<span />
				<span />
				<span />
			</div>
		</div>
	);
}
