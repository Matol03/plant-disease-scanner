import React, { useEffect, useState } from 'react';
import type { DiagnosisRecord } from '../types';
import { diseaseData } from '../data/diseaseData';
import './FieldLogItem.css';

interface FieldLogItemProps {
  record: DiagnosisRecord;
  onDelete: (id: number) => void;
}

const CROP_ICONS: Record<string, string> = {
  Apple: '🍎', Blueberry: '🫐', Cherry: '🍒', Corn: '🌽',
  Grape: '🍇', Orange: '🍊', Peach: '🍑', 'Bell Pepper': '🫑',
  Potato: '🥔', Raspberry: '🫐', Soybean: '🌱', Squash: '🎃',
  Strawberry: '🍓', Tomato: '🍅',
};

export const FieldLogItem: React.FC<FieldLogItemProps> = ({ record, onDelete }) => {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(record.imageBlob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [record.imageBlob]);

  const date = new Date(record.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const confidencePct = Math.round(record.confidence * 100);
  const icon = CROP_ICONS[record.cropName] ?? '🌿';

  // Find disease info
  const disease = Object.values(diseaseData).find(d => d.name === record.diseaseLabel);
  const isHealthy = disease?.cause === 'No disease detected';

  return (
    <div className="field-log-item card">
      <div className="field-log-item__thumbnail">
        {imageUrl && <img src={imageUrl} alt={record.diseaseLabel} />}
      </div>
      <div className="field-log-item__content">
        <div className="field-log-item__meta">
          <span className="field-log-item__icon">{icon}</span>
          <span className="field-log-item__crop">{record.cropName}</span>
          <span className={`field-log-item__status ${isHealthy ? 'healthy' : 'diseased'}`}>
            {isHealthy ? '✓' : '⚠'}
          </span>
        </div>
        <div className="field-log-item__disease">{record.diseaseLabel}</div>
        <div className="field-log-item__footer">
          <span className="field-log-item__date">{dateStr} · {timeStr}</span>
          <span className="field-log-item__conf">{confidencePct}%</span>
        </div>
      </div>
      <button
        className="field-log-item__delete"
        onClick={() => record.id && onDelete(record.id)}
        aria-label="Delete record"
      >
        ✕
      </button>
    </div>
  );
};
