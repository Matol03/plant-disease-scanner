import React from 'react';
import './CaptureButton.css';

interface CaptureButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({ onClick, disabled }) => {
  return (
    <button
      className="capture-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label="Capture photo"
    >
      <span className="capture-btn__ring" />
      <span className="capture-btn__inner" />
    </button>
  );
};
