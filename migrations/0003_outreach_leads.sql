-- 業種別・周年別フォーム営業リストの保存先。
-- LLM Wiki側の anniversary_outreach.py / industry_outreach.py から
-- /api/outreach 経由で読み書きする（Notionの代替・機械作業側の保存先）。
-- 実際の送信可否レビューはこのテーブルを見る簡易管理画面（別途）で行う想定。
CREATE TABLE IF NOT EXISTS outreach_leads (
  id               TEXT PRIMARY KEY,
  campaign         TEXT NOT NULL,   -- '周年営業' / '士業AI-DX' 等
  company_name     TEXT NOT NULL,
  corporate_number TEXT,
  prefecture       TEXT,
  city             TEXT,
  rep_name         TEXT,
  industry         TEXT,
  site_url         TEXT,
  form_url         TEXT,
  email_address    TEXT,
  approach_channel TEXT,            -- 'フォーム' / 'メール'
  message          TEXT,
  status           TEXT NOT NULL,   -- '候補' / '下書き' / '承認済み' / '送信済み' / 'スキップ' / '失敗'
  skip_reason      TEXT,
  metadata_json    TEXT,            -- 周年月・設立年等、テーブルに無い付随情報をJSONで保持
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outreach_leads_campaign_status ON outreach_leads(campaign, status);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_corp_num ON outreach_leads(corporate_number);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_created_at ON outreach_leads(created_at);
