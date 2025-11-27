import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FiUser, FiActivity, FiRefreshCw, FiExternalLink } from 'react-icons/fi'; // Added FiExternalLink
import { useNavigate } from 'react-router-dom'; // Added useNavigate
import toast from 'react-hot-toast';
import '../css/VisaKanban.css';

const COLUMNS = {
  'Pending': { title: 'Pending / New', color: '#6c757d' },
  'Documents Submitted': { title: 'Docs Submitted', color: '#ffc107' },
  'Visa Applied': { title: 'Visa Applied', color: '#17a2b8' },
  'Approved': { title: 'Approved', color: '#28a745' },
  'Rejected': { title: 'Rejected', color: '#dc3545' }
};

function VisaKanbanPage() {
  const [columns, setColumns] = useState(COLUMNS);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook for navigation

  const fetchData = async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllActiveVisas();
    if (res.success) {
      setItems(res.data);
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getItemsByStatus = (status) => items.filter(i => i.status === status);

  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newStatus = destination.droppableId;
    const itemId = parseInt(draggableId);

    const updatedItems = items.map(item => 
      item.id === itemId ? { ...item, status: newStatus } : item
    );
    setItems(updatedItems);

    const res = await window.electronAPI.updateVisaStatus({ id: itemId, status: newStatus });
    if (!res.success) {
      toast.error("Failed to update status");
      fetchData();
    } else {
      toast.success(`Moved to ${newStatus}`);
    }
  };

  if (loading) return <div className="kanban-loading">Loading Board...</div>;

  return (
    <div className="kanban-container">
      <div className="kanban-header">
        <h1><FiActivity /> Visa Tracking Board</h1>
        <button className="btn btn-secondary" onClick={fetchData}><FiRefreshCw /> Refresh</button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kanban-board">
          {Object.entries(columns).map(([statusId, colDef]) => (
            <Droppable key={statusId} droppableId={statusId}>
              {(provided, snapshot) => (
                <div 
                  className={`kanban-column ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <div className="column-header" style={{ borderTop: `4px solid ${colDef.color}` }}>
                    <h3>{colDef.title}</h3>
                    <span className="count-badge">{getItemsByStatus(statusId).length}</span>
                  </div>
                  
                  <div className="column-content">
                    {getItemsByStatus(statusId).map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <div
                            className="kanban-card"
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.8 : 1
                            }}
                            // [FIX] Click to Navigate
                            onClick={() => navigate(`/candidate/${item.candidate_id}?tab=visa`)}
                          >
                            <div className="card-top">
                                <span className="card-id">#{item.id}</span>
                                <span className="card-country">{item.country}</span>
                                {/* Visual indicator that it's clickable */}
                                <FiExternalLink style={{marginLeft: 'auto', opacity: 0.5}} />
                            </div>
                            <h4><FiUser /> {item.candidateName}</h4>
                            <p className="card-detail">{item.passportNo}</p>
                            <p className="card-date">{item.application_date}</p>
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

export default VisaKanbanPage;