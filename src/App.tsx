import React, { useState, useCallback, useEffect } from 'react';
import { useAIAgent } from './hooks/useAIAgent';
import { ApiKeyPage } from './pages/ApiKeyPage';
import { HomePage } from './pages/HomePage';
import { CameraPage } from './pages/CameraPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { ResultPage } from './pages/ResultPage';
import { FieldLogPage } from './pages/FieldLogPage';
import type { AgentResult, AppState } from './types';

export default function App() {
  const [appState, setAppState] = useState<AppState>('setup');
  const [apiKey, setApiKey] = useState<string>('');
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string>('');
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);

  const agent = useAIAgent();

  // Check for saved API key on mount
  useEffect(() => {
    const saved = localStorage.getItem('anthropic_api_key');
    if (saved) {
      setApiKey(saved);
      setAppState('home');
    }
  }, []);

  // Inject API key into fetch headers globally for the agent calls
  useEffect(() => {
    if (!apiKey) return;
    // Store in sessionStorage so the agent hook can read it
    sessionStorage.setItem('anthropic_api_key', apiKey);
  }, [apiKey]);

  const handleKeySet = useCallback((key: string) => {
    setApiKey(key);
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
      console.error('Agent analysis failed:', err);
      // If API key invalid, send back to setup
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('401') || msg.includes('authentication') || msg.includes('API key')) {
        localStorage.removeItem('anthropic_api_key');
        sessionStorage.removeItem('anthropic_api_key');
        setApiKey('');
        setAppState('setup');
      } else {
        setAppState('camera');
      }
    }
  }, [agent]);

  return (
    <>
      {appState === 'setup' && (
        <ApiKeyPage onSave={handleKeySet} />
      )}
      {appState === 'home' && (
        <HomePage
          onStart={() => setAppState('camera')}
          onChangeKey={() => {
            localStorage.removeItem('anthropic_api_key');
            setAppState('setup');
          }}
        />
      )}
      {appState === 'camera' && (
        <CameraPage
          onCapture={handleCapture}
          onBack={() => setAppState('home')}
        />
      )}
      {appState === 'processing' && capturedImageUrl && (
        <ProcessingPage
          imageUrl={capturedImageUrl}
          streamingText={agent.streamingText}
        />
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
        <FieldLogPage
          onBack={() => setAppState('home')}
          onScan={() => setAppState('camera')}
        />
      )}
    </>
  );
}
