export interface Lead {
  _id: string;
  platform: 'facebook';
  profileId: string;
  profileUrl: string;
  fullName: string;
  jobTitle?: string;
  companyName?: string;
  location?: string;
  email?: string;
  phone?: string;
  triggerContext: string;
  sourceUrl: string;
  intentScore: number;
  intentReasoning: string;
  createdAt: string;
}

export interface Keyword {
  _id: string;
  keyword: string;
  cron: string;
  enabled: boolean;
  targetUrls: string[];
  createdAt: string;
}

export interface StatusResponse {
  status: string;
  timestamp: string;
}
