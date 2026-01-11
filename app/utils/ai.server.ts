import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * List of available Gemini models as of January 2026.
 */
const AVAILABLE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Cleans the AI response text to extract a valid JSON array.
 */
function cleanJSON(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code blocks
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  // Find the first '[' and last ']' to extract just the array
  const startIdx = cleaned.indexOf('[');
  const endIdx = cleaned.lastIndexOf(']');

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  return cleaned.trim();
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateWordsForTopic(topicTitle: string, existingWords: string[], count: number = 5) {
  // Limit count to reduce response size and avoid truncation
  const safeCount = Math.min(count, 15);

  const prompt = `Generate ${safeCount} English vocabulary words for topic: "${topicTitle}".
Exclude: [${existingWords.slice(0, 10).join(", ")}].

Return JSON array only. Each object needs:
term, phonetic, type, definition, translation (Vietnamese), viDefinition, example, viExample

Example format:
[{"term":"hello","phonetic":"/həˈloʊ/","type":"noun","definition":"a greeting","translation":"xin chào","viDefinition":"lời chào","example":"Hello, how are you?","viExample":"Xin chào, bạn khỏe không?"}]

Return ONLY valid JSON array, nothing else.`;

  let lastError: any = null;

  for (const modelName of AVAILABLE_MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[AI] Attempting with model: ${modelName} (attempt ${attempt})`);

        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8192, // Increased significantly
          }
        });

        const text = result.response.text();
        if (!text) throw new Error("AI returned empty response");

        console.log(`[AI] Response from ${modelName}: ${text.length} chars`);

        const cleaned = cleanJSON(text);
        console.log(`[AI] Cleaned (first 200 chars): ${cleaned.substring(0, 200)}...`);

        const parsedData = JSON.parse(cleaned);

        if (!Array.isArray(parsedData)) {
          throw new Error("Response is not an array");
        }

        console.log(`[AI] Success with ${modelName}! Generated ${parsedData.length} words.`);
        return parsedData;
      } catch (error: any) {
        lastError = error;
        const statusCode = error?.status || error?.response?.status;

        if (statusCode === 429) {
          console.warn(`[AI] Rate limit hit for ${modelName}. Waiting 5s...`);
          await delay(5000);
          break; // Move to next model
        } else if (statusCode === 404) {
          console.warn(`[AI] Model ${modelName} not found.`);
          break;
        } else if (error instanceof SyntaxError) {
          console.warn(`[AI] JSON Error with ${modelName} (attempt ${attempt}): ${error.message}`);
          // Wait a bit before retrying
          await delay(1000);
          if (attempt === 3) break;
        } else {
          console.warn(`[AI] Error with ${modelName}: ${error.message}`);
          break;
        }
      }
    }
  }

  console.error("[AI] All models failed. Last error:", lastError?.message);
  throw new Error("Đã vượt quá giới hạn API (rate limit). Vui lòng đợi khoảng 30 giây và thử lại.");
}

/**
 * Lookup English vocabulary words from Vietnamese input
 */
export async function lookupEnglishWords(vietnameseWord: string, count: number = 8) {
  const safeCount = Math.min(count, 10);

  const prompt = `Given the Vietnamese word/phrase: "${vietnameseWord}"

Find ${safeCount} English vocabulary words that have similar or related meanings.

Return JSON array only. Each object needs:
- term: the English word
- phonetic: IPA pronunciation
- type: part of speech (noun, verb, adj, etc.)
- definition: short English definition
- translation: Vietnamese meaning (should relate to "${vietnameseWord}")
- viDefinition: Vietnamese explanation
- example: an English example sentence
- viExample: Vietnamese translation of the example

Include various related words: synonyms, related concepts, different forms (noun/verb/adj).

Return ONLY valid JSON array, nothing else.`;

  let lastError: any = null;

  for (const modelName of AVAILABLE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI Lookup] Attempting with model: ${modelName} (attempt ${attempt})`);

        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 8192,
          }
        });

        const text = result.response.text();
        if (!text) throw new Error("AI returned empty response");

        console.log(`[AI Lookup] Response from ${modelName}: ${text.length} chars`);

        const cleaned = cleanJSON(text);
        const parsedData = JSON.parse(cleaned);

        if (!Array.isArray(parsedData)) {
          throw new Error("Response is not an array");
        }

        console.log(`[AI Lookup] Success! Found ${parsedData.length} words for "${vietnameseWord}".`);
        return parsedData;
      } catch (error: any) {
        lastError = error;
        const statusCode = error?.status || error?.response?.status;

        if (statusCode === 429) {
          console.warn(`[AI Lookup] Rate limit hit for ${modelName}.`);
          await delay(3000);
          break;
        } else if (statusCode === 404) {
          console.warn(`[AI Lookup] Model ${modelName} not found.`);
          break;
        } else if (error instanceof SyntaxError) {
          console.warn(`[AI Lookup] JSON Error (attempt ${attempt}): ${error.message}`);
          await delay(1000);
          if (attempt === 2) break;
        } else {
          console.warn(`[AI Lookup] Error: ${error.message}`);
          break;
        }
      }
    }
  }

  console.error("[AI Lookup] All models failed.");
  throw new Error("Không thể tra cứu từ vựng. Vui lòng thử lại sau.");
}

