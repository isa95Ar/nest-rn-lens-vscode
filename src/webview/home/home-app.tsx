import { useEffect, useState } from 'react';
import type { ClientKind, HomeToHost, HostToHome, ValidationResult } from '../../shared/protocol';
import { ArrowRightIcon, BrowserIcon, PhoneIcon, PlayIcon, RefreshIcon, ServerIcon, StopIcon } from '../components/icons';
import { Logo } from '../components/logo';
import { createChannel } from '../vscode';
import { LensLoader } from './lens-loader';
import { StepList } from './step-list';

const channel = createChannel<HostToHome, HomeToHost>(['validation', 'session']);

export function HomeApp() {
	const [result, setResult] = useState<ValidationResult>();
	// Remembered across re-checks, so the switch doesn't flicker while the apps are re-detected.
	const [choice, setChoice] = useState<{ both: boolean; target?: ClientKind }>({ both: false });
	const [running, setRunning] = useState(false);

	useEffect(() => {
		const stop = channel.listen((message) => {
			if (message.type === 'validation') {
				setResult(message.result);
				const { clients, target } = message.result;
				if (target) {
					setChoice({ both: !!(clients.expo && clients.next), target });
				}
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

			{choice.both && (
				<TargetSwitch
					target={choice.target}
					disabled={running || validating}
					onChange={(target) => channel.post({ type: 'setTarget', target })}
				/>
			)}

			{validating ? (
				<section className="hero" aria-live="polite">
					<LensLoader />
					<h2>Inspecting your workspace</h2>
					<p className="muted">Looking for Turborepo, a NestJS API and a React Native or Next.js app</p>
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
				<AppChip
					icon={result.target === 'next' ? <BrowserIcon size={15} /> : <PhoneIcon size={15} />}
					label={result.target === 'next' ? 'Web' : 'App'}
					name={result.client!.name}
					dir={result.client!.relativeDir}
				/>
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

const TARGETS: { id: ClientKind; label: string; icon: React.ReactNode }[] = [
	{ id: 'expo', label: 'React Native', icon: <PhoneIcon size={13} /> },
	{ id: 'next', label: 'Next.js', icon: <BrowserIcon size={13} /> },
];

/** Shown when the monorepo has both a React Native and a Next.js app. */
function TargetSwitch({
	target,
	disabled,
	onChange,
}: {
	target?: ClientKind;
	disabled: boolean;
	onChange: (target: ClientKind) => void;
}) {
	return (
		<div className="target" role="radiogroup" aria-label="App to track">
			<span className="target__label">Track</span>
			<div className="target__options">
				{TARGETS.map((option) => (
					<button
						key={option.id}
						role="radio"
						aria-checked={target === option.id}
						className="target__option"
						disabled={disabled && target !== option.id}
						onClick={() => target !== option.id && onChange(option.id)}
					>
						{option.icon}
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}
