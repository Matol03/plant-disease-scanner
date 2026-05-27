import React, { useEffect, useState } from 'react';
import { FieldLogItem } from '../components/FieldLogItem';
import { getAllDiagnoses, deleteDiagnosis } from '../utils/db';
import type { DiagnosisRecord } from '../types';
import './FieldLogPage.css';

interface FieldLogPageProps {
  onBack: () => void;
  onScan: () => void;
}

export const FieldLogPage: React.FC<FieldLogPageProps> = ({ onBack, onScan }) => {
  const [records, setRecords] = useState<DiagnosisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setIsLoading(true);
    const data = await getAllDiagnoses();
    setRecords(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: number) => {
    await deleteDiagnosis(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  // Stats
  const totalScans = records.length;
  const diseased = records.filter(r => r.diseaseLabel !== 'Healthy').length;
  const crops = [...new Set(records.map(r => r.cropName))].length;

  return (
    <div className="field-log-page">
      <div className="field-log-page__header">
        <button className="field-log-page__back" onClick={onBack}>← Back</button>
        <h1 className="field-log-page__title">Field Log</h1>
        <div style={{ width: 60 }} />
      </div>

      {/* Stats bar */}
      {records.length > 0 && (
        <div className="field-log-page__stats">
          <div className="field-log-page__stat">
            <span className="field-log-page__stat-val">{totalScans}</span>
            <span className="field-log-page__stat-label">Scans</span>
          </div>
          <div className="field-log-page__stat-divider" />
          <div className="field-log-page__stat">
            <span className="field-log-page__stat-val">{diseased}</span>
            <span className="field-log-page__stat-label">Diseases</span>
          </div>
          <div className="field-log-page__stat-divider" />
          <div className="field-log-page__stat">
            <span className="field-log-page__stat-val">{crops}</span>
            <span className="field-log-page__stat-label">Crops</span>
          </div>
        </div>
      )}

      {/* Records list */}
      <div className="field-log-page__list">
        {isLoading && (
          <div className="field-log-page__empty">
            <div className="field-log-page__spinner" />
          </div>
        )}

        {!isLoading && records.length === 0 && (
          <div className="field-log-page__empty">
            <div className="field-log-page__empty-icon">📋</div>
            <p className="field-log-page__empty-title">No scans yet</p>
            <p className="field-log-page__empty-text">
              Scan a leaf to start building your field history
            </p>
            <button className="btn-primary" onClick={onScan}>
              📷 Scan First Leaf
            </button>
          </div>
        )}

        {!isLoading && records.map(record => (
          <FieldLogItem
            key={record.id}
            record={record}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
};
