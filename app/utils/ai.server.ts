import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * List of available Gemini models as of early 2026.
 * Priority: 1.5 Flash (stable JSON), 2.0 Flash (speed), 2.5 Flash (latest)
 */
const AVAILABLE_MODELS = [
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-pro"
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateWordsForTopic(topicTitle: string, existingWords: string[], count: number = 5) {
  const prompt = `Generate ${count} new English vocabulary words for the topic: "${topicTitle}".
    Exclude these existing words: [${existingWords.join(", ")}].
    
    Return a JSON array of objects with exactly these keys:
    term, phonetic, type, definition, translation, viDefinition, example, viExample. 
    Ensure Vietnamese translations are accurate and natural.`;

  let lastError: any = null;

  for (const modelName of AVAILABLE_MODELS) {
    try {
      console.log(`[AI] Attempting with model: ${modelName}`);

      // Use v1beta for reliable JSON Mode support
      const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const text = result.response.text();
      if (!text) throw new Error("AI returned empty response");

      const parsedData = JSON.parse(text);
      console.log(`[AI] Success with ${modelName}`);
      return parsedData;
    } catch (error: any) {
      lastError = error;
      const statusCode = error?.status || error?.response?.status;

      if (statusCode === 429) {
        console.warn(`[AI] Rate limit hit for ${modelName}.`);
      } else if (statusCode === 404) {
        console.warn(`[AI] Model ${modelName} not found.`);
      } else {
        console.warn(`[AI] Error with ${modelName}: ${error.message}`);
      }
      continue;
    }
  }

  console.error("[AI] All models failed.");
  throw new Error("Không thể kết nối với AI. Bạn hãy kiểm tra lại API Key trong file .env (phải đủ ~39-40 ký tự) và đảm bảo có quyền truy cập vào các model Gemini.");
}
