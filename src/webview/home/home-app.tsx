import { useEffect, useState } from 'react';
import type { HomeToHost, HostToHome, ValidationResult } from '../../shared/protocol';
import { ArrowRightIcon, PhoneIcon, PlayIcon, RefreshIcon, ServerIcon, StopIcon } from '../components/icons';
import { Logo } from '../components/logo';
import { createChannel } from '../vscode';
import { LensLoader } from './lens-loader';
import { StepList } from './step-list';

const channel = createChannel<HostToHome, HomeToHost>(['validation', 'session']);

export function HomeApp() {
	const [result, setResult] = useState<ValidationResult>();
	const [running, setRunning] = useState(false);

	useEffect(() => {
		const stop = channel.listen((message) => {
			if (message.type === 'validation') {
				setResult(message.result);
			} else {
				setRunning(message.running);
			}
		});
		channel.post({ type: 'ready' });
		return stop;
	}, []);

	const validating = !result || result.phase === 'validating';
	const done = result?.steps.filter((s) => s.status !== 'pending' && s.status !== 'running').length ?? 0;
	const total = result?.steps.length ?? 8;

	return (
		<main className="home">
			<header className="brand">
				<Logo size={30} />
				<div>
					<h1>NestRN Lens</h1>
					<p>Live traffic for your Turborepo</p>
				</div>
			</header>

			{validating ? (
				<section className="hero" aria-live="polite">
					<LensLoader />
					<h2>Inspecting your workspace</h2>
					<p className="muted">Looking for Turborepo, a NestJS API and an Expo app</p>
					<div className="progress" role="progressbar" aria-valuenow={done} aria-valuemax={total}>
						<span style={{ width: `${(done / total) * 100}%` }} />
					</div>
				</section>
			) : running ? (
				<RunningCard />
			) : (
				<Summary result={result} />
			)}

			{result && (
				<StepList steps={result.steps} onFix={(stepId) => channel.post({ type: 'runFix', stepId })} />
			)}

			{!validating && (
				<button className="link-button" onClick={() => channel.post({ type: 'revalidate' })}>
					<RefreshIcon size={13} /> Re-check workspace
				</button>
			)}
		</main>
	);
}

function Summary({ result }: { result: ValidationResult }) {
	const failed = result.steps.filter((s) => s.status === 'fail').length;
	const warned = result.steps.filter((s) => s.status === 'warn').length;

	if (!result.canStart) {
		return (
			<section className="summary summary--fail">
				<h2>{failed === 1 ? '1 check needs attention' : `${failed} checks need attention`}</h2>
				<p className="muted">Fix the items marked below, then re-check.</p>
			</section>
		);
	}

	return (
		<section className="summary">
			<div className="apps">
				<AppChip icon={<PhoneIcon size={15} />} label="App" name={result.expo!.name} dir={result.expo!.relativeDir} />
				<div className="apps__link" aria-hidden="true">
					<span />
					<ArrowRightIcon size={12} />
				</div>
				<AppChip icon={<ServerIcon size={15} />} label="API" name={result.nest!.name} dir={result.nest!.relativeDir} />
			</div>
			<button className="button button--primary button--block" onClick={() => channel.post({ type: 'start' })}>
				<PlayIcon size={14} /> Launch session
			</button>
			<p className="muted center small">
				{warned ? `Ready, with ${warned} warning${warned > 1 ? 's' : ''}` : 'Everything looks good'}
			</p>
		</section>
	);
}

function AppChip({ icon, label, name, dir }: { icon: React.ReactNode; label: string; name: string; dir: string }) {
	return (
		<div className="app-chip" title={dir}>
			<span className="app-chip__icon">{icon}</span>
			<span className="app-chip__label">{label}</span>
			<strong>{name}</strong>
		</div>
	);
}

function RunningCard() {
	return (
		<section className="summary summary--running">
			<div className="live">
				<span className="live__dot" />
				Session running
			</div>
			<div className="row">
				<button className="button button--primary" onClick={() => channel.post({ type: 'showPanel' })}>
					Show panel
				</button>
				<button className="button button--ghost" onClick={() => channel.post({ type: 'stop' })}>
					<StopIcon size={13} /> Stop
				</button>
			</div>
		</section>
	);
}
