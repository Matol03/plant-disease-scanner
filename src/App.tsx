import React, { useState, useCallback } from 'react';
import { useAIAgent } from './hooks/useAIAgent';
import { HomePage } from './pages/HomePage';
import { CameraPage } from './pages/CameraPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { ResultPage } from './pages/ResultPage';
import { FieldLogPage } from './pages/FieldLogPage';
import type { AgentResult, AppState } from './types';
import './App.css';

type LocalState = Exclude<AppState, 'setup'>;

export default function App() {
  const [appState, setAppState] = useState<LocalState>('home');
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>('');
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const agent = useAIAgent();

  const runAnalysis = useCallback(async (canvas: HTMLCanvasElement, imageUrl: string) => {
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
      setAnalysisError(msg);
      setAppState('error');
    }
  }, [agent]);

  // Retry with the same image — no need to re-scan
  const handleRetryAnalysis = useCallback(() => {
    if (capturedCanvas && capturedImageUrl) {
      runAnalysis(capturedCanvas, capturedImageUrl);
    } else {
      setAppState('camera');
    }
  }, [capturedCanvas, capturedImageUrl, runAnalysis]);

  const isRateLimit = analysisError?.toLowerCase().includes('rate') ||
                      analysisError?.toLowerCase().includes('429');

  return (
    <>
      {appState === 'home' && (
        <HomePage
          onStart={() => setAppState('camera')}
          onChangeKey={() => {}}
          keyIsEnvLocked={true}
        />
      )}

      {appState === 'camera' && (
        <CameraPage onCapture={runAnalysis} onBack={() => setAppState('home')} />
      )}

      {appState === 'processing' && capturedImageUrl && (
        <ProcessingPage imageUrl={capturedImageUrl} streamingText={agent.streamingText} />
      )}

      {appState === 'error' && (
        <div className="app-error">
          <div className="app-error__card card">
            <div className="app-error__icon">{isRateLimit ? '⏱️' : '⚠️'}</div>
            <h2>{isRateLimit ? 'Too Many Requests' : 'Analysis Failed'}</h2>
            <p className="app-error__msg">{analysisError}</p>
            {isRateLimit && (
              <p className="app-error__hint">
                The free AI tier allows 15 requests/minute. The app already retried with 3 different models. Wait a moment and try again.
              </p>
            )}
            {/* Retry with same image — no need to re-scan */}
            <button className="btn-primary" onClick={handleRetryAnalysis}>
              🔄 Retry Same Photo
            </button>
            <button className="btn-secondary" onClick={() => setAppState('camera')}>
              📷 Scan New Photo
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
