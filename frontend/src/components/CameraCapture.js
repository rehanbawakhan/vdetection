import React, { useEffect, useMemo, useRef, useState } from "react";
import { getFaceApi } from "../faceApiClient";

const MODEL_URL = "/models";

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
    }, 170);
}

function captureImageFromVideo(video) {
    if (!video || !video.videoWidth) return "";
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 140;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
}

export default function CameraCapture({
    knownFaces,
    threshold,
    alertPrefs,
    onAlert,
    onRecognized
}) {
    const [faceapi, setFaceapi] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const loopRef = useRef(null);
    const lastAlertRef = useRef({ name: "", ts: 0 });
    const lastRecognizedRef = useRef({ name: "", ts: 0 });
    const lastUnknownAlertRef = useRef(0);

    const [streaming, setStreaming] = useState(false);
    const [modelsReady, setModelsReady] = useState(false);
    const [status, setStatus] = useState("Idle");

    const descriptorBank = useMemo(
        () =>
            knownFaces
                .filter((f) => f.encoding)
                .map((f) => ({ ...f, vector: JSON.parse(f.encoding) })),
        [knownFaces]
    );

    useEffect(() => {
        let mounted = true;
        const waitForFaceApi = async () => {
            for (let i = 0; i < 40; i += 1) {
                const api = getFaceApi();
                if (api) {
                    if (mounted) setFaceapi(api);
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            setStatus("face-api.js failed to load");
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
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            setModelsReady(true);
            setStatus("Models loaded");
        }

        loadModels().catch(() => setStatus("Model load failed (add /public/models)"));
    }, [faceapi]);

    const sendBrowserNotice = (name) => {
        if (!alertPrefs.popup) return;
        if (Notification.permission === "granted") {
            new Notification("Wanted Person Detected", {
                body: `${name} matched on camera stream`
            });
            return;
        }
        if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    };

    const drawOverlay = (box, label) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!box) return;
        ctx.strokeStyle = "#00f5ff";
        ctx.shadowColor = "#00f5ff";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        ctx.font = "14px monospace";
        ctx.fillStyle = "#00f5ff";
        ctx.fillText(label, box.x, Math.max(18, box.y - 8));
    };

    const detectLoop = async () => {
        const video = videoRef.current;
        if (!video || video.readyState !== 4 || !modelsReady) {
            loopRef.current = requestAnimationFrame(detectLoop);
            return;
        }

        const detection = await faceapi
            .detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            drawOverlay(null, "");
            setStatus("No face detected");
            loopRef.current = requestAnimationFrame(detectLoop);
            return;
        }

        const descriptor = Array.from(detection.descriptor);
        let best = { name: "Unknown", distance: 1, is_wanted: false };

        for (const face of descriptorBank) {
            const distance = euclideanDistance(descriptor, face.vector);
            if (distance < best.distance) {
                best = {
                    name: face.name,
                    distance,
                    is_wanted: !!face.is_wanted,
                    id: face.id
                };
            }
        }

        const matched = best.distance <= threshold;
        const label = matched
            ? `${best.name} ${Math.round((1 - best.distance) * 100)}%`
            : "Unknown";

        drawOverlay(detection.detection.box, label);
        const resolvedName = matched ? best.name : "Unknown";
        const now = Date.now();
        if (
            lastRecognizedRef.current.name !== resolvedName ||
            now - lastRecognizedRef.current.ts > 5000
        ) {
            lastRecognizedRef.current = { name: resolvedName, ts: now };
            onRecognized({
                name: resolvedName,
                image: captureImageFromVideo(videoRef.current),
                distance: best.distance
            });
        }

        setStatus(matched ? `Matched: ${best.name}` : "Scanning...");

        if (matched && best.is_wanted) {
            if (lastAlertRef.current.name !== best.name || now - lastAlertRef.current.ts > 8000) {
                lastAlertRef.current = { name: best.name, ts: now };
                if (alertPrefs.sound) beep();
                sendBrowserNotice(best.name);
                const capturedImage = captureImageFromVideo(videoRef.current);
                onAlert({
                    name: best.name,
                    distance: best.distance,
                    alert_type: "wanted_match",
                    image: capturedImage
                });
            }
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
            setStatus("Requesting camera permission...");
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 960, height: 540 },
                audio: false
            });

            videoRef.current.srcObject = stream;
            setStreaming(true);
            setStatus(modelsReady ? "Camera active" : "Camera active (loading AI models...)");
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
        }
    };

    const stopCamera = () => {
        if (loopRef.current) cancelAnimationFrame(loopRef.current);
        const stream = videoRef.current?.srcObject;
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            videoRef.current.srcObject = null;
        }
        setStreaming(false);
        setStatus("Camera stopped");
        drawOverlay(null, "");
    };

    useEffect(() => () => stopCamera(), []);

    return (
        <div className="camera-shell glass-card">
            <div className="status-row">
                <span className="dot" /> {status}
            </div>
            <div className="video-wrap radar">
                <video ref={videoRef} autoPlay muted playsInline className="video" />
                <canvas ref={canvasRef} className="overlay" />
            </div>
            <div className="controls">
                <button onClick={startCamera} disabled={streaming}>Start Camera</button>
                <button onClick={stopCamera} disabled={!streaming} className="danger-lite">Stop Camera</button>
            </div>
        </div>
    );
}
