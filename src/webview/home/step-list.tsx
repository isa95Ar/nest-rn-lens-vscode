import type { StepStatus, ValidationStep } from '../../shared/protocol';
import { AlertIcon, CheckIcon, XIcon } from '../components/icons';

export function StepList({ steps, onFix }: { steps: ValidationStep[]; onFix: (stepId: string) => void }) {
	return (
		<ol className="steps">
			{steps.map((step, index) => (
				<li key={step.id} className={`step step--${step.status}`} style={{ animationDelay: `${index * 30}ms` }}>
					<StepIcon status={step.status} />
					<div className="step__body">
						<span className="step__title">{step.title}</span>
						{step.detail && <span className="step__detail">{step.detail}</span>}
						{step.fix && (step.status === 'fail' || step.status === 'warn') && (
							<div className="step__fix">
								<button className="button button--small" onClick={() => onFix(step.id)} title={step.fix.command ?? step.fix.summary}>
									{step.fix.label}
								</button>
								<span className="step__fix-summary">{step.fix.summary}</span>
							</div>
						)}
					</div>
				</li>
			))}
		</ol>
	);
}

function StepIcon({ status }: { status: StepStatus }) {
	return (
		<span className="step__icon" aria-label={status}>
			{status === 'running' && <span className="spinner" />}
			{status === 'pass' && <CheckIcon size={11} strokeWidth={3} />}
			{status === 'warn' && <AlertIcon size={12} strokeWidth={3} />}
			{status === 'fail' && <XIcon size={11} strokeWidth={3} />}
		</span>
	);
}
