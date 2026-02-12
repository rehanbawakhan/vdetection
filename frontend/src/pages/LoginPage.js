import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import { useAuth } from "../context/AuthContext";
import { getFaceApi } from "../faceApiClient";

const FACE_LOGIN_DEFAULT_THRESHOLD = 0.62;
const FACE_LOGIN_MIN_THRESHOLD = 0.35;
const FACE_LOGIN_MAX_THRESHOLD = 0.9;

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export default function LoginPage() {
  const { login, faceLogin } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [status, setStatus] = useState("Use credentials or face login");
  const [faceMode, setFaceMode] = useState(false);
  const videoRef = useRef(null);
  const nav = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      nav("/");
    } catch (err) {
      setStatus(err.message || "Invalid credentials");
    }
  };

  const startFaceLogin = async () => {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (!window.isSecureContext && !isLocalHost) {
      setStatus("Camera needs HTTPS (or localhost)");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera API not available in this browser");
      return;
    }

    const faceapi = getFaceApi();
    if (!faceapi) {
      setStatus("face-api.js not loaded yet");
      return;
    }

    try {
      setFaceMode(true);
      setStatus("Loading models...");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models")
      ]);

      setStatus("Requesting camera permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoRef.current.srcObject = stream;
      setStatus("Scanning for Admin face...");
      await new Promise((resolve) => setTimeout(resolve, 600));
      const res = await apiGet("/api/public-faces");
      const admin = (res.data || []).find((f) => f.name.toLowerCase() === "admin");
      if (!admin) {
        setStatus("No Admin face found in library");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const savedThreshold = Number(localStorage.getItem("faceLoginThreshold"));
      const threshold = Number.isFinite(savedThreshold)
        && savedThreshold >= FACE_LOGIN_MIN_THRESHOLD
        && savedThreshold <= FACE_LOGIN_MAX_THRESHOLD
        ? savedThreshold
        : FACE_LOGIN_DEFAULT_THRESHOLD;

      let bestDistance = Infinity;
      for (let i = 0; i < 12; i += 1) {
        const det = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (det) {
          const d = distance(Array.from(det.descriptor), JSON.parse(admin.encoding));
          if (d < bestDistance) bestDistance = d;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;

      if (!Number.isFinite(bestDistance)) {
        setStatus("No face detected");
        return;
      }

      if (bestDistance <= threshold) {
        try {
          // Face match is validated against Admin embedding, so log in as admin directly.
          await faceLogin("admin");
          nav("/");
        } catch (err) {
          setStatus(err.message || "Face matched, but face login request failed");
        }
      } else {
        setStatus(`Face mismatch (${bestDistance.toFixed(3)} > ${threshold.toFixed(3)})`);
      }
    } catch (err) {
      const stream = videoRef.current?.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      if (err?.name === "NotAllowedError") {
        setStatus("Camera permission denied");
      } else if (err?.name === "NotFoundError") {
        setStatus("No camera device found");
      } else if (err?.name === "NotReadableError") {
        setStatus("Camera is busy in another app");
      } else {
        setStatus("Face login setup failed");
      }
    }
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
