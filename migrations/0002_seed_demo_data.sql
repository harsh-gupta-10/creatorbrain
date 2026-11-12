-- CreatorBrain D1 Database Schema
-- Migration 0002: Seed Demo Creator Data

-- Demo Creator
INSERT OR REPLACE INTO creators (
  id, email, password_hash, name, handle, channel_title, channel_url,
  platform, subscribers, avatar_url, bio, niche, dna_summary,
  created_at, updated_at
) VALUES (
  'creator_demo_tech_kabir',
  'kabir@creatorbrain.dev',
  'demo_no_password_needed',
  'Kabir Verma',
  'techkabir',
  'TechExplains by Kabir',
  'https://youtube.com/@techkabir',
  'youtube',
  7520,
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  'Hardware teardowns, honesty-first gadget reviews, and maker builds. Delhi, India.',
  'Tech & Hardware',
  '{"voice":{"pace":"Conversational & high-velocity","tone":"Candid, enthusiastic, engineering-grounded","catchphrases":["Let us pop the hood on this","Is it worth your hard-earned rupees?","Real talk","No sponsored BS here"],"language_mix":"Hinglish (75% English, 25% Hindi colloquial tech terms)","hook_formula":"Bold provocation + physical component teardown in first 4s"},"visual":{"thumbnail_palette":["#FF0055","#00F0FF","#111827","#F59E0B"],"composition":"Subject on left with high key backlight, expressive creator reaction face on right, 3-word bold title card","text_overlay_words":3,"contrast":"High-dynamic-range with warm backlight"},"packaging":{"title_avg_length":48,"title_patterns":["[Product]: Do NOT Buy Until You See This!","I Tested [Product] For 7 Days... Huge Mistake?","The Truth About [Product] Nobody Is Telling You"],"disclosure_position":"First 3 lines of description & pinned comment"},"audience":{"primary_demographic":"18-34 engineering students, coders, tech hobbyists across India & SE Asia","buying_intent":"High VFM (Value For Money) focus between INR 15,000 to INR 35,000"}}',
  '2026-10-15T10:00:00Z',
  '2026-11-12T19:00:00Z'
);

-- Provider Settings for Demo Creator
INSERT OR REPLACE INTO provider_settings (
  id, creator_id, preferred_general_provider, preferred_fast_provider,
  preferred_structured_provider, preferred_video_provider, daily_budget_usd,
  created_at, updated_at
) VALUES (
  'setting_demo_kabir',
  'creator_demo_tech_kabir',
  'claude',
  'claude-haiku',
  'openai',
  'gemini',
  10.0,
  '2026-10-15T10:00:00Z',
  '2026-11-12T19:00:00Z'
);

-- Bio Page for Demo Creator
INSERT OR REPLACE INTO bio_pages (
  id, creator_id, handle, theme, custom_title, custom_bio,
  accent_color, bg_color, is_published, views_count,
  created_at, updated_at
) VALUES (
  'bio_demo_kabir',
  'creator_demo_tech_kabir',
  'techkabir',
  'dna-accent',
  'Kabir Verma | TechExplains',
  'Hardware teardowns, honest smartphone benchmarks & maker builds. All my tracked gear & recommended deals below.',
  '#06b6d4',
  '#090d16',
  1,
  2384,
  '2026-10-15T10:00:00Z',
  '2026-11-12T19:00:00Z'
);

