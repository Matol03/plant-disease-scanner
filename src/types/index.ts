export interface Disease {
  name: string;
  crop: string;
  cause: string;
  description: string;
  treatments: Treatment[];
}

export interface Treatment {
  step: string;
  cost: 'low' | 'medium' | 'high';
  timeframe: string;
}

export interface Prediction {
  diseaseLabel: string;
  confidence: number;
  disease: Disease;
}

export interface AgentResult {
  predictions: Prediction[];
  reasoning: string;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  urgency: 'monitor' | 'treat_soon' | 'treat_immediately';
  additionalAdvice: string;
}

export interface DiagnosisRecord {
  id?: number;
  imageBlob: Blob;
  diseaseLabel: string;
  confidence: number;
  timestamp: number;
  gps?: { lat: number; lng: number };
  cropName: string;
  reasoning?: string;
  severity?: string;
  urgency?: string;
}

export type AppState = 'setup' | 'home' | 'camera' | 'processing' | 'result' | 'log' | 'error';
