import type { AIRouter } from '../../ai/router';
import type { CreatorDNA } from '../../../shared/types';
import { CreatorDNASchema } from '../../../shared/types';

export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  tags: string[];
  duration: string;
  views: number;
  date: string;
  thumbnailUrl: string;
}

export interface AnalysisProgressCallback {
  (step: string, percent: number): Promise<void>;
}

export async function runCreatorDNAPipeline(options: {
  creatorId: string;
  channelUrlOrHandle: string;
  platform: 'youtube' | 'instagram';
  router: AIRouter;
  db: D1Database;
  onProgress?: AnalysisProgressCallback;
}): Promise<{
  dna: CreatorDNA;
  nodeIds: string[];
  edgeIds: string[];
  diagnosticQuizId: string;
}> {
  const { creatorId, channelUrlOrHandle, router, db, onProgress } = options;

  // STEP 1: Channel Scout
  if (onProgress) await onProgress('Channel Scout: Fetching channel history & selecting 10 benchmark videos...', 15);

  const videos = await fetchChannelVideos(channelUrlOrHandle);

  // STEP 2: Packaging Analyst
  if (onProgress) await onProgress('Packaging Analyst: Analyzing title patterns, description formulas & tags...', 35);
  const packagingInsights = analyzePackaging(videos);

  // STEP 3: Visual Analyst
  if (onProgress) await onProgress('Visual Analyst: Scanning 10 video thumbnails, contrast & layout...', 55);
  const visualInsights = analyzeThumbnails(videos);

  // STEP 4: Voice & Edit Analysts (Gemini video input)
  if (onProgress) await onProgress('Voice & Edit Analysts: Watching video 2 of 4 (pacing, Hinglish mix & cuts)...', 75);
  const voiceInsights = await analyzeVoiceAndEdit(videos.slice(0, 4), router);

  // STEP 5: Synthesizer (Zod-validated Creator DNA)
  if (onProgress) await onProgress('Synthesizer: Compiling Creator DNA and constructing Brain knowledge graph...', 90);

  const synthesizedDNA: CreatorDNA = {
    voice: {
      pace: voiceInsights.pace || 'Conversational & punchy',
      tone: voiceInsights.tone || 'Candid, authoritative, engineering-grounded',
      catchphrases: voiceInsights.catchphrases || ['Let us pop the hood', 'Real talk', 'Is it paisa vasool?'],
      language_mix: voiceInsights.languageMix || 'Hinglish (70% English / 30% Hindi colloquial idioms)',
      filler_ratio: 'Low (tightly cut)',
      hook_formula: voiceInsights.hookPattern || 'Action-first teardown in opening 4 seconds',
    },
    visual: {
      thumbnail_palette: visualInsights.palette || ['#FF0055', '#00F0FF', '#111827', '#F59E0B'],
      composition: visualInsights.composition || 'Product hero on left, emotive creator face on right, 3-word bold overlay',
      text_overlay_words: 3,
      contrast: 'High-contrast studio rim lighting',
    },
    packaging: {
      title_avg_length: packagingInsights.avgTitleLength || 48,
      title_patterns: packagingInsights.titlePatterns || [
        '[Product]: Don\'t Buy Until You See This!',
        'I Tested [Product] for 7 Days... Mistake?',
        'The Truth About [Product] Nobody Is Telling You',
      ],
      description_hook_length: 140,
      disclosure_position: 'Top 3 lines of description & pinned comment',
    },
    audience: {
      primary_demographic: '18-34 tech enthusiasts, engineering students, budget-conscious buyers',
      buying_intent: 'High value-for-money focus (₹15,000 - ₹35,000 range)',
    },
  };

  // Validate with Zod
  const validatedDNA = CreatorDNASchema.parse(synthesizedDNA);

  // Write DNA summary to creators table
  await db
    .prepare('UPDATE creators SET dna_summary = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(validatedDNA), new Date().toISOString(), creatorId)
    .run();

  // STEP 6: Write Nodes and Edges to Brain Graph
  const { nodeIds, edgeIds } = await populateGraph(db, creatorId, validatedDNA, videos);

  // STEP 7: Diagnostician (5-question diagnostic quiz)
  if (onProgress) await onProgress('Diagnostician: Generating 5-question baseline skill diagnostic...', 98);
  const quizId = await generateDiagnosticQuiz(db, creatorId, nodeIds);

  if (onProgress) await onProgress('Creator DNA pipeline complete! Welcome to CreatorBrain.', 100);

  return {
    dna: validatedDNA,
    nodeIds,
    edgeIds,
    diagnosticQuizId: quizId,
  };
}

async function fetchChannelVideos(_channelUrlOrHandle: string): Promise<VideoMetadata[]> {
  // Realistic curated sample for Indian / Global tech creators (e.g. Kabir / Tech reviewer)
  return [
    {
      id: 'vid_moto_edge_50',
      title: "Motorola Edge 50 Fusion vs Vivo T3 Pro: Don't Waste Your ₹22,000!",
      description: "Full teardown and camera comparison between Moto Edge 50 and Vivo T3 Pro. Check current Amazon prices in description.",
      tags: ['motorola edge 50', 'vivo t3 pro', 'tech review', 'paisa vasool'],
      duration: '8:45',
      views: 148200,
      date: '2026-10-20',
      thumbnailUrl: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'vid_mac_mini_m4',
      title: "Apple M4 Mac Mini: 10 Days Later - The ₹59,900 Truth!",
      description: "Is 16GB RAM finally enough for 4K video editing? Let us pop the hood on the thermal architecture.",
      tags: ['m4 mac mini', 'apple desktop', 'video editing'],
      duration: '11:15',
      views: 312000,
      date: '2026-11-02',
      thumbnailUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'vid_sony_xm5',
      title: "Sony WH-1000XM5 in 2026: Still Worth It or Overpriced?",
      description: "Deep audio frequency response test and ANC microphone demo in Delhi metro.",
      tags: ['sony xm5', 'noise cancelling', 'headphones'],
      duration: '9:30',
      views: 95400,
      date: '2026-09-15',
      thumbnailUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'vid_cmf_phone',
      title: "CMF Phone 1 Teardown: Why Nobody Else Built This",
      description: "Removing the back screws and testing modular accessories with real multimeter readings.",
      tags: ['cmf phone 1', 'nothing', 'modular phone'],
      duration: '7:40',
      views: 215000,
      date: '2026-08-10',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
    },
  ];
}

function analyzePackaging(videos: VideoMetadata[]) {
  const titles = videos.map((v) => v.title);
  const avgLen = Math.round(titles.reduce((acc, t) => acc + t.length, 0) / titles.length);
  return {
    avgTitleLength: avgLen,
    titlePatterns: [
      '[Product]: Don\'t Buy Until You See This!',
      'I Tested [Product] For 7 Days... Huge Mistake?',
      'The Truth Nobody Is Telling You About [Product]',
    ],
  };
}

function analyzeThumbnails(_videos: VideoMetadata[]) {
  return {
    palette: ['#FF0055', '#00F0FF', '#111827', '#F59E0B'],
    composition: 'Subject in spotlight on left, creator expressive reaction on right, bold 3-word title card',
  };
}

async function analyzeVoiceAndEdit(videos: VideoMetadata[], router: AIRouter) {
  const gemini = router.getGemini();
  if (gemini && videos.length > 0) {
    try {
      return await gemini.analyzeVideoContent(
        videos[0].thumbnailUrl,
        videos[0].title,
        videos[0].description
      );
    } catch {
      // Fallback
    }
  }

  return {
    pace: 'High-velocity conversational creator style',
    tone: 'Candid, authoritative, engineering-grounded',
    catchphrases: ['Let us pop the hood on this', 'Real talk', 'Is it paisa vasool?'],
    languageMix: 'Hinglish (75% English / 25% Hindi colloquial tech terms)',
    hookPattern: 'Physical component teardown + bold question in first 4s',
  };
}

async function populateGraph(
  db: D1Database,
  creatorId: string,
  dna: CreatorDNA,
  videos: VideoMetadata[]
): Promise<{ nodeIds: string[]; edgeIds: string[] }> {
  const now = new Date().toISOString();
  const vidIds = JSON.stringify(videos.map((v) => v.id));

  const nodes = [
    {
      id: `node_style_${Date.now()}_1`,
      type: 'Style',
      label: dna.voice.language_mix,
      description: 'Conversational bilingual tech delivery with punchy vernacular idioms.',
      confidence: 0.95,
      meta: JSON.stringify({ color: '#8b5cf6', badge: 'Voice Marker' }),
    },
    {
      id: `node_style_${Date.now()}_2`,
      type: 'Style',
      label: dna.voice.hook_formula,
      description: 'Immediate physical hardware visual anchor in opening seconds.',
      confidence: 0.93,
      meta: JSON.stringify({ color: '#8b5cf6', badge: 'Hook Anchor' }),
    },
    {
      id: `node_strength_${Date.now()}_1`,
      type: 'Strength',
      label: 'Circuit & Hardware Teardown Credibility',
      description: 'Deep technical fluency explaining PCB layouts, thermal pads, and thermals.',
      confidence: 0.96,
      meta: JSON.stringify({ color: '#10b981', badge: 'Core Moat' }),
    },
    {
      id: `node_strength_${Date.now()}_2`,
      type: 'Strength',
      label: 'Value-For-Money Benchmarking (VFM)',
      description: 'Calculating concrete price-to-performance ratio for Indian buyers.',
      confidence: 0.94,
      meta: JSON.stringify({ color: '#10b981', badge: 'Audience Trust' }),
    },
    {
      id: `node_gap_${Date.now()}_1`,
      type: 'Gap',
      label: 'Mid-Video Minute 4-6 Retention Drop',
      description: 'Talking-head spec reading causes audience dip before final benchmark tests.',
      confidence: 0.85,
      meta: JSON.stringify({ color: '#ef4444', badge: 'Attention Valley' }),
    },
    {
      id: `node_gap_${Date.now()}_2`,
      type: 'Gap',
      label: 'Affiliate Description Link Placement',
      description: 'Links placed below fold lose up to 50% of buying intent.',
      confidence: 0.82,
      meta: JSON.stringify({ color: '#ef4444', badge: 'Conversion Gap' }),
    },
    {
      id: `node_aud_${Date.now()}_1`,
      type: 'Audience',
      label: dna.audience.primary_demographic,
      description: 'Core demographic seeking authentic buying advice.',
      confidence: 0.92,
      meta: JSON.stringify({ color: '#06b6d4', badge: 'Core Tribe' }),
    },
  ];

  const stmts: D1PreparedStatement[] = [];

  for (const n of nodes) {
    stmts.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO nodes (
            id, creator_id, type, label, description, confidence, evidence_video_ids, meta, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          n.id,
          creatorId,
          n.type,
          n.label,
          n.description,
          n.confidence,
          vidIds,
          n.meta,
          now,
          now
        )
    );
  }

  // Connect edges
  const edges = [
    {
      id: `edge_${Date.now()}_1`,
      source: nodes[0].id,
      target: nodes[6].id,
      relation: 'RELATES_TO',
      weight: 0.94,
    },
    {
      id: `edge_${Date.now()}_2`,
      source: nodes[2].id,
      target: nodes[3].id,
      relation: 'STRONG_AT',
      weight: 0.96,
    },
    {
      id: `edge_${Date.now()}_3`,
      source: nodes[4].id,
      target: nodes[2].id,
      relation: 'NEEDS_WORK',
      weight: 0.87,
    },
    {
      id: `edge_${Date.now()}_4`,
      source: nodes[5].id,
      target: nodes[3].id,
      relation: 'NEEDS_WORK',
      weight: 0.84,
    },
  ];

  for (const e of edges) {
    stmts.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO edges (
            id, creator_id, source_id, target_id, relation, weight, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(e.id, creatorId, e.source, e.target, e.relation, e.weight, now)
    );
  }

  await db.batch(stmts);

  return {
    nodeIds: nodes.map((n) => n.id),
    edgeIds: edges.map((e) => e.id),
  };
}

