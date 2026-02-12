import React, { useEffect, useMemo, useRef, useState } from "react";
import { getFaceApi } from "../faceApiClient";
import Controls from "./Controls";
import DetectionOverlay from "./DetectionOverlay";

const MODEL_URL = "/models";

// Euclidean distance for two embedding vectors:
// d(a, b) = sqrt(sum((a_i - b_i)^2))
// Lower distance means descriptors are closer; match when d <= threshold.
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function beep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.08;
  osc.start();
  setTimeout(() => {
    osc.stop();
    ctx.close();
  }, 180);
}

function captureImageFromVideo(video) {
  if (!video || !video.videoWidth) return "";
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export default function CameraFeed({
  knownFaces,
  settings,
  onSettingsChange,
  onAlert,
  onRecognized,
  onToast
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const loopRef = useRef(null);
  const initTickRef = useRef(null);
  const lastRecognizedRef = useRef({ name: "", ts: 0 });
  const lastAlertRef = useRef({ name: "", ts: 0 });
  const lastUnknownAlertRef = useRef(0);

  const [status, setStatus] = useState("Idle");
  const [faceapi, setFaceapi] = useState(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [guidance, setGuidance] = useState("Center your face");
  const [detectionState, setDetectionState] = useState(null);

  const descriptorBank = useMemo(
    () =>
      knownFaces
        .filter((face) => face.encoding)
        .map((face) => ({ ...face, vector: JSON.parse(face.encoding) })),
    [knownFaces]
  );

  useEffect(() => {
    let mounted = true;
    const waitForFaceApi = async () => {
      for (let i = 0; i < 60; i += 1) {
        const api = getFaceApi();
        if (api) {
          if (mounted) setFaceapi(api);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (mounted) setStatus("face-api.js failed to load");
    };

    waitForFaceApi();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!faceapi) return;

    async function loadModels() {
      setStatus("Loading models...");
      setInitProgress(10);
      // SSD MobileNet V1 is used instead of tiny detector for better face localization accuracy.
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      setInitProgress(45);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      setInitProgress(72);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      setInitProgress(100);
      setModelsReady(true);
      setStatus("AI models loaded - ready");
    }

    loadModels().catch(() => setStatus("Model load failed. Verify /public/models."));
  }, [faceapi]);

  const sendBrowserNotice = (name, confidence) => {
    if (!settings.popup) return;
    if (Notification.permission === "granted") {
      new Notification("Match found", {
        body: `${name} (${Math.round(confidence * 100)}%)`
      });
      return;
    }
    if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const drawOverlay = (box, label, color, isMatch) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 960;
    canvas.height = video.videoHeight || 540;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!box) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = isMatch ? 4 : 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = isMatch ? 20 : 12;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.font = "15px monospace";
    ctx.fillStyle = color;
    ctx.fillText(label, box.x, Math.max(18, box.y - 10));
  };

  const detectLoop = async () => {
    const video = videoRef.current;
    if (!video || video.readyState !== 4 || !modelsReady) {
      loopRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const minConfidence = Math.max(0.15, Math.min(1, settings.threshold));
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections.length) {
      drawOverlay(null, "", "#6b7280", false);
      setGuidance("Center your face");
      setDetectionState(null);
      setStatus("No face detected");
      loopRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const face = detections[0];
    const descriptor = Array.from(face.descriptor);

    let best = { name: "Unknown", distance: 1, is_wanted: false };
    for (const knownFace of descriptorBank) {
      const distance = euclideanDistance(descriptor, knownFace.vector);
      if (distance < best.distance) {
        best = {
          name: knownFace.name,
          distance,
          is_wanted: Boolean(knownFace.is_wanted),
          id: knownFace.id
        };
      }
    }

    const confidence = Math.max(0, 1 - best.distance);
    const matched = best.distance <= settings.threshold;
    const detectionConfidence = face.detection.score || 0;
    const box = face.detection.box;
    const centerX = box.x + box.width / 2;
    const frameCenterX = (video.videoWidth || 960) / 2;
    const centered = Math.abs(centerX - frameCenterX) < (video.videoWidth || 960) * 0.12;
    const guidanceText = centered ? "Hold still" : "Center your face";
    const overlayColor = matched
      ? (best.is_wanted ? "#ff3b4f" : "#00f5ff")
      : centered ? "#00f5ff" : "#f59e0b";

    setGuidance(guidanceText);

    const label = matched
      ? `${best.name} ${Math.round(confidence * 100)}%`
      : `Unknown ${Math.round(detectionConfidence * 100)}%`;
    drawOverlay(box, label, overlayColor, matched);

    const detectionPayload = {
      matched,
      name: matched ? best.name : "Unknown",
      is_wanted: matched ? best.is_wanted : false,
      confidence: matched ? confidence : detectionConfidence,
      timestamp: new Date().toISOString()
    };
    setDetectionState(detectionPayload);
    setStatus(
      matched
        ? (best.is_wanted ? `Threat match: ${best.name}` : `Known match: ${best.name}`)
        : "Unknown face"
    );

    const now = Date.now();
    const capturedImage = captureImageFromVideo(videoRef.current);

    if (matched) {
      if (
        lastRecognizedRef.current.name !== best.name ||
        now - lastRecognizedRef.current.ts > 5000
      ) {
        lastRecognizedRef.current = { name: best.name, ts: now };
        onRecognized({
          name: best.name,
          image: capturedImage,
          distance: best.distance,
          confidence,
          timestamp: detectionPayload.timestamp
        });
      }

      if (best.is_wanted && (lastAlertRef.current.name !== best.name || now - lastAlertRef.current.ts > 8000)) {
        lastAlertRef.current = { name: best.name, ts: now };
        if (settings.sound) beep();
        sendBrowserNotice(best.name, confidence);
        onToast(`Threat detected: ${best.name} at ${new Date().toLocaleTimeString()}`);
        onAlert({
          name: best.name,
          confidence,
          detection_status: "wanted_match",
          alert_type: "wanted_match",
          image: capturedImage
        });
      }
    } else if (now - lastUnknownAlertRef.current > 5000) {
      lastUnknownAlertRef.current = now;
      onToast("Unknown face");
    }

    loopRef.current = requestAnimationFrame(detectLoop);
  };

  const startCamera = async () => {
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

    try {
      setInitializing(true);
      setStatus("Initializing camera...");
      setInitProgress(0);
      initTickRef.current = window.setInterval(() => {
        setInitProgress((current) => Math.min(95, current + 8));
      }, 180);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 540 },
        audio: false
      });

      videoRef.current.srcObject = stream;
      setStreaming(true);
      setInitProgress(100);
      setStatus("Camera active");
      loopRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      if (err?.name === "NotAllowedError") {
        setStatus("Camera permission denied");
      } else if (err?.name === "NotFoundError") {
        setStatus("No camera device found");
      } else if (err?.name === "NotReadableError") {
        setStatus("Camera is busy in another app");
      } else {
        setStatus("Failed to start camera");
      }
    } finally {
      if (initTickRef.current) {
        clearInterval(initTickRef.current);
        initTickRef.current = null;
      }
      setTimeout(() => setInitializing(false), 320);
    }
  };

  const stopCamera = () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setStatus("Camera stopped");
    setDetectionState(null);
    drawOverlay(null, "", "#00f5ff", false);
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="camera-shell glass-card">
      <DetectionOverlay detectionState={detectionState} status={status} />
      <div className="status-row">
        <span className="dot" /> {guidance}
      </div>
      <div
        className={`video-wrap radar ${
          detectionState?.matched
            ? (detectionState?.is_wanted ? "alert-border" : "known-border")
            : ""
        } ${
          detectionState && !detectionState.matched ? "unknown-border" : ""
        }`}
      >
        {!modelsReady && (
          <div className="loading-splash">
            <p>Loading AI models...</p>
            <div className="loading-bar" style={{ width: "280px" }}>
              <span style={{ width: `${initProgress}%` }} />
            </div>
          </div>
        )}
        {initializing && (
          <div className="camera-init-overlay">
            <p>Initializing camera...</p>
            <div className="loading-bar" style={{ width: "280px" }}>
              <span style={{ width: `${initProgress}%` }} />
            </div>
          </div>
        )}
        <div className="scan-graphic" />
        <video ref={videoRef} autoPlay muted playsInline className="video" />
        <canvas ref={canvasRef} className="overlay" />
      </div>
      <Controls
        threshold={settings.threshold}
        onThresholdChange={(value) => onSettingsChange({ ...settings, threshold: value })}
        onStartCamera={startCamera}
        onStopCamera={stopCamera}
        streaming={streaming}
        modelReady={modelsReady}
      />
    </div>
  );
}
