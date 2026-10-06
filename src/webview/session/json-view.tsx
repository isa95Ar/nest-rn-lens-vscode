// Pretty-printed, syntax-colored JSON, without a library.
const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function JsonView({ value }: { value: unknown }) {
	const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
	if (typeof value === 'string') {
		return <pre className="json">{text}</pre>;
	}

	const parts: React.ReactNode[] = [];
	let last = 0;
	for (const match of text.matchAll(TOKEN)) {
		const index = match.index ?? 0;
		parts.push(text.slice(last, index));
		const [token, string, colon, literal] = match;
		const kind = string ? (colon ? 'key' : 'string') : literal ? 'literal' : 'number';
		parts.push(
			<span key={index} className={`json__${kind}`}>
				{colon ? string : token}
			</span>,
		);
		if (colon) {
			parts.push(colon);
		}
		last = index + token.length;
	}
	parts.push(text.slice(last));
	return <pre className="json">{parts}</pre>;
}
