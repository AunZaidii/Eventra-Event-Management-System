// Admin-only endpoints (all behind requireAdmin).
const eventService = require('../services/eventService');
const registrationService = require('../services/registrationService');
const statsService = require('../services/statsService');

async function stats(req, res) {
  res.json(await statsService.getDashboardStats());
}

async function listEvents(req, res) {
  res.json(await eventService.listAdmin(req.valid.query));
}

async function getEvent(req, res) {
  res.json(await eventService.getById(req.valid.params.id));
}

async function createEvent(req, res) {
  res.status(201).json(await eventService.create(req.valid.body));
}

async function updateEvent(req, res) {
  res.json(await eventService.update(req.valid.params.id, req.valid.body));
}

async function deleteEvent(req, res) {
  await eventService.remove(req.valid.params.id);
  res.status(204).end();
}

async function listRegistrations(req, res) {
  res.json(await registrationService.listForEvent(req.valid.params.id, req.valid.query));
}

async function exportRegistrations(req, res) {
  const { filename, csv } = await registrationService.exportCsv(req.valid.params.id);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
  res.send(csv);
}

module.exports = {
  stats,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listRegistrations,
  exportRegistrations,
};
