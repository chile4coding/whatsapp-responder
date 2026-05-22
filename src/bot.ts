import * as dotenv from "dotenv";
dotenv.config();

import WAWebJS, { Client, LocalAuth, Message } from "whatsapp-web.js";
import { AIService } from "./services/aiService";
import { logger } from "./utils/logger";
import * as fs from "fs";
import * as path from "path";
import { ThinkingLevel } from "@google/genai";
import qrcode from "qrcode-terminal";
export class WhatsAppBot {
  private client: Client;
  private aiService: AIService;

  constructor(sessionPath: string = "./sessions") {
    const chromePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_PATH ||
      "/usr/bin/chromium";

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });
    this.aiService = new AIService();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on("qr", (qr: string) => {
      logger.info("QR Code received, scan with WhatsApp");

      qrcode.generate(qr, { small: true });
    });

    this.client.on("ready", () => {
      logger.info("Client is ready!");
    });

    this.client.on("message", async (message: Message) => {
      const chat = await message.getChat();
await new Promise((resolve) => setTimeout(resolve, 2000));
      await chat.sendStateTyping();

      await this.handleMessage(message);
      await chat.clearState();
    });

    this.client.on("authenticated", () => {
      logger.info("Authentication successful");
    });

    this.client.on("auth_failure", (msg: string) => {
      logger.error("Authentication failure", msg);
    });

    this.client.on("disconnected", (reason: string) => {
      logger.warn("Client disconnected", reason);
    });
  }

  private async handleMessage(message: Message) {
    if (message.fromMe) return;

    try {
      const chat = await message.getChat();
      await this.client.sendPresenceAvailable();

      let response: string;

      if (message.type === WAWebJS.MessageTypes.TEXT) {
        response = await this.handleTextMessage(message);
      } else if (message.hasMedia) {
        response = await this.handleMediaMessage(message);
      } else {
        response =
          "I can only process text, images, audio, and video messages.";
      }

      console.log("=====", response);
      

      if (response) {
        await message.reply(response);
      }
    } catch (error) {
      logger.error("Error handling message:", error);
      await message.reply(
        "Sorry, I encountered an error processing your message.",
      );
    }
  }

  private async handleTextMessage(message: Message): Promise<string> {
    const shouldUseSearch = this.needsSearch(message.body);

    const result = await this.aiService.generateTextResponse(
      message.body,
      [],
      shouldUseSearch,
      ThinkingLevel.HIGH,
    );

    return result.text;
  }

  private async handleMediaMessage(message: Message): Promise<string> {
    const media = await message.downloadMedia();
    if (!media) return "Could not download media";

    const tempPath = path.join(
      "./temp",
      `${Date.now()}.${media.mimetype.split("/")[1]}`,
    );
    fs.mkdirSync("./temp", { recursive: true });
    fs.writeFileSync(tempPath, media.data, "base64");

    try {
      const prompt = message.body || "What is in this media?";
      const result = await this.aiService.processMediaMessage(
        tempPath,
        media.mimetype,
        prompt,
      );
      return result.text;
    } finally {
      fs.unlinkSync(tempPath);
    }
  }

  private needsSearch(text: string): boolean {
    const searchKeywords = [
      "what is",
      "when is",
      "who is",
      "current",
      "today",
      "latest",
      "news",
      "weather",
    ];
    return searchKeywords.some((keyword) =>
      text.toLowerCase().includes(keyword),
    );
  }

  public async initialize() {
    await this.client.initialize();
  }

  public async destroy() {
    await this.client.destroy();
  }
}
