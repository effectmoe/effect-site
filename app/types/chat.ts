export interface ChatContext {
  title: string;
  slug: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: string;
  context?: ChatContext[];
}
