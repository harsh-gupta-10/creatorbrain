import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { AmazonReportFile } from '../../shared/amazon';
import { ErrorNote } from './ui';

export function AmazonLinkBuilder({ marketplace }: { marketplace: string }) {
  const [input, setInput] = useState('');
  const [link, setLink] = useState<{ taggedUrl: string; disclosure: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function build(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setLink(null);
    try {
      setLink(await api.amazon.buildLink({ productUrl: input }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 mb-8 space-y-3">
      <h2 className="font-medium">Build an affiliate link</h2>
      <p className="text-fg-2 text-[13px]">
        Paste a product URL from {marketplace} or enter its ASIN. This works with your tracking ID alone.
      </p>
      <form onSubmit={build} className="flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-48"
          value={input}
          required
          maxLength={2048}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Amazon product URL or ASIN"
          placeholder="Amazon product URL or ASIN"
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Build link
        </button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {link && (
        <div className="well p-3 space-y-2">
          <a className="underline break-all" href={link.taggedUrl} target="_blank" rel="noreferrer">
            {link.taggedUrl}
          </a>
          <p className="text-fg-2">{link.disclosure}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link.taggedUrl);
                setNotice('Copied');
              } catch {
                setNotice('Copy the link above.');
              }
            }}
          >
            Copy link
          </button>
          <span className="ml-3" role="status">
            {notice}
          </span>
        </div>
      )}
    </section>
  );
}

export function AmazonReportsPanel() {
  const [reports, setReports] = useState<AmazonReportFile[]>([]);
  const [reportLink, setReportLink] = useState<{ filename: string; url: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setReportLink(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read Amazon reports.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={busy}
        onClick={() =>
          run(async () => {
            setNotice('');
            setReports([]);
            const result = await api.amazon.listReports();
            setReports(result.reports);
            if (!result.configured)
              setNotice('Save your Creators API credentials in Settings to check for downloadable API reports.');
            else if (!result.reports.length)
              setNotice(
                'Amazon made no files available through the API. You can still export your earnings from Associates Central.'
              );
          })
        }
      >
        Check Amazon API reports
      </button>
      {notice && (
        <p role="status" className="text-fg-2">
          {notice}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {reports.length > 0 && (
        <ul className="space-y-2 max-h-40 overflow-y-auto">
          {reports.map((report) => (
            <li key={report.filename} className="flex items-center justify-between gap-3">
              <span className="break-all text-fg-2">{report.filename}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setReportLink({ filename: report.filename, ...(await api.amazon.downloadReport(report.filename)) });
                  })
                }
              >
                Get download link
              </button>
            </li>
          ))}
        </ul>
      )}
      {reportLink && (
        <a className="underline" href={reportLink.url} target="_blank" rel="noreferrer">
          Download {reportLink.filename}
        </a>
      )}
    </div>
  );
}
