import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';

import authRoutes from './routes/auth.routes';
import fileRoutes from './routes/file.routes';
import orderRoutes from './routes/order.routes';
import passportRoutes from './routes/passport.routes';
import pricingRoutes from './routes/pricing.routes';
import adminRoutes from './routes/admin.routes';
import printJobRoutes from './routes/printJob.routes';
import printerRoutes from './routes/printer.routes';

// ── App ───────────────────────────────────────────────────────────────────────

const app = express();

// Firebase Functions sits behind a reverse proxy. Trust its single proxy hop
// so Express (and express-rate-limit) uses the caller's forwarded address
// instead of grouping every visitor under the proxy's address.
app.set('trust proxy', 1);

// ── Security middleware ───────────────────────────────────────────────────────

app.use(helmet());

// env.corsOrigins is either the string '*' (wildcard) or a string[] of allowed
// origins.  The cors package needs this exact union — do NOT pass ['*'] because
// the package treats that as "only allow the literal string *", blocking every
// real browser origin.
const corsOptions: cors.CorsOptions = {
  origin: env.corsOrigins as cors.CorsOptions['origin'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

// Respond to CORS preflight (OPTIONS) immediately — before rate-limiting or
// body parsing — so the browser never sees a missing Access-Control-Allow-Origin
// on a preflight response.
app.options('*', cors(corsOptions));

app.use(cors(corsOptions));

app.use(
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    // Firebase Auth already protects sign-in attempts and these endpoints are
    // required to establish/refresh the app session. Keeping them in the
    // shared API bucket can otherwise lock every user out after normal API
    // polling exhausts that bucket.
    skip: (req) => req.path.startsWith('/auth/'),
    message: { success: false, message: 'Too many requests — please try again later' },
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────

// 10mb to handle base64 photo data URLs from the passport creator
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────

app.use(morgan(env.isDev ? 'dev' : 'combined'));

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: process.env['npm_package_version'] ?? '1.0.0' });
});

// ── API routes ────────────────────────────────────────────────────────────────
// Firebase Cloud Functions v2 strips the function name ("/api") from the URL
// path before forwarding to Express. A client request for /api/auth/me hits
// the "api" function, Firebase strips "/api", and Express sees /auth/me.
// Routes are therefore mounted WITHOUT the /api prefix here.

app.use('/auth', authRoutes);
app.use('/files', fileRoutes);
app.use('/orders', orderRoutes);
app.use('/passport', passportRoutes);
app.use('/pricing', pricingRoutes);
app.use('/admin', adminRoutes);
app.use('/print-jobs', printJobRoutes);
app.use('/printers', printerRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
