import { GoogleGenAI, ThinkingLevel, createUserContent, createPartFromUri, FunctionDeclaration } from '@google/genai';
import { AIResponse } from '../types/index';
import { personality } from '../personality';

export class AIService {
  private ai: GoogleGenAI;
  private model: string = 'gemma-4-26b-a4b-it';
  constructor() {
    this.ai = new GoogleGenAI(
      {
        apiKey:process.env.API_KEY,
        httpOptions:{
          timeout:80000
        }
      }
    );
  }

  async generateTextResponse(
    message: string,
    context: string[] = [],
    useSearch: boolean = false,
    thinkingLevel: ThinkingLevel = ThinkingLevel.HIGH
  ): Promise<AIResponse> {
    const contents = [...context, message].join('\n');
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: personality.systemInstruction,
        thinkingConfig: {
          thinkingLevel
        },
        tools: useSearch ? [{ googleSearch: {} }] : undefined
      }
    });

return {
      text: response.text || '',
      functionCalls: response.functionCalls?.filter(fc => fc.name !== undefined).map(fc => ({
        name: fc.name!,
        args: fc.args ?? {}
      })),
      groundingMetadata: response.candidates?.[0]?.groundingMetadata as any
    };
  }

  async processMediaMessage(
    mediaPath: string,
    mimeType: string,
    prompt: string,
    context: string[] = []
  ): Promise<AIResponse> {
    const uploadedFile = await this.ai.files.upload({
      file: mediaPath,
      config: { mimeType }
    });

    const contents = createUserContent([
      createPartFromUri(uploadedFile.uri!, uploadedFile.mimeType!),
      prompt || "What is in this media?"
    ]);

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: personality.systemInstruction
      }
    });

    return {
      text: response.text || ''
    };
  }

  async createChatSession(): Promise<{
    sendMessage: (message: string) => Promise<AIResponse>;
  }> {
    const chat = this.ai.chats.create({
      model: this.model,
      config: {
        systemInstruction: personality.systemInstruction
      }
    });

    return {
      sendMessage: async (message: string) => {
        const response = await chat.sendMessage({ message });
        return {
          text: response.text || ''
        };
      }
    };
  }

  async functionCalling(
    message: string,
    functions: FunctionDeclaration[]
  ): Promise<AIResponse> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: message,
      config: {
        tools: [{ functionDeclarations: functions }]
      }
    });

    return {
      text: response.text || '',
      functionCalls: response.functionCalls?.filter(fc => fc.name !== undefined).map(fc => ({
        name: fc.name!,
        args: fc.args ?? {}
      }))
    };
  }
}