import { useState, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { diseaseData } from '../data/diseaseData';
import type { Prediction } from '../types';

interface ModelInfo {
  class_names: string[];
  num_classes: number;
  input_size: number;
  input_range: [number, number];
}

interface UseModelInferenceReturn {
  predict: (imageElement: HTMLImageElement | HTMLCanvasElement) => Promise<Prediction[]>;
  loadModel: () => Promise<void>;
  isLoading: boolean;
  loadProgress: number;
  isReady: boolean;
  error: string | null;
}

export function useModelInference(): UseModelInferenceReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef<tf.GraphModel | null>(null);
  const modelInfoRef = useRef<ModelInfo | null>(null);

  const loadModel = useCallback(async () => {
    if (modelRef.current || isLoading) return;
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
      await tf.setBackend('webgl');
      await tf.ready();
      setLoadProgress(10);

      // Try to load model_info.json first
      try {
        const infoRes = await fetch('/model/model_info.json');
        if (infoRes.ok) {
          modelInfoRef.current = await infoRes.json();
          console.log('Model info loaded:', modelInfoRef.current);
        }
      } catch {
        // model_info.json optional
      }

      // Load TF.js model
      const model = await tf.loadGraphModel('/model/model.json', {
        onProgress: (fraction) => {
          setLoadProgress(10 + Math.round(fraction * 88));
        },
      });
      modelRef.current = model;
      setLoadProgress(100);
      setIsReady(true);
      console.log('Real model loaded successfully');
    } catch {
      // Fall back to demo mode
      console.warn('Model not found — running in DEMO MODE');
      modelRef.current = null;
      setLoadProgress(100);
      setIsReady(true);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  /**
   * Map a class index to a Prediction using model_info.json if available,
   * falling back to the built-in diseaseData mapping.
   */
  function indexToPrediction(index: number, confidence: number): Prediction {
    // If we have model_info with class names, parse them
    if (modelInfoRef.current?.class_names) {
      const rawName = modelInfoRef.current.class_names[index] ?? '';
      // PlantVillage format: "Tomato___Early_blight" → crop=Tomato, name=Early blight
      const parts = rawName.split('___');
      const crop = parts[0]?.replace(/_/g, ' ').replace(/,.*/, '').trim() ?? 'Unknown';
      const diseaseName = parts[1]?.replace(/_/g, ' ').trim() ?? rawName;

      // Try to find matching disease data
      const disease = Object.values(diseaseData).find(
        d => d.name.toLowerCase() === diseaseName.toLowerCase() && d.crop.toLowerCase() === crop.toLowerCase()
      ) ?? Object.values(diseaseData).find(
        d => rawName.toLowerCase().includes(d.name.toLowerCase().split(' ')[0].toLowerCase())
      ) ?? diseaseData[index % 38] ?? diseaseData[37];

      return { diseaseLabel: disease.name, confidence, disease };
    }

    // Fallback: use diseaseData index directly
    const disease = diseaseData[index] ?? diseaseData[37];
    return { diseaseLabel: disease.name, confidence, disease };
  }

  /**
   * Demo mode predictions — deterministic per image dimensions.
   */
  function getDemoPredictions(imageEl: HTMLImageElement | HTMLCanvasElement): Prediction[] {
    const hash = (imageEl.width * 31 + imageEl.height * 17 + 7) % 38;
    return [
      indexToPrediction(hash, 0.84),
      indexToPrediction((hash + 7) % 38, 0.10),
      indexToPrediction((hash + 15) % 38, 0.04),
    ];
  }

  const predict = useCallback(async (
    imageEl: HTMLImageElement | HTMLCanvasElement
  ): Promise<Prediction[]> => {
    if (!isReady) throw new Error('Model not ready');

    if (!modelRef.current) {
      await new Promise(r => setTimeout(r, 1200));
      return getDemoPredictions(imageEl);
    }

    const imgSize = modelInfoRef.current?.input_size ?? 224;
    const inputRange = modelInfoRef.current?.input_range ?? [0, 255];

    const inputTensor = tf.tidy(() => {
      const tensor = tf.browser.fromPixels(imageEl);
      const resized = tf.image.resizeBilinear(tensor, [imgSize, imgSize]);
      // Normalize based on model's expected input range
      const normalized = inputRange[1] === 1
        ? resized.div(255.0)
        : resized.toFloat();
      return normalized.expandDims(0) as tf.Tensor4D;
    });

    try {
      const output = modelRef.current.predict(inputTensor) as tf.Tensor;
      const probabilities = Array.from(await output.data());

      const indexed = probabilities.map((p, i) => ({ i, p }));
      indexed.sort((a, b) => b.p - a.p);
      const top3 = indexed.slice(0, 3);

      inputTensor.dispose();
      output.dispose();

      return top3.map(({ i, p }) => indexToPrediction(i, Math.round(p * 100) / 100));
    } catch (err) {
      inputTensor.dispose();
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return { predict, loadModel, isLoading, loadProgress, isReady, error };
}
