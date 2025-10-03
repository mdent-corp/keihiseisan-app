// functions/analyze.js
const fetch = require('node-fetch');

exports.handler = async function(event) {
    // POST以外のリクエストは許可しない
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        console.log("Function execution started."); // 実行開始のログ

        const { image, mimeType } = JSON.parse(event.body);
        if (!image || !mimeType) {
            console.error("ERROR: Missing 'image' or 'mimeType' in the request body.");
            return { statusCode: 400, body: JSON.stringify({ error: "Request body must contain 'image' and 'mimeType'." }) };
        }
        console.log("Successfully parsed request body.");

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
             console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set in Netlify.");
             return { statusCode: 500, body: JSON.stringify({ error: "Server configuration error: API key is missing." }) };
        }
        console.log("API key found.");

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const prompt = "これは領収書の画像です。会計処理のため、以下の情報をJSON形式で抽出してください: 日付(YYYY-MM-DD)、支払先(店名)、勘定科目、内容・目的、合計金額(数値)、備考(もしあれば)。重要: 支払先の項目には「株式会社MDエンタテイメント」という会社名は絶対に含めないでください。";
        const schema = {type: "OBJECT", properties: { date: { "type": "STRING"}, payee: { "type": "STRING"}, description: { "type": "STRING"}, amount: { "type": "NUMBER"}, remarks: { "type": "STRING"}, category: { "type": "STRING", "enum": ["旅費交通費", "会議費", "消耗品費", "通信費", "接待交際費", "雑費", "その他"]}}, required: ["date", "payee", "description", "amount", "category"]};
        
        const payload = {
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType, data: image } }] }], 
            generationConfig: { responseMimeType: "application/json", responseSchema: schema }
        };

        console.log("Sending request to Google Gemini API...");
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Google API Error (${response.status}):`, errorBody);
            return { statusCode: response.status, body: JSON.stringify({ error: `Google API Error: ${response.statusText}`, details: errorBody }) };
        }

        const result = await response.json();
        console.log("Successfully received a valid response from Google Gemini API.");
        
        if (!result.candidates || result.candidates.length === 0 || !result.candidates[0].content) {
            console.error("Google API Response Error: The response format is invalid or empty.", JSON.stringify(result));
            return { statusCode: 500, body: JSON.stringify({ error: "Failed to parse response from AI service." }) };
        }
        
        const dataText = result.candidates[0].content.parts[0].text;
        const data = JSON.parse(dataText);

        console.log("Function execution finished successfully.");
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error("FATAL CATCH BLOCK ERROR:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An unexpected internal server error occurred.", details: error.message }),
        };
    }
};

