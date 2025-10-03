// functions/analyze.js
const fetch = require('node-fetch');
exports.handler = async function(event) {
    // POST以外のリクエストは許可しない
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { image, mimeType } = JSON.parse(event.body);

        if (!image || !mimeType) {
            return { statusCode: 400, body: "Missing image data or mimeType" };
        }
        
        // Netlifyの環境変数からAPIキーを取得
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
             console.error("API key is not configured.");
             return { statusCode: 500, body: "API key is not configured on the server." };
        }
        
        // 最新のモデルを指定
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const prompt = "これは領収書の画像です。会計処理のため、以下の情報をJSON形式で抽出してください: 日付(YYYY-MM-DD)、支払先(店名)、勘定科目、内容・目的、合計金額(数値)、備考(もしあれば)。重要: 支払先の項目には「株式会社MDエンタテイメント」という会社名は絶対に含めないでください。";
        const schema = {type: "OBJECT", properties: { date: { "type": "STRING"}, payee: { "type": "STRING"}, description: { "type": "STRING"}, amount: { "type": "NUMBER"}, remarks: { "type": "STRING"}, category: { "type": "STRING", "enum": ["旅費交通費", "会議費", "消耗品費", "通信費", "接待交際費", "雑費", "その他"]}}, required: ["date", "payee", "description", "amount", "category"]};
        
        const payload = {
            contents: [{ 
                parts: [
                    { text: prompt }, 
                    { inlineData: { mimeType: mimeType, data: image } }
                ] 
            }], 
            generationConfig: { 
                responseMimeType: "application/json", 
                responseSchema: schema 
            }
        };

        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("API Error Response:", errorBody);
            return { statusCode: response.status, body: `API error: ${response.statusText}` };
        }

        const result = await response.json();
        
        // AIからの応答データ（JSONテキスト）を取得
        const dataText = result.candidates[0].content.parts[0].text;
        const data = JSON.parse(dataText);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data), // フロントエンドにJSONデータを返す
        };

    } catch (error) {
        console.error("Error in Netlify function:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An internal server error occurred." }),
        };
    }
};
