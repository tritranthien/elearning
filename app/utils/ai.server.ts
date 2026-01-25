import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * List of available Gemini models as of January 2026.
 */
const AVAILABLE_MODELS = [
  "gemini-2.5-flash",  // Try this first (usually has better quota)
  "gemini-2.0-flash",
  "gemini-2.5-pro",    // Last resort (lower rate limits)
];

/**
 * Helper to get a dedicated GoogleGenerativeAI instance for a specific task.
 * This allows using different API keys to bypass individual quota limits.
 */
function getGenAIForTask(task: 'LEARN' | 'DICTIONARY' | 'PRACTICE'): GoogleGenerativeAI {
  const taskKey = process.env[`GEMINI_API_KEY_${task}`];
  const defaultKey = process.env.GEMINI_API_KEY;
  const finalKey = taskKey || defaultKey || "";

  if (!finalKey) {
    console.warn(`[AI] No API key found for task ${task}. Please set GEMINI_API_KEY_${task} or GEMINI_API_KEY in .env`);
  }

  return new GoogleGenerativeAI(finalKey);
}

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
        const taskGenAI = getGenAIForTask('LEARN');
        const model = taskGenAI.getGenerativeModel({ model: modelName });

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
        const taskGenAI = getGenAIForTask('DICTIONARY');
        const model = taskGenAI.getGenerativeModel({ model: modelName });

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
 * Step 1: Fast translation from Vietnamese to English.
 * Uses a simpler prompt and lower token limit for speed.
 */
export async function fastTranslate(vietnameseText: string): Promise<string> {
  const prompt = `Translate the following Vietnamese text to natural English: "${vietnameseText}". 
Return ONLY the English translation, no other text or explanation.`;

  // Prefer faster flash models for this task
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];

  for (const modelName of models) {
    try {
      console.log(`[AI FastTranslate] Attempting with model: ${modelName}`);
      const taskGenAI = getGenAIForTask('PRACTICE');
      const model = taskGenAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        }
      });

      const text = result.response.text().trim();
      if (!text) throw new Error("Empty response");

      console.log(`[AI FastTranslate] Success! Translation: "${text}"`);
      return text;
    } catch (error: any) {
      console.warn(`[AI FastTranslate] Error with ${modelName}: ${error.message}`);
      continue;
    }
  }

  throw new Error("Không thể dịch nhanh. Vui lòng thử lại sau.");
}

/**
 * Step 2: Extract key phrases and analyze the translation.
 * This can take more time as it generates detailed content.
 */
export async function analyzeTranslation(englishText: string, vietnameseText: string) {
  const prompt = `Dựa trên câu tiếng Anh: "${englishText}" (dịch từ: "${vietnameseText}")
Hãy trích xuất 3-6 từ hoặc cụm từ quan trọng để người học ghi nhớ.

Trả về JSON array các object, mỗi object có:
{
  "english": "từ hoặc cụm từ tiếng Anh",
  "vietnamese": "nghĩa tiếng Việt",
  "phonetic": "/phiên âm IPA/",
  "partOfSpeech": "loại từ (noun/verb/adjective/phrase/idiom)",
  "example": "ví dụ câu sử dụng từ này",
  "viExample": "bản dịch tiếng Việt của ví dụ"
}

Trả về ONLY valid JSON array.`;

  for (const modelName of AVAILABLE_MODELS) {
    try {
      console.log(`[AI Analyze] Attempting with model: ${modelName}`);
      const taskGenAI = getGenAIForTask('PRACTICE');
      const model = taskGenAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 4096,
        }
      });

      const text = result.response.text();
      const cleaned = cleanJSON(text);
      const phrases = JSON.parse(cleaned);

      if (!Array.isArray(phrases)) throw new Error("Not an array");

      console.log(`[AI Analyze] Success! Extracted ${phrases.length} phrases.`);
      return phrases;
    } catch (error: any) {
      console.warn(`[AI Analyze] Error with ${modelName}: ${error.message}`);
      continue;
    }
  }

  throw new Error("Không thể phân tích từ vựng. Vui lòng thử lại sau.");
}

/**
 * Combined function (Legacy/Wrapper)
 */
export async function translateAndAnalyze(vietnameseText: string) {
  const englishText = await fastTranslate(vietnameseText);
  const phrases = await analyzeTranslation(englishText, vietnameseText);
  return { englishText, phrases };
}

/**
 * Generate a suggested next sentence for conversation practice.
 * @param conversationHistory - Array of previous conversation messages
 * @param nextSpeaker - "A" (continue) or "B" (response)
 * @param topicTitle - The topic/context of the conversation
 * @returns Object with Vietnamese and English suggestions
 */
