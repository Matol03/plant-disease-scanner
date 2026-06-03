import React from 'react';
import { OfflineBadge } from '../components/OfflineBadge';
import './HomePage.css';

interface HomePageProps {
  onStart: () => void;
  onChangeKey: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onStart, onChangeKey }) => {
  return (
    <div className="home-page">
      <header className="home-page__header">
        <OfflineBadge />
        <button className="home-page__key-btn" onClick={onChangeKey} title="Change API key">
          🔑
        </button>
      </header>

      <main className="home-page__main">
        <div className="home-page__hero">
          <div className="home-page__leaf-icon">🌿</div>
          <h1 className="home-page__title">
            Plant Disease<br />Scanner
          </h1>
          <p className="home-page__subtitle">
            Point your camera at a crop leaf.<br />
            Claude AI diagnoses it in seconds.
          </p>
          <div className="home-page__agent-badge">
            🤖 Powered by Claude Vision AI
          </div>
        </div>

        <div className="home-page__steps">
          {[
            { icon: '📷', text: 'Take a photo of the leaf' },
            { icon: '🤖', text: 'Claude AI analyses the image' },
            { icon: '💊', text: 'Get diagnosis + treatment steps' },
          ].map((step, i) => (
            <div key={i} className="home-page__step" style={{ animationDelay: `${i * 100}ms` }}>
              <span className="home-page__step-icon">{step.icon}</span>
              <span className="home-page__step-text">{step.text}</span>
            </div>
          ))}
        </div>

        <button className="btn-primary home-page__cta" onClick={onStart}>
          📷 Scan a Leaf
        </button>

        <p className="home-page__disclaimer">
          38 plant disease categories · PlantVillage dataset<br />
          Optimised for Central Asian crops
        </p>
      </main>

      <footer className="home-page__footer">
        <p>AI Agent: Claude claude-sonnet-4-20250514 Vision</p>
        <p>No model download required · Works immediately</p>
      </footer>
    </div>
  );
};
