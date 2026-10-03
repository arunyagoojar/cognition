import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Cognition ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          maxWidth: 680,
          margin: '60px auto',
          padding: '36px',
          background: 'var(--bg-card, #FFFFFF)',
          border: '1.5px solid #151313',
          borderRadius: 20,
          boxShadow: '0 4px 0 #151313',
          textAlign: 'center',
          fontFamily: 'Kodchasan, sans-serif'
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#151313', margin: '0 0 12px' }}>
            Something went wrong in this view
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 24, lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. Your test progress is preserved.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                background: '#FF5734',
                color: '#151313',
                fontSize: 14,
                fontWeight: 800,
                border: '1.5px solid #151313',
                boxShadow: '0 3px 0 #151313',
                cursor: 'pointer'
              }}
            >
              Recover View
            </button>
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.props.onReset}
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  background: 'var(--surface-alt, #F5F5F5)',
                  color: '#151313',
                  fontSize: 14,
                  fontWeight: 700,
                  border: '1.5px solid #151313',
                  boxShadow: '0 3px 0 #151313',
                  cursor: 'pointer'
                }}
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