export async function suggestNextSentence(
  conversationHistory: { speaker: string; vietnameseText: string; englishText: string }[],
  nextSpeaker: "A" | "B",
  topicTitle: string
): Promise<{ vietnameseText: string; englishText: string }> {
  // Build context from history - only Vietnamese to save tokens
  const historyContext = conversationHistory.length > 0
    ? conversationHistory.map((msg, idx) =>
      `${msg.speaker}: ${msg.vietnameseText}`
    ).join("\n")
    : "Chưa có cuộc hội thoại nào.";

  const prompt = `Bạn là trợ lý giúp tạo hội thoại thực tế cho người học tiếng Anh.

Chủ đề hội thoại: "${topicTitle}"
Lịch sử hội thoại:
${historyContext}

Nhiệm vụ: Tạo CÂU TIẾP THEO cho người nói ${nextSpeaker}.
${nextSpeaker === "A"
      ? "- Người A tiếp tục nói (có thể là bắt đầu chủ đề mới hoặc tiếp tục ý trước đó)"
      : "- Người B đáp lại câu cuối cùng của A một cách tự nhiên và phù hợp ngữ cảnh"}

Yêu cầu:
1. Câu phải TỰ NHIÊN, THỰC TẾ, phù hợp với tình huống hội thoại hàng ngày
2. Độ dài vừa phải (8-15 từ)
3. Sử dụng từ vựng phổ biến, dễ hiểu
4. Câu tiếng Việt và tiếng Anh phải tương ứng chính xác

QUAN TRỌNG: Trả về CHÍNH XÁC format JSON sau, KHÔNG thêm bất kỳ text nào khác:
{"vietnameseText": "câu tiếng Việt ở đây", "englishText": "English sentence here"}

CHỈ trả về 1 dòng JSON object duy nhất như trên.`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];
  let lastError: any = null;
  let quotaExceededCount = 0;

  for (const modelName of models) {
    // Try each model multiple times with exponential backoff
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI SuggestNext] Attempting with model: ${modelName} (attempt ${attempt})`);
        const taskGenAI = getGenAIForTask('PRACTICE');
        const model = taskGenAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8, // Higher temperature for more creative suggestions
            maxOutputTokens: 1024, // Increased from 512 to prevent truncation
          }
        });

        const text = result.response.text().trim();
        if (!text) throw new Error("Empty response");

        console.log(`[AI SuggestNext] Raw response (first 200 chars): ${text.substring(0, 200)}`);

        // Clean JSON - more aggressive cleaning
        let cleaned = text;
        if (cleaned.startsWith("```json")) {
          cleaned = cleaned.slice(7);
        } else if (cleaned.startsWith("```")) {
          cleaned = cleaned.slice(3);
        }
        if (cleaned.endsWith("```")) {
          cleaned = cleaned.slice(0, -3);
        }
        cleaned = cleaned.trim();

        // Try to find JSON object in the response
        const startIdx = cleaned.indexOf('{');
        const endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          cleaned = cleaned.slice(startIdx, endIdx + 1);
        }

        let suggestion;
        try {
          suggestion = JSON.parse(cleaned);
        } catch (parseError: any) {
          console.error(`[AI SuggestNext] JSON parse error: ${parseError.message}`);
          console.error(`[AI SuggestNext] Cleaned text: ${cleaned}`);
          throw new Error(`Lỗi phân tích phản hồi từ AI (${modelName}): ${parseError.message}`);
        }

        if (!suggestion.vietnameseText || !suggestion.englishText) {
          throw new Error("Missing required fields");
        }

        console.log(`[AI SuggestNext] Success! Suggested: "${suggestion.vietnameseText}"`);
        return suggestion;
      } catch (error: any) {
        lastError = error;
        const statusCode = error?.status || error?.response?.status;
        const errorMessage = error?.message || String(error);

        // Check for quota errors
        if (statusCode === 429 || errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
          quotaExceededCount++;
          console.warn(`[AI SuggestNext] ⚠️ Quota exceeded for ${modelName}. Moving to next model...`);
          await delay(2000); // Wait 2s before trying next model
          break; // Skip to next model
        }

        console.warn(`[AI SuggestNext] Error with ${modelName} (attempt ${attempt}): ${errorMessage}`);

        // If it's a parsing error and we have another attempt, wait a bit
        if (attempt < 2 && errorMessage.includes("JSON")) {
          await delay(1000);
        } else {
          break; // Move to next model
        }
      }
    }
  }

  // If all models failed due to quota, provide helpful error
  if (quotaExceededCount >= models.length) {
    throw new Error("⚠️ Đã vượt giới hạn API Gemini. Vui lòng đợi vài phút và thử lại hoặc kiểm tra quota tại https://ai.google.dev/gemini-api/docs/rate-limits");
  }

  throw new Error(`Không thể tạo gợi ý. ${lastError?.message || 'Vui lòng thử lại sau.'}`);
}

/**
 * Generate multiple conversation suggestions at once (2-3 options)
 * This is more efficient than calling suggestNextSentence multiple times
 */
