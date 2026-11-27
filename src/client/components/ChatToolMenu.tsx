const shortcuts = [
  ['Shorten last link', 'Make this a short link'],
  ['Check link clicks', '/link-stats'],
  ['Brain and analytics', '/insights'],
  ['Hooks', '/tool hook '],
  ['Script outline', '/tool script '],
  ['Thumbnail ideas', '/tool thumbnail '],
  ['Captions', '/tool captions '],
  ['Run saved agent', '/run '],
] as const;

export function ChatToolMenu({ onChoose, disabled }: { onChoose: (prompt: string) => void; disabled?: boolean }) {
  return (
    <details className="text-[13px] text-fg-2">
      <summary className="cursor-pointer w-fit py-1">Chat tools</summary>
      <div className="flex flex-wrap gap-1 pt-1 pb-2">
        {shortcuts.map(([label, prompt]) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            className="btn btn-secondary btn-sm"
            onClick={(event) => {
              const details = event.currentTarget.closest('details');
              if (details) details.open = false;
              onChoose(prompt);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}
