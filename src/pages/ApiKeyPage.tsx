import React, { useState } from 'react';
import './ApiKeyPage.css';

interface ApiKeyPageProps {
  onSave: (key: string) => void;
}

export const ApiKeyPage: React.FC<ApiKeyPageProps> = ({ onSave }) => {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Key must start with sk-ant-');
      return;
    }
    setTesting(true);
    setError('');
    try {
      // Quick validation call
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true',
          'x-api-key': trimmed,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (res.status === 401) throw new Error('Invalid API key — authentication failed');
      if (!res.ok && res.status !== 200) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Error ${res.status}`);
      }
      localStorage.setItem('anthropic_api_key', trimmed);
      onSave(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="apikey-page">
      <div className="apikey-page__card card animate-fadeInUp">
        <div className="apikey-page__icon">🔑</div>
        <h1 className="apikey-page__title">Connect AI Agent</h1>
        <p className="apikey-page__subtitle">
          This app uses Claude's vision AI to detect and classify plant diseases.
          Enter your Anthropic API key to get started.
        </p>

        <div className="apikey-page__steps">
          <p className="apikey-page__steps-title">Get your free API key:</p>
          <ol className="apikey-page__step-list">
            <li>Go to <strong>console.anthropic.com</strong></li>
            <li>Sign up or log in</li>
            <li>Click <strong>API Keys → Create Key</strong></li>
            <li>Copy and paste below</li>
          </ol>
        </div>

        <div className="apikey-page__input-wrap">
          <input
            className="apikey-page__input"
            type="password"
            placeholder="sk-ant-api03-..."
            value={key}
            onChange={e => { setKey(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className="apikey-page__error">⚠ {error}</p>}
        </div>

        <button
          className="btn-primary apikey-page__btn"
          onClick={handleSave}
          disabled={!key.trim() || testing}
        >
          {testing ? 'Verifying key…' : '✓ Save & Start'}
        </button>

        <p className="apikey-page__note">
          Your key is stored only in your browser's localStorage and never sent anywhere except directly to Anthropic's API.
        </p>
      </div>
    </div>
  );
};
