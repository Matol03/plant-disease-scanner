import React from 'react';
import './ProcessingPage.css';

interface ProcessingPageProps {
  imageUrl: string;
  streamingText?: string;
}

export const ProcessingPage: React.FC<ProcessingPageProps> = ({ imageUrl, streamingText }) => {
  // Show partial JSON as a readable "thinking" indicator
  const isThinking = streamingText && streamingText.length > 0;
  const thinkingSnippet = streamingText
    ? streamingText.replace(/[{}"]/g, '').replace(/\n/g, ' ').slice(-120)
    : '';

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

        <h2 className="processing-page__title">AI Agent Analysing</h2>

        {isThinking ? (
          <div className="processing-page__stream">
            <p className="processing-page__stream-label">Agent reasoning…</p>
            <p className="processing-page__stream-text">{thinkingSnippet}</p>
          </div>
        ) : (
          <>
            <p className="processing-page__subtitle">Sending image to Claude vision AI…</p>
            <div className="processing-page__steps">
              {['Encoding leaf image', 'Querying plant pathologist AI', 'Parsing diagnosis'].map((step, i) => (
                <div key={i} className="processing-page__step" style={{ animationDelay: `${i * 400}ms` }}>
                  <div className="processing-page__step-dot" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
