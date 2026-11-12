import React, { useEffect, useState } from 'react';
import {
  FolderKanban,
  Send,
  Sparkles,
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
} from 'lucide-react';
import { api } from '../lib/api';
import type { Project, ProjectAsset, AssetType } from '../../shared/types';

const ASSET_ICONS: Record<AssetType, React.ComponentType<{ className?: string }>> = {
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
    { role: 'user' | 'agent'; text: string; time: string }[]
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

      setChatMessages([
        {
          role: 'agent',
          text: `Studio Agent ready for project "${res.project.title}". You can ask me to research new products, write scripts in your DNA voice, refine title options, or check compliance!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: unknown) {
      console.error('Failed to select project:', err);
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
          text: `⚠️ Error communicating with Studio Agent: ${message}. Please check provider setup in Settings.`,
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
    }
  };

  const handleSaveAssetEdit = async () => {
    const curAsset = assets.find((a) => a.type === activeAssetType);
    if (!curAsset) return;

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
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
      {/* Top Project Selector & Actions Bar */}
      <div className="glass-panel rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 shadow-sm">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => selectProject(e.target.value)}
                className="bg-[#090d18] border border-white/[0.12] rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 transition"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              {selectedProject && (
                <select
                  value={selectedProject.status}
                  onChange={(e) => handleStatusChange(e.target.value as Project['status'])}
                  className={`text-xs font-bold uppercase rounded-xl px-3 py-1.5 border focus:outline-none transition ${
                    selectedProject.status === 'Published'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : selectedProject.status === 'Scripted'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <option value="Idea">Idea</option>
                  <option value="Scripted">Scripted</option>
                  <option value="Filmed">Filmed</option>
                  <option value="Edited">Edited</option>
                  <option value="Published">Published</option>
                </select>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl truncate">
              {selectedProject?.brief || 'No brief provided yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold border border-white/[0.08] transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 text-indigo-200 text-xs font-bold border border-indigo-500/30 transition active:scale-95 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Markdown
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Studio Chat & Right Asset Suite Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: AI Studio Chat (5 Cols) */}
        <div className="lg:col-span-5 h-[620px] rounded-3xl glass-panel flex flex-col overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">Studio Agent</span>
              <span className="text-[10px] text-indigo-300 font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25">
                DNA Guided
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Autonomous Tool Loop</span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-tr-none shadow-md'
                      : 'bg-white/[0.04] text-slate-200 border border-white/[0.08] rounded-tl-none shadow-md'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.time}</span>
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2 p-3 text-xs text-indigo-300 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl animate-pulse">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Agents collaborating: Product Researcher, Studio Agent & Compliance Checker...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.06] bg-black/30 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g. Making a review on Motorola Edge 50, budget ₹22k angle..."
              className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatInput.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 disabled:opacity-50 transition active:scale-95 shadow-md shadow-indigo-600/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Column: Asset Suite Inspector (7 Cols) */}
        <div className="lg:col-span-7 h-[620px] rounded-3xl glass-panel flex flex-col overflow-hidden shadow-2xl">
          {/* Asset Category Tabs Bar */}
          <div className="border-b border-white/[0.06] bg-black/25 p-2.5 overflow-x-auto flex items-center gap-1.5">
            {[
              { type: 'titles' as const, label: '5 Titles' },
              { type: 'description' as const, label: 'Description' },
              { type: 'tags' as const, label: 'Tags' },
              { type: 'pinned_comment' as const, label: 'Pinned Comment' },
              { type: 'shorts_caption' as const, label: 'Shorts' },
              { type: 'instagram_caption' as const, label: 'Instagram' },
              { type: 'script_outline' as const, label: 'Script Outline' },
              { type: 'thumbnail_ideas' as const, label: 'Thumbnail' },
              { type: 'community_post' as const, label: 'Community Poll' },
              { type: 'compliance_report' as const, label: 'Compliance' },
            ].map((tab) => {
              const Icon = ASSET_ICONS[tab.type] || FileText;
              const isActive = activeAssetType === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => handleAssetTabChange(tab.type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Asset Content Header & Action Buttons */}
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-black/15">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {currentAsset?.title || activeAssetType}
              </h3>
              <p className="text-[11px] text-slate-400">
                Generated strictly in Kabir's signature Creator DNA Voice
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/[0.08] transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditing ? 'Cancel' : 'Edit Asset'}
              </button>
              {isEditing && (
                <button
                  onClick={handleSaveAssetEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-md shadow-indigo-600/30"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              )}
              <button
                onClick={() => handleCopyAsset(editableContent, activeAssetType)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.06] text-slate-200 hover:bg-white/[0.1] transition border border-white/[0.08]"
              >
                {copiedType === activeAssetType ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Asset Content Viewer / Editor */}
          <div className="flex-1 p-4 overflow-y-auto bg-black/20">
            {isEditing ? (
              <textarea
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                className="w-full h-full bg-[#080c16] border border-white/[0.1] rounded-2xl p-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
              />
            ) : (
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text font-normal">
                {editableContent || 'No content synthesized yet for this asset.'}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-panel rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-white/[0.1]">
            <h3 className="text-lg font-bold text-white">Create New Video Project</h3>
            <form onSubmit={handleCreateNewProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Vivo T3 Pro 5G Review: Battery King?"
                  className="w-full bg-[#090d18] border border-white/[0.1] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Creator Idea / Prompt Brief
                </label>
                <textarea
                  rows={3}
                  value={newBrief}
                  onChange={(e) => setNewBrief(e.target.value)}
                  placeholder="e.g. 8-minute in-depth review comparing battery life and cameras for students."
                  className="w-full bg-[#090d18] border border-white/[0.1] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-xs hover:from-indigo-400 hover:to-purple-500 transition shadow-lg shadow-indigo-600/30"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
