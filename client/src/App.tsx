import { AppProvider } from './app/AppProvider';
import { AppRoutes } from './app/AppRoutes';
import { AppErrorBoundary } from './components/AppErrorBoundary';

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <div className="app-shell">
          <AppRoutes />
        </div>
      </AppProvider>
    </AppErrorBoundary>
  );
}
