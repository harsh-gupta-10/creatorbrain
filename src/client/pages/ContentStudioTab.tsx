import React, { useEffect, useState } from 'react';
import {
  ArrowUp,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Plus,
  Edit3,
  Save,
  FileText,
  Tag,
  Pin,
  Film,
  Camera,
  FileCode,
  Image as ImageIcon,
  HelpCircle,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, EmptyState, ErrorNote, Spinner, ICON, Dialog } from '../components/ui';
import type { Project, ProjectAsset, AssetType } from '../../shared/types';

const ASSET_ICONS: Record<AssetType, LucideIcon> = {
  titles: FileText,
  description: FileText,
  tags: Tag,
  pinned_comment: Pin,
  shorts_caption: Film,
  instagram_caption: Camera,
  script_outline: FileCode,
  thumbnail_ideas: ImageIcon,
  community_post: HelpCircle,
  compliance_report: ShieldCheck,
};

export const ContentStudioTab: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [activeAssetType, setActiveAssetType] = useState<AssetType>('titles');

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'agent'; text: string; time: string; isError?: boolean }[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Asset Editing State
  const [editableContent, setEditableContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // New Project Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBrief, setNewBrief] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await api.studio.getProjects();
      setProjects(res.projects || []);
      if (res.projects?.length > 0 && !selectedProjectId) {
        selectProject(res.projects[0].id);
      }
    } catch (err: unknown) {
      console.error('Failed to load projects:', err);
      setError(err instanceof Error ? err.message : 'Could not load projects');
    }
  };

  const selectProject = async (id: string) => {
    setSelectedProjectId(id);
    try {
      const res = await api.studio.getProject(id);
      setSelectedProject(res.project);
      setAssets(res.assets || []);

      const active = res.assets.find((a) => a.type === activeAssetType) || res.assets[0];
      if (active) {
        setActiveAssetType(active.type);
        setEditableContent(active.content);
      }

      const intro = {
        role: 'agent' as const,
        text: `Working on "${res.project.title}". Ask for product research, a script in your voice, new title options or a disclosure check.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages([intro]);
      // Restore this project's saved conversation
      api.chats
        .get(`studio:${res.project.id}`)
        .then(({ messages: saved }) => {
          if (!saved.length) return;
          setChatMessages([
            intro,
            ...saved.map((m) => ({
              role: m.role === 'user' ? ('user' as const) : ('agent' as const),
              text: m.content,
              time: new Date(m.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            })),
          ]);
        })
        .catch(() => {});
    } catch (err: unknown) {
      console.error('Failed to select project:', err);
      setError(err instanceof Error ? err.message : 'Could not open the project');
    }
  };

  const handleAssetTabChange = (type: AssetType) => {
    setActiveAssetType(type);
    const target = assets.find((a) => a.type === type);
    setEditableContent(target?.content || '');
    setIsEditing(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isGenerating || !selectedProjectId) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      {
        role: 'user',
        text: userText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsGenerating(true);
    try {
      const res = await api.studio.chat({
        projectId: selectedProjectId,
        message: userText,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: res.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (res.assets) {
        setAssets(res.assets);
        const cur = res.assets.find((a) => a.type === activeAssetType);
        if (cur) setEditableContent(cur.content);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown generation error';
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: `Could not get a reply: ${message}. Check the model provider in Settings.`,
          isError: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setModalError(null);
    try {
      const res = await api.studio.createProject({
        title: newTitle.trim(),
        brief: newBrief.trim(),
        status: 'Idea',
      });
      setShowNewModal(false);
      setNewTitle('');
      setNewBrief('');
      await loadProjects();
      selectProject(res.project.id);
    } catch (err: unknown) {
      console.error('Failed to create project:', err);
      setModalError(err instanceof Error ? err.message : 'Could not create the project');
    }
  };

  const handleSaveAssetEdit = async () => {
    const curAsset = assets.find((a) => a.type === activeAssetType);
    if (!curAsset) return;

    setError(null);
    setIsSaving(true);
    try {
      await api.studio.editAsset(curAsset.id, {
        content: editableContent,
        title: curAsset.title,
      });
      setIsEditing(false);
      const res = await api.studio.getProject(selectedProjectId);
      setAssets(res.assets || []);
    } catch (err: unknown) {
      console.error('Failed to save asset edit:', err);
      setError(err instanceof Error ? err.message : 'Could not save the edit');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyAsset = (content: string, type: string) => {
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleExportMarkdown = () => {
    if (!selectedProject) return;

    const markdownDoc = `# ${selectedProject.title}
**Status:** ${selectedProject.status}
**Brief:** ${selectedProject.brief}

${assets
  .map(
    (a) => `## ${a.title}
\`\`\`
${a.content}
\`\`\`
`
  )
  .join('\n\n')}
`;

    const blob = new Blob([markdownDoc], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedProject.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-assets.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!selectedProject) return;
    try {
      const updated = { ...selectedProject, status: newStatus };
      setSelectedProject(updated);
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? { ...p, status: newStatus } : p))
      );
    } catch (err: unknown) {
      console.error('Failed to update status:', err);
    }
  };

  const currentAsset = assets.find((a) => a.type === activeAssetType);

  return (
    <div className="w-full">
      <PageHeader
        title="Content Studio"
        description="One project per video. Draft every asset with the studio agent, then edit, copy or export"
        actions={
          <>
            <button
              onClick={() => {
                setModalError(null);
                setShowNewModal(true);
              }}
              className="btn btn-secondary"
            >
              <Plus {...ICON} />
              New project
            </button>
            <button onClick={handleExportMarkdown} disabled={!selectedProject} className="btn btn-primary">
              <Download {...ICON} />
              Export Markdown
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="card p-4 mb-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="studio-project" className="sr-only">
            Project
          </label>
          <select
            id="studio-project"
            value={selectedProjectId}
            onChange={(e) => selectProject(e.target.value)}
            className="input w-auto min-w-0 max-w-sm font-medium"
          >
            {projects.length === 0 && <option value="">No projects yet</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {selectedProject && (
            <div className="relative">
              <span
                className={`dot absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  selectedProject.status === 'Published' ? 'bg-positive' : 'bg-fg-3'
                }`}
                aria-hidden="true"
              />
              <label htmlFor="studio-status" className="sr-only">
                Status
              </label>
              <select
                id="studio-status"
                value={selectedProject.status}
                onChange={(e) => handleStatusChange(e.target.value as Project['status'])}
                className="input w-auto pl-7"
              >
                <option value="Idea">Idea</option>
                <option value="Scripted">Scripted</option>
                <option value="Filmed">Filmed</option>
                <option value="Edited">Edited</option>
                <option value="Published">Published</option>
              </select>
            </div>
          )}
        </div>
        <p className="text-[13px] text-fg-2 min-w-0 truncate">{selectedProject?.brief || 'No brief yet'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 h-[620px] panel flex flex-col overflow-hidden">
          <div className="h-12 px-4 border-b border-line flex items-center justify-between">
            <h2 id="studio-agent-title" className="text-[13px] font-medium text-fg">Studio agent</h2>
            <span className="meta">Researches, drafts and checks</span>
          </div>

          <div
            className="flex-1 overflow-y-auto p-4 space-y-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-labelledby="studio-agent-title"
            tabIndex={0}
          >
            {chatMessages.length === 0 && !selectedProjectId && (
              <EmptyState
                icon={<FolderKanban {...ICON} />}
                title="No project selected"
                description="Create a project to start drafting its assets"
              />
            )}
            {chatMessages.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="flex flex-col items-end gap-1">
                  <div className="max-w-[88%] rounded-[12px] bg-raised px-3 py-2 text-fg whitespace-pre-wrap">
                    <span className="sr-only">You said: </span>
                    {msg.text}
                  </div>
                  <span className="meta">{msg.time}</span>
                </div>
              ) : (
                <div key={i} className="flex flex-col gap-1">
                  {msg.isError ? (
                    <ErrorNote>{msg.text}</ErrorNote>
                  ) : (
                    <div className="text-fg-2 whitespace-pre-wrap">
                      <span className="sr-only">Studio agent: </span>
                      {msg.text}
                    </div>
                  )}
                  <span className="meta">{msg.time}</span>
                </div>
              )
            )}
            {isGenerating && (
              <div className="flex items-center gap-2 text-[13px] text-fg-3" role="status">
                <Spinner />
                Researching products, drafting and checking disclosures
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t border-line flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask the studio agent"
              aria-label="Message the studio agent"
              disabled={!selectedProjectId}
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatInput.trim()}
              aria-label="Send"
              className="btn btn-accent w-9 px-0 shrink-0"
            >
              <ArrowUp {...ICON} />
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 h-[620px] panel flex flex-col overflow-hidden">
          <div
            className="border-b border-line p-2 overflow-x-auto flex items-center gap-1"
            role="tablist"
            aria-label="Project assets"
            onKeyDown={(e) => {
              // Arrow keys move between tabs (WAI-ARIA tabs pattern)
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
              if (i < 0) return;
              e.preventDefault();
              const next =
                e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              tabs[next].focus();
              tabs[next].click();
            }}
          >
            {[
              { type: 'titles' as const, label: 'Titles' },
              { type: 'description' as const, label: 'Description' },
              { type: 'tags' as const, label: 'Tags' },
              { type: 'pinned_comment' as const, label: 'Pinned comment' },
              { type: 'shorts_caption' as const, label: 'Shorts' },
              { type: 'instagram_caption' as const, label: 'Instagram' },
              { type: 'script_outline' as const, label: 'Script outline' },
              { type: 'thumbnail_ideas' as const, label: 'Thumbnail' },
              { type: 'community_post' as const, label: 'Community post' },
              { type: 'compliance_report' as const, label: 'Compliance' },
            ].map((tab) => {
              const Icon = ASSET_ICONS[tab.type] || FileText;
              const isActive = activeAssetType === tab.type;
              return (
                <button
                  key={tab.type}
                  id={`asset-tab-${tab.type}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="asset-panel"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleAssetTabChange(tab.type)}
                  className={`flex items-center gap-2 h-8 px-3 rounded-[8px] text-[13px] whitespace-nowrap transition-colors ${
                    isActive ? 'bg-raised text-fg' : 'text-fg-2 hover:text-fg hover:bg-raised'
                  }`}
                >
                  <Icon {...ICON} className={isActive ? 'text-fg-2' : 'text-fg-3'} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            id="asset-panel"
            role="tabpanel"
            aria-labelledby={`asset-tab-${activeAssetType}`}
            className="flex-1 min-h-0 flex flex-col"
          >
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-medium text-fg truncate">{currentAsset?.title || activeAssetType}</h2>
              <p className="text-[12px] leading-4 text-fg-3 mt-1">Drafted from your past videos and captions</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setIsEditing(!isEditing)} className="btn btn-ghost btn-sm" aria-pressed={isEditing}>
                <Edit3 {...ICON} />
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
              {isEditing && (
                <button onClick={handleSaveAssetEdit} disabled={isSaving} aria-busy={isSaving} className="btn btn-primary btn-sm">
                  {isSaving ? <Spinner /> : <Save {...ICON} />}
                  Save
                </button>
              )}
              <button
                onClick={() => handleCopyAsset(editableContent, activeAssetType)}
                className="btn btn-secondary btn-sm"
              >
                {copiedType === activeAssetType ? (
                  <>
                    <Check {...ICON} className="text-positive" />
                    <span role="status">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy {...ICON} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto">
            {isEditing ? (
              <textarea
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                aria-label="Asset content"
                className="input h-full font-mono text-[13px] resize-none"
              />
            ) : editableContent ? (
              <pre className="font-mono text-[13px] leading-5 text-fg whitespace-pre-wrap select-text">
                {editableContent}
              </pre>
            ) : (
              <EmptyState
                icon={<FileText {...ICON} />}
                title="Nothing drafted yet"
                description="Ask the studio agent to draft this asset"
              />
            )}
          </div>
          </div>
        </div>
      </div>

      {showNewModal && (
        <Dialog
          onClose={() => setShowNewModal(false)}
          labelledBy="new-project-title"
          backdropClassName="bg-fg/30"
          className="panel w-full max-w-md p-6 shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
        >
            <h2 id="new-project-title" className="text-[16px] font-medium text-fg mb-4">
              New video project
            </h2>
            <form onSubmit={handleCreateNewProject} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="new-project-name">
                  Title
                </label>
                <input
                  id="new-project-name"
                  type="text"
                  required
                  aria-required="true"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Vivo T3 Pro 5G review"
                  className="input"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="new-project-brief">
                  Brief
                </label>
                <textarea
                  id="new-project-brief"
                  rows={3}
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  placeholder="8-minute review comparing battery life and cameras for students"
                  className="input"
                />
              </div>
              {modalError && <ErrorNote>{modalError}</ErrorNote>}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create project
                </button>
              </div>
            </form>
        </Dialog>
      )}
    </div>
  );
};
