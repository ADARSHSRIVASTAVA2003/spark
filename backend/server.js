require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const connectDB = require('./src/config/db');
const initSocket = require('./src/socket');
const { generalLimiter } = require('./src/middleware/rateLimit');

const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const geoRoutes = require('./src/routes/geo');
const matchRoutes = require('./src/routes/match');
const chatRoutes = require('./src/routes/chat');

const PORT = process.env.PORT || 4000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

const app = express();
const server = http.createServer(app);

// Static uploads served before helmet so they aren't tagged with a same-origin CORP header
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(generalLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/chat', chatRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const io = initSocket(server, CORS_ORIGINS);
app.set('io', io);

connectDB(process.env.MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
