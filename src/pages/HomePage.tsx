import React, { useEffect } from 'react';
import { OfflineBadge } from '../components/OfflineBadge';
import type { UseModelInferenceReturn } from '../types/hooks';
import './HomePage.css';

interface HomePageProps {
  onStart: () => void;
  model: UseModelInferenceReturn;
}

export const HomePage: React.FC<HomePageProps> = ({ onStart, model }) => {
  useEffect(() => {
    // Start loading model on home page
    if (!model.isReady && !model.isLoading) {
      model.loadModel();
    }
  }, [model]);

  return (
    <div className="home-page">
      <header className="home-page__header">
        <div className="home-page__badge-row">
          <OfflineBadge />
          <span className="home-page__version">v1.0 · Demo Mode</span>
        </div>
      </header>

      <main className="home-page__main">
        <div className="home-page__hero">
          <div className="home-page__leaf-icon">🌿</div>
          <h1 className="home-page__title">
            Plant Disease<br />Scanner
          </h1>
          <p className="home-page__subtitle">
            Point your camera at a crop leaf.<br />
            Get an instant diagnosis in seconds.
          </p>
          <p className="home-page__region">
            Optimised for Central Asian crops
          </p>
        </div>

        <div className="home-page__steps">
          {[
            { icon: '📷', text: 'Take a photo of the leaf' },
            { icon: '🔬', text: 'AI analyses in 2 seconds' },
            { icon: '💊', text: 'Get treatment steps' },
          ].map((step, i) => (
            <div key={i} className="home-page__step" style={{ animationDelay: `${i * 100}ms` }}>
              <span className="home-page__step-icon">{step.icon}</span>
              <span className="home-page__step-text">{step.text}</span>
            </div>
          ))}
        </div>

        {/* Model loading indicator */}
        {model.isLoading && (
          <div className="home-page__loading">
            <div className="home-page__progress-bar">
              <div
                className="home-page__progress-fill"
                style={{ width: `${model.loadProgress}%` }}
              />
            </div>
            <p className="home-page__loading-text">
              Loading AI model… {model.loadProgress}%
            </p>
          </div>
        )}

        {model.error && (
          <div className="home-page__error">
            ⚠ Could not load AI model. Running in demo mode.
          </div>
        )}

        <button
          className="btn-primary home-page__cta"
          onClick={onStart}
          disabled={model.isLoading}
        >
          {model.isLoading
            ? `Loading AI… ${model.loadProgress}%`
            : model.isReady
            ? '📷 Scan a Leaf'
            : '📷 Scan a Leaf'}
        </button>

        <p className="home-page__disclaimer">
          Works offline after first load.<br />
          Supports 38 plant disease categories.
        </p>
      </main>

      <footer className="home-page__footer">
        <p>Powered by EfficientNet + TensorFlow.js</p>
        <p>PlantVillage Dataset · 38 disease classes</p>
      </footer>
    </div>
  );
};
