import type { ClientKind } from '../../shared/protocol';
import { AlertIcon, ExternalIcon } from '../components/icons';
import { appLabel, channel } from './use-session';

interface BootScreenProps {
	kind: ClientKind;
	status: string;
	detail?: string;
	appName: string;
	/** Shows skeleton cards in the shape of a phone grid. */
	skeleton?: boolean;
}

/** Shown inside the preview while the app's dev server starts, or if it fails. */
export function BootScreen({ kind, status, detail, appName, skeleton }: BootScreenProps) {
	const server = appLabel(kind);
	if (status === 'error' || status === 'stopped') {
		return (
			<div className="boot boot--error">
				<span className="boot__error-icon">
					<AlertIcon size={22} strokeWidth={2.5} />
				</span>
				<strong>{status === 'error' ? `${server} didn't start` : `${server} stopped`}</strong>
				<p>{detail ?? 'Restart the session to run it again.'}</p>
			</div>
		);
	}
	return (
		<div className="boot">
			<div className="boot__spinner" />
			<strong>Starting {appName || 'your app'}</strong>
			<p>{kind === 'expo' ? 'Metro is bundling the web build…' : 'next dev is compiling the first page…'}</p>
			{skeleton && (
				<div className="boot__skeleton" aria-hidden="true">
					<span />
					<span />
					<span />
					<span />
				</div>
			)}
		</div>
	);
}

/** Shown instead of the iframe when the app refuses to be framed. */
export function EmbedBlocked({ reason }: { reason: string }) {
	return (
		<div className="boot boot--error">
			<span className="boot__error-icon">
				<AlertIcon size={22} strokeWidth={2.5} />
			</span>
			<strong>This app can&apos;t be shown here</strong>
			<p>
				It sends <code>{reason}</code>, which stops it from loading inside another page. Open it in your browser: its
				requests still show up in Traffic.
			</p>
			<button className="button button--primary" onClick={() => channel.post({ type: 'openExternal' })}>
				<ExternalIcon size={13} /> Open in browser
			</button>
		</div>
	);
}
