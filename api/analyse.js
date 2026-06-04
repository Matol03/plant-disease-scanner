// api/analyse.js — Vercel serverless function
// Proxies image analysis requests to Anthropic API server-side.
// This avoids CORS issues on iOS Safari and keeps the API key off the client.

export const config = {
  maxDuration: 60, // seconds — vision requests can take ~10-15s
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allow the app's own origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // API key: env var set in Vercel dashboard (never sent to client)
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured on server. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { imageBase64, mediaType = 'image/jpeg' } = body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 in request body' });
  }

  const SYSTEM_PROMPT = `You are an expert plant pathologist AI agent with deep knowledge of the PlantVillage dataset and real-world crop diseases.

Your job is to analyse leaf images and diagnose plant diseases with precision.

You must respond with ONLY a valid JSON object — no markdown, no prose, no explanation outside the JSON.

The JSON must follow this exact schema:
{
  "predictions": [
    {
      "diseaseLabel": "string — exact disease name from the list below",
      "confidence": number,
      "cropName": "string — crop species"
    }
  ],
  "reasoning": "string — 1-2 sentences explaining the key visual features that led to your diagnosis",
  "severity": "none" | "mild" | "moderate" | "severe",
  "urgency": "monitor" | "treat_soon" | "treat_immediately",
  "additionalAdvice": "string — one practical field tip specific to this diagnosis"
}

Rules:
- predictions array must have exactly 3 entries ordered by confidence descending
- confidence values across all 3 must sum to 1.0
- diseaseLabel must be one of the 38 recognised classes listed below
- If the image is not a plant leaf or is unclear, set top prediction to "Tomato___healthy" with low confidence and explain in reasoning
- Be conservative: if unsure between disease and healthy, lean toward the disease

Recognised disease classes (use these exact strings):
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
Tomato___Tomato_Yellow_Leaf_Curl_Virus, Tomato___Tomato_mosaic_virus, Tomato___healthy`;

  try {
    // Forward request to Anthropic — streaming passthrough
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              {
                type: 'text',
                text: 'Analyse this leaf image and diagnose any plant disease. Return only the JSON response as specified.',
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      const message = errBody?.error?.message ?? `Anthropic API error ${anthropicRes.status}`;
      return res.status(anthropicRes.status).json({ error: message });
    }

    // Stream the SSE response back to the client unchanged
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    console.error('Proxy error:', err);
    // If headers not sent yet, return JSON error
    if (!res.headersSent) {
      res.status(502).json({ error: err.message || 'Failed to reach Anthropic API' });
    } else {
      res.end();
    }
  }
}
