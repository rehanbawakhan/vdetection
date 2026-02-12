import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { verifyPin, logout, pinVerified, username } = useAuth();
  const [pin, setPin] = useState("");
  const [sound, setSound] = useState(localStorage.getItem("alert_sound") !== "false");
  const [popup, setPopup] = useState(localStorage.getItem("alert_popup") !== "false");
  const [pinStatus, setPinStatus] = useState("");

  const savePrefs = () => {
    localStorage.setItem("alert_sound", String(sound));
    localStorage.setItem("alert_popup", String(popup));
    if (popup && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  };

  return (
    <section className="two-col">
      <div className="glass-card form-card">
        <h2>Settings</h2>
        <label>
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
          Sound alert
        </label>
        <label>
          <input type="checkbox" checked={popup} onChange={(e) => setPopup(e.target.checked)} />
          Popup notification
        </label>
        <button onClick={savePrefs}>Save Preferences</button>
      </div>

      <div className="glass-card form-card">
        <h3>Admin Panel Lock</h3>
        <p>User: {username}</p>
        <p>PIN status: {pinVerified ? "Verified" : "Not verified"}</p>
        <input
          type="password"
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <button
          onClick={async () => {
            console.log("Verifying PIN:", pin);
            try {
              await verifyPin(pin);
              setPinStatus("PIN verified");
            } catch (err) {
              console.error("PIN Error:", err);
              if (err.message && (err.message.includes("Invalid token") || err.message.includes("jwt expired"))) {
                logout();
              } else {
                setPinStatus(err.message || "Invalid PIN");
              }
            }
          }}
        >
          Verify PIN
        </button>
        <small>{pinStatus}</small>
        <button className="danger-lite" onClick={logout}>Logout</button>
      </div>
    </section>
  );
}
