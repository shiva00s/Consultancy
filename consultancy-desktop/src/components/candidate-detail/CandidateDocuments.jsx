import React, { useMemo, useState } from "react";
import toast from 'react-hot-toast';
import "../../css/CandidateDocuments.css";
import UniversalTabs from "../common/UniversalTabs"; 
import DocumentChecker from "./DocumentChecker";
import DocumentList from "../DocumentList";
import DocumentUploader from "../DocumentUploader";
import { DOCUMENT_CATEGORIES } from "../../utils/documentCategories";
import DocumentViewer from "../DocumentViewer";
import ConfirmDialog from "../common/ConfirmDialog";
import useNotificationStore from '../../store/useNotificationStore';

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
    // open confirm dialog (single place) for single document
    setConfirmTarget({ docId, fileName, type: 'single' });
    setConfirmOpen(true);
  };

  const handleDeleteGroup = async (category, docs) => {
    // Open confirm dialog for a group delete (move to recycle)
    setConfirmTarget({ category, docs, type: 'group' });
    setConfirmOpen(true);
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const createNotification = useNotificationStore((s) => s.createNotification);

  const performDelete = async () => {
    if (!confirmTarget) return;
    try {
      toast.loading('Processing delete…', { id: 'doc-delete' });
      if (confirmTarget.type === 'single') {
        const { docId } = confirmTarget;
        const res = await window.electronAPI.deleteDocument({ user, docId });
        if (res && res.success) {
          onDocumentsUpdate([], docId);
          toast.success('Document moved to Recycle Bin', { id: 'doc-delete' });
            try {
              createNotification({
                title: '🗑️ Document deleted',
                message: `A document was moved to Recycle Bin for candidate ${candidateId}`,
                type: 'warning',
                priority: 'high',
                link: `/candidate/${candidateId}?tab=documents`,
                actor: { id: user?.id, name: user?.name || user?.username },
                target: { type: 'document', id: docId },
                meta: { candidateId },
              });
            } catch (e) {}
        } else {
          toast.error(res?.error || 'Failed to delete document', { id: 'doc-delete' });
        }
      } else if (confirmTarget.type === 'group') {
        const { docs } = confirmTarget;
        // Prefer bulk delete for performance
        try {
          const ids = docs.map((d) => d.id);
          const res = await window.electronAPI.deleteDocumentsBulk({ user, docIds: ids });
          if (res && (res.success || (res.processed && res.processed > 0))) {
            const processedIds = ids; // assume tx marked them
            for (const id of processedIds) onDocumentsUpdate([], id);
            toast.success(`Moved ${res.processed || ids.length} file(s) to Recycle Bin`, { id: 'doc-delete' });
            try {
              createNotification({
                title: '🗑️ Documents deleted',
                message: `Multiple documents moved to Recycle Bin for candidate ${candidateId}`,
                type: 'warning',
                priority: 'high',
                link: `/candidate/${candidateId}?tab=documents`,
                actor: { id: user?.id, name: user?.name || user?.username },
                target: { type: 'document', id: null },
                meta: { candidateId, count: res.processed || ids.length },
              });
            } catch (e) {}
          } else if (res && res.errors && res.errors.length) {
            const failedIds = (res.errors || []).map((e) => e.id).filter(Boolean);
            const succeeded = ids.filter((id) => !failedIds.includes(id));
            for (const id of succeeded) onDocumentsUpdate([], id);
            toast.error(`Failed to move ${failedIds.length} file(s).`, { id: 'doc-delete' });
            console.error('deleteDocumentsBulk errors', res.errors);
          } else {
            toast.error(res?.error || 'Bulk delete failed', { id: 'doc-delete' });
            console.error('deleteDocumentsBulk unexpected response', res);
          }
        } catch (e) {
          console.error('group bulk delete failed, falling back to per-item', e);
          toast.error('Bulk delete failed, trying individually', { id: 'doc-delete' });
          for (const d of docs) {
            try {
              const r = await window.electronAPI.deleteDocument({ user, docId: d.id });
              if (r && r.success) onDocumentsUpdate([], d.id);
            } catch (err) {
              console.error('group delete item failed', d.id, err);
            }
          }
          toast.success('Completed individual deletes (best-effort)', { id: 'doc-delete' });
        }
      } else if (confirmTarget.type === 'all') {
        // delete all documents for this candidate (use bulk)
        try {
          const docsList = documents || [];
          const ids = docsList.map((d) => d.id);
          if (ids.length > 0) {
            const res = await window.electronAPI.deleteDocumentsBulk({ user, docIds: ids });
            if (res && (res.success || (res.processed && res.processed > 0))) {
              for (const id of ids) onDocumentsUpdate([], id);
              toast.success(`Moved ${res.processed || ids.length} file(s) to Recycle Bin`, { id: 'doc-delete' });
                try {
                  createNotification({
                    title: '🗑️ Documents deleted',
                    message: `All documents moved to Recycle Bin for candidate ${candidateId}`,
                    type: 'warning',
                    priority: 'high',
                    link: `/candidate/${candidateId}?tab=documents`,
                    actor: { id: user?.id, name: user?.name || user?.username },
                    target: { type: 'document', id: null },
                    meta: { candidateId, count: res.processed || ids.length },
                  });
                } catch (e) {}
            } else {
              toast.error(res?.error || 'Failed to delete all documents', { id: 'doc-delete' });
            }
          }
        } catch (e) {
          console.error('delete all bulk failed, falling back to per-item', e);
          const docsList = documents || [];
          for (const d of docsList) {
            try {
              const r = await window.electronAPI.deleteDocument({ user, docId: d.id });
              if (r && r.success) onDocumentsUpdate([], d.id);
            } catch (err) {
              console.error('delete all item failed', d.id, err);
            }
          }
          toast.success('Completed individual deletes (best-effort)', { id: 'doc-delete' });
        }
      }
    } catch (err) {
      console.error('delete doc error', err);
      toast.error('Unexpected error deleting documents');
    } finally {
      setConfirmOpen(false);
      setConfirmTarget(null);
      toast.remove('doc-delete');
    }
  };

  const handleDeleteAll = () => {
    setConfirmTarget({ type: 'all' });
    setConfirmOpen(true);
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
            onDeleteGroup={handleDeleteGroup}
            onDeleteAll={handleDeleteAll}
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

  // Dynamic confirm dialog texts (show counts/context)
  const confirmTitle = "Move to Recycle Bin";
  let confirmMessage = "Are you sure?";
  let confirmButtonText = "Move to Recycle Bin";
  if (confirmTarget) {
    if (confirmTarget.type === 'single') {
      confirmMessage = `⚠️ Move "${confirmTarget.fileName}" to Recycle Bin? This can be restored later.`;
    } else if (confirmTarget.type === 'group') {
      const count = (confirmTarget.docs || []).length;
      const cat = confirmTarget.category || '';
      confirmMessage = `⚠️ Move ${count} document${count === 1 ? '' : 's'}${cat ? ` in "${cat}"` : ''} to Recycle Bin? This can be restored later.`;
      confirmButtonText = `Move ${count} file${count === 1 ? '' : 's'} to Recycle Bin`;
    } else if (confirmTarget.type === 'all') {
      confirmMessage = `⚠️ Move all ${totalFiles} documents to Recycle Bin? This can be restored later.`;
      confirmButtonText = `Move ${totalFiles} file${totalFiles === 1 ? '' : 's'} to Recycle Bin`;
    }
  }


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
        title={confirmTitle}
        message={confirmMessage}
        isDanger={true}
        confirmText={confirmButtonText}
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
