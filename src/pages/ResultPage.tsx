import React, { useState } from 'react';
import { DiagnosisCard } from '../components/DiagnosisCard';
import type { AgentResult } from '../types';
import { saveDiagnosis } from '../utils/db';
import './ResultPage.css';

interface ResultPageProps {
  agentResult: AgentResult;
  imageUrl: string;
  imageCanvas: HTMLCanvasElement;
  onRetry: () => void;
  onViewLog: () => void;
}

export const ResultPage: React.FC<ResultPageProps> = ({
  agentResult, imageUrl, imageCanvas, onRetry, onViewLog,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (saved || isSaving) return;
    setIsSaving(true);
    try {
      imageCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const top = agentResult.predictions[0];
        await saveDiagnosis({
          imageBlob: blob,
          diseaseLabel: top.diseaseLabel,
          confidence: top.confidence,
          timestamp: Date.now(),
          cropName: top.disease.crop,
          reasoning: agentResult.reasoning,
          severity: agentResult.severity,
          urgency: agentResult.urgency,
        });
        setSaved(true);
        setIsSaving(false);
      }, 'image/jpeg', 0.8);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="result-page">
      {saved && (
        <div className="result-page__toast">
          ✓ Saved to Field Log
          <button onClick={onViewLog}>View Log →</button>
        </div>
      )}
      <DiagnosisCard
        predictions={agentResult.predictions}
        imageUrl={imageUrl}
        onSave={handleSave}
        onRetry={onRetry}
        isSaving={isSaving}
        reasoning={agentResult.reasoning}
        severity={agentResult.severity}
        urgency={agentResult.urgency}
        additionalAdvice={agentResult.additionalAdvice}
      />
    </div>
  );
};
