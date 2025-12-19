import React, { useMemo, useState } from "react";
import "../../css/CandidateDocuments.css";
import UniversalTabs from "../common/UniversalTabs"; 
import DocumentChecker from "./DocumentChecker";
import DocumentList from "../DocumentList";
import DocumentUploader from "../DocumentUploader";
import DocumentViewer from "../DocumentViewer";
import { readFileAsBuffer } from "../../utils/file";

const documentCategories = [
  "📂 Uncategorized",
  "🛂 Passport",
  "📄 Resume",
  "📸 Photograph",
  "🎓 Education Certificate",
  "💼 Experience Letter",
  "📋 Offer Letter",
  "✈️ Visa",
  "🆔 Aadhar Card",
  "💳 Pan Card",
  "🏥 Medical Certificate",
  "🚗 Driving License",
];

const mandatoryCategories = [
  "Aadhar Card",
  "Education Certificate",
  "Offer Letter",
  "Pan Card",
  "Visa",
];

function CandidateDocuments({ user, candidateId, documents, onDocumentsUpdate }) {
  const [viewerDoc, setViewerDoc] = useState(null);

  const groupedDocuments = useMemo(() => {
    if (!documents) return {};
    return documents.reduce((acc, doc) => {
      const cat = doc.category || "📂 Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    }, {});
  }, [documents]);

  // Calculate counts
  const totalFiles = documents?.length || 0;
  const checkedFiles = useMemo(() => {
    if (!documents) return 0;
    const uploadedSet = new Set(
      documents
        .map((d) => {
          const cat = d.category || "Uncategorized";
          return cat.replace(/^[\u{1F000}-\u{1F9FF}]\s*/u, '').trim();
        })
        .filter(Boolean)
    );
    const checkedCount = mandatoryCategories.filter((cat) =>
      uploadedSet.has(cat)
    ).length;
    return checkedCount;
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
        `⚠️ Are you sure you want to move "${fileName}" to the Recycle Bin?`
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

 // Tab configuration
  const tabs = [
    {
      key: "view-all",
      label: "View All",
      icon: "📁",
      badge: totalFiles > 0 ? `${totalFiles}` : null,
      content: (
        <div className="candocs-viewall-grid">
          <DocumentList
            groupedDocuments={groupedDocuments}
            onView={handleView}
            onChangeCategory={handleChangeCategory}
            onDelete={handleDeleteDocument}
            documentCategories={documentCategories}
          />
        </div>
      ),
    },
    {
      key: "status-check",
      label: "Status Check",
      icon: "✅",
      badge: checkedFiles > 0 ? `${checkedFiles}/${mandatoryCategories.length}` : null,
      content: (
        <div className="candocs-checker-layout">
          <DocumentChecker
            documents={documents}
            mandatoryCategories={mandatoryCategories}
          />
        </div>
      ),
    },
    {
      key: "upload",
      label: "Upload",
      icon: "📤",
      content: (
        <div className="candocs-upload-layout">
          <DocumentUploader
            user={user}
            candidateId={candidateId}
            onUploaded={handleUploaded}
            documentCategories={documentCategories}
          />
        </div>
      ),
    },
  ];


  return (
    <div className="candidate-documents-container">
      <UniversalTabs defaultActiveTab="view-all" tabs={tabs} />
      
      {viewerDoc && (
        <DocumentViewer
          doc={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  );
}


export default CandidateDocuments;
