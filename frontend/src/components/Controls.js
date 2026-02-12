import React from "react";

export default function Controls({
  threshold,
  onThresholdChange,
  onStartCamera,
  onStopCamera,
  streaming,
  modelReady
}) {
  return (
    <div className="controls-panel glass-card">
      <label className="tiny-control">
        Match threshold: {threshold.toFixed(2)}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={threshold}
          onChange={(event) => onThresholdChange(Number(event.target.value))}
        />
      </label>
      <div className="controls">
        <button onClick={onStartCamera} disabled={streaming || !modelReady}>
          {streaming ? "Camera Running" : "Start Camera"}
        </button>
        <button onClick={onStopCamera} disabled={!streaming} className="danger-lite">
          Stop Camera
        </button>
      </div>
    </div>
  );
}
