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
  "reasoning": "string — 1-2 sentences explaining the key visual features",
  "severity": "none" | "mild" | "moderate" | "severe",
  "urgency": "monitor" | "treat_soon" | "treat_immediately",
  "additionalAdvice": "string — one practical field tip"
}

Rules:
- predictions array must have exactly 3 entries ordered by confidence descending
- confidence values must sum to 1.0
- diseaseLabel must be one of the 38 recognised classes listed below
- If image is unclear or not a leaf, use "Tomato___healthy" as top prediction

Recognised disease classes:
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

function parseClassToPrediction(diseaseLabel: string, confidence: number, cropName?: string): Prediction {
  const byName = Object.values(diseaseData).find(
    d => d.name.toLowerCase() === diseaseLabel.toLowerCase()
  );
  if (byName) return { diseaseLabel: byName.name, confidence, disease: byName };

  const parts = diseaseLabel.split('___');
  const crop = (cropName ?? parts[0] ?? 'Unknown').replace(/_/g, ' ').replace(/,.*/, '').trim();
  const name = (parts[1] ?? diseaseLabel).replace(/_/g, ' ').trim();

  const fuzzy = Object.values(diseaseData).find(d => {
    const nameMatch = d.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]);
    const cropMatch = d.crop.toLowerCase().includes(crop.toLowerCase().split(' ')[0]);
    return nameMatch && cropMatch;
  });
  if (fuzzy) return { diseaseLabel: fuzzy.name, confidence, disease: fuzzy };

  const nameOnly = Object.values(diseaseData).find(d =>
    d.name.toLowerCase().includes(name.toLowerCase().split(' ')[0])
  );
  if (nameOnly) return { diseaseLabel: nameOnly.name, confidence, disease: nameOnly };

  return { diseaseLabel: diseaseLabel, confidence, disease: diseaseData[37] };
}

function canvasToBase64(canvas: HTMLCanvasElement, maxSize = 1024): string {
  let target = canvas;
  if (canvas.width > maxSize || canvas.height > maxSize) {
    const scale = maxSize / Math.max(canvas.width, canvas.height);
    const w = Math.round(canvas.width * scale);
    const h = Math.round(canvas.height * scale);
    target = document.createElement('canvas');
    target.width = w;
    target.height = h;
    target.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
  }
  // Ensure canvas has content — if empty return a minimal JPEG
  const data = target.toDataURL('image/jpeg', 0.85);
  return data.split(',')[1];
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
      const apiKey = sessionStorage.getItem('anthropic_api_key') ?? '';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
              },
              {
                type: 'text',
                text: 'Analyse this leaf image and diagnose any plant disease. Return only the JSON response.',
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error?.message ?? `API error ${response.status}`);
      }

      // ── SSE stream parsing ─────────────────────────────────────────────
      // Anthropic SSE format:
      //   event: content_block_delta
      //   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."},...}
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep last incomplete line in buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const evt = JSON.parse(payload);
            // Anthropic streaming: content_block_delta with text_delta
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              accumulated += evt.delta.text;
              setStreamingText(accumulated);
            }
            // Also handle message_delta for stop reason
            if (evt.type === 'message_stop') break;
          } catch {
            // malformed SSE line — skip
          }
        }
      }

      if (!accumulated.trim()) {
        throw new Error('No response received from AI agent. Please check your API key has credits.');
      }

      // Strip markdown fences if model wrapped in ```json ... ```
      const clean = accumulated.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();

      let result;
      try {
        result = JSON.parse(clean);
      } catch {
        // Try to extract JSON object from response
        const match = clean.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`Could not parse agent response: ${clean.slice(0, 100)}`);
        result = JSON.parse(match[0]);
      }

      const predictions: Prediction[] = (result.predictions ?? [])
        .slice(0, 3)
        .map((p: { diseaseLabel: string; confidence: number; cropName?: string }) =>
          parseClassToPrediction(p.diseaseLabel, p.confidence, p.cropName)
        );

      while (predictions.length < 3) {
        const idx = predictions.length;
        const fallback = parseClassToPrediction('Tomato___healthy', 0);
        fallback.confidence = 0;
        predictions[idx] = fallback;
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

  return { analyse, isAnalysing, streamingText, error, isReady: true };
}
