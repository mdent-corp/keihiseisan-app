const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Check for POST request
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("APIキーが設定されていません。");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API key is missing.' }),
        };
    }

    try {
        const { image, mimeType } = JSON.parse(event.body);

        if (!image || !mimeType) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Image data or mimeType is missing.' }),
            };
        }

        const model = 'gemini-pro-vision'; // 安定しているVisionモデルに変更
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: `
この画像は経費精算のための領収書です。以下の情報をJSON形式で抽出してください。
- date: 支払日 (YYYY-MM-DD形式)
- payee: 支払先 (店名や会社名)
- amount: 金額 (数値のみ)
- category: 勘定科目として最も適切と思われるものを "旅費交通費", "会議費", "消耗品費", "通信費", "接待交際費", "雑費", "その他" から選択
- description: 内容・目的 (具体的な品目や用途)

もし情報が読み取れない項目があれば、そのキーの値は空欄にしてください。
`
                        },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: image,
                            },
                        },
                    ],
                },
            ],
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google API Error:', errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: 'Google API Error', details: errorText }),
            };
        }

        const responseData = await response.json();
        
        // Extract and parse the JSON string from the model's response
        const jsonString = responseData.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const extractedData = JSON.parse(jsonString);

        return {
            statusCode: 200,
            body: JSON.stringify(extractedData),
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.', details: error.message }),
        };
    }
};

