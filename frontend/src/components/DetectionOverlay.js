import React from "react";

export default function DetectionOverlay({ detectionState, status }) {
  if (!detectionState) {
    return (
      <div className="status-banner">
        <strong>Status:</strong> {status}
      </div>
    );
  }

  const confidencePercent = Math.round((detectionState.confidence || 0) * 100);
  const ts = detectionState.timestamp ? new Date(detectionState.timestamp).toLocaleTimeString() : "";

  const stateClass = detectionState.matched
    ? (detectionState.is_wanted ? "match" : "known")
    : "unknown";

  return (
    <div className={`status-banner ${stateClass}`}>
      <strong>
        {detectionState.matched
          ? `${detectionState.is_wanted ? "Threat match" : "Known match"}: ${detectionState.name}`
          : "Unknown face"}
      </strong>
      <span>Confidence: {confidencePercent}%</span>
      {ts && <span>{ts}</span>}
    </div>
  );
}
