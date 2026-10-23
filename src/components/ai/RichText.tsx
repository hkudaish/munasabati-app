import React from 'react';

/** Renders the **bold** markers the assistant writes (and nothing else): no HTML is ever interpreted. */
export default function RichText({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>))}</>;
}
