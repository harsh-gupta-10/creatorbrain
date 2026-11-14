import type { Product } from '../../shared/types';
import { MOCK_AMAZON_PRODUCTS } from './fixtures';

export interface AmazonCredentials {
  accessKey?: string;
  secretKey?: string;
  partnerTag: string;
  marketplace?: string; // default amazon.in
}

export class AmazonCreatorsClient {
  private credentials?: AmazonCredentials;
  private isMockMode: boolean = true;
  private marketplace: string = 'amazon.in';

  constructor(credentials?: AmazonCredentials) {
    if (credentials?.accessKey && credentials?.secretKey && credentials?.partnerTag) {
      this.credentials = credentials;
      this.isMockMode = false;
      this.marketplace = credentials.marketplace || 'amazon.in';
    } else {
      this.isMockMode = true;
      this.marketplace = credentials?.marketplace || 'amazon.in';
    }
  }

  isMock(): boolean {
    return this.isMockMode;
  }

  getMarketplace(): string {
    return this.marketplace;
  }

  getPartnerTag(): string {
    return this.credentials?.partnerTag || '';
  }

  private generateTimestamp(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `price as of ${dateStr} ${timeStr} IST`;
  }

  async searchItems(keywords: string, creatorId: string): Promise<Product[]> {
    if (this.isMockMode) {
      const q = keywords.toLowerCase();
      const matched = MOCK_AMAZON_PRODUCTS.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.asin.toLowerCase() === q ||
          p.product_url.toLowerCase().includes(q)
      );

      const pool = matched.length > 0 ? matched : MOCK_AMAZON_PRODUCTS;
      return pool.map((p) => ({
        ...p,
        id: `prod_${p.asin.toLowerCase()}`,
        creator_id: creatorId,
        price_timestamp: this.generateTimestamp(),
        last_checked_at: new Date().toISOString(),
      }));
    }

    // Live Amazon Creators API REST fetch
    try {
      // Per Creators API specification
      const endpoint = `https://api.amazon.in/creators/v1/items:search`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-amz-access-token': this.credentials!.accessKey!,
        },
        body: JSON.stringify({
          keywords,
          partnerTag: this.credentials!.partnerTag,
          marketplace: this.marketplace,
        }),
      });

      if (!res.ok) {
        throw new Error(`Amazon Creators API HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      return (data.items || []).map((item: any) => ({
        id: `prod_${item.asin}`,
        creator_id: creatorId,
        asin: item.asin,
        title: item.title,
        price_str: item.price?.displayAmount || 'Check Amazon for Price',
        price_timestamp: this.generateTimestamp(),
        currency: item.price?.currency || 'INR',
        image_url: item.imageUrl || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80',
        product_url: item.detailPageUrl || `https://www.${this.marketplace}/dp/${item.asin}`,
        features_json: JSON.stringify(item.features || []),
        specs_json: JSON.stringify(item.specs || {}),
        pros_cons_json: JSON.stringify(item.prosCons || { pros: [], cons: [] }),
        is_mock: 0,
        availability: item.availability || 'In Stock',
        last_checked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));
    } catch (err: any) {
      console.warn('[Amazon Client] Live API error, falling back to mock fixtures:', err.message);
      return MOCK_AMAZON_PRODUCTS.map((p) => ({
        ...p,
        id: `prod_${p.asin.toLowerCase()}`,
        creator_id: creatorId,
        price_timestamp: this.generateTimestamp(),
        is_mock: 1,
      }));
    }
  }

  async getItems(asins: string[], creatorId: string): Promise<Product[]> {
    if (this.isMockMode) {
      return MOCK_AMAZON_PRODUCTS.filter((p) => asins.includes(p.asin)).map((p) => ({
        ...p,
        id: `prod_${p.asin.toLowerCase()}`,
        creator_id: creatorId,
        price_timestamp: this.generateTimestamp(),
        last_checked_at: new Date().toISOString(),
      }));
    }

    return this.searchItems(asins[0] || '', creatorId);
  }

  buildAffiliateUrl(originalUrl: string, customPartnerTag?: string): string {
    const tag = customPartnerTag || this.getPartnerTag();
    try {
      const u = new URL(originalUrl);
      u.searchParams.set('tag', tag);
      return u.toString();
    } catch {
      return `${originalUrl}?tag=${tag}`;
    }
  }

  getMandatoryDisclosure(): string {
    return 'Affiliate Disclosure: As an Amazon Associate, I earn from qualifying purchases made through links here at zero extra cost to you.';
  }
}