-- Demo Products (Realistic Fixtures)
INSERT OR REPLACE INTO products (
  id, creator_id, asin, title, price_str, price_timestamp,
  currency, image_url, product_url, features_json, specs_json,
  pros_cons_json, is_mock, availability, last_checked_at, created_at
) VALUES 
(
  'prod_moto_edge_50',
  'creator_demo_tech_kabir',
  'B0D3G78JKL',
  'Motorola Edge 50 Fusion 5G (Marshmallow Blue, 8GB RAM, 128GB Storage)',
  '₹22,999',
  'price as of Nov 12, 2026 18:30 IST',
  'INR',
  'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80',
  'https://www.amazon.in/dp/B0D3G78JKL',
  '["Snapdragon 7s Gen 2 Processor with 4nm architecture","144Hz 3D Curved pOLED Display with Gorilla Glass 5","50MP Sony LYTIA 700C OIS Camera sensor","IP68 Underwater Protection up to 1.5m for 30 mins","5000mAh Battery with 68W TurboPower Fast Charging in box"]',
  '{"SoC":"Snapdragon 7s Gen 2","RAM":"8GB LPDDR4X","Storage":"128GB UFS 2.2","Display":"6.7 inch 144Hz FHD+ pOLED","Main Camera":"50MP Sony LYT-700C with OIS","Battery":"5000mAh","Charging":"68W TurboPower","Water Resistance":"IP68"}',
  '{"pros":["Segment-best IP68 water resistance rating","Clean near-stock Hello UI with zero bloatware","Stunning 144Hz curved pOLED display with vibrant colors","Flagship Sony LYT-700C primary camera in daylight & low light"],"cons":["Snapdragon 7s Gen 2 throttles under continuous 4K 60fps recording","Curved edges prone to accidental palm touches without a case","Mono speaker sounds tinny compared to Vivo T3 Pro dual speakers"]}',
  1,
  'In Stock',
  '2026-11-12T17:00:00Z',
  '2026-10-23T10:00:00Z'
),
(
  'prod_vivo_t3_pro',
  'creator_demo_tech_kabir',
  'B0DCF9X11M',
  'Vivo T3 Pro 5G (Sandstone Orange, 8GB RAM, 128GB Storage)',
  '₹24,999',
  'price as of Nov 12, 2026 18:30 IST',
  'INR',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
  'https://www.amazon.in/dp/B0DCF9X11M',
  '["Snapdragon 7 Gen 3 (4nm) processor scoring over 820k on AnTuTu","5500mAh Ultra-Slim Battery with 80W FlashCharge","50MP Sony IMX882 OIS Camera + 8MP Ultra-Wide","120Hz 3D Curved AMOLED Display with 4500 nits peak brightness","Vegan Leather Back finish with metallic camera ring"]',
  '{"SoC":"Snapdragon 7 Gen 3","RAM":"8GB LPDDR4X","Storage":"128GB UFS 2.2","Display":"6.77 inch 120Hz AMOLED","Main Camera":"50MP Sony IMX882 OIS","Battery":"5500mAh","Charging":"80W FlashCharge","Weight":"190g"}',
  '{"pros":["Outstanding battery backup with 5500mAh cell easily lasting 1.5 days","Superior Snapdragon 7 Gen 3 gaming performance over Moto","Loud and punchy stereo speakers with Hi-Res certification","80W fast charger bundled inside retail box"],"cons":["Funtouch OS has notification spam out of the box (requires disabling)","Only IP64 dust/splash rating (Motorola has full IP68 submersible)","No 4K recording on front selfie camera"]}',
  1,
  'In Stock',
  '2026-11-12T17:00:00Z',
  '2026-10-25T10:00:00Z'
),
(
  'prod_mac_mini_m4',
  'creator_demo_tech_kabir',
  'B0DLH4567M',
  'Apple Mac Mini Desktop (M4 Chip, 10-core CPU, 10-core GPU, 16GB Unified Memory, 256GB SSD)',
  '₹59,900',
  'price as of Nov 12, 2026 18:30 IST',
  'INR',
  'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
  'https://www.amazon.in/dp/B0DLH4567M',
  '["Apple M4 chip with 10-core CPU and 10-core GPU delivers desktop-class performance","Now with 16GB Unified Memory standard - zero swap lag in 4K ProRes timelines","Ultra-compact 5x5 inch redesigned enclosure with front USB-C and headphone jack","Thunderbolt 5 support on Pro / Thunderbolt 4 on standard model","Silent cooling architecture with whisper-quiet fan even during Blender renders"]',
  '{"Chip":"Apple M4 (10c CPU / 10c GPU)","RAM":"16GB Unified Memory","SSD":"256GB NVMe","Ports":"3x Thunderbolt 4, 2x USB-C front, HDMI, Gigabit Ethernet","Dimensions":"12.7 x 12.7 x 5.0 cm"}',
  '{"pros":["Unbelievable power-to-size ratio - fits in the palm of your hand","16GB base RAM finally solves the Apple memory tax scandal","Virtually silent operation even when exporting 10-bit 4K H.265 files","Front facing USB-C ports make connecting SD readers painless"],"cons":["Power button is placed underneath the chassis (bizarre design choice)","256GB base storage fills up rapidly with FCP / Premiere cache files","Non-upgradeable internal storage forces external NVMe enclosures"]}',
  1,
  'In Stock',
  '2026-11-12T18:00:00Z',
  '2026-11-02T10:00:00Z'
),
(
  'prod_sony_xm5',
  'creator_demo_tech_kabir',
  'B09XS7JWHH',
  'Sony WH-1000XM5 Wireless Active Noise Cancelling Headphones (Silver)',
  '₹26,990',
  'price as of Nov 12, 2026 18:30 IST',
  'INR',
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80',
  'https://www.amazon.in/dp/B09XS7JWHH',
  '["Industry-leading Noise Cancellation with dual processors and 8 microphones","Magnificent sound engineered to perfection with 30mm carbon fiber driver","Crystal clear hands-free calling with 4 beamforming mics & AI noise reduction","Up to 30-hour battery life with quick charging (3 min charge gives 3 hours playback)","Speak-to-chat technology automatically pauses music when you talk"]',
  '{"Battery":"30 hours ANC on","Weight":"250g","Bluetooth":"v5.2 with LDAC & multipoint","Drivers":"30mm carbon composite"}',
  '{"pros":["Unrivaled active noise cancellation blocks office chatter and metro drone","Extremely lightweight design with soft-fit synthetic leather headband","LDAC high-resolution audio support with Sony Sound Connect app","Multipoint Bluetooth allows seamless switching between phone and MacBook"],"cons":["Headband cannot fold into compact ball like older XM4 series","Microphone sounds artificial in heavy wind conditions","Carrying case is considerably bulkier than previous generations"]}',
  1,
  'In Stock',
  '2026-11-12T15:00:00Z',
  '2026-10-28T10:00:00Z'
);

-- Bio Blocks
INSERT OR REPLACE INTO bio_blocks (
  id, bio_page_id, type, order_index, title, url, product_id,
  content_json, is_active, clicks_count, created_at
) VALUES 
(
  'block_1',
  'bio_demo_kabir',
  'product_card',
  1,
  'Motorola Edge 50 Fusion (My Current Budget Recommendation)',
  'https://www.amazon.in/dp/B0D3G78JKL?tag=techkabir-21',
  'prod_moto_edge_50',
  '{"badge":"Editor Choice","note":"Best camera under ₹23k"}',
  1,
  420,
  '2026-10-18T10:00:00Z'
),
(
  'block_2',
  'bio_demo_kabir',
  'product_card',
  2,
  'Vivo T3 Pro 5G (Best Gaming & Battery Pick)',
  'https://www.amazon.in/dp/B0DCF9X11M?tag=techkabir-21',
  'prod_vivo_t3_pro',
  '{"badge":"Best Battery","note":"5500mAh + 80W Charger"}',
  1,
  315,
  '2026-10-20T10:00:00Z'
),
(
  'block_3',
  'bio_demo_kabir',
  'link',
  3,
  '🎙️ Complete YouTube Studio Gear & Lighting Setup 2026',
  'https://creatorbrain.dev/s/kabir-gear-kit',
  NULL,
  '{"subtitle":"Cameras, Softboxes, Microphones & Desks","highlight":true}',
  1,
  620,
  '2026-10-15T10:00:00Z'
),
(
  'block_4',
  'bio_demo_kabir',
  'product_card',
  4,
  'Apple M4 Mac Mini (The 4K Video Editing Machine)',
  'https://www.amazon.in/dp/B0DLH4567M?tag=techkabir-21',
  'prod_mac_mini_m4',
  '{"badge":"Desktop King","note":"16GB Base RAM"}',
  1,
  842,
  '2026-11-02T10:00:00Z'
),
(
  'block_5',
  'bio_demo_kabir',
  'social_links',
  5,
  'Connect With Me',
  NULL,
  NULL,
  '{"youtube":"https://youtube.com/@techkabir","instagram":"https://instagram.com/techkabir","github":"https://github.com/kabirbuilds","twitter":"https://twitter.com/techkabir"}',
  1,
  187,
  '2026-10-15T10:00:00Z'
),
(
  'block_6',
  'bio_demo_kabir',
  'text',
  6,
  'Amazon Affiliate Disclosure',
  NULL,
  NULL,
  '{"text":"Affiliate Disclosure: As an Amazon Associate, I earn from qualifying purchases made through links on this page at zero extra cost to you. I only recommend products I have personally tested and verified."}',
  1,
  0,
  '2026-10-15T10:00:00Z'
);

