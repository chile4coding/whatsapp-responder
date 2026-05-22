import { AIService } from "../services/aiService";
import { QuizState, QuizQuestion } from "../types/index";
import { ThinkingLevel } from "@google/genai";

export class QuizHandler {
  constructor(private aiService: AIService) {}

  createQuizState(subject: string): QuizState {
    return {
      subject,
      currentQuestion: 1,
      totalQuestions: 5,
      score: 0,
      expectedAnswer: "",
      active: true,
    };
  }

  async generateQuestion(
    subject: string,
  ): Promise<{ question: QuizQuestion; raw: string }> {
    const prompt = `You are StudyMate, a Nigerian curriculum AI tutor.
Generate one WAEC/JAMB-style multiple choice question for the subject: "${subject}".
Return ONLY valid JSON — no markdown, no explanation outside JSON.
Format:
{ "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A|B|C|D", "explanation": "..." }`;

    const res = await this.aiService.generateTextResponse(
      prompt,
      [],
      false,
      ThinkingLevel.HIGH,
    );

    let parsed: QuizQuestion;
    try {
      const cleaned = this.cleanJson(res.text);
      parsed = JSON.parse(cleaned);
      if (
        !parsed.question ||
        !Array.isArray(parsed.options) ||
        parsed.options.length !== 4
      ) {
        throw new Error("Invalid quiz shape");
      }
    } catch {
      parsed = {
        question:
          "What is the capital of Nigeria?",
        options: [
          "A) Port Harcourt",
          "B) Lagos",
          "C) Abuja",
          "D) Kano",
        ],
        answer: "C",
        explanation: "Abuja has been the capital of Nigeria since 1991.",
      };
    }

    return { question: parsed, raw: res.text };
  }

  private cleanJson(raw: string): string {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      return raw.slice(start, end + 1);
    }
    return raw;
  }

  evaluateAnswer(
    state: QuizState,
    studentAnswer: string,
    correctAnswer: string,
    explanation: string,
  ): string {
    const isCorrect =
      studentAnswer.trim().toUpperCase() ===
      correctAnswer.trim().toUpperCase();

    if (isCorrect) {
      state.score += 1;
    }

    if (state.currentQuestion >= state.totalQuestions) {
      state.active = false;
      const emoji = state.score >= 4
        ? "🏆"
        : state.score >= 2
          ? "👍"
          : "💪";
      return (
        (isCorrect ? "✅ Correct!" : `❌ Not quite — the answer was *${correctAnswer}*`) +
        `\n💡 ${explanation}\n\n${emoji} Quiz complete! You scored ${state.score}/${state.totalQuestions}. ${this.feedback(state.score)}`
      );
    }

    return (
      (isCorrect ? "✅ Correct!" : `❌ Not quite — the answer was *${correctAnswer}*`) +
      `\n💡 ${explanation}\n\nQuestion ${state.currentQuestion + 1} of ${state.totalQuestions} coming up…`
    );
  }

  private feedback(score: number): string {
    if (score === 5) return "Perfect! You're a star! ⭐";
    if (score === 4) return "Great job, keep it up! 🌟";
    if (score === 3) return "Solid work — review the topics you missed.";
    if (score === 2) return "Good effort — a bit more practice and you'll nail it.";
    return "Don't give up! Try again after reviewing the topic.";
  }
}
