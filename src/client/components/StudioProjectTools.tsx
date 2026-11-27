import { useEffect, useState } from 'react';
import { BarChart3, Clapperboard, FileCheck, Link, X } from 'lucide-react';
import {
  projectPlacements,
  type ProjectPlacementLink,
  type PublicationReview,
  type ScriptReviewNote,
} from '../../shared/creator-workflows';
import type { Project, ProjectAsset } from '../../shared/types';
import { api } from '../lib/api';
import { linkProps } from '../lib/router';
import { ClipFinder } from './ClipFinder';
import { Dialog, ErrorNote, ICON, Spinner, formatDate } from './ui';

const panels = [
  { id: 'publication', label: 'Published video', icon: BarChart3 },
  { id: 'clips', label: 'Find a clip', icon: Clapperboard },
  { id: 'review', label: 'Script review', icon: FileCheck },
  { id: 'links', label: 'Project link kit', icon: Link },
] as const;
export type ProjectToolPanel = (typeof panels)[number]['id'];

export default function StudioProjectTools({
  project,
  assets,
  initial,
  readOnly,
  onClose,
  onChange,
}: {
  project: Project;
  assets: ProjectAsset[];
  initial: ProjectToolPanel;
  readOnly: boolean;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [panel, setPanel] = useState(initial);
  return (
    <Dialog onClose={onClose} labelledBy="project-tools-heading" className="panel w-full max-w-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="project-tools-heading" className="text-lg font-semibold">
            Project tools
          </h2>
          <p className="mt-1 text-sm text-fg-2 break-words">{project.title}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" aria-label="Close project tools" onClick={onClose}>
          <X {...ICON} />
        </button>
      </div>
      <div role="group" aria-label="Choose a project tool" className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {panels.map(({ id, icon: Icon, label }) => (
          <button
            type="button"
            className={`btn btn-sm justify-start whitespace-normal h-auto min-h-9 ${panel === id ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={panel === id}
            key={id}
            onClick={() => setPanel(id)}
          >
            <Icon {...ICON} />
            {label}
          </button>
        ))}
      </div>
      {panel === 'publication' && <PublishedReview id={project.id} readOnly={readOnly} onChange={onChange} />}
      {panel === 'clips' && <ClipFinder topic={project.title} />}
      {panel === 'review' && <ScriptReview id={project.id} assets={assets} readOnly={readOnly} onChange={onChange} />}
      {panel === 'links' && <LinkKit id={project.id} readOnly={readOnly} />}
    </Dialog>
  );
}

type PublicationOption = { id: string; title: string; publishedAt: string };
function PublishedReview({ id, readOnly, onChange }: { id: string; readOnly: boolean; onChange: () => Promise<void> }) {
  const [review, setReview] = useState<PublicationReview>();
  const [options, setOptions] = useState<PublicationOption[]>([]);
  const [links, setLinks] = useState<ProjectPlacementLink[]>([]);
  const [selection, setSelection] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void Promise.all([api.workflows.publication(id), api.workflows.publicationOptions(), api.workflows.links(id)])
      .then(([data, { videos }, linkData]) => {
        if (!active) return;
        setReview(data);
        setOptions(videos);
        setLinks(linkData.links);
        setSelection(data.video?.id || '');
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  const video = review?.video;
  const videoMissingFromOptions = video && !options.some((option) => option.id === video.id);
  return (
    <section className="space-y-4" aria-label="Published video review">
      {error && <ErrorNote>{error}</ErrorNote>}
      {!review && !error && (
        <p className="text-sm text-fg-2" role="status">
          Loading publication review…
        </p>
      )}
      {review && options.length === 0 && !video && (
        <p className="text-sm text-fg-2">
          Study your published YouTube video in the{' '}
          <a className="underline" {...linkProps('/app/library')}>
            Library
          </a>{' '}
          to attach it here.
        </p>
      )}
      {review && !readOnly && (options.length > 0 || video) && (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              setReview(await api.workflows.attachVideo(id, selection || null));
              await onChange();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not save the video.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="published-video" className="field-label">
            Video from your Library
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id="published-video"
              className="input min-w-0 flex-1"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
            >
              <option value="">No video attached</option>
              {videoMissingFromOptions && <option value={video.id}>{video.title}</option>}
              {options.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={busy || selection === (video?.id || '')}>
              {busy && <Spinner />} Save video
            </button>
          </div>
        </form>
      )}
      {video && (
        <>
          <h3 className="font-semibold text-sm break-words">
            <a href={video.url || undefined} target="_blank" rel="noreferrer" className="hover:underline">
              {video.title}
            </a>
          </h3>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border border-line p-3 text-sm">
            <div>
              <dt className="text-fg-2">Latest recorded views</dt>
              <dd className="text-lg font-semibold">{video.views.toLocaleString()}</dd>
            </div>
            {video.snapshot && (
              <div>
                <dt className="text-fg-2">Views near day seven</dt>
                <dd className="text-lg font-semibold">{video.snapshot.views.toLocaleString()}</dd>
                <dd className="text-xs text-fg-3">Recorded {formatDate(video.snapshot.sampledAt)}</dd>
              </div>
            )}
            {review.baseline && (
              <div>
                <dt className="text-fg-2">Median near day seven</dt>
                <dd className="text-lg font-semibold">{review.baseline.median.toLocaleString()}</dd>
                <dd className="text-xs text-fg-3">{review.baseline.uploads} similar uploads</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {review && <p className="text-sm leading-relaxed text-fg-2">{review.nextStep}</p>}
      {links.length > 0 && (
        <>
          <h3 className="text-sm font-semibold">Tracked clicks by placement</h3>
          <PlacementList links={links} />
        </>
      )}
    </section>
  );
}

function PlacementList({ links }: { links: ProjectPlacementLink[] }) {
  const [copied, setCopied] = useState('');
  return (
    <ul className="border-y border-line divide-y divide-line">
      {links.map((link) => {
        const href = window.location.origin + '/s/' + link.slug;
        return (
          <li key={link.slug} className="flex items-center flex-wrap justify-between gap-2 py-2.5">
            <div className="min-w-0 flex-1 basis-44 text-sm">
              <strong className="font-medium">{projectPlacements[link.placement]}</strong>
              <p className="meta truncate" title={link.destination}>
                {link.clicks.toLocaleString()} clicks · {link.destination}
              </p>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              aria-label={'Open ' + projectPlacements[link.placement]}
            >
              Open
            </a>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label={'Copy ' + projectPlacements[link.placement]}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(href);
                  setCopied(link.slug);
                } catch {
                  setCopied('failed');
                }
              }}
            >
              {copied === link.slug ? 'Copied' : 'Copy'}
            </button>
          </li>
        );
      })}
      {copied === 'failed' && (
        <li className="py-2 text-sm text-fg-2" role="status">
          Clipboard unavailable. Use Open to get the URL.
        </li>
      )}
    </ul>
  );
}

function LinkKit({ id, readOnly }: { id: string; readOnly: boolean }) {
  const [links, setLinks] = useState<ProjectPlacementLink[]>([]);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api.workflows
      .links(id)
      .then(({ links }) => {
        if (active) setLinks(links);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <section aria-label="Project link kit" className="space-y-4">
      <p className="text-sm text-fg-2">
        Make three tracked links for one destination. See imported commission in{' '}
        <a className="underline" {...linkProps('/app/amazon')}>
          Amazon earnings
        </a>
        .
      </p>
      {!readOnly && (
        <form
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const { links: saved } = await api.workflows.makeLinks(id, destination);
              setLinks((previous) => [
                ...saved,
                ...previous.filter((link) => saved.every((item) => item.slug !== link.slug)),
              ]);
              setDestination('');
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Could not create the link kit.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label" htmlFor="kit-destination">
            Destination URL
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1 min-w-40"
              id="kit-destination"
              type="url"
              required
              maxLength={2048}
              placeholder="https://…"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
            <button className="btn btn-primary" disabled={busy || !destination.trim()}>
              {busy && <Spinner />} Create placement links
            </button>
          </div>
        </form>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {links.length > 0 && <PlacementList links={links} />}
    </section>
  );
}

const draftOptions = {
  full_script: 'Full script',
  short_script: 'Short script',
  script_outline: 'Script outline',
} as const;
type ReviewType = keyof typeof draftOptions;
function ScriptReview({
  id,
  assets,
  readOnly,
  onChange,
}: {
  id: string;
  assets: ProjectAsset[];
  readOnly: boolean;
  onChange: () => Promise<void>;
}) {
  const drafts = (Object.keys(draftOptions) as ReviewType[]).filter((type) =>
    assets.some((asset) => asset.type === type && asset.content.trim())
  );
  const [type, setType] = useState(drafts[0]);
  const [result, setResult] = useState<{ notes: ScriptReviewNote[]; reused: boolean; draftKey: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (readOnly)
    return <p className="text-sm text-fg-2">Open a project in your own workspace to review and edit a script.</p>;
  if (!drafts.length)
    return <p className="text-sm text-fg-2">Save a Short, full script, or outline in Studio to review it here.</p>;
  return (
    <section aria-label="Script review" className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          setResult(undefined);
          try {
            setResult(await api.workflows.review(id, type));
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not review the script.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm text-fg-2">Reviews the first 180 lines or 16,000 characters of the saved draft.</p>
        <label className="field-label" htmlFor="review-draft">
          Saved draft
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            className="input flex-1 min-w-36"
            id="review-draft"
            value={type}
            disabled={busy}
            onChange={(event) => {
              setType(event.target.value as ReviewType);
              setResult(undefined);
            }}
          >
            {drafts.map((draft) => (
              <option value={draft} key={draft}>
                {draftOptions[draft]}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={busy}>
            {busy && <Spinner />} Review script
          </button>
        </div>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {result && (
        <p className="text-sm text-fg-2" role="status">
          {result.reused ? 'Opened the saved review for this draft.' : 'Review complete.'}{' '}
          {!result.notes.length && 'No edits to apply.'}
        </p>
      )}
      {result && result.notes.length > 0 && (
        <ol className="divide-y divide-line border-y border-line">
          {result.notes.map((note) => (
            <li key={note.line} className="py-3 space-y-2 text-sm">
              <p>
                <strong className="font-medium">Line {note.line}</strong> · {note.issue}
              </p>
              <p className="text-fg-2 break-words">
                {assets.find((asset) => asset.type === type)?.content.split('\n')[note.line - 1]}
              </p>
              {note.replacement && (
                <>
                  <blockquote className="border-l-2 border-line pl-3 text-fg-2">{note.replacement}</blockquote>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const { draftKey } = await api.workflows.applyLine(
                          id,
                          type,
                          result.draftKey,
                          note.line,
                          note.replacement
                        );
                        setResult({
                          ...result,
                          draftKey,
                          notes: result.notes.filter((item) => item.line !== note.line),
                        });
                        await onChange();
                      } catch (error) {
                        setError(error instanceof Error ? error.message : 'Could not apply that edit.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Apply line {note.line}
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
