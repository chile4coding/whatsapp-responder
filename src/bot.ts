import * as dotenv from "dotenv";
dotenv.config();

import WAWebJS, { Client, LocalAuth, Message } from "whatsapp-web.js";
import { AIService } from "./services/aiService";
import { logger } from "./utils/logger";
import { SessionManager } from "./utils/sessionManager";
import { CommandHandler } from "./handlers/commandHandler";
import { MessageHandler } from "./handlers/messageHandler";
import { MediaHandler } from "./handlers/mediaHandler";
import { QuizHandler } from "./handlers/quizHandler";
import { QuizQuestion } from "./types/index";
import { ThinkingLevel } from "@google/genai";
import qrcode from "qrcode-terminal";

const sessionPath = process.env.SESSION_PATH || "./sessions";

const sessionManager = new SessionManager(sessionPath);
const aiService = new AIService();
const commandHandler = new CommandHandler(aiService, new QuizHandler(aiService));
const messageHandler = new MessageHandler(aiService);
const mediaHandler = new MediaHandler(aiService);
const quizHandler = new QuizHandler(aiService);

export class WhatsAppBot {
  private client: Client;

  constructor(private _sessionPath: string = "./sessions") {
    const chromePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_PATH ||
      "/snap/bin/chromium";

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: _sessionPath }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on("qr", (qr: string) => {
      logger.info("QR Code received — scan with WhatsApp to connect");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      logger.info("StudyMate is ready!");
    });

    this.client.on("message", async (message: Message) => {
      if (message.fromMe) return;

      try {
        const chat = await message.getChat();
        await chat.sendStateTyping();

        await this.handleMessage(message);
        await chat.clearState();
      } catch (err) {
        logger.error("Error handling message:", err);
        try {
          await message.reply(
            "Sorry, something went wrong. Please try again 🤖",
          );
        } catch (_replyErr) {
          logger.error("Failed to send error reply:", _replyErr);
        }
      }
    });

    this.client.on("authenticated", () => {
      logger.info("Authentication successful");
    });

    this.client.on("auth_failure", (msg: string) => {
      logger.error("Authentication failure", { msg });
    });

    this.client.on("disconnected", (reason: string) => {
      logger.warn("Client disconnected", { reason });
    });
  }

  private async handleMessage(message: Message) {
    const chatId = message.from;

    if (message.hasMedia) {
      const response = await mediaHandler.handleMedia(message);
      sessionManager.addToHistory(chatId, `Media: ${response.slice(0, 100)}`);
      await safeReply(message, response);
    } else {
      await this.handleTextMessage(message, chatId);
    }
  }

  private async handleTextMessage(
    message: Message,
    chatId: string,
  ) {
    const text = message.body.trim();
    const subjectMode = sessionManager.getActiveSubject(chatId);
    const quizState = sessionManager.getQuizState(chatId);
    const needsSearch = (t: string) =>
      ["what is", "current", "today", "latest", "news"].some((k) =>
        t.toLowerCase().includes(k),
      );

    // ── Quiz in-progress: evaluate answer ─────────────────────────────
    if (quizState?.active) {
      const answer = text. replace(/[\/\\]/g, "").trim();
      const feedback = quizHandler.evaluateAnswer(
        quizState,
        answer,
        quizState.expectedAnswer,
        "",
      );
      sessionManager.setQuizState(chatId, quizState);

      if (quizState.active) {
        await safeReply(message, feedback);
        // Send next question after a short gap
        setTimeout(async () => {
          const { question } = await quizHandler.generateQuestion(quizState.subject);
          quizState.expectedAnswer = question.answer;
          quizState.currentQuestion += 1;
          sessionManager.setQuizState(chatId, quizState);

          const msg = formatQuizQuestion(
            quizState.currentQuestion,
            quizState.totalQuestions,
            question,
          );
          await sendCascadedMessage(this.client, chatId, msg);
        }, 1500);
        return;
      }

      await safeReply(message, feedback);
      sessionManager.addToHistory(chatId, `Quiz answer: ${answer}`);
      return;
    }

    // ── Command handling ──────────────────────────────────────────────
    if (text.startsWith("/")) {
      const result = await commandHandler.handleCommand(text, subjectMode);

      if (result.type === "quizStart") {
        sessionManager.setQuizState(chatId, result.quizState!);
        sessionManager.setActiveSubject(chatId, result.subject);
        sessionManager.addToHistory(chatId, `Cmd: ${text}`);

        await safeReply(
          message,
          `Quiz starting for *${result.subject}*! I'll send you questions one by one to test your skill. Let's go! 📝\n\n${formatQuizQuestion(1, 5, result.firstQuestion)}`,
        );

        // Pre-queue question 2 immediately so it cascades seamlessly
        const Q2 = await quizHandler.generateQuestion(result.subject);
        result.quizState!.expectedAnswer = Q2.question.answer;
        result.quizState!.currentQuestion = 2;
        sessionManager.setQuizState(chatId, result.quizState!);
        setTimeout(async () => {
          await sendCascadedMessage(
            this.client,
            chatId,
            formatQuizQuestion(2, 5, Q2.question),
          );
        }, 3500);

        return;
      }

      sessionManager.setActiveSubject(chatId, result.subject);
      sessionManager.addToHistory(chatId, `Cmd: ${text}`);
      await safeReply(message, result.response);
      return;
    }

    // ── Regular text tutoring ─────────────────────────────────────────
    const reply = await messageHandler.handleText(message, subjectMode, needsSearch);
    sessionManager.addToHistory(chatId, reply.slice(0, 200));
    await safeReply(message, reply);
  }

  public async initialize() {
    await this.client.initialize();
  }

  public async destroy() {
    await this.client.destroy();
  }
}

/** Build a formatted quiz question string for WhatsApp */
function formatQuizQuestion(
  current: number,
  total: number,
  q: QuizQuestion,
): string {
  return `Q${current}/${total}: ${q.question}\n\nA) ${q.options[0]}\nB) ${q.options[1]}\nC) ${q.options[2]}\nD) ${q.options[3]}`;
}

/** Send a message to a chat from outside the message-reply context */
async function sendCascadedMessage(
  client: Client,
  chatId: string,
  text: string,
): Promise<void> {
  try {
    const chat = await client.getChatById(chatId);
    if (chat) {
      await chat.sendMessage(text);
    }
  } catch {
    logger.warn("Could not send cascaded question", { chatId });
  }
}

async function safeReply(message: Message, text: string) {
  if (text.length > 4000) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 3800) {
      chunks.push(text.slice(i, i + 3800));
    }
    await message.reply(chunks[0]);
    for (let i = 1; i < chunks.length; i++) {
      try { await message.reply(chunks[i]); } catch { break; }
    }
  } else {
    await message.reply(text);
  }
}
