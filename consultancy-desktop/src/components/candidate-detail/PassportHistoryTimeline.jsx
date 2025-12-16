import React from 'react';
import { FiPackage, FiCalendar, FiEye, FiTrash2 } from 'react-icons/fi';
import '../../css/passport-tracking/PassportTimeline.css';

function PassportHistoryTimeline({ movements, onDelete, onViewPhotos, onAddNew }) {
  const MovementCard = ({ movement, type, position }) => {
    const isReceive = type === 'RECEIVE';
    
    return (
      <div className={`timeline-item ${position}`}>
        <div className={`timeline-icon ${type.toLowerCase()}`}>
          {isReceive ? '📥' : '📤'}
        </div>
        
        <div className={`movement-card ${type.toLowerCase()}`}>
          <div className="card-header">
            <h4>{isReceive ? '📥 PASSPORT RECEIVED' : '📤 PASSPORT SENT'}</h4>
            <div className="card-actions">
              {movement.has_photos && (
                <button className="icon-btn" onClick={() => onViewPhotos(movement.id)} title="Photos">
                  <FiEye />
                </button>
              )}
              <button className="icon-btn danger" onClick={() => onDelete(movement.id)} title="Delete">
                <FiTrash2 />
              </button>
            </div>
          </div>

          <div className="card-date">
            <FiCalendar /> {movement.date}
          </div>

          <div className="card-details">
            {isReceive ? (
              <>
                <div className="detail-row">
                  <label>FROM:</label>
                  <span>{movement.received_from}</span>
                </div>
                <div className="detail-row">
                  <label>RECEIVED BY:</label>
                  <span>👤 {movement.received_by}</span>
                </div>
              </>
            ) : (
              <>
                <div className="detail-row">
                  <label>TO:</label>
                  <span>{movement.send_to}</span>
                </div>
                {movement.send_to_name && (
                  <div className="detail-row">
                    <label>NAME:</label>
                    <span>{movement.send_to_name}</span>
                  </div>
                )}
                {movement.send_to_contact && (
                  <div className="detail-row">
                    <label>CONTACT:</label>
                    <span>📞 {movement.send_to_contact}</span>
                  </div>
                )}
                <div className="detail-row">
                  <label>SENT BY:</label>
                  <span>👤 {movement.sent_by}</span>
                </div>
              </>
            )}

            <div className="detail-row">
              <label>METHOD:</label>
              <span>
                {movement.method === 'By Hand' ? '✋ By Hand' : '🚚 By Courier'}
                {movement.courier_number && ` • #${movement.courier_number}`}
              </span>
            </div>

            {movement.notes && (
              <div className="detail-row notes">
                <label>📝 NOTES:</label>
                <p>{movement.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (movements.length === 0) {
    return (
      <div className="tab-panel">
        <div className="empty-state">
          <FiPackage style={{ fontSize: '3.5rem', opacity: 0.2 }} />
          <p>No movements recorded yet</p>
          <button className="btn-primary" onClick={onAddNew}>
            📥 Record First Receipt
          </button>
        </div>
      </div>
    );
  }

  // Sort by date descending (newest first)
  const sortedMovements = [...movements].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );

  return (
    <div className="tab-panel">
      <div className="timeline-container">
        {sortedMovements.map((movement, index) => {
          const type = (movement.movement_type || movement.type);
          // Alternate left (SENT) and right (RECEIVED)
          const position = type === 'SEND' ? 'left' : 'right';
          
          return (
            <MovementCard 
              key={movement.id} 
              movement={movement} 
              type={type}
              position={position}
            />
          );
        })}
      </div>
    </div>
  );
}

export default PassportHistoryTimeline;
