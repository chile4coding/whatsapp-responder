import {
  AIService,
} from "../services/aiService";
import { Message } from "whatsapp-web.js";
import { ThinkingLevel } from "@google/genai";

export class MessageHandler {
  constructor(private aiService: AIService) {}

  async handleText(
    message: Message,
    activeSubject: string | undefined,
    onForceSearch: (text: string) => boolean,
  ): Promise<string> {
    const prefix = activeSubject
      ? `[Active subject mode: ${activeSubject}]\n\n`
      : "";

    const prompt = prefix + message.body;
    const shouldUseSearch = onForceSearch(message.body);

    const result = await this.aiService.generateTextResponse(
      prompt,
      [],
      shouldUseSearch,
      ThinkingLevel.HIGH,
    );

    return result.text;
  }
}
