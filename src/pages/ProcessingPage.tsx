import React, { useState, useEffect } from 'react';
import './ProcessingPage.css';

interface ProcessingPageProps {
  imageUrl: string;
  streamingText?: string;
}

const STEPS = [
  'Encoding leaf image…',
  'Sending to Gemini Vision AI…',
  'Identifying disease patterns…',
  'Generating diagnosis…',
];

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ imageUrl }) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(i => (i < STEPS.length - 1 ? i + 1 : i));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="processing-page">
      <div className="processing-page__content">
        <div className="processing-page__image-wrap">
          <img src={imageUrl} alt="Scanning leaf" className="processing-page__image" />
          <div className="processing-page__scan-line" />
        </div>

        <div className="processing-page__indicator">
          <div className="processing-page__spinner" />
        </div>

        <h2 className="processing-page__title">Analysing Leaf</h2>

        <div className="processing-page__steps">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`processing-page__step ${i <= stepIndex ? 'active' : ''}`}
              style={{ animationDelay: `${i * 400}ms` }}
            >
              <div className={`processing-page__step-dot ${i === stepIndex ? 'current' : i < stepIndex ? 'done' : ''}`}>
                {i < stepIndex ? '✓' : ''}
              </div>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <p className="processing-page__powered">Powered by Gemini 2.0 Flash · Free tier</p>
      </div>
    </div>
  );
};
