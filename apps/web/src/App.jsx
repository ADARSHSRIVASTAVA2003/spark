import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CallProvider } from './context/CallContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import CallModal from './components/CallModal';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import NearbyPage from './pages/NearbyPage';
import SuggestPage from './pages/SuggestPage';
import MatchesPage from './pages/MatchesPage';
import ChatListPage from './pages/ChatListPage';
import ChatThreadPage from './pages/ChatThreadPage';
import CreateRoomPage from './pages/CreateRoomPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/nearby" element={<NearbyPage />} />
                <Route path="/suggest" element={<SuggestPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/chat" element={<ChatListPage />} />
                <Route path="/chat/new-group" element={<CreateRoomPage />} />
                <Route path="/chat/:convId" element={<ChatThreadPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/feed" replace />} />
          </Routes>
          <CallModal />
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  );
}
