import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequestHandler } from "@react-router/node";

// Import the built server
const build = require("../build/server/index.js");

const handler = createRequestHandler({ build });

export default async function (req: VercelRequest, res: VercelResponse) {
    // Convert Vercel request to Web Request
    const url = new URL(req.url || "/", `https://${req.headers.host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        if (value) {
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
    }

    const webRequest = new Request(url.toString(), {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    try {
        const response = await handler(webRequest);

        // Set status and headers
        res.status(response.status);
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Send body
        const body = await response.text();
        res.send(body);
    } catch (error) {
        console.error("Error handling request:", error);
        res.status(500).send("Internal Server Error");
    }
}
