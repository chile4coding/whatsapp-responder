import { Message } from "whatsapp-web.js";
import * as fs from "fs";
import * as path from "path";
import { AIService } from "../services/aiService";

export class MediaHandler {
  constructor(private aiService: AIService) {}

  private subjectPrompt(mimeType: string, caption: string): string {
    const isImage = mimeType.startsWith("image/");
    const base = caption || "What is in this media?";

    if (isImage) {
      return `
A Nigerian student has sent a photo of a question from their textbook or exam paper.
1. Identify the subject and topic
2. Solve step by step as a patient tutor
3. Explain the concept so they understand
4. End with: "Do you want me to quiz you on this topic? 📝"

Student caption: ${base}
`.trim();
    }

    return base;
  }

  async handleMedia(message: Message): Promise<string> {
    const media = await message.downloadMedia();
    if (!media) return "I couldn't download that media. Please try again.";

    const ext = media.mimetype.split("/")[1]?.split("+")[0] || "bin";
    const tempPath = path.join(__dirname, `../temp/tmp_${Date.now()}.${ext}`);

    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    fs.writeFileSync(tempPath, media.data, "base64");

    try {
      const prompt = this.subjectPrompt(media.mimetype, message.body || "");
      const result = await this.aiService.processMediaMessage(
        tempPath,
        media.mimetype,
        prompt,
      );
      return result.text;
    } finally {
      fs.rmSync(tempPath, { force: true, recursive: true });
    }
  }
}
