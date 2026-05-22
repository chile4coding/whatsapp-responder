export interface BotConfig {
  name: string;
  prefix: string;
  sessionPath: string;
}

export interface PersonalityConfig {
  name: string;
  traits: string[];
  tone: string;
  responseStyle: string;
  systemInstruction: string;
  userProfile: {
    name: string;
    location: string;
  };
}

export interface MessageContext {
  chatId: string;
  sender: string;
  messageType: "text" | "audio" | "image" | "video" | "document";
  timestamp: Date;
  history: string[];
  activeSubject?: string;
  quizState?: QuizState;
}

export interface QuizState {
  subject: string;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  expectedAnswer: string;
  active: boolean;
}

export interface AIResponse {
  text: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
  };
}

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  answer: string;
  explanation: string;
}

export interface MediaUploadResult {
  uri: string;
  mimeType: string;
}

export interface UploadedMedia {
  path: string;
  mimeType: string;
}
