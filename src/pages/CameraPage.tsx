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
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingCanvas, setPendingCanvas] = useState<HTMLCanvasElement | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsReady(false);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setIsReady(true);
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Camera permission denied. Use the Upload tab instead.'
        : 'Camera not available. Use the Upload tab instead.';
      setCameraError(msg);
      setMode('upload');
    }
  }, [facingMode]);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [mode, startCamera]);

  // Camera capture
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(canvas, canvas.toDataURL('image/jpeg', 0.9));
  }, [onCapture]);

  // File upload — FIX: use FileReader instead of Image.onload to avoid mobile callback issues
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input immediately so re-selecting same file fires onChange again
    e.target.value = '';
    if (!file) return;

    setIsProcessingFile(true);
    setPreviewUrl(null);
    setPendingCanvas(null);

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const dataUrl = readerEvent.target?.result as string;
      if (!dataUrl) {
        setIsProcessingFile(false);
        return;
      }

      const img = new Image();
      img.onload = () => {
        // Resize to max 1024px keeping aspect ratio
        const MAX = 1024;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);

        // Show preview — user confirms before sending to AI
        setPreviewUrl(jpegUrl);
        setPendingCanvas(canvas);
        setIsProcessingFile(false);
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        alert('Could not load image. Please try another file.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => setIsProcessingFile(false);
    reader.readAsDataURL(file);
  }, []);

  // Confirmed: send to AI
  const handleConfirm = useCallback(() => {
    if (!pendingCanvas || !previewUrl) return;
    onCapture(pendingCanvas, previewUrl);
  }, [pendingCanvas, previewUrl, onCapture]);

  // Discard preview, pick again
  const handleRetake = useCallback(() => {
    setPreviewUrl(null);
    setPendingCanvas(null);
  }, []);

  return (
    <div className="camera-page">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top bar */}
      <div className="camera-page__topbar">
        <button className="camera-page__back" onClick={onBack}>← Back</button>
        <h2 className="camera-page__title">Scan Leaf</h2>
        {mode === 'camera' && !cameraError
          ? <button className="camera-page__flip"
              onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}>🔄</button>
          : <div style={{ width: 44 }} />}
      </div>

      {/* Preview confirmation screen */}
      {previewUrl && (
        <div className="camera-page__preview">
          <p className="camera-page__preview-label">Use this photo?</p>
          <img src={previewUrl} alt="Leaf preview" className="camera-page__preview-img" />
          <div className="camera-page__preview-actions">
            <button className="btn-primary" onClick={handleConfirm}>
              ✓ Analyse This Leaf
            </button>
            <button className="btn-secondary" onClick={handleRetake}>
              ✕ Choose Different Photo
            </button>
          </div>
        </div>
      )}

      {/* Camera viewfinder */}
      {!previewUrl && mode === 'camera' && (
        <div className="camera-page__viewfinder">
          <video ref={videoRef} autoPlay playsInline muted className="camera-page__video" />
          <div className="camera-page__overlay">
            <div className="camera-page__frame">
              <div className="camera-page__corner tl" />
              <div className="camera-page__corner tr" />
              <div className="camera-page__corner bl" />
              <div className="camera-page__corner br" />
            </div>
            <p className="camera-page__guide-text">Centre a leaf within the frame</p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      {!previewUrl && mode === 'upload' && (
        <div className="camera-page__upload-zone">
          <div className="camera-page__upload-inner">
            <div className="camera-page__upload-icon">
              {isProcessingFile ? '⏳' : '🍃'}
            </div>
            <p className="camera-page__upload-title">
              {isProcessingFile ? 'Loading image…' : 'Choose a Leaf Photo'}
            </p>
            <p className="camera-page__upload-hint">
              Select a clear photo of a single crop leaf
            </p>
            {cameraError && (
              <p className="camera-page__upload-error">{cameraError}</p>
            )}
            <button
              className="btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
            >
              {isProcessingFile ? 'Loading…' : '📁 Browse Photos'}
            </button>
          </div>
          {/* Input always in DOM, never conditionally rendered */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture={undefined}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Bottom controls — hidden during preview */}
      {!previewUrl && (
        <>
          <div className="camera-page__controls">
            <button
              className={`camera-page__mode-btn ${mode === 'upload' ? 'active' : ''}`}
              onClick={() => setMode('upload')}
            >
              📁<span>Upload</span>
            </button>
            {mode === 'camera' && (
              <CaptureButton onClick={handleCapture} disabled={!isReady} />
            )}
            <button
              className={`camera-page__mode-btn ${mode === 'camera' ? 'active' : ''}`}
              onClick={() => setMode('camera')}
            >
              📷<span>Camera</span>
            </button>
          </div>
          <div className="camera-page__tips">
            <p>💡 Tips: Good light · One leaf · Focus close</p>
          </div>
        </>
      )}
    </div>
  );
};
