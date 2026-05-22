import * as fs from "fs";
import { MessageContext, QuizState } from "../types/index";

export class SessionManager {
  private sessionPath: string;
  private sessions: Map<string, MessageContext> = new Map();

  constructor(sessionPath: string = "./sessions") {
    this.sessionPath = sessionPath;
    this.ensureSessionDirectory();
    this.loadSessions();
  }

  private ensureSessionDirectory() {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }
  private loadSessions() {
    const file = `${this.sessionPath}/sessions.json`;
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));
        for (const [chatId, ctx] of Object.entries(data)) {
          this.sessions.set(chatId, ctx as MessageContext);
        }
      } catch {
        this.sessions.clear();
      }
    }
  }

  private persistSessions() {
    const file = `${this.sessionPath}/sessions.json`;
    const data: Record<string, MessageContext> = {};
    for (const [chatId, ctx] of this.sessions) {
      data[chatId] = ctx;
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  }

  getContext(chatId: string): MessageContext {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, {
        chatId,
        sender: "",
        messageType: "text",
        timestamp: new Date(),
        history: [],
      });
    }
    return this.sessions.get(chatId)!;
  }

  setActiveSubject(chatId: string, subject: string | undefined) {
    const ctx = this.getContext(chatId);
    ctx.activeSubject = subject;
    ctx.timestamp = new Date();
    this.persistSessions();
  }

  getActiveSubject(chatId: string): string | undefined {
    return this.getContext(chatId).activeSubject;
  }

  setQuizState(chatId: string, quizState: QuizState | undefined) {
    const ctx = this.getContext(chatId);
    ctx.quizState = quizState;
    ctx.timestamp = new Date();
    this.persistSessions();
  }

  getQuizState(chatId: string): QuizState | undefined {
    return this.getContext(chatId).quizState;
  }

  addToHistory(chatId: string, entry: string) {
    const ctx = this.getContext(chatId);
    ctx.history.push(entry);
    if (ctx.history.length > 50) ctx.history = ctx.history.slice(-50);
    ctx.timestamp = new Date();
    this.persistSessions();
  }

  getHistory(chatId: string): string[] {
    return this.getContext(chatId).history;
  }

  resetChat(chatId: string) {
    this.sessions.delete(chatId);
    this.persistSessions();
  }

  getSessionPath(): string {
    return this.sessionPath;
  }

  clearSession() {
    if (fs.existsSync(this.sessionPath)) {
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
      this.ensureSessionDirectory();
    }
    this.sessions.clear();
  }
}
