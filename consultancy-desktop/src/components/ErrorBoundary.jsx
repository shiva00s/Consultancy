import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // This lifecycle method is used to update the state so the next render will show the fallback UI.
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  // This lifecycle method is used to log the error information
  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // You could also send this to a logging service
  }

  // Function to reload the entire application
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={styles.container}>
          <FiAlertTriangle style={styles.icon} />
          <h2 style={styles.title}>Something went wrong.</h2>
          <p style={styles.message}>An unexpected error occurred. Please try reloading the application.</p>
          <pre style={styles.pre}>
            {this.state.error?.message}
          </pre>
          <button className="btn btn-danger" onClick={this.handleReload}>
            Reload Application
          </button>
        </div>
      );
    }

    // If there's no error, render the children components normally
    return this.props.children;
  }
}

// Simple styles for the error screen
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '2rem',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  icon: {
    fontSize: '3rem',
    color: 'var(--danger-color)',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
  },
  message: {
    color: 'var(--text-secondary)',
    maxWidth: '400px',
    textAlign: 'center',
  },
    pre: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    padding: '1rem',
    borderRadius: 'var(--border-radius)',
    maxWidth: '600px',
    overflowX: 'auto',
    color: 'rgba(var(--danger-rgb), 0.9)',
    whiteSpace: 'pre-wrap',
  }
};

export default ErrorBoundary;