-- Brain Graph Nodes (14 Nodes)
INSERT OR REPLACE INTO nodes (id, creator_id, type, label, description, confidence, evidence_video_ids, meta, created_at, updated_at) VALUES
('node_1', 'creator_demo_tech_kabir', 'Style', 'Hinglish Colloquial Pacing', 'Smooth blend of 70% technical English with punchy Hindi idioms like "Paisa Vasool" and "Asli Sach". Keeps audience hooked.', 0.96, '["vid_moto_edge_50", "vid_vivo_t3", "vid_cmf_phone"]', '{"color":"#8b5cf6","badge":"Voice Marker"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_2', 'creator_demo_tech_kabir', 'Style', '4-Second Teardown Hook', 'Opens videos immediately with a screwdriver or physical hardware macro shot, stating the real problem before any intro.', 0.94, '["vid_moto_edge_50", "vid_mac_mini_m4"]', '{"color":"#8b5cf6","badge":"Retention Anchor"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_3', 'creator_demo_tech_kabir', 'Style', 'High-Contrast Dual Lighting', 'Cyan-Orange background accent lighting with focused softbox on product textures.', 0.88, '["vid_moto_edge_50", "vid_sony_xm5"]', '{"color":"#8b5cf6","badge":"Aesthetic"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_4', 'creator_demo_tech_kabir', 'Strength', 'Circuit & PCB Teardown Analysis', 'Explains battery chemistry, trace impedance, and heat dissipation with genuine engineering credibility.', 0.97, '["vid_moto_edge_50", "vid_mac_mini_m4", "vid_oneplus_nord"]', '{"color":"#10b981","badge":"Core Moat"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_5', 'creator_demo_tech_kabir', 'Strength', 'First 30-Second Retention Rate (82%)', 'Superb pacing and sensory b-roll sounds keep drop-off under 18% in the opening half-minute.', 0.92, '["vid_moto_edge_50", "vid_vivo_t3"]', '{"color":"#10b981","badge":"Metric Leader"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_6', 'creator_demo_tech_kabir', 'Strength', '3-Word High Emotion Thumbnails', 'Thumbnails average 12.8% CTR with big font contrast and clear product isolation.', 0.91, '["vid_moto_edge_50", "vid_cmf_phone"]', '{"color":"#10b981","badge":"Packaging"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_7', 'creator_demo_tech_kabir', 'Strength', 'No-Nonsense Pricing Benchmarking', 'Calculates rupee-per-benchmark score to give concrete buying verdict rather than vague impressions.', 0.95, '["vid_moto_edge_50", "vid_vivo_t3"]', '{"color":"#10b981","badge":"Trust Driver"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_8', 'creator_demo_tech_kabir', 'Gap', 'Minute 4 to 6 Retention Valley', 'Talking-head spec recitations cause viewer drop-off between minutes 4 and 6 before benchmark results.', 0.86, '["vid_moto_edge_50", "vid_oneplus_nord"]', '{"color":"#ef4444","badge":"Attention Valley"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_9', 'creator_demo_tech_kabir', 'Gap', 'Affiliate Description CTR (1.2%)', 'Affiliate links are buried too low below timestamps, losing up to 60% of potential click intent.', 0.83, '["vid_moto_edge_50", "vid_vivo_t3"]', '{"color":"#ef4444","badge":"Revenue Leak"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_10', 'creator_demo_tech_kabir', 'Gap', 'Vertical Reels Pacing Mismatch', 'Directly cropping 16:9 videos to 9:16 leaves awkward framing and missing on-screen text overlays.', 0.79, '["vid_reels_fail_1", "vid_reels_fail_2"]', '{"color":"#ef4444","badge":"Distribution"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_11', 'creator_demo_tech_kabir', 'Audience', 'Engineering Students & Tech DIYers', 'Aged 18-28, appreciate schematics, soldering iron shots, and custom ROM/mod discussions.', 0.94, '["analytics_demographics_2026"]', '{"color":"#06b6d4","badge":"Core Tribe"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_12', 'creator_demo_tech_kabir', 'Audience', 'Sub-₹25,000 Smartphone Shoppers', 'Seeking maximum longevity, clean software, and dependable cameras for college and work.', 0.92, '["analytics_comments_cluster"]', '{"color":"#06b6d4","badge":"Target Buyer"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_13', 'creator_demo_tech_kabir', 'Topic', 'SoC Thermal Throttling & Stress Tests', 'Deep testing of CPU Throttling App and 3DMark Wild Life Stress tests across 20-minute runs.', 0.89, '["vid_moto_edge_50", "vid_vivo_t3"]', '{"color":"#f59e0b","badge":"Content Pillar"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z'),
('node_14', 'creator_demo_tech_kabir', 'Topic', 'Fast Charging Safety & Battery Degrade', 'Cycle testing 68W vs 80W charging curves and temperature rise during summer ambient temps.', 0.87, '["vid_moto_edge_50", "vid_vivo_t3"]', '{"color":"#f59e0b","badge":"Content Pillar"}', '2026-10-23T10:00:00Z', '2026-11-12T19:00:00Z');

