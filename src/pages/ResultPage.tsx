import React, { useState } from 'react';
import { DiagnosisCard } from '../components/DiagnosisCard';
import type { Prediction } from '../types';
import { saveDiagnosis } from '../utils/db';
import './ResultPage.css';

interface ResultPageProps {
  predictions: Prediction[];
  imageUrl: string;
  imageCanvas: HTMLCanvasElement;
  onRetry: () => void;
  onViewLog: () => void;
}

export const ResultPage: React.FC<ResultPageProps> = ({
  predictions,
  imageUrl,
  imageCanvas,
  onRetry,
  onViewLog,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (saved || isSaving) return;
    setIsSaving(true);
    try {
      imageCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const top = predictions[0];
        await saveDiagnosis({
          imageBlob: blob,
          diseaseLabel: top.diseaseLabel,
          confidence: top.confidence,
          timestamp: Date.now(),
          cropName: top.disease.crop,
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
        predictions={predictions}
        imageUrl={imageUrl}
        onSave={handleSave}
        onRetry={onRetry}
        isSaving={isSaving}
      />
    </div>
  );
};
