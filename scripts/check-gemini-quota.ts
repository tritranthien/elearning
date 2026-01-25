/**
 * Script to check Gemini API quota status
 * Run: npx tsx scripts/check-gemini-quota.ts
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const API_KEYS = {
    MAIN: process.env.GEMINI_API_KEY,
    LEARN: process.env.GEMINI_API_KEY_LEARN,
    DICTIONARY: process.env.GEMINI_API_KEY_DICTIONARY,
    PRACTICE: process.env.GEMINI_API_KEY_PRACTICE,
};

const MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

async function checkApiKey(keyName: string, apiKey: string | undefined) {
    if (!apiKey) {
        console.log(`❌ ${keyName}: No API key found\n`);
        return;
    }

    console.log(`\n🔑 Checking ${keyName}...`);
    console.log(`Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);

    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of MODELS) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });

            // Try a very small request
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: "Hi" }] }],
                generationConfig: {
                    maxOutputTokens: 10,
                }
            });

            const text = result.response.text();
            console.log(`  ✅ ${modelName}: OK (response: ${text.substring(0, 20)}...)`);
        } catch (error: any) {
            const statusCode = error?.status;
            const message = error?.message || String(error);

            if (statusCode === 429 || message.includes("quota") || message.includes("rate limit")) {
                console.log(`  ⚠️  ${modelName}: QUOTA EXCEEDED`);

                // Try to extract retry time
                const match = message.match(/retry in (\d+\.?\d*)(s|ms)/);
                if (match) {
                    const time = parseFloat(match[1]);
                    const unit = match[2];
                    const seconds = unit === 's' ? time : time / 1000;
                    console.log(`     → Retry in: ${Math.ceil(seconds)}s`);
                }
            } else if (statusCode === 404) {
                console.log(`  ❌ ${modelName}: Model not found`);
            } else {
                console.log(`  ❌ ${modelName}: Error - ${message.substring(0, 100)}`);
            }
        }

        // Small delay between model checks
        await delay(500);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log("🔍 Gemini API Quota Checker");
    console.log("=".repeat(50));
    console.log("This will test each API key with all available models.\n");

    for (const [keyName, apiKey] of Object.entries(API_KEYS)) {
        await checkApiKey(keyName, apiKey);
        console.log();
        await delay(1000); // Delay between key checks
    }

    console.log("=".repeat(50));
    console.log("\n💡 Tips:");
    console.log("  - If quota exceeded, wait a few minutes and try again");
    console.log("  - Free tier limits: 15 requests/minute, 1500 requests/day per model");
    console.log("  - Check quota at: https://ai.google.dev/gemini-api/docs/rate-limits");
    console.log("  - Get new API keys at: https://aistudio.google.com/app/apikey\n");
}

main().catch(console.error);
