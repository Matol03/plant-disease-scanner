import { useState, useCallback } from 'react';
import { diseaseData } from '../data/diseaseData';
import type { Prediction } from '../types';

interface AgentAnalysis {
  predictions: Prediction[];
  reasoning: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  urgency: 'monitor' | 'treat_soon' | 'treat_immediately';
  additionalAdvice: string;
}

interface UseAIAgentReturn {
  analyse: (canvas: HTMLCanvasElement) => Promise<AgentAnalysis>;
  isAnalysing: boolean;
  streamingText: string;
  error: string | null;
  isReady: boolean;
}

// System prompt that turns Claude into a plant pathologist agent
const SYSTEM_PROMPT = `You are an expert plant pathologist AI agent with deep knowledge of the PlantVillage dataset and real-world crop diseases.

Your job is to analyse leaf images and diagnose plant diseases with precision.

You must respond with ONLY a valid JSON object — no markdown, no prose, no explanation outside the JSON.

The JSON must follow this exact schema:
{
  "predictions": [
    {
      "diseaseLabel": "string — exact disease name from the list below",
      "confidence": number — float between 0 and 1,
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
- If the image is not a plant leaf, set diseaseLabel to "Tomato___healthy" with reasoning explaining the image is unclear
- Be conservative: if unsure between disease and healthy, lean toward the disease (false negative is worse than false positive for farmers)

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

/**
 * Parse a PlantVillage class string like "Tomato___Early_blight"
 * into crop name and disease name, then match to diseaseData.
 */
function parseClassToPrediction(
  diseaseLabel: string,
  confidence: number,
  cropName?: string
): Prediction {
  // Try direct match in diseaseData by name
  const byName = Object.values(diseaseData).find(
    d => d.name.toLowerCase() === diseaseLabel.toLowerCase()
  );
  if (byName) return { diseaseLabel: byName.name, confidence, disease: byName };

  // Parse PlantVillage format: "Tomato___Early_blight"
  const parts = diseaseLabel.split('___');
  const crop = (cropName ?? parts[0] ?? 'Unknown').replace(/_/g, ' ').replace(/,.*/, '').trim();
  const name = (parts[1] ?? diseaseLabel).replace(/_/g, ' ').trim();

  // Fuzzy match on both crop + disease name
  const fuzzy = Object.values(diseaseData).find(d => {
    const nameMatch = d.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]);
    const cropMatch = d.crop.toLowerCase().includes(crop.toLowerCase().split(' ')[0]);
    return nameMatch && cropMatch;
  });
  if (fuzzy) return { diseaseLabel: fuzzy.name, confidence, disease: fuzzy };

  // Fallback: match by disease name only
  const nameOnly = Object.values(diseaseData).find(d =>
    d.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
  );
  if (nameOnly) return { diseaseLabel: nameOnly.name, confidence, disease: nameOnly };

  // Last resort: return tomato healthy with the raw label
  return { diseaseLabel: diseaseLabel, confidence, disease: diseaseData[37] };
}

/**
 * Convert a canvas to a base64 JPEG string suitable for the Anthropic API.
 * Resizes to max 1024px to keep payload small.
 */
function canvasToBase64(canvas: HTMLCanvasElement, maxSize = 1024): string {
  let targetCanvas = canvas;

  if (canvas.width > maxSize || canvas.height > maxSize) {
    const scale = maxSize / Math.max(canvas.width, canvas.height);
    const w = Math.round(canvas.width * scale);
    const h = Math.round(canvas.height * scale);
    targetCanvas = document.createElement('canvas');
    targetCanvas.width = w;
    targetCanvas.height = h;
    targetCanvas.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
  }

  return targetCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export function useAIAgent(): UseAIAgentReturn {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyse = useCallback(async (canvas: HTMLCanvasElement): Promise<AgentAnalysis> => {
    setIsAnalysing(true);
    setStreamingText('');
    setError(null);

    try {
      const base64Image = canvasToBase64(canvas);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
          'x-api-key': sessionStorage.getItem('anthropic_api_key') ?? '',
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
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image,
                  },
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

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `API error ${response.status}`);
      }

      // Stream the response and accumulate the JSON
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.delta?.text ?? '';
            if (delta) {
              accumulated += delta;
              setStreamingText(accumulated);
            }
          } catch {
            // partial JSON line — skip
          }
        }
      }

      // Parse the accumulated JSON response
      const clean = accumulated.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      // Map raw API response to typed Prediction objects
      const predictions: Prediction[] = (result.predictions ?? [])
        .slice(0, 3)
        .map((p: { diseaseLabel: string; confidence: number; cropName?: string }) =>
          parseClassToPrediction(p.diseaseLabel, p.confidence, p.cropName)
        );

      // Ensure we always have 3 predictions
      while (predictions.length < 3) {
        const fallbackIdx = predictions.length;
        predictions.push(parseClassToPrediction('Tomato___healthy', 0, undefined));
        predictions[fallbackIdx].confidence = 0;
      }

      return {
        predictions,
        reasoning: result.reasoning ?? '',
        severity: result.severity ?? 'none',
        urgency: result.urgency ?? 'monitor',
        additionalAdvice: result.additionalAdvice ?? '',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(msg);
      throw err;
    } finally {
      setIsAnalysing(false);
    }
  }, []);

  return {
    analyse,
    isAnalysing,
    streamingText,
    error,
    isReady: true, // Agent is always ready — no model loading needed
  };
}
