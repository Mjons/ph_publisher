export interface Comic {
  id: string;
  title: string;
  slug: string;
  cover_url: string;
  pages: string[];
  is_published: boolean;
  brand_name: string | null;
  brand_slug: string | null;
  series_name: string | null;
  series_slug: string | null;
  issue_number: number | null;
  view_count: number;
  created_at: string;
}

export interface ComicSibling {
  id: string;
  title: string;
  slug: string;
  issue_number: number | null;
}
