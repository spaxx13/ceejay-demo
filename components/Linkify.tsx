// Turns any http(s):// or www. URL inside a block of customer-typed text
// (e.g. a pasted Google Maps / Grab link in the Landmark field) into a
// clickable link, so staff/technicians can tap straight to navigation
// instead of copy-pasting raw text. Pure rendering, no state — safe in
// both Server and Client Components.
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

export default function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const start = match.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    // Trailing punctuation (a closing paren from "(near ...)", a period
    // ending the sentence, etc.) is almost never part of the URL itself —
    // peel it off so the link doesn't swallow it.
    let url = match[0];
    let trailing = "";
    const trimmed = url.match(/^(.*?)([),.;:'"\]]+)$/);
    if (trimmed) {
      url = trimmed[1];
      trailing = trimmed[2];
    }

    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-600 break-all">
        {url}
      </a>
    );
    if (trailing) parts.push(trailing);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <>{parts}</>;
}
