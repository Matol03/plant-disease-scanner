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

function parseClassToPrediction(diseaseLabel: string, confidence: number, cropName?: string): Prediction {
  const byName = Object.values(diseaseData).find(d => d.name.toLowerCase() === diseaseLabel.toLowerCase());
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
  return target.toDataURL('image/jpeg', 0.85).split(',')[1];
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
      const imageBase64 = canvasToBase64(canvas);

      // Call server-side proxy at /api/analyse — avoids CORS on iOS Safari
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg' }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `Server error ${response.status}`);
      }

      // Parse SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              accumulated += evt.delta.text;
              setStreamingText(accumulated);
            }
          } catch { /* partial line */ }
        }
      }

      if (!accumulated.trim()) {
        throw new Error('No response from AI agent. Check API key has credits at console.anthropic.com → Billing.');
      }

      const clean = accumulated.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
      let result;
      try {
        result = JSON.parse(clean);
      } catch {
        const match = clean.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`Could not parse agent response: ${clean.slice(0, 120)}`);
        result = JSON.parse(match[0]);
      }

      const predictions: Prediction[] = (result.predictions ?? [])
        .slice(0, 3)
        .map((p: { diseaseLabel: string; confidence: number; cropName?: string }) =>
          parseClassToPrediction(p.diseaseLabel, p.confidence, p.cropName)
        );

      while (predictions.length < 3) {
        predictions.push({ ...parseClassToPrediction('Tomato___healthy', 0), confidence: 0 });
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
