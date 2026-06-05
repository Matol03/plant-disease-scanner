// api/analyse.js — Vercel serverless function
// Uses Google Gemini 2.0 Flash (FREE tier: 15 req/min, 1500 req/day, no credit card)
// Get a free key at: https://aistudio.google.com/apikey

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are an expert plant pathologist AI. Analyse the leaf image and diagnose plant diseases.

You must respond with ONLY a valid JSON object — no markdown, no prose, no code fences.

Required schema:
{
  "predictions": [
    { "diseaseLabel": "string", "confidence": number, "cropName": "string" }
  ],
  "reasoning": "string — 1-2 sentences describing key visual symptoms you observed",
  "severity": "none" | "mild" | "moderate" | "severe",
  "urgency": "monitor" | "treat_soon" | "treat_immediately",
  "additionalAdvice": "string — one practical field tip"
}

Rules:
- predictions must have exactly 3 entries, confidence values sum to 1.0
- diseaseLabel must be one of these exact strings:
  Apple___Apple_scab, Apple___Black_rot, Apple___Cedar_apple_rust, Apple___healthy,
  Blueberry___healthy, Cherry_(including_sour)___Powdery_mildew, Cherry_(including_sour)___healthy,
  Corn_(maize)___Cercospora_leaf_spot, Corn_(maize)___Common_rust_, Corn_(maize)___Northern_Leaf_Blight, Corn_(maize)___healthy,
  Grape___Black_rot, Grape___Esca_(Black_Measles), Grape___Leaf_blight_(Isariopsis_Leaf_Spot), Grape___healthy,
  Orange___Haunglongbing_(Citrus_greening), Peach___Bacterial_spot, Peach___healthy,
  Pepper,_bell___Bacterial_spot, Pepper,_bell___healthy,
  Potato___Early_blight, Potato___Late_blight, Potato___healthy,
  Raspberry___healthy, Soybean___healthy, Squash___Powdery_mildew,
  Strawberry___Leaf_scorch, Strawberry___healthy,
  Tomato___Bacterial_spot, Tomato___Early_blight, Tomato___Late_blight, Tomato___Leaf_Mold,
  Tomato___Septoria_leaf_spot, Tomato___Spider_mites, Tomato___Target_Spot,
  Tomato___Tomato_Yellow_Leaf_Curl_Virus, Tomato___Tomato_mosaic_virus, Tomato___healthy
- If image is unclear or not a leaf, use Tomato___healthy with low confidence and explain in reasoning
- Lean toward disease over healthy when uncertain (false negatives are costly for farmers)`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not set. Add it in Vercel → Settings → Environment Variables. Get a free key at aistudio.google.com/apikey'
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = body;
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

  try {
    // Gemini 2.0 Flash — free, fast, excellent vision capabilities
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT + '\n\nAnalyse this leaf image now:' },
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,      // low temp = consistent, accurate diagnoses
          maxOutputTokens: 1024,
          responseMimeType: 'application/json', // force JSON output
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      const msg = err?.error?.message ?? `Gemini API error ${geminiRes.status}`;

      // Helpful messages for common errors
      if (geminiRes.status === 400 && msg.includes('API_KEY')) {
        return res.status(401).json({ error: 'Invalid Gemini API key. Get a free one at aistudio.google.com/apikey' });
      }
      if (geminiRes.status === 429) {
        return res.status(429).json({ error: 'Rate limit hit (15 req/min free tier). Wait 10 seconds and try again.' });
      }
      return res.status(geminiRes.status).json({ error: msg });
    }

    const data = await geminiRes.json();

    // Extract text from Gemini response structure
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) {
      return res.status(502).json({ error: 'Empty response from Gemini. Try again.' });
    }

    // Validate it's parseable JSON before sending back
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: 'Gemini returned non-JSON response. Try again.' });
      parsed = JSON.parse(match[0]);
    }

    return res.status(200).json({ result: parsed });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({ error: err.message || 'Failed to reach Gemini API' });
  }
}
