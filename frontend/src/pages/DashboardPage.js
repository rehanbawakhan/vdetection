import React, { useEffect, useMemo, useState } from "react";
import CameraCapture from "../components/CameraCapture";
import AlertBanner from "../components/AlertBanner";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../context/AuthContext";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function DashboardPage({ faces, setFaces, history, setHistory }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeAlert, setActiveAlert] = useState(null);
  const [threshold, setThreshold] = useState(Number(localStorage.getItem("threshold") || 0.55));
  const [historyName, setHistoryName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const alertPrefs = useMemo(
    () => ({
      sound: localStorage.getItem("alert_sound") !== "false",
      popup: localStorage.getItem("alert_popup") !== "false"
    }),
    [activeAlert]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [faceRes, historyRes] = await Promise.all([
        apiGet("/api/known-faces", token),
        apiGet("/api/history", token)
      ]);
      setFaces(faceRes.data || []);
      setHistory(historyRes.data || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [token, setFaces, setHistory]);

  useEffect(() => {
    async function setupPush() {
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

    setupPush().catch(() => {});
  }, [token]);

  const handleAlert = async (alert) => {
    setActiveAlert(alert);
    await apiPost("/api/alert", alert, token).catch(() => {});
    const historyRes = await apiGet("/api/history", token).catch(() => ({ data: [] }));
    setHistory(historyRes.data || []);
  };

  const handleRecognized = async (entry) => {
    if (!entry || !entry.name || entry.name === "Unknown") return;
    await apiPost("/api/history", { name: entry.name, image: entry.image }, token).catch(() => {});
    const historyRes = await apiGet("/api/history", token).catch(() => ({ data: [] }));
    setHistory(historyRes.data || []);
  };

  const applyHistoryFilter = async () => {
    const q = new URLSearchParams();
    if (historyName) q.set("name", historyName);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const res = await apiGet(`/api/history${q.toString() ? `?${q.toString()}` : ""}`, token);
    setHistory(res.data || []);
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
        <label className="tiny-control">
          Match threshold: {threshold.toFixed(2)}
          <input
            type="range"
            min="0.35"
            max="0.8"
            step="0.01"
            value={threshold}
            onChange={(e) => {
              const val = Number(e.target.value);
              setThreshold(val);
              localStorage.setItem("threshold", String(val));
            }}
          />
        </label>
      </div>
      <div className="stat-strip">
        <div className="glass-card stat-card">
          <strong>{faces.length}</strong>
          <small>Known Faces</small>
        </div>
        <div className="glass-card stat-card">
          <strong>{faces.filter((f) => f.is_wanted).length}</strong>
          <small>Wanted Profiles</small>
        </div>
        <div className="glass-card stat-card">
          <strong>{history.length}</strong>
          <small>History Entries</small>
        </div>
      </div>

      <AlertBanner alert={activeAlert} />
      <CameraCapture
        knownFaces={faces}
        threshold={threshold}
        alertPrefs={alertPrefs}
        onAlert={handleAlert}
        onRecognized={handleRecognized}
      />

      <div className="glass-card filter-panel">
        <h3>History Filter</h3>
        <div className="inline-filters">
          <input placeholder="Name" value={historyName} onChange={(e) => setHistoryName(e.target.value)} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button onClick={applyHistoryFilter}>Apply</button>
          <button onClick={() => apiGet("/api/history", token).then((r) => setHistory(r.data || []))}>Reset</button>
        </div>
      </div>
    </section>
  );
}
