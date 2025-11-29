import React, { useState, useEffect, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  FiUser,
  FiActivity,
  FiRefreshCw,
  FiExternalLink,
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
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllActiveVisas();
    res.success ? setItems(res.data) : toast.error(res.error);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter((i) =>
      i.candidateName.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);

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

    const res = await window.electronAPI.updateVisaStatus({ id, status: newStatus });
    !res.success && fetchData();
  };

  if (loading) return <div className="kanban-loading">Loading…</div>;

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <h1><FiActivity /> Visa Tracking Board</h1>

        <div className="kanban-search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search candidate…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button className="refresh-btn" onClick={fetchData}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      <div className="summary-row">
        {STATUS_ORDER.map((st) => (
          <div className="summary-pill" key={st} style={{ "--c": STATUS_INFO[st].color }}>
            {STATUS_INFO[st].title}
            <span>{getByStatus(st).length}</span>
          </div>
        ))}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-grid">

          {STATUS_ORDER.map((status, idx) => (
            <Droppable key={status} droppableId={status}>
              {(provided, snapshot) => (
                <div
                  className={`kanban-column ${
                    snapshot.isDraggingOver ? "drag-over" : ""
                  } ${idx === 6 ? "center-last-column" : ""}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <div className="column-header" style={{ borderTopColor: STATUS_INFO[status].color }}>
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
                        {(provided, snap) => (
                          <div
                            className={`kanban-card ${snap.isDragging ? "dragging" : ""}`}
                            ref={provided.innerRef}
                            {...provided.dragHandleProps}
                            {...provided.draggableProps}
                            onClick={() =>
                              navigate(`/candidate/${item.candidate_id}?tab=visa`)
                            }
                          >
                            <div className="card-top">
                              <span>#{item.id}</span>
                              <FiExternalLink className="open-icon" />
                            </div>

                            <div className="card-body">

  <div className="card-row-top">
    <div className="avatar-sm">
      {item.photo ? (
        <img src={item.photo} alt="" />
      ) : (
        <span>{item.candidateName?.charAt(0)}</span>
      )}
    </div>

    <div className="card-name-block">
      <h3 className="card-name">{item.candidateName}</h3>
      <p className="card-meta-small">Country: {item.country}</p>
      <p className="card-meta-small">Passport: {item.passportNo}</p>
    </div>

    <div className="card-date-top">
      {item.application_date}
    </div>
  </div>

</div>


                            <div className="card-footer">
                              <span>{item.application_date}</span>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}

        </div>
      </DragDropContext>
    </div>
  );
}
