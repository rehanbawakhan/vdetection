import React, { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import { useAuth } from "../context/AuthContext";
import { getFaceApi } from "../faceApiClient";

export default function LibraryPage({ faces, setFaces }) {
  const { token, logout } = useAuth();
  const [form, setForm] = useState({ name: "", image_url: "", encoding: "[]" });
  const [filters, setFilters] = useState({ name: "", wantedOnly: false });
  const [extractStatus, setExtractStatus] = useState("No image selected");

  useEffect(() => {
    apiGet("/api/known-faces", token)
      .then((res) => setFaces(res.data || []))
      .catch((err) => {
        if (err.message && (err.message.includes("Invalid token") || err.message.includes("jwt expired"))) {
          logout();
        }
      });
  }, [token, setFaces, logout]);

  const filteredFaces = useMemo(() => {
    return faces.filter((f) => {
      const byName = f.name.toLowerCase().includes(filters.name.toLowerCase());
      const byWanted = filters.wantedOnly ? f.is_wanted : true;
      return byName && byWanted;
    });
  }, [faces, filters]);

  const addFace = async (e) => {
    e.preventDefault();
    try {
      await apiPost("/api/known-faces", form, token);
      const res = await apiGet("/api/known-faces", token);
      setFaces(res.data || []);
      setForm({ name: "", image_url: "", encoding: "[]" });
    } catch (err) {
      if (err.message && (err.message.includes("Invalid token") || err.message.includes("jwt expired"))) {
        logout();
      } else {
        alert(err.message || "Failed to add face");
      }
    }
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const extractEncodingFromFile = async (file) => {
    const faceapi = getFaceApi();
    if (!faceapi) {
      setExtractStatus("face-api.js not loaded yet");
      return;
    }
    setExtractStatus("Loading models...");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models")
    ]);

    const dataUrl = await fileToDataUrl(file);
    const img = await faceapi.fetchImage(dataUrl);
    const result = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (!result) {
      setExtractStatus("No face found in image");
      return;
    }

    setForm((prev) => ({
      ...prev,
      image_url: dataUrl,
      encoding: JSON.stringify(Array.from(result.descriptor))
    }));
    setExtractStatus("Encoding extracted");
  };

  const toggleWanted = async (id, is_wanted) => {
    try {
      await apiPut(`/api/known-faces/${id}`, { is_wanted: !is_wanted }, token);
      const res = await apiGet("/api/known-faces", token);
      setFaces(res.data || []);
    } catch (err) {
      if (err.message && (err.message.includes("Invalid token") || err.message.includes("jwt expired"))) {
        logout();
      } else {
        alert(err.message || "Failed to update face");
      }
    }
  };

  const removeFace = async (id) => {
    try {
      await apiDelete(`/api/known-faces/${id}`, token);
      setFaces(faces.filter((f) => f.id !== id));
    } catch (err) {
      if (err.message && (err.message.includes("Invalid token") || err.message.includes("jwt expired"))) {
        logout();
      } else {
        alert(err.message || "Failed to delete face");
      }
    }
  };

  return (
    <section>
      <h2>Face Library</h2>
      <div className="two-col">
        <form className="glass-card form-card" onSubmit={addFace}>
          <h3>Upload New Face</h3>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <textarea
            placeholder="Image URL or base64"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            required
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) extractEncodingFromFile(file).catch(() => setExtractStatus("Failed to extract"));
            }}
          />
          <small>{extractStatus}</small>
          <textarea
            placeholder="Encoding array JSON: [0.12, ...]"
            value={form.encoding}
            onChange={(e) => setForm({ ...form, encoding: e.target.value })}
            required
          />
          <button type="submit">Add Face</button>
        </form>

        <div className="glass-card list-card">
          <div className="top-row">
            <h3>Stored Faces</h3>
            <div className="inline-filters">
              <input
                placeholder="Filter by name"
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              />
              <label>
                <input
                  type="checkbox"
                  checked={filters.wantedOnly}
                  onChange={(e) => setFilters({ ...filters, wantedOnly: e.target.checked })}
                />
                Wanted only
              </label>
            </div>
          </div>
          <div className="table-wrap">
            {filteredFaces.map((f) => (
              <div key={f.id} className="face-row">
                <div>
                  <strong>{f.name}</strong>
                  <small>id #{f.id}</small>
                </div>
                <div className="row-actions">
                  <button onClick={() => toggleWanted(f.id, f.is_wanted)}>
                    {f.is_wanted ? "Remove from Wanted" : "Add to Wanted"}
                  </button>
                  <button className="danger-lite" onClick={() => removeFace(f.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
