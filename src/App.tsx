import React, { useState, useCallback, useEffect } from 'react';
import { useAIAgent } from './hooks/useAIAgent';
import { ApiKeyPage } from './pages/ApiKeyPage';
import { HomePage } from './pages/HomePage';
import { CameraPage } from './pages/CameraPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { ResultPage } from './pages/ResultPage';
import { FieldLogPage } from './pages/FieldLogPage';
import type { AgentResult, AppState } from './types';

// Key priority: 1) Vite env var (set in Vercel dashboard), 2) localStorage (user-entered)
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

function getStoredKey(): string {
  return ENV_KEY || localStorage.getItem('anthropic_api_key') || '';
}

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>('');
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);

  const agent = useAIAgent();

  // On mount: check for stored or env key and skip setup if present
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
    setAppState('processing');

    try {
      const result = await agent.analyse(canvas);
      setAgentResult(result);
      setAppState('result');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.includes('authentication') || msg.includes('API key')) {
        localStorage.removeItem('anthropic_api_key');
        sessionStorage.removeItem('anthropic_api_key');
        setAppState('setup');
      } else {
        setAppState('camera');
      }
    }
  }, [agent]);

  const handleChangeKey = useCallback(() => {
    // Don't allow key change when key is baked in via env
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
