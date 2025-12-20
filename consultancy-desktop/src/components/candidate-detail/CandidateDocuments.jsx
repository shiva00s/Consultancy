import React, { useMemo, useState } from "react";
import "../../css/CandidateDocuments.css";
import UniversalTabs from "../common/UniversalTabs"; 
import DocumentChecker from "./DocumentChecker";
import DocumentList from "../DocumentList";
import DocumentUploader from "../DocumentUploader";
import { DOCUMENT_CATEGORIES } from "../../utils/documentCategories";
import DocumentViewer from "../DocumentViewer";
import ConfirmDialog from "../common/ConfirmDialog";

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



function CandidateDocuments({ user, candidateId, documents, onDocumentsUpdate }) {
  const [viewerDoc, setViewerDoc] = useState(null);
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(true);

  const groupedDocuments = useMemo(() => {
    if (!documents) return {};
    const cleanCategoryName = (value = "") =>
      String(value)
        .replace(/\s+/g, " ")
        .replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, "")
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
        .replace(/[\u{2600}-\u{27BF}]/gu, "")
        .replace(/[\u{2700}-\u{27BF}]/gu, "")
        .trim();

    return documents.reduce((acc, doc) => {
      const cat = cleanCategoryName(doc.category || "Uncategorized") || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({ ...doc, category: cat });
      return acc;
    }, {});
  }, [documents]);

  // Calculate counts
  const totalFiles = documents?.length || 0;
  const cleanCategoryName = (value = "") =>
    String(value)
      .replace(/\s+/g, " ")
      .replace(/^[\u{1F000}-\u{1FFFF}]\s*/u, "")
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[\u{2600}-\u{27BF}]/gu, "")
      .replace(/[\u{2700}-\u{27BF}]/gu, "")
      .trim();

  const checkedFiles = useMemo(() => {
    if (!documents) return 0;
    const uploadedSet = new Set(
      documents
        .map((d) => cleanCategoryName(d.category || "Uncategorized"))
        .filter(Boolean)
    );

    const requiredNames = (requiredDocs || []).map((r) => cleanCategoryName(r.name || "") ).filter(Boolean);

    const checkedCount = requiredNames.filter((cat) => uploadedSet.has(cat)).length;
    return checkedCount;
  }, [documents, requiredDocs]);

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
    // open confirm dialog instead of native confirm
    setConfirmTarget({ docId, fileName });
    setConfirmOpen(true);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const performDelete = async () => {
    if (!confirmTarget) return;
    const { docId } = confirmTarget;
    try {
      const res = await window.electronAPI.deleteDocument({ user, docId });
      if (res.success) {
        onDocumentsUpdate([], docId);
      }
    } catch (err) {
      console.error('delete doc error', err);
    } finally {
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  const handleUploaded = (newDocs) => {
    onDocumentsUpdate(newDocs);
  };

  // Fetch required documents from manager so header badges are accurate
  React.useEffect(() => {
    let mounted = true;
    const fetchReqs = async () => {
      setLoadingReqs(true);
      try {
        const res = await window.electronAPI.getRequiredDocuments();
        if (res?.success) {
          if (mounted) setRequiredDocs(res.data || []);
        } else {
          if (mounted) setRequiredDocs([]);
        }
      } catch (err) {
        if (mounted) setRequiredDocs([]);
      } finally {
        if (mounted) setLoadingReqs(false);
      }
    };

    fetchReqs();

    return () => {
      mounted = false;
    };
  }, []);

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
            documentCategories={DOCUMENT_CATEGORIES}
          />
        </div>
      ),
    },
    {
      key: "status-check",
      label: "Status Check",
      icon: "✅",
          badge: (requiredDocs.length > 0 && checkedFiles >= 0) ? `${checkedFiles}/${requiredDocs.length}` : null,
      content: (
        <div className="candocs-checker-layout">
          <DocumentChecker
            documents={documents}
            requiredDocsProp={requiredDocs}
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
            documentCategories={DOCUMENT_CATEGORIES}
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

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Move to Recycle Bin"
        message={
          confirmTarget
            ? `⚠️ Move "${confirmTarget.fileName}" to Recycle Bin? This can be restored later.`
            : 'Are you sure?'
        }
        isDanger={true}
        confirmText="Move to Recycle Bin"
        cancelText="Cancel"
        onConfirm={performDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}


export default CandidateDocuments;
