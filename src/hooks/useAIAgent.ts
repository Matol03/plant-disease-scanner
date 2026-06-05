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
  return target.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export function useAIAgent(): UseAIAgentReturn {
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const analyse = useCallback(async (canvas: HTMLCanvasElement): Promise<AgentAnalysis> => {
    setIsAnalysing(true);
    setStreamingText('Sending image to AI agent…');
    setError(null);

    try {
      const imageBase64 = canvasToBase64(canvas);

      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType: 'image/jpeg' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? `Server error ${response.status}`);
      }

      const result = data.result;
      if (!result) throw new Error('No result returned from AI agent');

      setStreamingText(JSON.stringify(result, null, 2));

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