export async function generateMultipleSuggestions(
  conversationHistory: { speaker: string; vietnameseText: string; englishText: string }[],
  topicTitle: string
): Promise<Array<{ vietnameseText: string; englishText: string; speaker: string }>> {
  // Build context from history - only Vietnamese to save tokens
  const historyContext = conversationHistory.length > 0
    ? conversationHistory.map((msg) =>
      `${msg.speaker}: ${msg.vietnameseText}`
    ).join("\n")
    : "Chưa có cuộc hội thoại nào.";

  // Determine next speaker based on last message
  const lastSpeaker = conversationHistory.length > 0
    ? conversationHistory[0].speaker // conversations are ordered DESC, so [0] is latest
    : "B"; // If no history, default lastSpeaker to "B" so nextSpeakerForResponse becomes "A"

  const nextSpeakerForResponse = lastSpeaker === "A" ? "B" : "A";

  // Adjust prompt based on whether there's conversation history
  const suggestionInstructions = conversationHistory.length > 0
    ? `Nhiệm vụ: Tạo 3 GỢI Ý cho câu tiếp theo. Bao gồm:
1. Một câu cho ${nextSpeakerForResponse} ĐÁP LẠI câu cuối (casual/friendly)
2. Một câu cho ${nextSpeakerForResponse} ĐÁP LẠI câu cuối (formal/polite) 
3. Một câu cho ${lastSpeaker} TIẾP TỤC NÓI (chủ đề liên quan)`
    : `Nhiệm vụ: Tạo 3 GỢI Ý để BẮT ĐẦU hội thoại. Tất cả đều là câu cho ${nextSpeakerForResponse} (người A) mở đầu:
1. Một câu chào hỏi thân mật
2. Một câu giới thiệu bản thân hoặc hỏi han lịch sự
3. Một câu bắt đầu chủ đề chính`;

  const prompt = `Bạn là trợ lý giúp tạo hội thoại thực tế cho người học tiếng Anh.

Chủ đề hội thoại: "${topicTitle}"
Lịch sử hội thoại (mới nhất trước):
${historyContext}

${suggestionInstructions}

Yêu cầu:
- Mỗi câu phải TỰ NHIÊN, THỰC TẾ, PHÙ HỢP ngữ cảnh hội thoại hàng ngày
- Độ dài vừa phải (8-15 từ tiếng Việt)
- Đa dạng về phong cách (thân mật, lịch sự, v.v.)

Trả về JSON array với 3 objects, mỗi object có format:
{
  "vietnameseText": "câu tiếng Việt",
  "englishText": "câu tiếng Anh tương ứng",
  "speaker": "A" hoặc "B"
}

Trả về ONLY valid JSON array, không có text khác.`;

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"];
  let lastError: any = null;
  let quotaExceededCount = 0;

  for (const modelName of models) {
    // Try each model multiple times with exponential backoff
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI MultiSuggest] Attempting with model: ${modelName} (attempt ${attempt})`);
        const taskGenAI = getGenAIForTask('PRACTICE');
        const model = taskGenAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
          }
        });

        const text = result.response.text().trim();
        if (!text) throw new Error("Empty response");

        console.log(`[AI MultiSuggest] Raw response (first 200 chars): ${text.substring(0, 200)}`);

        // Clean JSON - more aggressive
        const cleaned = cleanJSON(text);

        let suggestions;
        try {
          suggestions = JSON.parse(cleaned);
        } catch (parseError: any) {
          console.error(`[AI MultiSuggest] JSON parse error: ${parseError.message}`);
          console.error(`[AI MultiSuggest] Cleaned text: ${cleaned}`);
          throw new Error(`Lỗi phân tích phản hồi từ AI (${modelName}): ${parseError.message}`);
        }

        if (!Array.isArray(suggestions)) {
          throw new Error("Response is not an array");
        }

        // Validate all suggestions
        for (const sug of suggestions) {
          if (!sug.vietnameseText || !sug.englishText || !sug.speaker) {
            throw new Error("Missing required fields in suggestion");
          }
        }

        console.log(`[AI MultiSuggest] Success! Generated ${suggestions.length} suggestions.`);
        return suggestions;
      } catch (error: any) {
        lastError = error;
        const statusCode = error?.status || error?.response?.status;
        const errorMessage = error?.message || String(error);

        // Check for quota errors
        if (statusCode === 429 || errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
          quotaExceededCount++;
          console.warn(`[AI MultiSuggest] ⚠️ Quota exceeded for ${modelName}. Moving to next model...`);
          await delay(2000); // Wait 2s before trying next model
          break; // Skip to next model
        }

        console.warn(`[AI MultiSuggest] Error with ${modelName} (attempt ${attempt}): ${errorMessage}`);

        // If it's a parsing error and we have another attempt, wait a bit
        if (attempt < 2 && errorMessage.includes("JSON")) {
          await delay(1000);
        } else {
          break; // Move to next model
        }
      }
    }
  }

  // If all models failed due to quota, provide helpful error
  if (quotaExceededCount >= models.length) {
    throw new Error("⚠️ Đã vượt giới hạn API Gemini. Vui lòng đợi vài phút và thử lại hoặc kiểm tra quota tại https://ai.google.dev/gemini-api/docs/rate-limits");
  }

  throw new Error(`Không thể tạo gợi ý. ${lastError?.message || 'Vui lòng thử lại sau.'}`);
}


