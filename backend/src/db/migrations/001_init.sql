-- Initial schema: admins, events, registrations

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT         NOT NULL,
  category    VARCHAR(30)  NOT NULL
              CHECK (category IN ('Conference', 'Workshop', 'Meetup', 'Concert', 'Sports', 'Webinar', 'Other')),
  starts_at   TIMESTAMPTZ  NOT NULL,
  location    VARCHAR(200) NOT NULL,
  capacity    INTEGER      NOT NULL CHECK (capacity > 0),
  banner_url  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS events_category_idx ON events (category);

CREATE TABLE IF NOT EXISTS registrations (
  id         SERIAL PRIMARY KEY,
  event_id   INTEGER      NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  phone      VARCHAR(30)  NOT NULL,
  code       VARCHAR(12)  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT registrations_code_key UNIQUE (code),
  CONSTRAINT registrations_event_email_key UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS registrations_event_id_idx ON registrations (event_id);
