export type ShortLink = {
  id: number;
  code: string;
  original_url: string;
  click_count: number;
  created_at: string;
  expires_at: string | null;
};

export type CreateLinkInput = {
  original_url: string;
  expires_at?: string;
};
