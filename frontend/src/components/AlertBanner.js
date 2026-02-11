import React from "react";

export default function AlertBanner({ alert }) {
  if (!alert) return null;
  return (
    <div className="alert-banner pulse-red">
      <strong>Threat detected:</strong> {alert.name} ({Math.round((1 - alert.distance) * 100)}% match)
    </div>
  );
}
