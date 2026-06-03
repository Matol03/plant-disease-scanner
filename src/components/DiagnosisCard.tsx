import React, { useState } from 'react';
import type { Prediction } from '../types';
import './DiagnosisCard.css';

interface DiagnosisCardProps {
  predictions: Prediction[];
  imageUrl: string;
  onSave: () => void;
  onRetry: () => void;
  isSaving?: boolean;
  // AI agent extras
  reasoning?: string;
  severity?: 'none' | 'mild' | 'moderate' | 'severe';
  urgency?: 'monitor' | 'treat_soon' | 'treat_immediately';
  additionalAdvice?: string;
}

const COST_LABEL: Record<string, string> = {
  low: '💚 Low cost',
  medium: '🟡 Medium cost',
  high: '🔴 High cost',
};

const SEVERITY_CONFIG = {
  none:     { label: 'No Disease',  color: 'var(--color-success)', bg: 'rgba(22,101,52,0.1)' },
  mild:     { label: 'Mild',        color: '#ca8a04',              bg: 'rgba(202,138,4,0.1)' },
  moderate: { label: 'Moderate',    color: 'var(--color-accent)',  bg: 'rgba(193,126,45,0.1)' },
  severe:   { label: 'Severe',      color: 'var(--color-danger)',  bg: 'rgba(185,28,28,0.1)' },
};

const URGENCY_CONFIG = {
  monitor:             { label: '🟢 Monitor weekly',          color: 'var(--color-success)' },
  treat_soon:          { label: '🟡 Treat within 1–2 weeks', color: '#ca8a04' },
  treat_immediately:   { label: '🔴 Treat immediately',       color: 'var(--color-danger)' },
};

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({
  predictions, imageUrl, onSave, onRetry, isSaving,
  reasoning, severity = 'none', urgency = 'monitor', additionalAdvice,
}) => {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const top = predictions[0];
  const isHealthy = top.disease.cause === 'No disease detected';
  const confidencePct = Math.round(top.confidence * 100);
  const sev = SEVERITY_CONFIG[severity];
  const urg = URGENCY_CONFIG[urgency];

  const confidenceColor =
    confidencePct >= 80 ? 'var(--color-success)' :
    confidencePct >= 60 ? 'var(--color-accent)' :
    'var(--color-danger)';

  return (
    <div className="diagnosis-card animate-slideUp">
      {/* Image thumbnail */}
      <div className="diagnosis-card__image-wrap">
        <img src={imageUrl} alt="Scanned leaf" className="diagnosis-card__image" />
        <div className={`diagnosis-card__status-badge ${isHealthy ? 'healthy' : 'diseased'}`}>
          {isHealthy ? '✓ Healthy' : '⚠ Disease Detected'}
        </div>
        {/* AI badge */}
        <div className="diagnosis-card__ai-badge">🤖 Claude AI</div>
      </div>

      {/* Disease name + confidence */}
      <div className="diagnosis-card__header">
        <div className="diagnosis-card__crop">{top.disease.crop}</div>
        <h2 className="diagnosis-card__name">{top.disease.name}</h2>
        <div className="diagnosis-card__confidence" style={{ color: confidenceColor }}>
          <span className="diagnosis-card__confidence-value">{confidencePct}%</span>
          <span className="diagnosis-card__confidence-label"> confidence</span>
        </div>
      </div>

      {/* Severity + Urgency pills */}
      <div className="diagnosis-card__pills">
        <span className="diagnosis-card__pill"
          style={{ color: sev.color, background: sev.bg }}>
          Severity: {sev.label}
        </span>
        <span className="diagnosis-card__pill"
          style={{ color: urg.color, background: `${urg.color}18` }}>
          {urg.label}
        </span>
      </div>

      {/* AI Reasoning */}
      {reasoning && (
        <div className="diagnosis-card__reasoning">
          <span className="diagnosis-card__label">🤖 Agent Reasoning</span>
          <p>{reasoning}</p>
        </div>
      )}

      {/* Cause */}
      <div className="diagnosis-card__cause">
        <span className="diagnosis-card__label">Cause</span>
        <p>{top.disease.cause}</p>
      </div>

      <p className="diagnosis-card__description">{top.disease.description}</p>

      {/* Treatment steps */}
      {!isHealthy && (
        <div className="diagnosis-card__treatments">
          <h3 className="diagnosis-card__section-title">Treatment Steps</h3>
          <p className="diagnosis-card__section-subtitle">Ranked cheapest first</p>
          {top.disease.treatments.map((t, i) => (
            <button
              key={i}
              className={`diagnosis-card__treatment ${expandedStep === i ? 'expanded' : ''}`}
              onClick={() => setExpandedStep(expandedStep === i ? null : i)}
            >
              <div className="diagnosis-card__treatment-header">
                <span className="diagnosis-card__step-num">{i + 1}</span>
                <span className="diagnosis-card__step-text">{t.step}</span>
                <span className="diagnosis-card__chevron">{expandedStep === i ? '▲' : '▼'}</span>
              </div>
              {expandedStep === i && (
                <div className="diagnosis-card__treatment-detail">
                  <span className="diagnosis-card__cost">{COST_LABEL[t.cost]}</span>
                  <span className="diagnosis-card__timeframe">⏱ {t.timeframe}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Additional AI advice */}
      {additionalAdvice && (
        <div className="diagnosis-card__advice">
          <span className="diagnosis-card__label">💡 Field Tip</span>
          <p>{additionalAdvice}</p>
        </div>
      )}

      {/* Alternative predictions */}
      {predictions.length > 1 && (
        <div className="diagnosis-card__alternatives">
          <span className="diagnosis-card__label">Other possibilities</span>
          <div className="diagnosis-card__alt-list">
            {predictions.slice(1).map((p, i) => (
              <div key={i} className="diagnosis-card__alt-item">
                <span>{p.disease.crop} — {p.diseaseLabel}</span>
                <span className="diagnosis-card__alt-conf">{Math.round(p.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="diagnosis-card__actions">
        <button className="btn-primary" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : '💾 Save to Field Log'}
        </button>
        <button className="btn-secondary" onClick={onRetry}>
          📷 Scan Another
        </button>
      </div>
    </div>
  );
};
