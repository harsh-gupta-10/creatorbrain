/** Chat output stays plain text except for explicit HTTPS links. */
export function ChatLinks({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https:\/\/[^\s<>"\])]+)/g).map((part, i) =>
        part.startsWith('https://') ? (
          <a key={i} className="underline break-all" href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}
