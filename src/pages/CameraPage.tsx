import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CaptureButton } from '../components/CaptureButton';
import './CameraPage.css';

interface CameraPageProps {
  onCapture: (canvas: HTMLCanvasElement, imageUrl: string) => void;
  onBack: () => void;
}

export const CameraPage: React.FC<CameraPageProps> = ({ onCapture, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsReady(false);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsReady(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access or upload a photo instead.');
      } else {
        setCameraError('Camera not available. Use the upload option below.');
      }
      setMode('upload');
    }
  }, [facingMode]);

  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [mode, startCamera]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(canvas, imageUrl);
  }, [onCapture]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      onCapture(canvas, canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = url;
  }, [onCapture]);

  return (
    <div className="camera-page">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top bar */}
      <div className="camera-page__topbar">
        <button className="camera-page__back" onClick={onBack}>← Back</button>
        <h2 className="camera-page__title">Scan Leaf</h2>
        {mode === 'camera' && !cameraError && (
          <button
            className="camera-page__flip"
            onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
          >
            🔄
          </button>
        )}
      </div>

      {/* Viewfinder */}
      {mode === 'camera' && (
        <div className="camera-page__viewfinder">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-page__video"
          />
          {/* Crop guide overlay */}
          <div className="camera-page__overlay">
            <div className="camera-page__frame">
              <div className="camera-page__corner tl" />
              <div className="camera-page__corner tr" />
              <div className="camera-page__corner bl" />
              <div className="camera-page__corner br" />
            </div>
            <p className="camera-page__guide-text">
              Centre a leaf within the frame
            </p>
          </div>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="camera-page__upload-zone">
          <div className="camera-page__upload-inner">
            <div className="camera-page__upload-icon">🍃</div>
            <p className="camera-page__upload-title">Choose a Leaf Photo</p>
            <p className="camera-page__upload-hint">
              Select a clear photo of a single crop leaf
            </p>
            {cameraError && (
              <p className="camera-page__upload-error">{cameraError}</p>
            )}
            <button
              className="btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Browse Photos
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Bottom controls */}
      <div className="camera-page__controls">
        <button
          className={`camera-page__mode-btn ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => setMode('upload')}
        >
          📁
          <span>Upload</span>
        </button>

        {mode === 'camera' && (
          <CaptureButton onClick={handleCapture} disabled={!isReady} />
        )}

        <button
          className={`camera-page__mode-btn ${mode === 'camera' ? 'active' : ''}`}
          onClick={() => setMode('camera')}
        >
          📷
          <span>Camera</span>
        </button>
      </div>

      {/* Tips */}
      <div className="camera-page__tips">
        <p>💡 Tips: Good light · One leaf · Focus close</p>
      </div>
    </div>
  );
};
