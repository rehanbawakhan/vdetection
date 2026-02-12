import React, { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "../api";
import SettingsPanel from "../components/SettingsPanel";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { verifyPin, logout, pinVerified, username, token } = useAuth();
  const [pin, setPin] = useState("");
  const [pinStatus, setPinStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ threshold: 0.55, sound: true, popup: true });

  useEffect(() => {
    apiGet("/api/settings", token)
      .then((result) => {
        if (!result?.data) return;
        setSettings({
          threshold: Number(result.data.threshold ?? 0.55),
          sound: Boolean(result.data.sound),
          popup: Boolean(result.data.popup)
        });
      })
      .catch(() => { });
  }, [token]);

  const savePrefs = async () => {
    setSaving(true);
    setSaveStatus("");
    try {
      await apiPost("/api/settings", settings, token);
      await apiPost("/api/config", settings, token);
      setSaveStatus("Settings saved");
      if (settings.popup && Notification.permission !== "granted") {
        Notification.requestPermission();
      }
    } catch (err) {
      setSaveStatus(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all detection history?")) return;
    await apiDelete("/api/history", token);
    setSaveStatus("History cleared");
  };

  return (
    <section className="two-col">
      <SettingsPanel
        settings={settings}
        onChange={setSettings}
        onSave={savePrefs}
        onClearHistory={clearHistory}
        isSaving={saving}
      />

      <div className="glass-card form-card">
        <h3>Admin Panel Lock</h3>
        <p>User: {username}</p>
        <p>PIN status: {pinVerified ? "Verified" : "Not verified"}</p>
        <input
          type="password"
          placeholder="Enter PIN"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        <button
          onClick={async () => {
            try {
              await verifyPin(pin);
              setPinStatus("PIN verified");
            } catch (err) {
              setPinStatus(err.message || "Invalid PIN");
            }
          }}
        >
          Verify PIN
        </button>
        <small>{pinStatus}</small>
        <small>{saveStatus}</small>
        <button className="danger-lite" onClick={logout}>Logout</button>
      </div>
    </section>
  );
}