-- Brain Graph Edges (18 Edges)
INSERT OR REPLACE INTO edges (id, creator_id, source_id, target_id, relation, weight, created_at) VALUES
('edge_1', 'creator_demo_tech_kabir', 'node_1', 'node_11', 'RELATES_TO', 0.95, '2026-10-23T10:00:00Z'),
('edge_2', 'creator_demo_tech_kabir', 'node_2', 'node_5', 'STRONG_AT', 0.94, '2026-10-23T10:00:00Z'),
('edge_3', 'creator_demo_tech_kabir', 'node_4', 'node_13', 'STRONG_AT', 0.98, '2026-10-23T10:00:00Z'),
('edge_4', 'creator_demo_tech_kabir', 'node_4', 'node_14', 'STRONG_AT', 0.93, '2026-10-23T10:00:00Z'),
('edge_5', 'creator_demo_tech_kabir', 'node_7', 'node_12', 'STRONG_AT', 0.96, '2026-10-23T10:00:00Z'),
('edge_6', 'creator_demo_tech_kabir', 'node_6', 'node_12', 'STRONG_AT', 0.90, '2026-10-23T10:00:00Z'),
('edge_7', 'creator_demo_tech_kabir', 'node_8', 'node_13', 'NEEDS_WORK', 0.88, '2026-10-23T10:00:00Z'),
('edge_8', 'creator_demo_tech_kabir', 'node_9', 'node_7', 'NEEDS_WORK', 0.85, '2026-10-23T10:00:00Z'),
('edge_9', 'creator_demo_tech_kabir', 'node_10', 'node_1', 'NEEDS_WORK', 0.80, '2026-10-23T10:00:00Z'),
('edge_10', 'creator_demo_tech_kabir', 'node_3', 'node_6', 'RELATES_TO', 0.87, '2026-10-23T10:00:00Z'),
('edge_11', 'creator_demo_tech_kabir', 'node_5', 'node_8', 'RELATES_TO', 0.75, '2026-10-23T10:00:00Z'),
('edge_12', 'creator_demo_tech_kabir', 'node_7', 'node_9', 'LEARNED_FROM', 0.82, '2026-10-23T10:00:00Z'),
('edge_13', 'creator_demo_tech_kabir', 'node_13', 'node_14', 'RELATES_TO', 0.91, '2026-10-23T10:00:00Z'),
('edge_14', 'creator_demo_tech_kabir', 'node_11', 'node_4', 'LEARNED_FROM', 0.93, '2026-10-23T10:00:00Z'),
('edge_15', 'creator_demo_tech_kabir', 'node_12', 'node_7', 'LEARNED_FROM', 0.94, '2026-10-23T10:00:00Z'),
('edge_16', 'creator_demo_tech_kabir', 'node_2', 'node_4', 'RELATES_TO', 0.89, '2026-10-23T10:00:00Z'),
('edge_17', 'creator_demo_tech_kabir', 'node_9', 'node_12', 'RELATES_TO', 0.84, '2026-10-23T10:00:00Z'),
('edge_18', 'creator_demo_tech_kabir', 'node_8', 'node_5', 'NEEDS_WORK', 0.81, '2026-10-23T10:00:00Z');

-- Learnings (Last 5 Learnings)
INSERT OR REPLACE INTO learnings (id, creator_id, title, insight, source_agent, created_at) VALUES
('learn_1', 'creator_demo_tech_kabir', 'Minute 4 Pattern Interrupt', 'Inserting a 5-second physical camera zoom or audio sound bite before reading benchmark specs boosted retention by 14.2% across 3 recent videos.', 'Memory Curator', '2026-11-10T12:00:00Z'),
('learn_2', 'creator_demo_tech_kabir', 'Top-3 Line Affiliate Placement', 'Moving the Amazon tagged link to line 2 of YouTube description doubled click-through rate from 1.2% to 2.8% without hurting SEO rankings.', 'Link Agent', '2026-11-08T14:30:00Z'),
('learn_3', 'creator_demo_tech_kabir', 'Disclose As-Of Pricing Always', 'Stating "Price as of recorded date" prevents negative comments when e-commerce sales change prices overnight.', 'Compliance Checker', '2026-11-05T09:15:00Z'),
('learn_4', 'creator_demo_tech_kabir', 'Vivo vs Moto Side-by-Side Appeal', 'Direct head-to-head title syntax ("Moto Edge 50 vs Vivo T3 Pro: Clear Winner?") drove 2.3x higher initial impression click-through than single phone titles.', 'Packaging Analyst', '2026-11-01T16:45:00Z'),
('learn_5', 'creator_demo_tech_kabir', 'Curved Display Palm Rejection Discussion', 'Addressing curved screen accidental touches with a real demonstration is one of the highest replayed segments among student viewers.', 'Voice & Edit Analyst', '2026-10-27T11:20:00Z');

-- Lessons
INSERT OR REPLACE INTO lessons (id, creator_id, gap_node_id, order_index, title, category, duration_min, content_markdown, completed, completed_at, created_at) VALUES
('lesson_1', 'creator_demo_tech_kabir', 'node_8', 1, 'Destroying the Minute 4 Retention Valley', 'Retention', 6, '### Why Viewers Drop Off at Minute 4\n\nYouTube data shows tech reviews experience their steepest drop between 3:45 and 5:30. Why? Because the creator finishes the hook, completes the aesthetic showcase, and transitions into a static reading of CPU specs.\n\n#### The 3 Rules of Pattern Interrupts\n1. **Never read a spec sheet without an emotional reaction.** Instead of saying "It has a 50MP Sony sensor", say "Look at what happens when I take this into Delhi night traffic at 10 PM".\n2. **B-Roll velocity change.** If the intro used 1.5s cuts, slow down to a deliberate 5s macro teardown shot, then punch in with sound.\n3. **Forward loop teaser.** At minute 3:30, explicitly say: *"In 2 minutes, I will show you the thermal throttling test that almost fried my battery."*', 1, '2026-11-09T18:00:00Z', '2026-10-28T10:00:00Z'),
('lesson_2', 'creator_demo_tech_kabir', 'node_9', 2, 'Amazon Creators API: Perfect Link Architecture & FTC Compliance', 'Compliance', 7, '### Maximizing Earnings Without Burning Viewer Trust\n\n#### 1. The Golden 3-Line Description Formula\nLine 1: High curiosity summary of video.\nLine 2: Direct Amazon Tracked Short Link (`https://creatorbrain.dev/s/moto-edge-fusion`).\nLine 3: Mandatory disclosure: *(As an Amazon Associate, I earn from qualifying purchases).* \n\n#### 2. Pricing Freshness Rule\nAmazon Operating Agreement strictly forbids presenting stale prices as current. Always specify the timestamp snapshot or state "Check current price on Amazon".', 0, NULL, '2026-11-02T10:00:00Z'),
('lesson_3', 'creator_demo_tech_kabir', 'node_10', 3, 'Repurposing Long-Form Teardowns into Viral 45s Shorts', 'Packaging', 5, '### Turn 1 Long-Form Video into 3 High-Yield Shorts\n\n1. **The Teardown Shock:** 0 to 5s showing an unexpected interior design flaw.\n2. **The Camera Blind Test:** Split screen asking viewers to guess Phone A vs Phone B before revealing in the comments.\n3. **The Battery Drain Verdict:** Timelapse of real-world gaming battery drop.', 0, NULL, '2026-11-04T10:00:00Z'),
('lesson_4', 'creator_demo_tech_kabir', 'node_8', 4, 'Interactive Pinned Comments & Community Poll Funneling', 'SEO', 6, '### Pinned Comments Convert 3x Higher Than Descriptions\n\nPin your own comment within 60 seconds of video upload with an open-ended question and a clean tracked short link.\nExample: *"Which color would you pick: Marshmallow Blue or Sandstone Orange? Also check the ongoing Amazon discount here: [Link]"*', 0, NULL, '2026-11-07T10:00:00Z');

