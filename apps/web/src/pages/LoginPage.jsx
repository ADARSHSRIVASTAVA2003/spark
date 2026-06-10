import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/feed');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuest() {
    setError('');
    setSubmitting(true);
    try {
      await guestLogin();
      navigate('/feed');
    } catch (err) {
      setError(err.response?.data?.error || 'Guest login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <h1 className="mb-1 text-3xl font-bold text-violet-400">Spark</h1>
      <p className="mb-8 text-sm text-gray-400">Sign in to continue</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-violet-500 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50"
        >
          Log in
        </button>
      </form>

      <button
        onClick={handleGuest}
        disabled={submitting}
        className="mt-4 w-full max-w-sm rounded-lg border border-gray-700 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-500 disabled:opacity-50"
      >
        Continue as guest
      </button>

      <p className="mt-6 text-sm text-gray-400">
        No account?{' '}
        <Link to="/register" className="text-violet-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
