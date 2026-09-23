import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            maxWidth: 480,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--accent-red)'
            }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Recovery Encountered
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              An unexpected render event occurred. Your test progression and scores stored in your browser remain intact.
            </p>
            {this.state.error && (
              <pre style={{
                background: 'rgba(0,0,0,0.5)',
                color: '#f87171',
                padding: 12,
                borderRadius: 8,
                fontSize: 11.5,
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: 20
              }}>
                {this.state.error.toString()}
              </pre>
            )}
            <button
              className="btn btn-primary"
              onClick={this.handleReset}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '10px 20px',
                fontSize: 13.5
              }}
            >
              <Home size={15} />
              <span>Return to Safe Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
