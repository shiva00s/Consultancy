import React, { useMemo, useState } from "react";
import "../../css/CandidateDocuments.css";

import DocumentChecker from "./DocumentChecker";
import DocumentList from "../DocumentList";
import DocumentUploader from "../DocumentUploader";
import DocumentViewer from "../DocumentViewer";

import { readFileAsBuffer } from "../../utils/file";

const documentCategories = [
  "Uncategorized",
  "Passport",
  "Resume",
  "Photograph",
  "Education Certificate",
  "Experience Letter",
  "Offer Letter",
  "Visa",
  "Aadhar Card",
  "Pan Card",
  "Medical Certificate",
  "Driving License",
];

function CandidateDocuments({
  user,
  candidateId,
  documents,
  onDocumentsUpdate,
}) {
  const [viewerDoc, setViewerDoc] = useState(null);

  const groupedDocuments = useMemo(() => {
    if (!documents) return {};
    return documents.reduce((acc, doc) => {
      const cat = doc.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    }, {});
  }, [documents]);

  const handleChangeCategory = async (docId, newCategory) => {
    try {
      const res = await window.electronAPI.updateDocumentCategory({
        user,
        docId,
        category: newCategory,
      });

      if (res.success) {
        onDocumentsUpdate([{ id: docId, category: newCategory }], null, true);
      }
    } catch (err) {
      console.error("update category error", err);
    }
  };

  const handleDeleteDocument = async (docId, fileName) => {
    if (
      !window.confirm(
        `Are you sure you want to move "${fileName}" to the Recycle Bin?`
      )
    ) {
      return;
    }

    try {
      const res = await window.electronAPI.deleteDocument({
        user,
        docId,
      });

      if (res.success) {
        onDocumentsUpdate([], docId);
      }
    } catch (err) {
      console.error("delete doc error", err);
    }
  };

  const handleUploaded = (newDocs) => {
    // right‑side list will refresh from parent
    onDocumentsUpdate(newDocs);
  };

  const openFileExternally = (filePath) => {
    window.electronAPI.openFileExternally({ path: filePath });
  };

  const handleView = (doc) => {
    const isViewable =
      doc.fileType === "application/pdf" || doc.fileType?.startsWith("image/");
    if (isViewable) {
      setViewerDoc(doc);
    } else {
      openFileExternally(doc.filePath);
    }
  };

  return (
    <div className="candocs-root">
      {viewerDoc && (
        <DocumentViewer
          doc={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      )}

      <div className="candocs-grid-split">
        {/* LEFT: status on top, uploader below */}
        <div className="candocs-left">
          <DocumentChecker candidateDocuments={documents} />

          <DocumentUploader
            user={user}
            candidateId={candidateId}
            documentCategories={documentCategories}
            onUploaded={handleUploaded}
            readFileAsBuffer={readFileAsBuffer}
          />
        </div>

        {/* RIGHT: uploaded list */}
        <div className="candocs-right">
          <DocumentList
            groupedDocuments={groupedDocuments}
            documentCategories={documentCategories}
            onChangeCategory={handleChangeCategory}
            onView={handleView}
            onDelete={handleDeleteDocument}
          />
        </div>
      </div>
    </div>
  );
}

export default CandidateDocuments;
