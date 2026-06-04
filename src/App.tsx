import React, { useState, useCallback, useEffect } from 'react';
import { useAIAgent } from './hooks/useAIAgent';
import { ApiKeyPage } from './pages/ApiKeyPage';
import { HomePage } from './pages/HomePage';
import { CameraPage } from './pages/CameraPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { ResultPage } from './pages/ResultPage';
import { FieldLogPage } from './pages/FieldLogPage';
import type { AgentResult, AppState } from './types';
import './App.css';

const ENV_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

function getStoredKey(): string {
  return ENV_KEY || localStorage.getItem('anthropic_api_key') || '';
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>('');
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const agent = useAIAgent();

  useEffect(() => {
    const key = getStoredKey();
    if (key) {
      sessionStorage.setItem('anthropic_api_key', key);
      setAppState('home');
    }
  }, []);

  const handleKeySet = useCallback((key: string) => {
    sessionStorage.setItem('anthropic_api_key', key);
    setAppState('home');
  }, []);

  const handleCapture = useCallback(async (canvas: HTMLCanvasElement, imageUrl: string) => {
    setCapturedCanvas(canvas);
    setCapturedImageUrl(imageUrl);
    setAnalysisError(null);
    setAppState('processing');

    try {
      const result = await agent.analyse(canvas);
      setAgentResult(result);
      setAppState('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';

      // Auth errors → back to key setup
      if (msg.includes('401') || msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('invalid x-api-key')) {
        localStorage.removeItem('anthropic_api_key');
        sessionStorage.removeItem('anthropic_api_key');
        setAppState('setup');
        return;
      }

      // All other errors → stay on processing page but show the error
      setAnalysisError(msg);
      setAppState('error');
    }
  }, [agent]);

  const handleChangeKey = useCallback(() => {
    if (ENV_KEY) return;
    localStorage.removeItem('anthropic_api_key');
    sessionStorage.removeItem('anthropic_api_key');
    setAppState('setup');
  }, []);

  return (
    <>
      {appState === 'setup' && <ApiKeyPage onSave={handleKeySet} />}

      {appState === 'home' && (
        <HomePage
          onStart={() => setAppState('camera')}
          onChangeKey={handleChangeKey}
          keyIsEnvLocked={!!ENV_KEY}
        />
      )}

      {appState === 'camera' && (
        <CameraPage onCapture={handleCapture} onBack={() => setAppState('home')} />
      )}

      {appState === 'processing' && capturedImageUrl && (
        <ProcessingPage imageUrl={capturedImageUrl} streamingText={agent.streamingText} />
      )}

      {appState === 'error' && (
        <div className="app-error">
          <div className="app-error__card card">
            <div className="app-error__icon">⚠️</div>
            <h2>Analysis Failed</h2>
            <p className="app-error__msg">{analysisError}</p>
            {analysisError?.toLowerCase().includes('credit') && (
              <p className="app-error__hint">
                Add credits at <strong>console.anthropic.com</strong> → Billing
              </p>
            )}
            <button className="btn-primary" onClick={() => setAppState('camera')}>
              ← Try Again
            </button>
            <button className="btn-secondary" onClick={() => setAppState('home')}>
              Home
            </button>
          </div>
        </div>
      )}

      {appState === 'result' && agentResult && capturedCanvas && capturedImageUrl && (
        <ResultPage
          agentResult={agentResult}
          imageUrl={capturedImageUrl}
          imageCanvas={capturedCanvas}
          onRetry={() => setAppState('camera')}
          onViewLog={() => setAppState('log')}
        />
      )}

      {appState === 'log' && (
        <FieldLogPage onBack={() => setAppState('home')} onScan={() => setAppState('camera')} />
      )}
    </>
  );
}
