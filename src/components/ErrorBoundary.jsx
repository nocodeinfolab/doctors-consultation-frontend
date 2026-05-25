import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-premium-pearl-tint p-4">
          <div className="w-full max-w-md rounded-3xl border border-premium-lilac/25 bg-white p-8 text-center shadow-premium-soft">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>

            <h1 className="mb-2 text-2xl font-bold text-premium-purple-plum">
              Something went wrong
            </h1>

            <p className="mb-6 text-sm leading-6 text-premium-purple-plum/65">
              We encountered an unexpected error. This has been logged and our team will
              investigate.
            </p>

            <div className="space-y-3">
              <Button onClick={this.handleReload} className="w-full font-semibold">
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>

              <Button
                variant="secondary"
                onClick={() => (window.location.href = '/login')}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-semibold text-premium-purple-plum">
                  Development Error Details
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-premium-lilac-light/40 p-3 text-xs text-premium-purple-plum">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