/**
 * Translates Vietnamese text to English and extracts key phrases for learning.
 * Returns the English translation and an array of extracted phrases with explanations.
 */
export async function translateAndAnalyze(vietnameseText: string) {
  const prompt = `Bạn là một trợ lý dạy tiếng Anh. Người dùng nói tiếng Việt và bạn cần:

1. Dịch câu tiếng Việt sau sang tiếng Anh tự nhiên (như người bản xứ nói)
2. Trích xuất 3-6 từ hoặc cụm từ quan trọng từ câu tiếng Anh để người học ghi nhớ

Câu tiếng Việt: "${vietnameseText}"

Trả về JSON với format CHÍNH XÁC như sau (không thêm text nào khác):
{
  "englishText": "câu tiếng Anh đã dịch",
  "phrases": [
    {
      "english": "từ hoặc cụm từ tiếng Anh",
      "vietnamese": "nghĩa tiếng Việt",
      "phonetic": "/phiên âm IPA/",
      "partOfSpeech": "loại từ (noun/verb/adjective/phrase/idiom)",
      "example": "ví dụ câu sử dụng từ này",
      "viExample": "bản dịch tiếng Việt của ví dụ"
    }
  ]
}

Lưu ý:
- Ưu tiên trích từ/cụm thông dụng, hữu ích cho giao tiếp hàng ngày
- Mỗi phrase phải có đầy đủ các trường
- Phiên âm theo chuẩn IPA
- Ví dụ phải khác với câu gốc nhưng liên quan`;

  for (const modelName of AVAILABLE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI Translate] Attempting with model: ${modelName} (attempt ${attempt})`);

        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4096,
          }
        });

        const text = result.response.text();
        console.log(`[AI Translate] Response from ${modelName}: ${text.length} chars`);

        // Parse JSON
        let cleaned = text.trim();
        if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
        else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
        if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();

        // Find JSON object
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleaned = cleaned.slice(startIdx, endIdx + 1);
        }

        const parsedData = JSON.parse(cleaned);

        if (!parsedData.englishText || !Array.isArray(parsedData.phrases)) {
          throw new Error("Invalid response format");
        }

        console.log(`[AI Translate] Success! Translated to: "${parsedData.englishText}" with ${parsedData.phrases.length} phrases`);
        return parsedData;

      } catch (error: any) {
        const statusCode = error?.status || error?.response?.status;

        if (statusCode === 429) {
          console.warn(`[AI Translate] Rate limit hit for ${modelName}.`);
          await delay(3000);
          break;
        } else if (statusCode === 404) {
          console.warn(`[AI Translate] Model ${modelName} not found.`);
          break;
        } else if (error instanceof SyntaxError) {
          console.warn(`[AI Translate] JSON Error (attempt ${attempt}): ${error.message}`);
          await delay(1000);
          if (attempt === 2) break;
        } else {
          console.warn(`[AI Translate] Error: ${error.message}`);
          break;
        }
      }
    }
  }

  console.error("[AI Translate] All models failed.");
  throw new Error("Không thể dịch. Vui lòng thử lại sau.");
}
