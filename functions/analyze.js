const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { image, mimeType } = JSON.parse(event.body);
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'サーバーにAPIキーが設定されていません。' }) };
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
  const schema = {type: "OBJECT", properties: { date: { "type": "STRING"}, payee: { "type": "STRING"}, description: { "type": "STRING"}, amount: { "type": "NUMBER"}, remarks: { "type": "STRING"}, category: { "type": "STRING", "enum": ["旅費交通費", "会議費", "消耗品費", "通信費", "接待交際費", "雑費", "その他"]}}, required: ["date", "payee", "description", "amount", "category"]};
  const prompt = "これは領収書の画像です。会計処理のため、以下の情報をJSON形式で抽出してください: 日付(YYYY-MM-DD)、支払先(店名)、勘定科目、内容・目的、合計金額(数値)、備考(もしあれば)。重要: 支払先の項目には「株式会社MDエンタテイメント」という会社名は絶対に含めないでください。";

  const payload = {
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: image } }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25秒でタイムアウト

    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error('API Error Body:', errorBody);
      return { statusCode: apiResponse.status, body: JSON.stringify({ error: `AIサーバーとの通信に失敗しました: ${errorBody}` }) };
    }

    const data = await apiResponse.json();
    return { statusCode: 200, body: JSON.stringify(data) };

  } catch (error) {
    console.error("Error in Netlify Function:", error);
    if (error.name === 'AbortError') {
         return { statusCode: 504, body: JSON.stringify({ error: 'AIサーバーへのリクエストがタイムアウトしました。' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};