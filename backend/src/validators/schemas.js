// Zod schemas for every endpoint's params, query and body.
const { z } = require('zod');
const { CATEGORIES } = require('../constants');

// Treat "" from query strings / forms as "not provided".
const blankToUndefined = (schema) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');

const page = z.coerce.number().int().min(1).max(10000).default(1);
const limit = (max, fallback) => z.coerce.number().int().min(1).max(max).default(fallback);
const search = blankToUndefined(z.string().trim().max(100));

const idParams = z.object({
  id: z.coerce.number({ invalid_type_error: 'Invalid id' }).int().positive('Invalid id').max(2147483647),
});

const listEventsQuery = z.object({
  q: search,
  category: blankToUndefined(z.enum(CATEGORIES, { errorMap: () => ({ message: 'Unknown category' }) })),
  from: blankToUndefined(dateOnly),
  to: blankToUndefined(dateOnly),
  sort: blankToUndefined(z.enum(['date', 'seats'])).default('date'),
  page,
  limit: limit(50, 12),
});

const adminListEventsQuery = z.object({
  q: search,
  status: blankToUndefined(z.enum(['upcoming', 'past', 'soldout'])),
  page,
  limit: limit(100, 20),
});

const registrationsQuery = z.object({
  q: search,
  page,
  limit: limit(100, 20),
});

const eventFields = {
  title: z.string({ required_error: 'Title is required' }).trim().min(3, 'Title must be at least 3 characters').max(150),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(', ')}` }) }),
  startsAt: z
    .string({ required_error: 'Date and time are required' })
    .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date and time')
    .transform((s) => new Date(s)),
  location: z.string({ required_error: 'Location is required' }).trim().min(2, 'Location is required').max(200),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity must be a number' })
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(100000, 'Capacity is too large'),
  bannerUrl: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z
      .string()
      .trim()
      .max(2048)
      .url('Banner must be a valid URL')
      .refine((u) => /^https?:\/\//i.test(u), 'Banner URL must start with http:// or https://')
      .nullable(),
  ),
};

const createEventBody = z
  .object(eventFields)
  .refine((e) => e.startsAt.getTime() > Date.now(), { path: ['startsAt'], message: 'Date must be in the future' });

const updateEventBody = z.object(eventFields);

const registrationBody = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .max(255)
    .email('Enter a valid email address'),
  phone: z
    .string({ required_error: 'Phone is required' })
    .trim()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number'),
});

const loginBody = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().max(255).email('Enter a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(200),
});

module.exports = {
  idParams,
  listEventsQuery,
  adminListEventsQuery,
  registrationsQuery,
  createEventBody,
  updateEventBody,
  registrationBody,
  loginBody,
};