-- Quizzes
INSERT OR REPLACE INTO quizzes (id, creator_id, gap_node_id, title, questions_json, score, status, completed_at, created_at) VALUES
(
  'quiz_1',
  'creator_demo_tech_kabir',
  'node_9',
  'Amazon Creators API & FTC/ASCI Affiliate Compliance Quiz',
  '[{"id":"q1","question":"Where must your Amazon Associates affiliate disclosure appear on YouTube?","options":["Only in your channel About page","In the video description above the fold (top 3 lines) and ideally mentioned or pinned","Hidden at the very bottom of the description below 50 hashtags","Nowhere if you show the product on screen"],"correctIndex":1,"explanation":"Both FTC guidelines and Amazon Operating Agreement require disclosures to be clear, conspicuous, and placed immediately near the affiliate links before the user has to click Show More."},{"id":"q2","question":"According to Amazon Creators API license, how must product prices be displayed?","options":["You can write any estimated price you remember from last month","Prices must include a freshness timestamp (e.g., price as of date/time) or state check live price","You must guarantee the price will remain static for 30 days","Amazon forbids showing prices anywhere"],"correctIndex":1,"explanation":"Because Amazon prices fluctuate dynamically, showing a static price without a timestamp violates Amazon compliance rules."},{"id":"q3","question":"What type of URL redirection is permitted when shortening Amazon affiliate links?","options":["Masking the destination so the viewer never knows it goes to Amazon","Transparent, direct 301/302 redirects where the destination domain is clearly known","Cloaking inside an iframe with unauthorized cookie dropping","Chaining 5 different ad-supported redirect shorteners"],"correctIndex":1,"explanation":"Amazon strictly prohibits cloaking or deceptive link chaining that conceals the fact that the link leads to Amazon."},{"id":"q4","question":"How many qualifying sales must an Associates account generate in 30 days to access Creators API?","options":["At least 1 sale","At least 10 qualifying sales in the last 30 days","At least 500 sales","Zero sales are needed"],"correctIndex":1,"explanation":"Amazon Creators API documentation specifies an active account with at least 10 qualifying referred sales in the trailing 30-day window."},{"id":"q5","question":"Can you use Amazon customer reviews as testimonial quotes in your video scripts without permission?","options":["Yes, you can copy all reviews freely","No, Amazon Associates agreements forbid republishing or scraping customer star ratings/reviews outside official API parameters","Yes, as long as you translate them into Hindi","Only if the review gives 5 stars"],"correctIndex":1,"explanation":"Amazon program policies prohibit copying and displaying third-party customer reviews or star ratings directly outside of authorized API representations."}]',
  5,
  'completed',
  '2026-11-07T12:00:00Z',
  '2026-11-06T10:00:00Z'
),
(
  'quiz_2',
  'creator_demo_tech_kabir',
  'node_8',
  'Mid-Video Attention & Pacing Diagnostic Quiz',
  '[{"id":"q1","question":"What is a pattern interrupt in long-form video editing?","options":["A sudden video glitch that crashes the app","A deliberate change in visual framing, audio pacing, or perspective to re-engage wandering attention","A 30-second unskippable sponsor read in the middle of a sentence","Pausing the video for 10 seconds of silence"],"correctIndex":1,"explanation":"Pattern interrupts break repetitive cadence, signaling the brain to re-focus on the content."},{"id":"q2","question":"When presenting benchmark scores (e.g., AnTuTu or Geekbench), what keeps viewers most engaged?","options":["Reading numbers from a spreadsheet for 3 minutes","Showing real-time gaming screen capture with thermal camera overlay alongside the score","Whispering the numbers without visual aids","Skipping numbers entirely and guessing"],"correctIndex":1,"explanation":"Visualizing the benchmark in action (fps counter + thermal camera) anchors abstract scores to tangible real-world experience."},{"id":"q3","question":"What is the ideal position for a forward loop in an 8-minute review?","options":["In the final 10 seconds","At the 3:00-3:30 minute mark, just before the retention dip","Never use forward loops","In the video end screen only"],"correctIndex":1,"explanation":"Placing a forward loop right before the typical minute-4 drop gives viewers an explicit reason to stay watched."},{"id":"q4","question":"Why do Hinglish tech creators see high engagement when mixing technical terms with vernacular expressions?","options":["It confuses the YouTube algorithm in a good way","It humanizes complex engineering concepts and builds relatable peer-level trust with viewers","It is required by Indian law","It saves speaking time"],"correctIndex":1,"explanation":"Colloquial terminology removes elitism from tech hardware while keeping technical accuracy intact."},{"id":"q5","question":"What thumbnail element best differentiates a top-performing review thumbnail from a low-performing one?","options":["Adding 50 small stickers and arrows","High-contrast isolation of the product with creator reaction face and at most 3 words of bold curiosity text","Leaving the thumbnail completely blank","A screenshot of the Amazon invoice"],"correctIndex":1,"explanation":"Top thumbnails use clean focal contrast, high legible text (<=3 words), and clear product hero lighting."}]',
  NULL,
  'pending',
  NULL,
  '2026-11-11T10:00:00Z'
);

