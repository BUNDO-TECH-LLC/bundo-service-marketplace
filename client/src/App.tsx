import { AppProvider } from './app/AppProvider';
import { AppRoutes } from './app/AppRoutes';

export default function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <AppRoutes />
      </div>
    </AppProvider>
  );
}
