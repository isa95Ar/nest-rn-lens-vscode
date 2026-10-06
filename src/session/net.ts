import { connect } from 'node:net';

/** True if something accepts TCP connections on localhost:port. */
export function isPortInUse(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ port, host: 'localhost' });
		const done = (inUse: boolean) => {
			socket.destroy();
			resolve(inUse);
		};
		socket.setTimeout(500, () => done(false));
		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
	});
}

/** Metro answers /status with "packager-status:running" once it's ready. */
export async function isMetroReady(port: number): Promise<boolean> {
	try {
		const response = await fetch(`http://localhost:${port}/status`, { signal: AbortSignal.timeout(1000) });
		return (await response.text()).includes('packager-status:running');
	} catch {
		return false;
	}
}

/** Polls `check` until it returns true. Resolves false on timeout or abort. */
export async function waitUntil(
	check: () => Promise<boolean>,
	{ timeoutMs, intervalMs = 500, signal }: { timeoutMs: number; intervalMs?: number; signal?: AbortSignal },
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline && !signal?.aborted) {
		if (await check()) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	return false;
}
