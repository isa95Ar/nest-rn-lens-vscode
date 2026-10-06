import { useEffect, useState } from 'react';
import type { CapturedBody, NestRnLensEvent } from '../../shared/protocol';
import { CheckIcon, CopyIcon, XIcon } from '../components/icons';
import { JsonView } from './json-view';

type DetailsTab = 'response' | 'request' | 'headers';

/** The selected request: what was sent and what came back. */
export function RequestDetails({ event, onClose }: { event: NestRnLensEvent; onClose: () => void }) {
	const [tab, setTab] = useState<DetailsTab>('response');

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	const { target, status, request, response } = event;
	const captured = request !== undefined || response !== undefined;

	return (
		<aside className="details" aria-label="Request details">
			<header className="details__head">
				<span className={`method method--${target.method.toLowerCase()}`}>{target.method}</span>
				<span className="details__path mono" title={target.path}>
					{target.path}
				</span>
				<span className={`status status--${Math.floor(status / 100)}xx`}>{status}</span>
				<button className="icon-button" title="Close (Esc)" aria-label="Close details" onClick={onClose}>
					<XIcon size={14} />
				</button>
			</header>

			<nav className="details__tabs" role="tablist">
				{(['response', 'request', 'headers'] as DetailsTab[]).map((id) => (
					<button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
						{id === 'response' ? 'Response' : id === 'request' ? 'Request' : 'Headers'}
					</button>
				))}
			</nav>

			<div className="details__body">
				{!captured ? (
					<p className="details__note">
						Bodies aren&apos;t captured. Update <code>@nest-rn-lens/nest</code> in the API to 0.2.0 or newer, and keep{' '}
						<code>captureBodies</code> on (the default).
					</p>
				) : tab === 'response' ? (
					<Section title="Body" copy={bodyText(response?.body)}>
						<BodyView body={response?.body} empty="The handler returned nothing." />
					</Section>
				) : tab === 'request' ? (
					<>
						{request?.params !== undefined && (
							<Section title="Route params" copy={JSON.stringify(request.params, null, 2)}>
								<JsonView value={request.params} />
							</Section>
						)}
						{request?.query !== undefined && (
							<Section title="Query" copy={JSON.stringify(request.query, null, 2)}>
								<JsonView value={request.query} />
							</Section>
						)}
						<Section title="Body" copy={bodyText(request?.body)}>
							<BodyView body={request?.body} empty="No body." />
						</Section>
					</>
				) : (
					<Section title="Request headers" copy={JSON.stringify(request?.headers ?? {}, null, 2)}>
						<table className="kv">
							<tbody>
								{Object.entries(request?.headers ?? {}).map(([name, value]) => (
									<tr key={name}>
										<th>{name}</th>
										<td className={value === '[redacted]' ? 'muted' : undefined}>{value}</td>
									</tr>
								))}
							</tbody>
						</table>
					</Section>
				)}
			</div>
		</aside>
	);
}

function Section({ title, copy, children }: { title: string; copy?: string; children: React.ReactNode }) {
	return (
		<section className="details__section">
			<div className="details__section-head">
				<span>{title}</span>
				{copy && <CopyButton text={copy} />}
			</div>
			{children}
		</section>
	);
}

function BodyView({ body, empty }: { body?: CapturedBody; empty: string }) {
	if (!body) {
		return <p className="details__note">{empty}</p>;
	}
	if (body.summary) {
		return <p className="details__note">{body.summary}</p>;
	}
	if (body.truncated) {
		return (
			<>
				<p className="details__note">
					Showing the first {formatBytes(body.preview?.length ?? 0)} of {formatBytes(body.size)}. Raise{' '}
					<code>maxBodyBytes</code> in the API to capture more.
				</p>
				<pre className="json">{body.preview}…</pre>
			</>
		);
	}
	return <JsonView value={body.value} />;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			className="icon-button"
			title="Copy"
			aria-label="Copy"
			onClick={async () => {
				await navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			}}
		>
			{copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
		</button>
	);
}

function bodyText(body?: CapturedBody): string | undefined {
	if (!body) {
		return undefined;
	}
	if (body.summary) {
		return body.summary;
	}
	if (body.truncated) {
		return body.preview;
	}
	return typeof body.value === 'string' ? body.value : JSON.stringify(body.value, null, 2);
}

function formatBytes(bytes: number): string {
	return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