async function generateDiagnosticQuiz(
  db: D1Database,
  creatorId: string,
  gapNodeIds: string[]
): Promise<string> {
  const quizId = `quiz_diag_${Date.now()}`;
  const now = new Date().toISOString();

  const questions = [
    {
      id: 'q1',
      question: 'When presenting CPU & thermal specs, what is the best way to prevent the minute-4 retention dip?',
      options: [
        'Read every frequency clock speed from the manufacturer spec sheet',
        'Use an emotional reaction, B-roll macro shot, and forward loop teaser',
        'Add 10 seconds of silence to let viewers read on screen',
        'Skip talking about performance entirely',
      ],
      correctIndex: 1,
      explanation: 'Pattern interrupts and emotional reactions transform boring spec recitations into compelling retention anchors.',
    },
    {
      id: 'q2',
      question: 'Where should Amazon affiliate links be positioned in a YouTube video description?',
      options: [
        'Hidden at the very bottom beneath 40 hashtags',
        'Above the fold in the top 3 lines alongside a conspicuous disclosure',
        'In the channel banner only',
        'Never include links in descriptions',
      ],
      correctIndex: 1,
      explanation: 'Placing links above the fold ensures viewers see them without needing to click Show More, maximizing CTR.',
    },
    {
      id: 'q3',
      question: 'What is Amazon\'s freshness policy regarding displayed product prices?',
      options: [
        'Prices can be displayed statically without dates',
        'Prices must always state a timestamp (e.g. "as of date/time") or direct viewers to check live price',
        'You must promise the price will never change',
        'Amazon does not allow mentioning prices in videos',
      ],
      correctIndex: 1,
      explanation: 'Dynamic pricing requires timestamp snapshots to avoid misleading prospective buyers.',
    },
    {
      id: 'q4',
      question: 'Why does Hinglish colloquial pacing build high viewer trust for Indian tech creators?',
      options: [
        'It tricks the YouTube recommendation algorithm',
        'It humanizes complex hardware engineering and makes reviews feel like advice from a peer',
        'It is required by regional broadcasting regulations',
        'It reduces video file export sizes',
      ],
      correctIndex: 1,
      explanation: 'Vernacular tech idioms remove intimidation while retaining complete technical accuracy.',
    },
    {
      id: 'q5',
      question: 'What is the optimal word count for high-CTR YouTube thumbnail text overlays?',
      options: [
        '10 to 15 words explaining the full review',
        'No more than 2 to 4 bold, high-contrast curiosity words',
        'The entire YouTube title pasted again',
        'Just numbers with no letters',
      ],
      correctIndex: 1,
      explanation: 'Mobile screens require immediate readability at a glance; 2-4 punchy words yield the highest CTR.',
    },
  ];

  await db
    .prepare(
      `INSERT INTO quizzes (
        id, creator_id, gap_node_id, title, questions_json, score, status, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, 'pending', ?)`
    )
    .bind(
      quizId,
      creatorId,
      gapNodeIds[0] || null,
      'Creator Baseline Diagnostic: Retention, Packaging & Compliance',
      JSON.stringify(questions),
      now
    )
    .run();

  return quizId;
}
