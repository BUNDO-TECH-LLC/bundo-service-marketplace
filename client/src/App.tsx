import { BookingConfirmedProvider } from './contexts/BookingConfirmedContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <BookingConfirmedProvider>
      <AppRouter />
    </BookingConfirmedProvider>
  );
}
