import type { Prediction } from './index';

export interface UseModelInferenceReturn {
  predict: (imageElement: HTMLImageElement | HTMLCanvasElement) => Promise<Prediction[]>;
  loadModel: () => Promise<void>;
  isLoading: boolean;
  loadProgress: number;
  isReady: boolean;
  error: string | null;
}
