import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import { useAuth } from "../context/AuthContext";
import { getFaceApi } from "../faceApiClient";

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [status, setStatus] = useState("Use credentials or face login");
  const [faceMode, setFaceMode] = useState(false);
  const videoRef = useRef(null);
  const nav = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    await login(username, password);
    nav("/");
  };

  const startFaceLogin = async () => {
    const faceapi = getFaceApi();
    if (!faceapi) {
      setStatus("face-api.js not loaded yet");
      return;
    }
    setFaceMode(true);
    setStatus("Loading models...");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models")
    ]);

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoRef.current.srcObject = stream;
    setStatus("Scanning for Admin face...");

    setTimeout(async () => {
      const det = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      if (!det) {
        setStatus("No face detected");
        return;
      }

      const res = await apiGet("/api/public-faces");
      const admin = (res.data || []).find((f) => f.name.toLowerCase() === "admin");
      if (!admin) {
        setStatus("No Admin face found in library");
        return;
      }

      const d = distance(Array.from(det.descriptor), JSON.parse(admin.encoding));
      if (d <= Number(localStorage.getItem("threshold") || 0.55)) {
        await login("admin", "admin123");
        nav("/");
      } else {
        setStatus("Face mismatch");
      }
    }, 1800);
  };

  return (
    <section className="centered auth-screen">
      <form className="glass-card form-card" onSubmit={handleLogin}>
        <h2>Secure Login</h2>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit">Sign in</button>
        <button type="button" onClick={startFaceLogin}>Face Login</button>
        <small>{status}</small>
      </form>
      {faceMode && <video className="face-login-video" ref={videoRef} autoPlay muted playsInline />}
    </section>
  );
}
