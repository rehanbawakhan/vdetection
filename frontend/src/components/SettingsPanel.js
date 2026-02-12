import React from "react";

export default function SettingsPanel({
  settings,
  onChange,
  onSave,
  onClearHistory,
  isSaving
}) {
  return (
    <div className="glass-card form-card settings-panel">
      <h2>Detection Settings</h2>
      <label className="tiny-control">
        Match threshold: {settings.threshold.toFixed(2)}
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.threshold}
          onChange={(event) => onChange({ ...settings, threshold: Number(event.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(event) => onChange({ ...settings, sound: event.target.checked })}
        />
        Sound alerts
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.popup}
          onChange={(event) => onChange({ ...settings, popup: event.target.checked })}
        />
        Browser push notifications
      </label>
      <div className="controls">
        <button onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
        <button className="danger-lite" onClick={onClearHistory}>
          Clear History
        </button>
      </div>
    </div>
  );
}
