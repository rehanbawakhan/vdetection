import React, { useEffect, useState } from "react";
import CameraFeed from "../components/CameraFeed";
import AlertBanner from "../components/AlertBanner";
import HistoryList from "../components/HistoryList";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../context/AuthContext";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function DashboardPage({ faces, setFaces, history, refreshHistory }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeAlert, setActiveAlert] = useState(null);
  const [settings, setSettings] = useState({ threshold: 0.55, sound: true, popup: true });
  const [toasts, setToasts] = useState([]);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [faceRes, settingsRes] = await Promise.all([
          apiGet("/api/known-faces", token),
          apiGet("/api/settings", token).catch(() => ({ data: null }))
        ]);
        setFaces(faceRes.data || []);
        if (settingsRes.data) {
          setSettings({
            threshold: Number(settingsRes.data.threshold ?? 0.55),
            sound: Boolean(settingsRes.data.sound),
            popup: Boolean(settingsRes.data.popup)
          });
        }
        setSettingsReady(true);
        await refreshHistory();
      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, setFaces, refreshHistory]);

  useEffect(() => {
    if (!settingsReady) return;
    const timeoutId = window.setTimeout(() => {
      apiPost("/api/config", settings, token).catch(() => { });
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [settings, token, settingsReady]);

  useEffect(() => {
    async function setupPush() {
      if (!settings.popup) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission === "denied") return;

      const keyRes = await apiGet("/api/push-key", token).catch(() => ({ publicKey: null }));
      if (!keyRes.publicKey) return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const converted = urlBase64ToUint8Array(keyRes.publicKey);
        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: converted
        });
        await apiPost("/api/subscribe", { subscription: newSub }, token);
      }
    }

    setupPush().catch(() => { });
  }, [token, settings.popup]);

  const pushToast = (message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  };

  const handleAlert = async (alert) => {
    setActiveAlert(alert);
    await apiPost("/api/alert", alert, token).catch(() => { });
    await refreshHistory();
  };

  const handleRecognized = async (entry) => {
    if (!entry || !entry.name || entry.name === "Unknown") return;
    await apiPost(
      "/api/history",
      { name: entry.name, image: entry.image, confidence: entry.confidence, timestamp: entry.timestamp },
      token
    ).catch(() => { });
    await refreshHistory();
  };

  if (loading) {
    return (
      <div className="centered">
        <div className="loading-bar" />
        <p>Initializing AI surveillance stream...</p>
      </div>
    );
  }

  return (
    <section>
      <div className="top-row">
        <h2>Live Dashboard</h2>
      </div>

      <div className="stat-strip">
        <div className="glass-card stat-card">
          <strong>{faces.length}</strong>
          <small>Known Faces</small>
        </div>
        <div className="glass-card stat-card">
          <strong>{faces.filter((face) => face.is_wanted).length}</strong>
          <small>Wanted Profiles</small>
        </div>
        <div className="glass-card stat-card">
          <strong>{history.length}</strong>
          <small>History Entries</small>
        </div>
      </div>

      <AlertBanner alert={activeAlert} />
      <CameraFeed
        knownFaces={faces}
        settings={settings}
        onSettingsChange={setSettings}
        onAlert={handleAlert}
        onRecognized={handleRecognized}
        onToast={pushToast}
      />

      <div className="glass-card list-card history-panel">
        <h3>Recent Detections</h3>
        <HistoryList history={history.slice(0, 10)} />
      </div>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-card">{toast.message}</div>
        ))}
      </div>
    </section>
  );
}
