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

const ASSET_ICONS: Record<AssetType, any> = {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: `Error: ${err.message}. Please try again.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsGenerating(false);
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
      // Reload
      const res = await api.studio.getProject(selectedProjectId);
      setAssets(res.assets || []);
    } catch (err) {
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

---
*Exported from CreatorBrain Agentic Creator OS*`;

    const blob = new Blob([markdownDoc], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedProject.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_assets.md`;
    link.click();
    URL.revokeObjectURL(url);
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
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleStatusChange = async (newStatus: any) => {
    if (!selectedProject) return;
    try {
      const res = await api.studio.updateProject(selectedProject.id, { status: newStatus });
      setSelectedProject(res.project);
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const currentAsset = assets.find((a) => a.type === activeAssetType);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Project Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedProjectId}
                onChange={(e) => selectProject(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
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
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`text-xs font-bold uppercase rounded-lg px-2.5 py-1.5 border focus:outline-none ${
                    selectedProject.status === 'Published'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : selectedProject.status === 'Scripted'
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
          <button
            onClick={handleExportMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export Markdown
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Studio Chat & Right Asset Suite Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: AI Studio Chat (5 Cols) */}
        <div className="lg:col-span-5 h-[620px] rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl flex flex-col overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">Studio Agent</span>
              <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-800">
                Creator DNA Guided
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Autonomous Tool Loop</span>
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
                      ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none shadow-md'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none shadow-md'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.time}</span>
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2 p-3 text-xs text-cyan-400 bg-cyan-950/20 border border-cyan-800/40 rounded-xl animate-pulse">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Agents collaborating: Product Researcher, Studio Agent & Compliance Checker...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g. Making a review on Motorola Edge 50, budget ₹22k angle..."
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatInput.trim()}
              className="p-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 disabled:opacity-50 transition active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Column: Asset Suite Inspector (7 Cols) */}
        <div className="lg:col-span-7 h-[620px] rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl flex flex-col overflow-hidden shadow-2xl">
          {/* Asset Category Tabs Bar */}
          <div className="border-b border-slate-800 bg-slate-950/50 p-2 overflow-x-auto flex items-center gap-1.5">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Asset Content Header & Action Buttons */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/20">
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
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isEditing ? 'Cancel' : 'Edit Asset'}
              </button>
              {isEditing && (
                <button
                  onClick={handleSaveAssetEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              )}
              <button
                onClick={() => handleCopyAsset(editableContent, activeAssetType)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition border border-slate-700"
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
          <div className="flex-1 p-4 overflow-y-auto bg-slate-950/40">
            {isEditing ? (
              <textarea
                value={editableContent}
                onChange={(e) => setEditableContent(e.target.value)}
                className="w-full h-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition"
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
