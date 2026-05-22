import { AIService } from "../services/aiService";
import { QuizHandler } from "../handlers/quizHandler";
import { ThinkingLevel } from "@google/genai";
import { QuizQuestion } from "../types/index";

export const SUBJECT_MODES: Record<string, string> = {
  "/math":      "You are now a mathematics tutor — show full working for every step, include formulas and units.",
  "/english":   "You are now an English language and literature tutor for Nigerian students.",
  "/physics":   "You are now a physics tutor — always include formulas and units.",
  "/chemistry": "You are now a chemistry tutor — include balanced equations and reactions.",
  "/biology":   "You are now a biology tutor — use Nigerian ecosystems, flora and fauna as examples.",
  "/economics": "You are now an economics tutor — use Nigerian market and everyday pricing examples.",
  "/government":"You are now a Government/Civics tutor for Nigerian secondary students.",
  "/lit":       "You are now a Literature-in-English tutor for Nigerian students.",
  "/fmath":     "You are now a Further Mathematics tutor — show derivations and full working.",
  "/csc":       "You are now a Computer Science tutor — explain algorithms and coding clearly.",
  "/jamb":      "You are now a JAMB exam prep tutor — use past-question format with options and model answers.",
  "/waec":      "You are now a WAEC exam prep tutor — structured like the official marking scheme.",
};

export class CommandHandler {
  constructor(private aiService: AIService, private quizHandler: QuizHandler) {}

  isCommand(text: string): boolean {
    return text.startsWith("/");
  }

  /**
   * Returns a union type:
   *  - { type: "quizStart", subject: string, firstQuestion: QuizQuestion }
   *  - { type: "normal", response: string, subject: string | undefined }
   */
  async handleCommand(rawCommand: string, activeSubject: string | undefined) {
    const parts = rawCommand.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (cmd) {
      case "/math":
      case "/english":
      case "/physics":
      case "/chemistry":
      case "/biology":
      case "/economics":
      case "/government":
      case "/lit":
      case "/fmath":
      case "/csc":
      case "/jamb":
      case "/waec": {
        const subjName = SUBJECT_MODES[cmd]!;
        return {
          type: "normal" as const,
          response: `Subject mode set to *${cmd.slice(1).toUpperCase()}* 📚\n${subjName}`,
          subject: cmd,
        };
      }

      case "/simplify":
        return {
          type: "normal" as const,
          response: "Simplifying the last explanation for you…",
          subject: activeSubject,
        };

      case "/reset":
        return {
          type: "normal" as const,
          response:
            "Got it! I've reset our chat. Pick a subject with `/math`, `/physics`, `/biology`, `/chemistry`, `/english`, `/economics`, `/government`, `/lit`, `/fmath`, `/csc`, `/jamb`, `/waec`, or just ask anything!",
          subject: undefined,
        };

      case "/explain":
        if (!args) {
          return { type: "normal" as const, response: "Which topic do you want explained? Try `/explain photosynthesis`", subject: activeSubject };
        }
        return {
          type: "normal" as const,
          response: await this.getDeepExplanation(args, activeSubject),
          subject: activeSubject,
        };

      case "/quiz": {
        const quizSubj = args || activeSubject || "general";
        const state = this.quizHandler.createQuizState(quizSubj);
        const questionResult = await this.quizHandler.generateQuestion(quizSubj);
        return {
          type: "quizStart" as const,
          subject: quizSubj,
          firstQuestion: questionResult.question,
          quizState: state,
        };
      }

      default:
        return {
          type: "normal" as const,
          response:
            `Unknown command "${cmd}". Available:\n` +
            Object.keys(SUBJECT_MODES).join("  ") +
            " /simplify /reset /explain [topic] /quiz [subject]",
          subject: undefined,
        };
    }
  }

  async getDeepExplanation(topic: string, subject?: string): Promise<string> {
    const promptTxt = subject
      ? `${subject} tutor here. As StudyMate (a Nigerian curriculum AI tutor), explain "${topic}" in depth:\n- Start with a simple overview\n- Break it down step by step\n- Use Nigerian examples where possible\n- End with 2 self-check questions\nKeep it mobile-friendly with short paragraphs.`
      : `As StudyMate (a Nigerian curriculum AI tutor), explain "${topic}" in depth:\n- Start with a simple overview\n- Break it down step by step\n- Use Nigerian examples where possible\n- End with 2 self-check questions\nKeep it mobile-friendly with short paragraphs.`;

    const res = await this.aiService.generateTextResponse(
      promptTxt,
      [],
      false,
      ThinkingLevel.HIGH,
    );
    return res.text;
  }
}