-- Agent Traces
INSERT OR REPLACE INTO agent_traces (
  id, creator_id, agent_name, task_description, step_number, total_steps,
  tool_called, tool_input, tool_result, output_summary, status, created_at
) VALUES 
(
  'trace_1',
  'creator_demo_tech_kabir',
  'Channel Scout',
  'Scan recent YouTube videos, filter top and median performers, extract metadata',
  1,
  3,
  'fetchChannelVideos',
  '{"channelId":"UC_techkabir_id","maxResults":30}',
  '{"fetched":30,"selected":10,"topVideos":["vid_moto_edge_50","vid_mac_mini_m4","vid_vivo_t3"]}',
  'Retrieved 30 videos from YouTube Data API v3; selected 10 key videos (3 top, 3 recent, 2 median, 2 low) across 7.5K subscriber channel.',
  'success',
  '2026-10-23T10:00:00Z'
),
(
  'trace_2',
  'creator_demo_tech_kabir',
  'Product Researcher',
  'Search Amazon for Motorola Edge 50 Fusion and Vivo T3 Pro specs, price & availability',
  1,
  2,
  'amazonSearchItems',
  '{"keywords":"Motorola Edge 50 Fusion 5G","marketplace":"amazon.in"}',
  '{"asin":"B0D3G78JKL","title":"Motorola Edge 50 Fusion 5G","price":"₹22,999","availability":"In Stock","rating":4.3}',
  'Successfully resolved ASIN B0D3G78JKL on amazon.in with active pricing timestamp (₹22,999 as of recorded date). Extracted Snapdragon 7s Gen 2 specs & IP68 rating.',
  'success',
  '2026-11-10T14:00:00Z'
),
(
  'trace_3',
  'creator_demo_tech_kabir',
  'Content Studio Agent',
  'Generate 5 titles, full description with disclosure, tags, and script outline in Kabir DNA voice',
  2,
  4,
  'synthesizeContentAssets',
  '{"dnaTone":"Candid Hinglish, hardware teardown focus","product":"Motorola Edge 50 Fusion"}',
  '{"titlesGenerated":5,"assetsStored":["title","description","tags","pinned_comment","script_outline","thumbnail_ideas"]}',
  'Created full asset suite matching Kabir DNA: punchy 3-word thumbnail ideas, 5 high-CTR titles, structured description with disclosure line at top, and 8-min teardown script outline.',
  'success',
  '2026-11-10T14:15:00Z'
),
(
  'trace_4',
  'creator_demo_tech_kabir',
  'Compliance Checker',
  'Verify Amazon Associates disclosure, timestamped pricing, and substantiation of hardware claims',
  1,
  1,
  'checkComplianceRules',
  '{"descriptionText":"Full description check","tags":"Motorola Edge 50 review"}',
  '{"passed":true,"disclosureFound":true,"timestampFound":true,"flags":[]}',
  'Passed 100% of compliance rules: conspicuous disclosure present, price timestamped as of recorded date, and zero exaggerated unverified claims.',
  'success',
  '2026-11-10T14:20:00Z'
);

-- Projects
INSERT OR REPLACE INTO projects (id, creator_id, title, status, brief, primary_product_id, created_at, updated_at) VALUES
(
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'Motorola Edge 50 Fusion vs Vivo T3 Pro: The ₹22,000 Camera & Battery Battle',
  'Published',
  'Making an 8-minute comprehensive comparison review of Motorola Edge 50 Fusion and Vivo T3 Pro. Target audience is Indian engineering students wanting best value under ₹25k. Focus on real camera samples, battery drain test, and Snapdragon thermals.',
  'prod_moto_edge_50',
  '2026-10-23T10:00:00Z',
  '2026-11-10T15:00:00Z'
),
(
  'proj_mac_mini_m4',
  'creator_demo_tech_kabir',
  'Apple M4 Mac Mini: 10 Days Later - The ₹59,900 Video Editing Beast',
  'Scripted',
  'Teardown and 4K video editing performance test on the base 16GB M4 Mac Mini. Is 256GB SSD enough? How hot does it get during 10-bit ProRes 422 exports?',
  'prod_mac_mini_m4',
  '2026-11-07T10:00:00Z',
  '2026-11-11T12:00:00Z'
);

