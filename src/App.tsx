import React, { useState, useCallback } from 'react';
import { useModelInference } from './hooks/useModelInference';
import { HomePage } from './pages/HomePage';
import { CameraPage } from './pages/CameraPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { ResultPage } from './pages/ResultPage';
import { FieldLogPage } from './pages/FieldLogPage';
import type { Prediction, AppState } from './types';
import type { UseModelInferenceReturn } from './types/hooks';

export default function App() {
  const [appState, setAppState] = useState<AppState>('home');
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  const model = useModelInference();

  const handleCapture = useCallback(async (canvas: HTMLCanvasElement, imageUrl: string) => {
    setCapturedCanvas(canvas);
    setCapturedImageUrl(imageUrl);
    setAppState('processing');

    try {
      // Load model if not ready yet
      if (!model.isReady) {
        await model.loadModel();
      }
      const results = await model.predict(canvas);
      setPredictions(results);
      setAppState('result');
    } catch (err) {
      console.error('Prediction failed:', err);
      setAppState('camera');
    }
  }, [model]);

  return (
    <>
      {appState === 'home' && (
        <HomePage
          onStart={() => setAppState('camera')}
          model={model as UseModelInferenceReturn}
        />
      )}
      {appState === 'camera' && (
        <CameraPage
          onCapture={handleCapture}
          onBack={() => setAppState('home')}
        />
      )}
      {appState === 'processing' && capturedImageUrl && (
        <ProcessingPage imageUrl={capturedImageUrl} />
      )}
      {appState === 'result' && predictions.length > 0 && capturedCanvas && capturedImageUrl && (
        <ResultPage
          predictions={predictions}
          imageUrl={capturedImageUrl}
          imageCanvas={capturedCanvas}
          onRetry={() => setAppState('camera')}
          onViewLog={() => setAppState('log')}
        />
      )}
      {appState === 'log' && (
        <FieldLogPage
          onBack={() => setAppState('home')}
          onScan={() => setAppState('camera')}
        />
      )}
    </>
  );
}
