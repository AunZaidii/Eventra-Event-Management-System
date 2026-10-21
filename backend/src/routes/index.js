// Mounts every API route under /api.
const express = require('express');
const a = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const requireAdmin = require('../middleware/auth');
const { loginLimiter, registrationLimiter, apiLimiter } = require('../middleware/rateLimiters');
const s = require('../validators/schemas');
const health = require('../controllers/healthController');
const events = require('../controllers/eventController');
const auth = require('../controllers/authController');
const admin = require('../controllers/adminController');

const router = express.Router();

// Health check first, so load balancer probes are never rate-limited.
router.get('/health', a(health.health));

router.use(apiLimiter);

// ---- Public ----
router.get('/categories', a(events.listCategories));
router.get('/events', validate({ query: s.listEventsQuery }), a(events.listEvents));
router.get('/events/:id', validate({ params: s.idParams }), a(events.getEvent));
router.post(
  '/events/:id/registrations',
  registrationLimiter,
  validate({ params: s.idParams, body: s.registrationBody }),
  a(events.register),
);

// ---- Auth ----
router.post('/auth/login', loginLimiter, validate({ body: s.loginBody }), a(auth.login));
router.get('/auth/me', requireAdmin, a(auth.me));

// ---- Admin (JWT required) ----
const adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.get('/stats', a(admin.stats));
adminRouter.get('/events', validate({ query: s.adminListEventsQuery }), a(admin.listEvents));
adminRouter.post('/events', validate({ body: s.createEventBody }), a(admin.createEvent));
adminRouter.get('/events/:id', validate({ params: s.idParams }), a(admin.getEvent));
adminRouter.put('/events/:id', validate({ params: s.idParams, body: s.updateEventBody }), a(admin.updateEvent));
adminRouter.delete('/events/:id', validate({ params: s.idParams }), a(admin.deleteEvent));
adminRouter.get(
  '/events/:id/registrations',
  validate({ params: s.idParams, query: s.registrationsQuery }),
  a(admin.listRegistrations),
);
adminRouter.get('/events/:id/registrations/export', validate({ params: s.idParams }), a(admin.exportRegistrations));
router.use('/admin', adminRouter);

module.exports = router;
