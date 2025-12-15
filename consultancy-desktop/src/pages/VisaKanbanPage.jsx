// src/pages/VisaKanbanPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { FiActivity, FiRefreshCw, FiSearch } from "react-icons/fi";
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
  Pending: { title: "🕒 Pending / New", color: "#6C6F7F" },
  Submitted: { title: "📑 Documents Submitted", color: "#FFB400" },
  "Biometrics Done": { title: "🧬 Biometrics Done", color: "#B16CFF" },
  "In Progress": { title: "⚙️ In Progress", color: "#00B7D6" },
  Approved: { title: "✅ Approved", color: "#34C759" },
  Rejected: { title: "⛔ Rejected", color: "#FF3B30" },
  Cancelled: { title: "🗑️ Cancelled", color: "#777777" },
};

export default function VisaKanbanPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const navigate = useNavigate();

  const gridRef = useRef(null);
  const edgeScrollTimer = useRef(null); // ✅ keep this

  const fetchData = async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllActiveVisas();
    if (res.success) setItems(res.data);
    else toast.error(res.error || "Failed to load visas");
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ✅ ONLY THIS auto-scroll effect – remove the earlier one you pasted
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const EDGE_ZONE = 140; // px from left/right inside the grid
    const MAX_SPEED = 22;  // px per frame
    const FRAME_MS = 16;   // ~60fps

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX;

      let dir = 0;
      if (x >= rect.right - EDGE_ZONE && x <= rect.right) {
        dir = 1; // scroll right
      } else if (x <= rect.left + EDGE_ZONE && x >= rect.left) {
        dir = -1; // scroll left
      }

      if (dir === 0) {
        if (edgeScrollTimer.current) {
          clearInterval(edgeScrollTimer.current);
          edgeScrollTimer.current = null;
        }
        return;
      }

      const distFromEdge =
        dir === 1 ? rect.right - x : x - rect.left;
      const intensity = Math.max(0, (EDGE_ZONE - distFromEdge) / EDGE_ZONE);
      const speed = MAX_SPEED * intensity * dir;

      if (edgeScrollTimer.current) {
        clearInterval(edgeScrollTimer.current);
      }

      edgeScrollTimer.current = setInterval(() => {
        el.scrollLeft += speed;
      }, FRAME_MS);
    };

    const stopScroll = () => {
      if (edgeScrollTimer.current) {
        clearInterval(edgeScrollTimer.current);
        edgeScrollTimer.current = null;
      }
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", stopScroll);

    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", stopScroll);
      if (edgeScrollTimer.current) clearInterval(edgeScrollTimer.current);
    };
  }, []);



  const filtered = useMemo(() => {
    let result = items;

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
    const { destination, draggableId } = result;
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

  const handleCategoryClick = (status) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleRefresh = () => {
    setSelectedStatuses([]);
    setQuery("");
    fetchData();
  };

  // ===== automatic horizontal scroll on mouse move near edges =====
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const EDGE_ZONE = 140; // px from left/right inside the grid
    const MAX_SPEED = 22; // px per frame
    const FRAME_MS = 16; // ~60fps

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX;

      let dir = 0;
      if (x >= rect.right - EDGE_ZONE && x <= rect.right) {
        dir = 1; // scroll right
      } else if (x <= rect.left + EDGE_ZONE && x >= rect.left) {
        dir = -1; // scroll left
      }

      if (dir === 0) {
        if (edgeScrollTimer.current) {
          clearInterval(edgeScrollTimer.current);
          edgeScrollTimer.current = null;
        }
        return;
      }

      const distFromEdge =
        dir === 1 ? rect.right - x : x - rect.left; // smaller => closer to edge
      const intensity = Math.max(0, (EDGE_ZONE - distFromEdge) / EDGE_ZONE);
      const speed = MAX_SPEED * intensity * dir;

      if (edgeScrollTimer.current) {
        clearInterval(edgeScrollTimer.current);
      }

      edgeScrollTimer.current = setInterval(() => {
        el.scrollLeft += speed;
      }, FRAME_MS);
    };

    const stopScroll = () => {
      if (edgeScrollTimer.current) {
        clearInterval(edgeScrollTimer.current);
        edgeScrollTimer.current = null;
      }
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", stopScroll);

    return () => {
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", stopScroll);
      if (edgeScrollTimer.current) clearInterval(edgeScrollTimer.current);
    };
  }, []);

  if (loading) return <div className="kanban-loading">Loading…</div>;

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <div className="header-left">
          <FiActivity className="header-icon" />
          <div>
            <h1>Visa Tracking Board</h1>
            <p className="header-subtitle">
              Drag cards to update status and quickly track every visa case.
            </p>
          </div>
        </div>

        <div className="kanban-search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search candidate, passport or country…"
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
          <button
            type="button"
            className={`summary-pill ${
              selectedStatuses.includes(st) ? "active" : ""
            }`}
            key={st}
            style={{ "--c": STATUS_INFO[st].color }}
            onClick={() => handleCategoryClick(st)}
          >
            <span className="pill-label">{STATUS_INFO[st].title}</span>
            <span className="pill-count">
              {items.filter((i) => i.status === st).length}
            </span>
          </button>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div
          ref={gridRef}
          className={`kanban-grid ${
            selectedStatuses.length === 1 ? "single-column-centered" : ""
          }`}
        >
          {STATUS_ORDER.map((status) => {
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
                      <span className="column-title">
                        {STATUS_INFO[status].title}
                      </span>
                      <span className="count">
                        {getByStatus(status).length}
                      </span>
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
                                !s.isDragging &&
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
                                    <span>
                                      {item.candidateName?.charAt(0)}
                                    </span>
                                  )}
                                </div>

                                <div className="card-name-block">
                                  <h3 className="card-name">
                                    {item.candidateName}
                                  </h3>
                                  <p className="card-meta-small">
                                    🌍 {item.country}
                                  </p>
                                  <p className="card-meta-small">
                                    🛂 {item.passportNo}
                                  </p>
                                </div>

                                <div className="card-date-top">
                                  <span className="card-date-label">
                                    Applied
                                  </span>
                                  <span className="card-date-value">
                                    {item.application_date}
                                  </span>
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