-- Project Assets
INSERT OR REPLACE INTO assets (id, project_id, creator_id, type, current_version_id, title, content, created_at, updated_at) VALUES
(
  'asset_titles_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'titles',
  'v_title_1',
  '5 High-CTR Title Options',
  '1. Motorola Edge 50 Fusion vs Vivo T3 Pro: Don''t Waste Your ₹22,000!
2. I Tested Both For 7 Days... The Winner Surprised Me! (Moto vs Vivo)
3. IP68 or 80W Charging? The Brutally Honest Truth (Edge 50 vs T3 Pro)
4. Moto Edge 50 Fusion vs Vivo T3 Pro: Real Camera & Battery Teardown!
5. Best Phone Under ₹25,000? There Is Only ONE Clear Winner.',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_desc_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'description',
  'v_desc_1',
  'Full YouTube Description with Disclosures',
  'Motorola Edge 50 Fusion vs Vivo T3 Pro 5G: The Ultimate ₹22,000 Comparison!

Check Current Prices & Best Deals on Amazon:
👉 Moto Edge 50 Fusion: https://creatorbrain.dev/s/moto-edge-fusion
👉 Vivo T3 Pro 5G: https://creatorbrain.dev/s/vivo-t3-pro
👉 My Complete Gear Kit: https://creatorbrain.dev/@techkabir

Affiliate Disclosure: As an Amazon Associate, I earn from qualifying purchases made through the links above at zero extra cost to you. Prices and availability are accurate as of video upload and are subject to change.

In this video, we pop the hood on the Snapdragon 7s Gen 2 vs Snapdragon 7 Gen 3. We compare real low-light camera samples with the Sony LYTIA sensor, test IP68 water submersion, and run a 30-minute thermal throttling stress test.

⏱️ Timestamps:
0:00 - The Real ₹22,000 Dilemma
0:42 - Teardown & Build Quality (IP68 Test)
2:15 - Display: Curved 144Hz vs 120Hz 4500 Nits
3:48 - Camera Blind Comparison (Sony LYT-700C vs IMX882)
5:20 - Gaming & Thermal Throttling Test (Don''t Skip!)
6:45 - Battery Drain: 5000mAh 68W vs 5500mAh 80W
7:30 - Final Verdict: Which One Should YOU Buy?

#MotoEdge50Fusion #VivoT3Pro #TechExplains #SmartphoneComparison #AmazonDeals',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_tags_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'tags',
  'v_tags_1',
  'Optimized Video Tags',
  'motorola edge 50 fusion, vivo t3 pro, moto edge 50 fusion vs vivo t3 pro, best phone under 25000, snapdragon 7s gen 2 vs 7 gen 3, moto edge 50 camera test, vivo t3 pro battery drain, techexplains kabir, tech with kabir, smartphone comparison 2026, amazon phone deals',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_pinned_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'pinned_comment',
  'v_pin_1',
  'High-Engagement Pinned Comment',
  '🔥 Real talk: If clean software and IP68 waterproof design matter to you, pick Moto. If gaming and 1.5-day battery matter most, pick Vivo! 

Which one would you buy right now? Comment below!
🛒 Check current Amazon bank offers here:
👉 Moto Edge 50: https://creatorbrain.dev/s/moto-edge-fusion
👉 Vivo T3 Pro: https://creatorbrain.dev/s/vivo-t3-pro
(Affiliate links - helps support independent hardware teardowns!)',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_shorts_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'shorts_caption',
  'v_shorts_1',
  'YouTube Shorts Viral Caption',
  'Moto Edge 50 Fusion or Vivo T3 Pro? 📱 Dropped both in water and ran 30-min gaming test! Guess which one survived? Watch full breakdown on channel! Links in bio! #TechShorts #SmartphoneBattle #ShortsIndia',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_ig_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'instagram_caption',
  'v_ig_1',
  'Instagram Reel Caption & Carousel Text',
  'The ₹22,000 battle everyone asked for: Motorola Edge 50 Fusion vs Vivo T3 Pro 5G! 💥

Swipe through for uncompressed 50MP Sony sensor crops and 20-min thermal heat maps. 
🔗 Tap link in bio (@techkabir) for live Amazon pricing and complete YouTube review!

#techblogger #smartphonephotography #gadgetreview #teardown #creatorbrain #delhicreator',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_outline_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'script_outline',
  'v_out_1',
  'Complete 8-Minute Video Script Outline',
  '### 0:00 - 0:40: Hook & The Problem
- Visual: Kabir holding both phones underwater in an aquarium tank.
- Dialogue: "Most reviewers tell you these two phones are identical. They are lying. In the next 8 minutes, we pop the hood and test cameras, thermals, and real battery life."
- Forward loop: "Stay until minute 5, because one of these chips throttled by 35% in just 15 minutes."

### 0:40 - 2:15: Build, In-Hand Feel & IP68 Rating
- Teardown of back panel texture (vegan leather vs frosted PMMA).
- Sound design: tap test with Rode mic.
- Explain IP68 submersible vs IP64 splash proof.

### 2:15 - 3:45: Display & Curved Screen Usability
- 144Hz pOLED on Moto vs 120Hz 4500 nits on Vivo.
- Palm rejection test while playing BGMI.

### 3:45 - 5:20: Camera Teardown & Real Night Samples
- Sony LYT-700C vs Sony IMX882 side-by-side color science.
- Low light shutter lag comparison.

### 5:20 - 6:45: Performance, Thermals & Benchmark Truth
- CPU Throttling test results.
- Thermal gun reading: Moto 41°C, Vivo 38.5°C.

### 6:45 - 7:30: Battery & Charging Showdown
- 68W TurboPower (0-100% in 44m) vs 80W FlashCharge (0-100% in 48m).

### 7:30 - 8:00: Final Verdict & Buying Advice
- Clear buyer persona segmentation. Call to action for Amazon deals in description and pinned comment.',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_thumb_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'thumbnail_ideas',
  'v_thumb_1',
  '3-Word Thumbnail Concepts & AI Prompts',
  'Concept 1:
- Left: Both phones crossing like glowing swords, glowing cyan and amber sparks.
- Right: Kabir with wide open eyes pointing at the screen.
- Text Overlay: "DON''T BUY BOTH!" in electric yellow heavy font.

Concept 2:
- Left: Split screen showing thermal heat camera visual on Moto and battery bar on Vivo.
- Text Overlay: "MISTAKE AT ₹22K?" in bold white with red dropshadow.

Prompt for Midjourney / DALL-E:
"High end YouTube tech review thumbnail, two modern 2026 smartphones colliding in mid-air with neon cyan and amber cinematic rim lighting, 8k resolution, dramatic studio backlighting"',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_community_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'community_post',
  'v_comm_1',
  'YouTube Community Tab Poll',
  'Which phone gives better value under ₹25,000 in India?
Options:
1. Motorola Edge 50 Fusion (Clean UI + IP68)
2. Vivo T3 Pro 5G (Snapdragon 7 Gen 3 + 5500mAh)
3. Neither, waiting for OnePlus Nord CE series
4. Just show me the results!

Drop your thoughts below - full teardown and camera comparison goes live at 5 PM today!',
  '2026-11-10T14:15:00Z',
  '2026-11-10T14:15:00Z'
),
(
  'asset_compliance_1',
  'proj_moto_vs_vivo',
  'creator_demo_tech_kabir',
  'compliance_report',
  'v_comp_1',
  'AI Compliance Verification Report',
  'STATUS: PASS (100% Compliant)
- Amazon Associates Disclosure: Verified present at Line 4 of description and pinned comment.
- Price Timestamp: Verified ("accurate as of video upload and are subject to change").
- ASCI / FTC Ad Guidelines: Fully satisfied.
- Claim Substantiation: All claims backed by test methodology (thermal camera, stopwatch charging test, water tank).
- Redirection Transparency: Short links map transparently to official amazon.in URLs without cloaking.',
  '2026-11-10T14:20:00Z',
  '2026-11-10T14:20:00Z'
);

-- Short Links
INSERT OR REPLACE INTO short_links (
  id, creator_id, slug, destination_url, destination_domain,
  title, utm_source, utm_medium, utm_campaign, expires_at, total_clicks, created_at
) VALUES 
(
  'link_1',
  'creator_demo_tech_kabir',
  'moto-edge-fusion',
  'https://www.amazon.in/dp/B0D3G78JKL?tag=techkabir-21',
  'amazon.in',
  'Motorola Edge 50 Fusion (Amazon India)',
  'youtube',
  'description',
  'moto-vs-vivo-2026',
  NULL,
  420,
  '2026-10-23T10:00:00Z'
),
(
  'link_2',
  'creator_demo_tech_kabir',
  'vivo-t3-pro',
  'https://www.amazon.in/dp/B0DCF9X11M?tag=techkabir-21',
  'amazon.in',
  'Vivo T3 Pro 5G (Amazon India)',
  'youtube',
  'description',
  'moto-vs-vivo-2026',
  NULL,
  315,
  '2026-10-25T10:00:00Z'
),
(
  'link_3',
  'creator_demo_tech_kabir',
  'mac-mini-m4-deal',
  'https://www.amazon.in/dp/B0DLH4567M?tag=techkabir-21',
  'amazon.in',
  'Apple M4 Mac Mini 16GB (Amazon Deal)',
  'youtube',
  'pinned_comment',
  'mac-mini-review',
  NULL,
  842,
  '2026-11-02T10:00:00Z'
),
(
  'link_4',
  'creator_demo_tech_kabir',
  'kabir-gear-kit',
  'https://creatorbrain.dev/@techkabir',
  'creatorbrain.dev',
  'Complete Studio Gear & Bio Page',
  'instagram',
  'bio',
  'evergreen-gear',
  NULL,
  620,
  '2026-10-18T10:00:00Z'
),
(
  'link_5',
  'creator_demo_tech_kabir',
  'sony-xm5-offer',
  'https://www.amazon.in/dp/B09XS7JWHH?tag=techkabir-21',
  'amazon.in',
  'Sony WH-1000XM5 Silver (Discounted)',
  'youtube',
  'description',
  'audio-deals',
  NULL,
  189,
  '2026-10-28T10:00:00Z'
);

