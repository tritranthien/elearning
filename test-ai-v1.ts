import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

async function testV1() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' });
        const result = await model.generateContent("Hello");
        console.log("Success with v1:", result.response.text());
    } catch (error) {
        console.error("V1 Error:", error);
    }
}

testV1();
