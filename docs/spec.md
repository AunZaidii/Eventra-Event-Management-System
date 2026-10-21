# Spec: Event Management System

## 1. Goal
A website where people can find upcoming events and sign up for them, and where an admin can create and manage those events.
It is a university Cloud Computing project, so it must be easy to put on the cloud later (Docker, load balancer, managed database).

## 2. Users
- **Visitors** (no login): browse events, search, and register for an event.
- **Admin** (login required): one admin account, created automatically from settings. Manages events and sees who registered.

## 3. Features

### Visitors
1. The homepage shows a welcome banner (hero) and a grid of upcoming events.
2. Each event card shows the title, date, location, banner image and seats left.
3. Visitors can search events by text and filter them by category and by date.
4. Each event has its own details page with a registration form (name, email, phone).
5. The same email cannot register twice for the same event.
6. When an event is full, it shows "Sold out" and the form is turned off.
7. After registering, the visitor sees a confirmation page with a unique registration code.

### Admin
8. The admin logs in with email and password. The password is stored safely (hashed).
9. The dashboard shows: total events, total registrations, number of upcoming events, and a chart of registrations per event.
10. The admin can create, edit and delete events (title, description, category, date and time, location, capacity, banner image link).
11. The admin can see the list of people registered for each event.
12. The admin can download that list as a CSV file (opens in Excel).

### Look and feel
13. Modern, clean design: cards, soft shadows, rounded corners, smooth hover effects, one consistent color theme.
14. Works well on phones and on desktop.
15. Shows loading indicators, friendly "nothing here yet" messages, and clear error messages.
16. Small pop-up messages (toasts) for success and errors.

### Behind the scenes
17. A health check address (`/api/health`) reports whether the app and database are working. The load balancer will use this later.
18. The app keeps no state on the server, so many copies can run side by side.
19. Basic protection: secure headers, allowed-origin rules, and limits on how often someone can try to log in or register.
20. No passwords or secrets written in the code. All settings come from environment variables, with an example settings file (`.env.example`).
21. Every request is checked for valid input, and errors are handled in one central place.
22. The database is set up automatically (migrations), and sample events can be loaded (seed).
23. Everything runs with one command: `docker compose up --build`. It starts three parts: web, app and database. Only the web part is reachable from outside.
24. Automated tests cover the health check, listing events, registering, double registration and full events. The tests can run in a CI pipeline.
25. A README explains the project, the three-tier setup, how to run it, the settings, and the list of API addresses.

### CI/CD pipeline (GitHub Actions, target cloud: AWS)
26. **CI:** on every push and pull request, GitHub automatically installs everything, runs the backend tests against a real test database, builds the frontend, and builds both Docker images. If any step fails, the change is marked as failed.
27. **CD:** on every push to `main` that passes CI, the pipeline pushes the web and app images to Amazon ECR (AWS's image store) and deploys them to Amazon ECS Fargate (AWS's container service). The service sits behind an Application Load Balancer, and the database is Amazon RDS PostgreSQL.
28. The deploy job only runs once the AWS settings are added to the GitHub repo (as secrets and variables). Before that, CI still runs and the deploy step is skipped, not failed.
29. AWS login uses GitHub's secure OpenID Connect (OIDC) role, so no AWS keys are stored in the repo.
30. A step-by-step guide explains how to create the AWS resources (ECR, ECS, ALB, RDS) and connect them to the pipeline.

## 4. Decisions made (defaults, can be changed)
- **Categories** are a fixed list: Conference, Workshop, Meetup, Concert, Sports, Webinar, Other.
- **Past events** are hidden from the public homepage, but the admin still sees them.
- **Deleting an event** also deletes its registrations. The admin is asked "Are you sure?" first.
- **Capacity** cannot be lowered below the number of people already registered.
- **Registration code** is a short, readable code, like `EVT-7K3Q9P`.
- **Phone number** is required, in a simple format (digits, spaces, `+`, `-`).
- **Admin login** stays valid for 8 hours, then the admin must log in again.
- **Times** are entered and shown in the viewer's local time and stored in standard UTC.

## 5. Not included (for now)
- Payments or paid tickets.
- Sending emails (confirmations are shown on screen only).
- Uploading image files (banners are image links only, because the server stores no files).
- More than one admin, or admin roles.
- Cancelling a registration.
- Visitor accounts and "my registrations" pages (confirmed: visitors stay public).
- Creating the AWS resources for you. The pipeline and guide are ready, but you create the AWS resources and start the first live deploy, so nothing goes live without your approval.

## 6. Success checks
- [ ] `docker compose up --build` starts web, app and database with no errors.
- [ ] Opening the site in a browser shows the homepage with sample events.
- [ ] Search and the category and date filters change the list of events.
- [ ] A visitor can register for an event and sees a confirmation page with a code.
- [ ] Registering again with the same email for the same event shows a friendly error.
- [ ] A full event shows "Sold out" and cannot be registered for.
- [ ] The admin can log in with the email and password from the settings file.
- [ ] A wrong password shows an error, and too many attempts are blocked for a while.
- [ ] The dashboard shows correct totals and a chart.
- [ ] The admin can create, edit and delete an event.
- [ ] The admin can see an event's registrations and download them as CSV.
- [ ] `/api/health` reports "ok" when the database is up and an error when it is down.
- [ ] Only the web part has an open port; the database cannot be reached from outside.
- [ ] No passwords or secrets appear in the code; `.env` is not in git.
- [ ] `npm test` in the backend runs and all tests pass.
- [ ] The site looks good on a phone-size screen and on desktop.
- [ ] Pushing to GitHub starts the CI workflow, and tests, frontend build and Docker builds all pass (green tick).
- [ ] With no AWS settings added yet, the deploy job is skipped, not failed.
- [ ] The deploy workflow is complete and documented, so adding the AWS settings is enough to deploy.
