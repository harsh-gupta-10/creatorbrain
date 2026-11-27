ALTER TABLE earnings_reports ADD COLUMN marketplace TEXT;

-- Existing imports used the marketplace saved in their creator's Amazon settings.
UPDATE earnings_reports SET marketplace = COALESCE(
  (SELECT amazon_marketplace FROM credentials_encrypted c WHERE c.creator_id = earnings_reports.creator_id),
  'amazon.com'
);

CREATE INDEX idx_earnings_creator_market_date ON earnings_reports(creator_id, marketplace, report_date);
