import React from "react";

export default function AlertBanner({ alert }) {
  if (!alert) return null;
  const type = alert.alert_type || alert.detection_status || "";
  const isThreat = type === "wanted_match";
  const confidence = alert.confidence !== undefined
    ? alert.confidence
    : alert.distance !== undefined
      ? 1 - alert.distance
      : 0;

  const title = isThreat ? "Threat detected:" : "Known person detected:";
  const bannerClass = `alert-banner ${isThreat ? "pulse-red" : "info-banner"}`;
  return (
    <div className={bannerClass}>
      <strong>{title}</strong> {alert.name} ({Math.round(confidence * 100)}% match)
    </div>
  );
}
