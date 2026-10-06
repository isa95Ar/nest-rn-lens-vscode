import { useState } from 'react';
import type { ClientKind, ValidationResult } from '../../shared/protocol';
import { CheckIcon, CopyIcon, ExternalIcon, XIcon } from '../components/icons';

interface GuideStep {
	title: string;
	text: string;
	code?: string;
	/** The setup check that tells whether this step is done. */
	check?: string;
}

const API_STEPS: GuideStep[] = [
	{
		title: 'Add the interceptor to the API',
		text: 'Install @nest-rn-lens/nest and add it to the module you pass to NestFactory.create().',
		code: `npm install @nest-rn-lens/nest

// src/app.module.ts
import { NestRnLensModule } from '@nest-rn-lens/nest';

@Module({
  imports: [NestRnLensModule.forRoot({ app: 'api' })],
})
export class AppModule {}`,
		check: 'nest-interceptor',
	},
	{
		title: 'Allow browser requests (CORS)',
		text: 'Browser apps call the API from another port. In the API’s src/main.ts:',
		code: `const app = await NestFactory.create(AppModule);
if (process.env.NODE_ENV !== 'production') {
  app.enableCors();
}`,
		check: 'cors',
	},
];

const CLIENT_STEPS: Record<ClientKind, GuideStep[]> = {
	expo: [
		{
			title: 'Enable the in-editor preview',
			text: 'The panel shows your app’s web build. In the app folder:',
			code: 'npx expo install react-native-web react-dom',
			check: 'web',
		},
		{
			title: 'Tag the app’s requests',
			text: 'The fix button adds a small file that does it for every API request. By hand, add the header where you call the API:',
			code: `const headers = new Headers(init.headers);
if (__DEV__) {
  headers.set('x-nest-rn-lens-app', 'mobile');
}
fetch(\`\${API_URL}\${path}\`, { ...init, headers });`,
			check: 'client',
		},
	],
	next: [
		{
			title: 'Tag the app’s requests',
			text: 'The fix button adds a small component that does it for every API request. By hand, add the headers where you call the API:',
			code: `const headers = new Headers(init.headers);
if (process.env.NODE_ENV !== 'production') {
  headers.set('x-nest-rn-lens-app', 'web');
  headers.set('x-nest-rn-lens-caller', window.location.pathname);
}
fetch(\`\${API_URL}\${path}\`, { ...init, headers });`,
			check: 'client',
		},
	],
};

const LAUNCH: GuideStep = {
	title: 'Launch the session',
	text: 'Click Launch session: NestRN Lens starts the API and the app for you. Don’t run npm run dev yourself, or the panel can’t read their traffic.',
};

interface SetupGuideProps {
	result?: ValidationResult;
	onFix: (stepId: string) => void;
	onClose: () => void;
	onOpenOnline: () => void;
}

/** Step-by-step setup for the tracked app, with each step's state from the checks. */
export function SetupGuide({ result, onFix, onClose, onOpenOnline }: SetupGuideProps) {
	const target = result?.target ?? 'expo';
	const steps = [...API_STEPS, ...CLIENT_STEPS[target], LAUNCH];

	return (
		<section className="guide" aria-label="Setup guide">
			<header className="guide__head">
				<div>
					<h2>Setup guide</h2>
					<p className="muted small">{target === 'next' ? 'Next.js' : 'React Native (Expo)'} with a NestJS API</p>
				</div>
				<button className="icon-button" title="Close guide" aria-label="Close guide" onClick={onClose}>
					<XIcon size={14} />
				</button>
			</header>

			<ol className="guide__steps">
				{steps.map((step, index) => {
					const check = result?.steps.find((s) => s.id === step.check);
					const done = step === LAUNCH ? !!result?.canStart : check?.status === 'pass';
					const fix = check?.status !== 'pass' ? check?.fix : undefined;
					return (
						<li key={step.title} className={`guide__step${done ? ' guide__step--done' : ''}`}>
							<span className="guide__marker">{done ? <CheckIcon size={11} strokeWidth={3} /> : index + 1}</span>
							<div className="guide__body">
								<strong>{step.title}</strong>
								<p>{done && check?.detail ? check.detail : step.text}</p>
								{fix && (
									<button className="button button--small button--primary" onClick={() => onFix(check!.id)}>
										{fix.label}
									</button>
								)}
								{step.code && !done && <CodeBlock code={step.code} />}
							</div>
						</li>
					);
				})}
			</ol>

			<button className="link-button" onClick={onOpenOnline}>
				<ExternalIcon size={12} /> Open the full guide
			</button>
		</section>
	);
}

function CodeBlock({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="guide__code">
			<pre>{code}</pre>
			<button
				className="icon-button"
				title="Copy"
				aria-label="Copy code"
				onClick={async () => {
					await navigator.clipboard.writeText(code);
					setCopied(true);
					setTimeout(() => setCopied(false), 1200);
				}}
			>
				{copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
			</button>
		</div>
	);
}
