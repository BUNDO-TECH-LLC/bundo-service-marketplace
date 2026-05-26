import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureClientException } from '../lib/observability';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    captureClientException(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-error-boundary" role="alert">
        <section>
          <p className="eyebrow">Something went wrong</p>
          <h1>Bundo could not open correctly.</h1>
          <p>
            Refresh the page to start a clean session. If you were signing in, use the login button again after the
            page reloads.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload Bundo
          </button>
        </section>
      </main>
    );
  }
}
