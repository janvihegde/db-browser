import React, { useEffect } from 'react';

const Toast = ({ message, type = 'error', onClose }) => {
  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => onClose(), 6000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div style={{
      position: 'fixed', 
      bottom: '32px', 
      right: '32px', 
      zIndex: 9999,
      backgroundColor: type === 'error' ? '#dc2626' : '#059669', 
      color: '#ffffff',
      padding: '16px 24px', 
      borderRadius: '8px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '16px',
      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', 
      animation: 'slideUp 0.3s ease-out'
    }}>
      <strong style={{ fontSize: '1.2rem' }}>
        {type === 'error' ? '⚠️ Error:' : '✅ Success:'}
      </strong>
      <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{message}</span>
      <button 
        onClick={onClose} 
        style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', marginLeft: '12px', fontSize: '1.2rem', opacity: 0.8 }}
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;