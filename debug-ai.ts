import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
// We use a lower level fetch/request if possible, or just listModels via the SDK if supported
// Actually, the newest SDKs support listModels via the generativeAI instance or a separate client.
// However, to keep it simple, let's just try to call a standard one and check if the key is actually valid first.

async function checkApiKeyAndModels() {
    console.log("Checking API Key: ", process.env.GEMINI_API_KEY?.substring(0, 10) + "...");
    try {
        // There isn't a direct listModels in the browser/node SDK easily without discovery.
        // Let's try the most basic stable model.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("Gemini 1.5 Flash Test Success!");
    } catch (e: any) {
        console.log("Gemini 1.5 Flash Test Failed: ", e.message);
        if (e.status === 404) {
            console.log("Status 404: Likely model name wrong or API key doesn't have access to this region/model.");
        }
    }
}

checkApiKeyAndModels();
