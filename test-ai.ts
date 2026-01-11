import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function listModels() {
    try {
        // Note: The JS SDK doesn't have a direct listModels yet in the same way, 
        // but we can try to fetch them via the REST API or just try gemini-1.5-flash again with explicit v1 if possible.
        // Actually, let's just try gemini-1.5-flash.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash:", result.response.text());
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
