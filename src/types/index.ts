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

export interface DiagnosisRecord {
  id?: number;
  imageBlob: Blob;
  diseaseLabel: string;
  confidence: number;
  timestamp: number;
  gps?: { lat: number; lng: number };
  cropName: string;
}

export type AppState = 'home' | 'camera' | 'processing' | 'result' | 'log';
