import React from 'react';
import './ProcessingPage.css';

interface ProcessingPageProps {
  imageUrl: string;
}

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ imageUrl }) => {
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
        <p className="processing-page__subtitle">
          Running disease detection model…
        </p>

        <div className="processing-page__steps">
          {['Preprocessing image', 'Running EfficientNet', 'Matching disease patterns'].map((step, i) => (
            <div key={i} className="processing-page__step" style={{ animationDelay: `${i * 400}ms` }}>
              <div className="processing-page__step-dot" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
