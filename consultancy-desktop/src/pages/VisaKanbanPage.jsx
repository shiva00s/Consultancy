// src/pages/VisaKanbanPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  FiActivity,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "../css/VisaKanban.css";

const STATUS_ORDER = [
  "Pending",
  "Submitted",
  "Biometrics Done",
  "In Progress",
  "Approved",
  "Rejected",
  "Cancelled",
];

const STATUS_INFO = {
  Pending: { title: "Pending / New", color: "#6C6F7F" },
  Submitted: { title: "Documents Submitted", color: "#FFB400" },
  "Biometrics Done": { title: "Biometrics Done", color: "#B16CFF" },
  "In Progress": { title: "In Progress", color: "#00B7D6" },
  Approved: { title: "Approved", color: "#34C759" },
  Rejected: { title: "Rejected", color: "#FF3B30" },
  Cancelled: { title: "Cancelled", color: "#777" },
};

export default function VisaKanbanPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]); // ✅ Changed to array
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllActiveVisas();
    if (res.success) {
      setItems(res.data);
    } else {
      toast.error(res.error || "Failed to load visas");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let result = items;

    // ✅ Filter by multiple statuses
    if (selectedStatuses.length > 0) {
      result = result.filter((i) => selectedStatuses.includes(i.status));
    }

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (i) =>
          i.candidateName?.toLowerCase().includes(q) ||
          i.passportNo?.toLowerCase().includes(q) ||
          i.country?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, query, selectedStatuses]);

  const getByStatus = (status) => filtered.filter((i) => i.status === status);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const newStatus = destination.droppableId;
    const id = Number(draggableId);
    const updated = items.map((it) =>
      it.id === id ? { ...it, status: newStatus } : it
    );
    setItems(updated);

    const res = await window.electronAPI.updateVisaStatus({
      id,
      status: newStatus,
    });
    if (!res.success) {
      toast.error("Update failed");
      fetchData();
    } else {
      toast.success(`Moved to ${newStatus}`);
    }
  };

  // ✅ Multi-select handler
  const handleCategoryClick = (status) => {
    setSelectedStatuses((prev) => {
      if (prev.includes(status)) {
        // Remove if already selected
        return prev.filter((s) => s !== status);
      } else {
        // Add to selection
        return [...prev, status];
      }
    });
  };

  const handleRefresh = () => {
    setSelectedStatuses([]);
    setQuery("");
    fetchData();
  };

  if (loading) return <div className="kanban-loading">Loading…</div>;

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <div className="header-left">
          <FiActivity className="header-icon" />
          <h1>Visa Tracking Board</h1>
        </div>

        <div className="kanban-search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search candidate/passport/country..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button className="refresh-btn" onClick={handleRefresh}>
          <FiRefreshCw className="spin-icon" /> Refresh
        </button>
      </div>

      <div className="summary-row">
        {STATUS_ORDER.map((st) => (
          <div
            className={`summary-pill ${
              selectedStatuses.includes(st) ? "active" : ""
            }`}
            key={st}
            style={{ "--c": STATUS_INFO[st].color }}
            onClick={() => handleCategoryClick(st)}
          >
            {STATUS_INFO[st].title}
            <span>{items.filter((i) => i.status === st).length}</span>
          </div>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className={`kanban-grid ${
            selectedStatuses.length === 1 ? "single-column-centered" : ""
          }`}
        >
          {STATUS_ORDER.map((status) => {
            // ✅ Show column if no filter OR if status is selected
            if (
              selectedStatuses.length > 0 &&
              !selectedStatuses.includes(status)
            ) {
              return null;
            }

            return (
              <Droppable key={status} droppableId={status}>
                {(prov, snap) => (
                  <div
                    className={`kanban-column ${
                      snap.isDraggingOver ? "drag-over" : ""
                    }`}
                    ref={prov.innerRef}
                    {...prov.droppableProps}
                  >
                    <div
                      className="column-header"
                      style={{ borderTopColor: STATUS_INFO[status].color }}
                    >
                      {STATUS_INFO[status].title}
                      <span className="count">{getByStatus(status).length}</span>
                    </div>

                    <div className="column-content">
                      {getByStatus(status).map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id.toString()}
                          index={index}
                        >
                          {(p, s) => (
                            <div
                              className={`kanban-card ${
                                s.isDragging ? "dragging" : ""
                              }`}
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              onClick={() =>
                                navigate(
                                  `/candidate/${item.candidate_id}?tab=visa`
                                )
                              }
                            >
                              <div className="card-row-top">
                                <div className="avatar-sm">
                                  {item.photo ? (
                                    <img src={item.photo} alt="" />
                                  ) : (
                                    <span>{item.candidateName?.charAt(0)}</span>
                                  )}
                                </div>

                                <div className="card-name-block">
                                  <h3 className="card-name">
                                    {item.candidateName}
                                  </h3>
                                  <p className="card-meta-small">
                                    Country: {item.country}
                                  </p>
                                  <p className="card-meta-small">
                                    Passport: {item.passportNo}
                                  </p>
                                </div>

                                <div className="card-date-top">
                                  {item.application_date}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
