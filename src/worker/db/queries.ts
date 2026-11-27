import type {
  Creator,
  GraphData,
  Learning,
  Lesson,
  Quiz,
  AgentTrace,
  Project,
  ProjectAsset,
  Product,
  ShortLink,
  BioPage,
  BioBlock,
  ProviderSettings,
  EarningsReport,
} from '../../shared/types';
import { bioIconUrlFromContent, contentWithBioIcon } from '../../shared/bio';

// Never hand password material to routes; public lookups also drop the email
function stripSecrets(row: Creator | null, keepEmail = true): Creator | null {
  if (!row) return null;
  const { password_hash: _h, password_salt: _s, email, ...rest } = row as Creator & Record<string, unknown>;
  return (keepEmail ? { ...rest, email } : rest) as Creator;
}

export class DBClient {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getCreator(id: string): Promise<Creator | null> {
    const row = await this.db.prepare('SELECT * FROM creators WHERE id = ?').bind(id).first<Creator>();
    return stripSecrets(row);
  }

  async getCreatorByHandle(handle: string): Promise<Creator | null> {
    return await this.db
      .prepare('SELECT * FROM creators WHERE handle = ?')
      .bind(handle)
      .first<Creator>()
      .then((row) => stripSecrets(row, false));
  }

  /**
   * One graph read per request, zero waterfalls
   */
  async getBrainGraph(creatorId: string): Promise<GraphData> {
    const [nodesRes, edgesRes] = await this.db.batch([
      this.db.prepare('SELECT * FROM nodes WHERE creator_id = ?').bind(creatorId),
      this.db.prepare('SELECT * FROM edges WHERE creator_id = ?').bind(creatorId),
    ]);

    return {
      nodes: (nodesRes.results as unknown as GraphData['nodes']) || [],
      edges: (edgesRes.results as unknown as GraphData['edges']) || [],
    };
  }

  async getLearnings(creatorId: string, limit = 5): Promise<Learning[]> {
    const res = await this.db
      .prepare('SELECT * FROM learnings WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(creatorId, limit)
      .all<Learning>();
    return res.results || [];
  }

  async getLessons(creatorId: string): Promise<Lesson[]> {
    const res = await this.db
      .prepare('SELECT * FROM lessons WHERE creator_id = ? ORDER BY order_index ASC')
      .bind(creatorId)
      .all<Lesson>();
    return res.results || [];
  }

  async completeLesson(creatorId: string, lessonId: string): Promise<void> {
    await this.db
      .prepare('UPDATE lessons SET completed = 1, completed_at = ? WHERE id = ? AND creator_id = ?')
      .bind(new Date().toISOString(), lessonId, creatorId)
      .run();
  }

  async getQuizzes(creatorId: string): Promise<Quiz[]> {
    const res = await this.db
      .prepare('SELECT * FROM quizzes WHERE creator_id = ? ORDER BY created_at DESC')
      .bind(creatorId)
      .all<Quiz>();
    return res.results || [];
  }

  async submitQuizScore(creatorId: string, quizId: string, score: number): Promise<void> {
    await this.db
      .prepare('UPDATE quizzes SET score = ?, status = "completed", completed_at = ? WHERE id = ? AND creator_id = ?')
      .bind(score, new Date().toISOString(), quizId, creatorId)
      .run();
  }

  async getAgentTraces(creatorId: string, limit = 30): Promise<AgentTrace[]> {
    const res = await this.db
      .prepare('SELECT * FROM agent_traces WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(creatorId, limit)
      .all<AgentTrace>();
    return res.results || [];
  }

  async getProjects(creatorId: string): Promise<Project[]> {
    const res = await this.db
      .prepare('SELECT * FROM projects WHERE creator_id = ? ORDER BY updated_at DESC')
      .bind(creatorId)
      .all<Project>();
    return res.results || [];
  }

  async getProjectWithAssets(
    creatorId: string,
    projectId: string
  ): Promise<{ project: Project | null; assets: ProjectAsset[] }> {
    const [projRes, assetsRes] = await this.db.batch([
      this.db.prepare('SELECT * FROM projects WHERE id = ? AND creator_id = ?').bind(projectId, creatorId),
      this.db
        .prepare('SELECT * FROM assets WHERE project_id = ? AND creator_id = ? ORDER BY type ASC')
        .bind(projectId, creatorId),
    ]);

    const project = (projRes.results?.[0] as Project) || null;
    const assets = (assetsRes.results as ProjectAsset[]) || [];
    return { project, assets };
  }

  async createProject(project: Project): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO projects (id, creator_id, title, status, brief, primary_product_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        project.id,
        project.creator_id,
        project.title,
        project.status,
        project.brief,
        project.primary_product_id || null,
        project.created_at,
        project.updated_at
      )
      .run();
  }

  async updateProject(creatorId: string, projectId: string, updates: Partial<Project>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.brief) {
      fields.push('brief = ?');
      values.push(updates.brief);
    }
    if (updates.primary_product_id) {
      fields.push('primary_product_id = ?');
      values.push(updates.primary_product_id);
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(projectId, creatorId);

    await this.db
      .prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND creator_id = ?`)
      .bind(...values)
      .run();
  }

  async saveAsset(asset: ProjectAsset): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO assets (
          id, project_id, creator_id, type, current_version_id, title, content, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        asset.id,
        asset.project_id,
        asset.creator_id,
        asset.type,
        asset.current_version_id || null,
        asset.title,
        asset.content,
        asset.created_at,
        asset.updated_at
      )
      .run();
  }

  async getProducts(creatorId: string): Promise<Product[]> {
    const res = await this.db
      .prepare('SELECT * FROM products WHERE creator_id = ? ORDER BY created_at DESC')
      .bind(creatorId)
      .all<Product>();
    return res.results || [];
  }

  async saveProduct(product: Product): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO products (
          id, creator_id, asin, title, price_str, price_timestamp, currency,
          image_url, product_url, features_json, specs_json, pros_cons_json,
          is_mock, availability, last_checked_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, price_str=excluded.price_str,
          price_timestamp=excluded.price_timestamp, currency=excluded.currency, image_url=excluded.image_url,
          product_url=excluded.product_url, features_json=excluded.features_json, specs_json=excluded.specs_json,
          pros_cons_json=excluded.pros_cons_json, is_mock=excluded.is_mock, availability=excluded.availability,
          last_checked_at=excluded.last_checked_at WHERE products.creator_id=excluded.creator_id`
      )
      .bind(
        product.id,
        product.creator_id,
        product.asin,
        product.title,
        product.price_str,
        product.price_timestamp,
        product.currency,
        product.image_url,
        product.product_url,
        product.features_json || null,
        product.specs_json || null,
        product.pros_cons_json || null,
        product.is_mock,
        product.availability,
        product.last_checked_at || null,
        product.created_at
      )
      .run();
  }

