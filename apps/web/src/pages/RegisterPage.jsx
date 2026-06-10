import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GENDERS = ['male', 'female', 'nonbinary', 'other'];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    gender: 'female',
    lookingFor: ['male'],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleLookingFor(g) {
    setForm((f) => {
      const has = f.lookingFor.includes(g);
      const next = has ? f.lookingFor.filter((x) => x !== g) : [...f.lookingFor, g];
      return { ...f, lookingFor: next };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.lookingFor.length === 0) {
      setError('Select at least one preference');
      return;
    }

    setSubmitting(true);
    try {
      await register({ ...form, age: Number(form.age) });
      navigate('/feed');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      <h1 className="mb-1 text-3xl font-bold text-violet-400">Spark</h1>
      <p className="mb-8 text-sm text-gray-400">Create your account</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
        />
        <input
          type="number"
          required
          min={18}
          max={120}
          placeholder="Age"
          value={form.age}
          onChange={(e) => update('age', e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
        />

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-gray-500">I am</label>
          <div className="grid grid-cols-4 gap-2">
            {GENDERS.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => update('gender', g)}
                className={`rounded-lg border px-2 py-2 text-xs capitalize ${
                  form.gender === g
                    ? 'border-violet-400 bg-violet-500/20 text-violet-300'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-gray-500">
            Looking for
          </label>
          <div className="grid grid-cols-4 gap-2">
            {GENDERS.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => toggleLookingFor(g)}
                className={`rounded-lg border px-2 py-2 text-xs capitalize ${
                  form.lookingFor.includes(g)
                    ? 'border-violet-400 bg-violet-500/20 text-violet-300'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-violet-500 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-50"
        >
          Sign up
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="text-violet-400 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
