// src/components/ErrorBoundary.jsx
// Top-level error boundary. Catches any uncaught render crash and shows a
// friendly fallback instead of a blank screen.
//
// CONVENTION NOTE: coding-conventions.md §5.1 says "functional components only".
// React's error boundary API (componentDidCatch / getDerivedStateFromError)
// only exists as a class component — there is no hook equivalent in React 18.
// This is the single justified exception in the codebase.

import React from 'react';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you would send this to Sentry / Datadog here.
    // That is explicitly out of MVP scope (NFR-7).
    console.error('ErrorBoundary caught:', error, info); // eslint-disable-line no-console
  }

  render() {
    const { t } = this.props;

    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-md">
          <div className="flex items-start gap-3">
            {/* Icon + text label — never color alone (a11y, conventions §5.5) */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
              !
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900">
                {t('errors.boundaryTitle')}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {t('errors.boundaryMessage')}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded bg-ministry-700 px-4 py-2 text-sm text-white hover:bg-ministry-800 focus:outline-none focus:ring-2 focus:ring-ministry-700"
                >
                  {t('errors.boundaryReload')}
                </button>
                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {t('errors.boundaryDetails')}
                </button>
              </div>
              {this.state.showDetails && this.state.error && (
                <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-100 p-3 text-xs text-gray-800">
                  {this.state.error.message}{'\n\n'}{this.state.error.stack}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

// withTranslation injects `t` because hooks aren't available in class components.
export default withTranslation()(ErrorBoundary);