  async getShortLinks(creatorId: string): Promise<ShortLink[]> {
    const res = await this.db
      .prepare('SELECT * FROM short_links WHERE creator_id = ? ORDER BY created_at DESC')
      .bind(creatorId)
      .all<ShortLink>();
    return res.results || [];
  }

  async getShortLinkBySlug(slug: string): Promise<ShortLink | null> {
    return await this.db.prepare('SELECT * FROM short_links WHERE slug = ?').bind(slug).first<ShortLink>();
  }

  async createShortLink(link: ShortLink): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO short_links (
          id, creator_id, slug, destination_url, destination_domain, title,
          utm_source, utm_medium, utm_campaign, expires_at, total_clicks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        link.id,
        link.creator_id,
        link.slug,
        link.destination_url,
        link.destination_domain,
        link.title || null,
        link.utm_source || null,
        link.utm_medium || null,
        link.utm_campaign || null,
        link.expires_at || null,
        link.total_clicks,
        link.created_at
      )
      .run();
  }

  async recordClick(
    shortLinkId: string,
    creatorId: string,
    meta: {
      country?: string;
      device?: string;
      referrer?: string;
      ipHash?: string;
      userAgent?: string;
      bioBlockId?: string;
    }
  ): Promise<void> {
    const clickId = `click_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO link_clicks (
            id, short_link_id, bio_block_id, creator_id, country, device, referrer, ip_hash, user_agent, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          clickId,
          shortLinkId,
          meta.bioBlockId || null,
          creatorId,
          meta.country || 'India',
          meta.device || 'Desktop',
          meta.referrer || 'Direct',
          meta.ipHash || null,
          meta.userAgent || null,
          now
        ),
      this.db.prepare('UPDATE short_links SET total_clicks = total_clicks + 1 WHERE id = ?').bind(shortLinkId),
    ]);
  }

  async getBioPageWithBlocks(handle: string): Promise<{
    creator: Creator | null;
    bioPage: BioPage | null;
    blocks: BioBlock[];
  }> {
    const creator = await this.getCreatorByHandle(handle);
    if (!creator) return { creator: null, bioPage: null, blocks: [] };

    const page = await this.db
      .prepare('SELECT * FROM bio_pages WHERE creator_id = ?')
      .bind(creator.id)
      .first<BioPage>();

    if (!page) return { creator, bioPage: null, blocks: [] };

    const blocksRes = await this.db
      .prepare('SELECT * FROM bio_blocks WHERE bio_page_id = ? ORDER BY order_index ASC')
      .bind(page.id)
      .all<BioBlock>();

    const blocks = blocksRes.results || [];
    for (const block of blocks) block.icon_url = bioIconUrlFromContent(block.content_json);
    // Populate product details for product_card blocks
    const productIds = blocks.map((b) => b.product_id).filter((id): id is string => !!id);

    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const prodsRes = await this.db
        .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
        .bind(...productIds)
        .all<Product>();

      const prodMap = new Map((prodsRes.results || []).map((p) => [p.id, p]));
      for (const block of blocks) {
        if (block.product_id && prodMap.has(block.product_id)) {
          block.product = prodMap.get(block.product_id);
        }
      }
    }

    return { creator, bioPage: page, blocks };
  }

  async saveBioPage(page: BioPage): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO bio_pages (
          id, creator_id, handle, theme, custom_title, custom_bio,
          accent_color, bg_color, is_published, views_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        page.id,
        page.creator_id,
        page.handle,
        page.theme,
        page.custom_title || null,
        page.custom_bio || null,
        page.accent_color,
        page.bg_color,
        page.is_published,
        page.views_count,
        page.created_at,
        page.updated_at
      )
      .run();
  }

  async saveBioBlocks(bioPageId: string, blocks: BioBlock[]): Promise<void> {
    const stmts: D1PreparedStatement[] = [
      this.db.prepare('DELETE FROM bio_blocks WHERE bio_page_id = ?').bind(bioPageId),
    ];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      stmts.push(
        this.db
          .prepare(
            `INSERT INTO bio_blocks (
              id, bio_page_id, type, order_index, title, url, product_id,
              content_json, is_active, clicks_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            b.id || `block_${Date.now()}_${i}`,
            bioPageId,
            b.type,
            i + 1,
            b.title || null,
            b.url || null,
            b.product_id || null,
            contentWithBioIcon(b.content_json, b.icon_url),
            b.is_active ?? 1,
            b.clicks_count || 0,
            b.created_at || new Date().toISOString()
          )
      );
    }

    await this.db.batch(stmts);
  }

  async getProviderSettings(creatorId: string): Promise<ProviderSettings | null> {
    return await this.db
      .prepare('SELECT * FROM provider_settings WHERE creator_id = ?')
      .bind(creatorId)
      .first<ProviderSettings>();
  }

  async updateProviderSettings(creatorId: string, settings: Partial<ProviderSettings>): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO provider_settings (
          id, creator_id, preferred_general_provider, preferred_fast_provider,
          preferred_structured_provider, preferred_video_provider, daily_budget_usd,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `setting_${creatorId}`,
        creatorId,
        settings.preferred_general_provider || 'claude',
        settings.preferred_fast_provider || 'claude-haiku',
        settings.preferred_structured_provider || 'openai',
        settings.preferred_video_provider || 'gemini',
        settings.daily_budget_usd ?? 5.0,
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();
  }

  async getEarningsReports(creatorId: string, marketplace: string): Promise<EarningsReport[]> {
    const res = await this.db
      .prepare('SELECT * FROM earnings_reports WHERE creator_id = ? AND marketplace = ? ORDER BY report_date DESC')
      .bind(creatorId, marketplace)
      .all<EarningsReport>();
    return res.results || [];
  }

  async importEarnings(
    creatorId: string,
    marketplace: string,
    rows: Omit<EarningsReport, 'id' | 'creator_id' | 'created_at'>[]
  ): Promise<number> {
    const dates = [...new Set(rows.map(row => row.report_date))];
    const stmts = [this.db.prepare(
      `DELETE FROM earnings_reports WHERE creator_id = ? AND marketplace = ?
        AND report_date IN (SELECT value FROM json_each(?))`
    ).bind(creatorId, marketplace, JSON.stringify(dates))];
    stmts.push(this.db.prepare(`INSERT INTO earnings_reports (
      id, creator_id, report_date, asin, product_title, items_ordered, items_shipped, revenue, commission, created_at, marketplace
    ) SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.report_date'), json_extract(value, '$.asin'),
      json_extract(value, '$.product_title'), json_extract(value, '$.items_ordered'), json_extract(value, '$.items_shipped'),
      json_extract(value, '$.revenue'), json_extract(value, '$.commission'), ?, ?
    FROM json_each(?)`).bind(creatorId, new Date().toISOString(), marketplace,
      JSON.stringify(rows.map(row => ({ ...row, id: `earn_${crypto.randomUUID()}` })))));
    await this.db.batch(stmts);
    return rows.length;
  }

  async deleteCreatorData(creatorId: string): Promise<void> {
    // Every table holding creator data, children first, then the creator row itself
    const tables = [
      'edges',
      'nodes',
      'learnings',
      'lessons',
      'quizzes',
      'agent_traces',
      'asset_versions_by_creator',
      'assets',
      'projects',
      'affiliate_links',
      'link_clicks',
      'short_links',
      'bio_blocks_by_creator',
      'bio_pages',
      'products',
      'provider_settings',
      'credentials_encrypted',
      'earnings_reports',
      'content_items',
      'brand_deals',
      'chat_messages',
      'analysis_jobs',
      'sessions',
    ];
    const stmts = tables.map((t) => {
      if (t === 'asset_versions_by_creator') {
        return this.db
          .prepare('DELETE FROM asset_versions WHERE asset_id IN (SELECT id FROM assets WHERE creator_id = ?)')
          .bind(creatorId);
      }
      if (t === 'bio_blocks_by_creator') {
        return this.db
          .prepare('DELETE FROM bio_blocks WHERE bio_page_id IN (SELECT id FROM bio_pages WHERE creator_id = ?)')
          .bind(creatorId);
      }
      return this.db.prepare(`DELETE FROM ${t} WHERE creator_id = ?`).bind(creatorId);
    });
    stmts.push(this.db.prepare('DELETE FROM creators WHERE id = ?').bind(creatorId));
    await this.db.batch(stmts);
  }
}
