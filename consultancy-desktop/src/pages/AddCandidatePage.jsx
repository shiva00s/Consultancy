import React, { useState, useRef, useEffect } from "react";
import { FiPlus, FiCamera, FiVideo, FiUpload, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import useAuthStore from "../store/useAuthStore";
import { useShallow } from "zustand/react/shallow";
import AadharQRScanner from "../components/tools/AadharQRScanner";
import PassportScanner from "../components/tools/PassportScanner";
import "../css/AddCandidatePage.css";

/* Convert Blob -> UInt8Array[] */
async function blobToArray(blob) {
  const ab = await blob.arrayBuffer();
  return Array.from(new Uint8Array(ab));
}

export default function AddCandidatePage() {
  const initial = {
    name: "",
    education: "",
    experience: "",
    dob: "",
    passportNo: "",
    passportExpiry: "",
    contact: "",
    aadhar: "",
    status: "New",
    notes: "",
    Position: "",
  };

  const [textData, setTextData] = useState(initial);
  const [files, setFiles] = useState([]);
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamBlob, setWebcamBlob] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const { user } = useAuthStore(useShallow((s) => ({ user: s.user })));
  const [isSaving, setIsSaving] = useState(false);

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setTextData((p) => ({ ...p, [name]: value }));
  };

  /* Aadhaar scan result */
  const handleAadhar = (extracted, fileObject) => {
    if (extracted?.uid) {
      setTextData((p) => ({
        ...p,
        name: extracted.name || p.name,
        aadhar: extracted.uid,
        dob: p.dob || (extracted.yob ? `${extracted.yob}-01-01` : p.dob),
      }));
      if (fileObject) setFiles((p) => [...p, fileObject]);
      toast.success("Aadhaar verified.");
    }
  };

  /* Passport scan result */
  const handlePassport = (data) => {
    if (!data?.passport) return;
    const p = data.passport;
    setTextData((prev) => ({
      ...prev,
      passportNo: p.passportNo || prev.passportNo,
      passportExpiry: p.expiry || prev.passportExpiry,
      dob: prev.dob || p.dob || prev.dob,
    }));

    if (data.fileObject) setFiles((f) => [...f, data.fileObject]);
    else if (data.filePath)
      setFiles((f) => [
        ...f,
        {
          name: data.filePath.split(/[/\\]/).pop(),
          path: data.filePath,
          type: "image/jpeg",
        },
      ]);

    toast.success("Passport scanned.");
  };

  /* Document file uploads */
  const handleDocs = (e) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };
  const removeDoc = (i) => setFiles((p) => p.filter((_, idx) => idx !== i));

  /* Profile Photo – Upload */
  const handleProfileUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setProfileFile(f);
    setProfilePreview(URL.createObjectURL(f));
    setWebcamBlob(null);
  };

  /* Webcam ON/OFF */
  const startWebcam = async () => {
    try {
      setWebcamActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    } catch (e) {
      toast.error("Webcam error.");
      setWebcamActive(false);
    }
  };
  const stopWebcam = () => {
    setWebcamActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  /* Capture webcam */
  const captureWebcam = () => {
    const v = videoRef.current;
    if (!v) return;

    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      setWebcamBlob(blob);
      setProfilePreview(URL.createObjectURL(blob));
      setProfileFile(null);
      stopWebcam();
      toast.success("Captured.");
    }, "image/jpeg");
  };

  /* Save candidate */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const docPayload = await Promise.all(
        files.map(async (f) => {
          if (f.path) {
            return {
              name: f.name,
              type: f.type,
              path: f.path,
              buffer: null,
            };
          } else {
            const arr = await blobToArray(f);
            return { name: f.name, type: f.type, buffer: arr, path: null };
          }
        })
      );

      /* Profile picture payload */
      let profilePayload = null;

      if (webcamBlob) {
        profilePayload = {
          name: "webcam_" + Date.now() + ".jpg",
          type: "image/jpeg",
          buffer: await blobToArray(webcamBlob),
        };
      } else if (profileFile) {
        if (profileFile.path) {
          profilePayload = {
            name: profileFile.name,
            type: profileFile.type,
            path: profileFile.path,
            buffer: null,
          };
        } else {
          profilePayload = {
            name: profileFile.name,
            type: profileFile.type,
            buffer: await blobToArray(profileFile),
          };
        }
      }

      const res = await window.electronAPI.saveCandidateMulti({
        user,
        textData,
        files: docPayload,
        profilePhoto: profilePayload,
      });

      if (res.success) {
        toast.success("Saved successfully.");
        setTextData(initial);
        setFiles([]);
        setProfileFile(null);
        setProfilePreview(null);
        setWebcamBlob(null);
      } else toast.error(res.error || "Error");
    } catch (err) {
      toast.error(err.message);
    }

    setIsSaving(false);
  };

  return (
    <div className="add-candidate-container">

      <h2 className="add-title">Add New Candidate</h2>

      {/* TOP 3-COLUMN ROW */}
      <div className="identity-grid">
        <div className="identity-box"><AadharQRScanner onScanSuccess={handleAadhar} /></div>
        <div className="identity-box"><PassportScanner onScanSuccess={handlePassport} /></div>

        {/* PROFILE PHOTO */}
        <div className="identity-box photo-box">

          <h4 className="section-title"><FiCamera /> Profile Photo</h4>
          <p className="section-desc">Upload or capture profile photo (also saved as document).</p>

          <div className="photo-actions">
            {/* Upload */}
            <label className="btn">
              <FiUpload /> <input type="file" accept="image/*" onChange={handleProfileUpload} hidden />
            </label>

            {/* Webcam button */}
            <button
              type="button"
              className="btn"
              onClick={() => (webcamActive ? stopWebcam() : startWebcam())}
            >
              <FiVideo /> {webcamActive ? "Stop" : "Use Webcam"}
            </button>

            {webcamActive && (
              <button type="button" className="btn primary" onClick={captureWebcam}>
                <FiCamera /> Capture
              </button>
            )}
          </div>

          {/* Video Preview */}
          {webcamActive && (
            <video ref={videoRef} className="webcam-window" />
          )}

          {/* Final Preview */}
          {profilePreview && (
            <div className="photo-preview-wrap">
              <img src={profilePreview} className="photo-preview" />
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  setProfilePreview(null);
                  setProfileFile(null);
                  setWebcamBlob(null);
                }}
              >
                <FiTrash2 /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN 3-COLUMN FORM */}
      <form onSubmit={handleSubmit} className="candidate-form">

        <div className="form-grid">

          <div className="form-group">
            <label>Name</label>
            <input name="name" value={textData.name} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Passport No</label>
            <input name="passportNo" value={textData.passportNo} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Passport Expiry</label>
            <input type="date" name="passportExpiry" value={textData.passportExpiry} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Education</label>
            <input name="education" value={textData.education} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Experience (years)</label>
            <input type="number" name="experience" value={textData.experience} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Contact</label>
            <input name="contact" value={textData.contact} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Aadhar</label>
            <input name="aadhar" value={textData.aadhar} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>Position</label>
            <input name="Position" value={textData.Position} onChange={handleTextChange} />
          </div>

          <div className="form-group">
            <label>DOB</label>
            <input type="date" name="dob" value={textData.dob} onChange={handleTextChange} />
          </div>

          <div className="form-group full">
            <label>Status</label>
            <select name="status" value={textData.status} onChange={handleTextChange}>
              <option>New</option>
              <option>Documents Collected</option>
              <option>Visa Applied</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Rejected</option>
            </select>
          </div>

          <div className="form-group full">
            <label>Notes</label>
            <textarea name="notes" value={textData.notes} onChange={handleTextChange}></textarea>
          </div>

          <div className="form-group full document-box">
            <label>Documents</label>

            <label className="btn">
              <FiPlus /> <input type="file" multiple hidden onChange={handleDocs} />
            </label>

            {files.length > 0 && (
              <ul className="file-list">
                {files.map((f, i) => (
                  <li key={i}>
                    <span>{f.name || f.path?.split(/[/\\]/).pop()}</span>
                    <button type="button" className="btn small" onClick={() => removeDoc(i)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group full">
            <button className="btn primary full" type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Candidate"}
            </button>
          </div>

        </div>
      </form>

    </div>
  );
}