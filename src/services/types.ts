export interface FacebookPost {
  postId?: string;
  text?: string;
  url?: string;
  time?: string;
  pageName?: string;
  user?: {
    id?: string;
    name?: string;
  };
  [key: string]: unknown;
}

export interface FacebookComment {
  commentId?: string;
  text?: string;
  date?: string;
  profileId?: string;
  profileName?: string;
  commentUrl?: string;
  threadingDepth?: number;
  facebookUrl?: string;
  pageName?: string;
  author?: {
    id?: string;
    name?: string;
  };
  [key: string]: unknown;
}

export interface ScrapeOptions {
  resultsLimit?: number;
  onlyPostsNewerThan?: string;
}

export interface CommentScrapeOptions {
  resultsLimit?: number;
  onlyCommentsNewerThan?: string;
  includeNestedComments?: boolean;
}

export interface QualifiedLead {
  fullName: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  email?: string;
  phone?: string;
  companyWebsite?: string;
  intentScore: number;
  intentReasoning: string;
}
