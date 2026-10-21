// Public event endpoints.
const eventService = require('../services/eventService');
const registrationService = require('../services/registrationService');
const { CATEGORIES } = require('../constants');

async function listCategories(req, res) {
  res.json({ items: CATEGORIES });
}

async function listEvents(req, res) {
  res.json(await eventService.listPublic(req.valid.query));
}

async function getEvent(req, res) {
  res.json(await eventService.getById(req.valid.params.id));
}

async function register(req, res) {
  const result = await registrationService.register(req.valid.params.id, req.valid.body);
  res.status(201).json(result);
}

module.exports = { listCategories, listEvents, getEvent, register };