-- Link Clicks
INSERT OR REPLACE INTO link_clicks (id, short_link_id, bio_block_id, creator_id, country, device, referrer, ip_hash, user_agent, created_at) VALUES
('click_1', 'link_1', 'block_1', 'creator_demo_tech_kabir', 'India', 'Mobile', 'YouTube', 'hash1', 'Mozilla/5.0 Android', '2026-11-12T18:00:00Z'),
('click_2', 'link_1', 'block_1', 'creator_demo_tech_kabir', 'India', 'Mobile', 'YouTube', 'hash2', 'Mozilla/5.0 Android', '2026-11-12T17:00:00Z'),
('click_3', 'link_1', 'block_1', 'creator_demo_tech_kabir', 'India', 'Desktop', 'YouTube', 'hash3', 'Mozilla/5.0 Windows', '2026-11-12T15:00:00Z'),
('click_4', 'link_1', NULL, 'creator_demo_tech_kabir', 'United States', 'Desktop', 'Direct', 'hash4', 'Mozilla/5.0 Mac', '2026-11-12T11:00:00Z'),
('click_5', 'link_2', 'block_2', 'creator_demo_tech_kabir', 'India', 'Mobile', 'YouTube', 'hash5', 'Mozilla/5.0 Android', '2026-11-12T18:30:00Z'),
('click_6', 'link_2', 'block_2', 'creator_demo_tech_kabir', 'India', 'Mobile', 'Instagram', 'hash6', 'Mozilla/5.0 iPhone', '2026-11-12T16:00:00Z'),
('click_7', 'link_3', 'block_4', 'creator_demo_tech_kabir', 'India', 'Desktop', 'YouTube', 'hash7', 'Mozilla/5.0 Mac', '2026-11-12T18:00:00Z'),
('click_8', 'link_3', 'block_4', 'creator_demo_tech_kabir', 'United States', 'Desktop', 'YouTube', 'hash8', 'Mozilla/5.0 Mac', '2026-11-12T14:00:00Z'),
('click_9', 'link_3', 'block_4', 'creator_demo_tech_kabir', 'United Kingdom', 'Mobile', 'Twitter', 'hash9', 'Mozilla/5.0 iPhone', '2026-11-12T07:00:00Z'),
('click_10', 'link_4', 'block_3', 'creator_demo_tech_kabir', 'India', 'Mobile', 'Instagram', 'hash10', 'Mozilla/5.0 Android', '2026-11-12T17:00:00Z'),
('click_11', 'link_4', 'block_3', 'creator_demo_tech_kabir', 'India', 'Mobile', 'Instagram', 'hash11', 'Mozilla/5.0 iPhone', '2026-11-12T13:00:00Z'),
('click_12', 'link_5', NULL, 'creator_demo_tech_kabir', 'Germany', 'Desktop', 'YouTube', 'hash12', 'Mozilla/5.0 Windows', '2026-11-12T01:00:00Z');

-- Affiliate Links
INSERT OR REPLACE INTO affiliate_links (id, creator_id, project_id, product_id, tracking_id, original_url, tagged_url, created_at) VALUES
('aff_1', 'creator_demo_tech_kabir', 'proj_moto_vs_vivo', 'prod_moto_edge_50', 'techkabir-21', 'https://www.amazon.in/dp/B0D3G78JKL', 'https://www.amazon.in/dp/B0D3G78JKL?tag=techkabir-21', '2026-10-23T10:00:00Z'),
('aff_2', 'creator_demo_tech_kabir', 'proj_moto_vs_vivo', 'prod_vivo_t3_pro', 'techkabir-21', 'https://www.amazon.in/dp/B0DCF9X11M', 'https://www.amazon.in/dp/B0DCF9X11M?tag=techkabir-21', '2026-10-25T10:00:00Z'),
('aff_3', 'creator_demo_tech_kabir', 'proj_mac_mini_m4', 'prod_mac_mini_m4', 'techkabir-21', 'https://www.amazon.in/dp/B0DLH4567M', 'https://www.amazon.in/dp/B0DLH4567M?tag=techkabir-21', '2026-11-02T10:00:00Z'),
('aff_4', 'creator_demo_tech_kabir', NULL, 'prod_sony_xm5', 'techkabir-21', 'https://www.amazon.in/dp/B09XS7JWHH', 'https://www.amazon.in/dp/B09XS7JWHH?tag=techkabir-21', '2026-10-28T10:00:00Z');

-- Earnings Reports
INSERT OR REPLACE INTO earnings_reports (id, creator_id, report_date, asin, product_title, items_ordered, items_shipped, revenue, commission, created_at) VALUES
('earn_1', 'creator_demo_tech_kabir', '2026-11-10', 'B0D3G78JKL', 'Motorola Edge 50 Fusion 5G', 8, 8, 183992.0, 4599.8, '2026-11-10T18:00:00Z'),
('earn_2', 'creator_demo_tech_kabir', '2026-11-09', 'B0DCF9X11M', 'Vivo T3 Pro 5G', 5, 5, 124995.0, 3124.8, '2026-11-09T18:00:00Z'),
('earn_3', 'creator_demo_tech_kabir', '2026-11-08', 'B0DLH4567M', 'Apple Mac Mini M4 Desktop', 2, 2, 119800.0, 2396.0, '2026-11-08T18:00:00Z'),
('earn_4', 'creator_demo_tech_kabir', '2026-11-07', 'B09XS7JWHH', 'Sony WH-1000XM5 Wireless Headphones', 3, 3, 80970.0, 2024.2, '2026-11-07T18:00:00Z');
