// api/analyse.js — Vercel serverless function
// Uses Google Gemini 1.5 Flash (free tier: 15 req/min, 1500 req/day)
// With automatic retry on rate limit (3 attempts, exponential backoff)

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are an expert plant pathologist AI. Analyse the leaf image and diagnose plant diseases.

Respond with ONLY a valid JSON object, no markdown, no code fences, no extra text.

Schema:
{
  "predictions": [
    { "diseaseLabel": "string", "confidence": number, "cropName": "string" }
  ],
  "reasoning": "1-2 sentences on key visual symptoms observed",
  "severity": "none" | "mild" | "moderate" | "severe",
  "urgency": "monitor" | "treat_soon" | "treat_immediately",
  "additionalAdvice": "one practical field tip"
}

Rules:
- predictions: exactly 3 entries, confidence values sum to 1.0, sorted by confidence descending
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
- If image is unclear/not a leaf: top prediction Tomato___healthy, low confidence, explain in reasoning`;

// Models to try in order — fallback chain if one is rate-limited
const MODEL_CHAIN = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',  // smaller/faster, higher limits
  'gemini-1.5-pro',       // higher quota on some accounts
];

async function callGemini(apiKey, imageBase64, mediaType, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT + '\n\nAnalyse this leaf image:' },
          { inline_data: { mime_type: mediaType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
  });

  return res;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not configured. Add it in Vercel → Settings → Environment Variables. Get a free key at aistudio.google.com/apikey'
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

  // Try each model in the chain — move to next on rate limit
  for (let modelIdx = 0; modelIdx < MODEL_CHAIN.length; modelIdx++) {
    const model = MODEL_CHAIN[modelIdx];

    // Retry up to 3 times per model with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const geminiRes = await callGemini(apiKey, imageBase64, mediaType, model);

        if (geminiRes.status === 429) {
          // Rate limited — wait and retry this model, then try next model
          const waitMs = attempt === 0 ? 2000 : attempt === 1 ? 5000 : 10000;
          console.log(`Rate limited on ${model}, attempt ${attempt + 1}, waiting ${waitMs}ms`);
          await sleep(waitMs);
          continue; // retry same model
        }

        if (!geminiRes.ok) {
          const err = await geminiRes.json().catch(() => ({}));
          const msg = err?.error?.message ?? `Gemini error ${geminiRes.status}`;

          // Bad key — no point retrying
          if (geminiRes.status === 400 || geminiRes.status === 401 || geminiRes.status === 403) {
            return res.status(401).json({
              error: `Invalid Gemini API key or access denied: ${msg}. Get a free key at aistudio.google.com/apikey`
            });
          }

          // Other error — try next model
          break;
        }

        // Success
        const data = await geminiRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

        if (!text) {
          // Empty response — try next model
          break;
        }

        // Parse JSON
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          const match = text.match(/\{[\s\S]*\}/);
          if (!match) break; // try next model
          parsed = JSON.parse(match[0]);
        }

        // Validate shape
        if (!parsed?.predictions || !Array.isArray(parsed.predictions)) {
          break; // try next model
        }

        console.log(`Success with model: ${model}`);
        return res.status(200).json({ result: parsed, model });

      } catch (fetchErr) {
        console.error(`Fetch error on ${model} attempt ${attempt}:`, fetchErr.message);
        if (attempt < 2) await sleep(1000);
      }
    }

    // All retries exhausted for this model — wait before trying next
    if (modelIdx < MODEL_CHAIN.length - 1) {
      await sleep(2000);
    }
  }

  // All models exhausted
  return res.status(429).json({
    error: 'All Gemini models are currently rate-limited. Please wait 30 seconds and try again. (Free tier: 15 requests/minute)'
  });
}
