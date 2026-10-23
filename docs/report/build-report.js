// Builds docs/report/Eventra-Technical-Report.docx (SE-490 CEA technical report).
// Screenshots are read from docs/evidence/screenshots and docs/evidence/app if present;
// missing ones become labelled placeholders, so the report can be rebuilt any time:
//   cd docs/report && npm install && node build-report.js
const fs = require('fs');
const path = require('path');
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer,
  PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = require('docx');

// ---------- Fill in your details ----------
const STUDENT = {
  name: '[Your Name]',
  roll: '[Roll Number]',
  section: '[Section]',
  instructor: '[Instructor Name]',
};
const REPO_URL = 'https://github.com/AunZaidii/Eventra-Event-Management-System';
// -------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = path.join(ROOT, 'docs', 'evidence');
const OUT = path.join(__dirname, 'Eventra-Technical-Report.docx');

const FONT = 'Calibri';
const CONTENT_WIDTH = 9026; // A4 width minus 1" margins, in DXA
const COLORS = { ink: '0B1020', muted: '5B6475', brand: '4F46E5', head: 'EEF0FF', line: 'C9CEDB', warn: 'FFF7ED' };

// ---------- helpers ----------
// "Text with **bold** parts" -> TextRuns
function runs(text, base = {}) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
    part.startsWith('**')
      ? new TextRun({ ...base, text: part.slice(2, -2), bold: true })
      : new TextRun({ ...base, text: part }),
  );
}
const p = (text, opts = {}) =>
  new Paragraph({ children: runs(text, opts.run), spacing: { after: 100, line: 276 }, alignment: opts.align, ...opts.para });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const bullet = (text) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: runs(text), spacing: { after: 40, line: 264 } });

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_WIDTH / total;
  const w = widths.map((x) => Math.round(x * scale));
  w[w.length - 1] += CONTENT_WIDTH - w.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: COLORS.line };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (text, i, header) =>
    new TableCell({
      width: { size: w[i], type: WidthType.DXA },
      borders,
      shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: COLORS.head } : undefined,
      margins: { top: 50, bottom: 50, left: 90, right: 90 },
      children: [new Paragraph({ children: runs(String(text), { size: 18, bold: header || undefined }), spacing: { after: 0 } })],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((t, i) => cell(t, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i, false)) })),
    ],
  });
}
const spacer = () => new Paragraph({ children: [], spacing: { after: 60 } });

function imageSize(buf) {
  if (buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), type: 'jpg' };
      i += 2 + len;
    }
  }
  return null;
}

let figureNo = 0;
const missing = [];
// Inserts an image scaled to the page, or a shaded placeholder if the file is not there yet.
function figure(file, caption, hint, maxWidthPx = 600, maxHeightPx = 760) {
  figureNo += 1;
  const label = `Figure ${figureNo}: ${caption}`;
  const out = [];
  if (fs.existsSync(file)) {
    const buf = fs.readFileSync(file);
    const size = imageSize(buf);
    if (size) {
      let width = Math.min(maxWidthPx, size.width);
      let height = Math.round((size.height / size.width) * width);
      if (height > maxHeightPx) {
        width = Math.round((width * maxHeightPx) / height);
        height = maxHeightPx;
      }
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [new ImageRun({ type: size.type, data: buf, transformation: { width, height } })] }));
    }
  } else {
    missing.push(path.relative(ROOT, file));
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLORS.warn },
        border: { top: { style: BorderStyle.DASHED, size: 6, color: 'C2410C' }, bottom: { style: BorderStyle.DASHED, size: 6, color: 'C2410C' } },
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: `[Screenshot pending: ${path.relative(ROOT, file).replace(/\\/g, '/')}]`, bold: true, color: '9A3412', size: 20 }),
          ...(hint ? [new TextRun({ text: hint, break: 1, color: '9A3412', size: 18 })] : []),
        ],
      }),
    );
  }
  out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: label, italics: true, size: 18, color: COLORS.muted })] }));
  return out;
}
const shot = (name, caption, hint) => figure(path.join(EVIDENCE, 'screenshots', name), caption, hint);
const appShot = (name, caption, maxH) => figure(path.join(EVIDENCE, 'app', name), caption, 'Captured by tests/e2e/ui-test.js on the live site (deploy-plan step 7)', 600, maxH);

const pricingLinkFile = path.join(EVIDENCE, 'pricing-link.txt');
const pricingLink = fs.existsSync(pricingLinkFile) ? fs.readFileSync(pricingLinkFile, 'utf8').trim() : '[paste the AWS Pricing Calculator share link]';

// ---------- content ----------
const body = [];

// Title block
body.push(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Cloud Computing (SE-490) · Complex Engineering Activity', size: 22, color: COLORS.muted })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Design, Deployment and Cloud-Native Enhancement of a Three-Tier Web Application', bold: true, size: 34, color: COLORS.ink })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Eventra — Event Management System on AWS', size: 26, color: COLORS.brand, bold: true })] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: `${STUDENT.name} · ${STUDENT.roll} · ${STUDENT.section} · Instructor: ${STUDENT.instructor}`, size: 20 }), new TextRun({ text: `Repository: ${REPO_URL}`, break: 1, size: 20, color: COLORS.brand })],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.brand, space: 8 } },
  }),
);

// 1
body.push(
  h1('1. Introduction and Cloud Provider Choice'),
  p('Eventra is a three-tier web application: visitors browse upcoming events and register (with duplicate-email and sold-out protection), and an administrator manages events, views a statistics dashboard and exports registrations as CSV. The objective of this activity was to containerize the application, deploy it on a public cloud with production-style networking and security, and automate build, test and deployment with a CI/CD pipeline.'),
  p('**Amazon Web Services (AWS)** was chosen because (1) it provides every required building block as a managed service — VPC, Application Load Balancer, ECS Fargate, RDS PostgreSQL, ECR, Secrets Manager, CloudWatch; (2) ECS Fargate runs containers without managing servers, which keeps the solution small enough for a single engineer; (3) GitHub Actions authenticates to AWS with OpenID Connect, removing long-lived access keys from the pipeline; and (4) AWS has the largest market share and the most learning resources, which matters for maintainability. Region **us-east-1** offers the lowest prices and all services used.'),
);

// 2
body.push(
  h1('2. Architecture and Design Decisions'),
  p('Figure 1 shows the deployed architecture. All infrastructure is defined in Terraform (infra/terraform, about 60 resources) and is created or destroyed with a single command.'),
  ...figure(path.join(ROOT, 'docs', 'architecture', 'architecture.png'), 'Eventra architecture on AWS — network, tiers, security groups and CI/CD flow', null, 620, 620),
  p('**Request path.** Internet → Internet Gateway → internet-facing ALB in two public subnets → web tasks (Nginx serving the React build) in private subnets → /api calls via ECS Service Connect to app tasks (Node.js/Express) → Amazon RDS PostgreSQL in isolated database subnets. The app tier is never registered with the load balancer; it is reachable only through the web tier, as the brief requires.'),
  p('**Key decisions.**'),
  bullet('**Two Availability Zones** with three subnet layers (public, private-app, private-db) for segmentation and resilience.'),
  bullet('**ECS Fargate** instead of EC2 instances: no servers to patch, per-task billing, native auto scaling and rolling deployments.'),
  bullet('**Stateless application** (JWT authentication, no sessions or local files) so any number of tasks can serve any request.'),
  bullet('**Cost-optimized outbound access** through a NAT instance (t4g.nano) instead of a managed NAT Gateway (≈ $3 vs ≈ $33/month), with the availability trade-off documented in §8.'),
  bullet('**Terraform** as infrastructure-as-code; the pipeline only swaps image versions, so infrastructure and deployments never drift.'),
);

// 3
body.push(
  h1('3. Services Used and Their Role'),
  table(
    ['Tier / area', 'AWS service', 'Role in Eventra'],
    [
      ['Network', 'VPC 10.0.0.0/16, 6 subnets in 2 AZs, Internet Gateway, 3 route tables, NAT instance (EC2 t4g.nano)', 'Public subnets for ALB and NAT; private-app subnets (default route → NAT) for containers; private-db subnets with only the local route'],
      ['Web tier', 'Application Load Balancer + target group (IP), ECS Fargate service eventra-web', 'Public entry point on HTTP :80; Nginx serves the React build and reverse-proxies /api'],
      ['Application tier', 'ECS Fargate service eventra-app, ECS Service Connect / AWS Cloud Map', 'REST API (validation, business rules, JWT auth, CSV export) on port 4000, discoverable only as app.eventra.local'],
      ['Database tier', 'Amazon RDS for PostgreSQL 16 (db.t4g.micro)', 'Events, registrations and admins; encrypted, TLS-only, not publicly accessible'],
      ['Registry', 'Amazon ECR (eventra-web, eventra-app)', 'Stores images tagged with the Git commit SHA; scan on push; lifecycle policy'],
      ['Scaling', 'Application Auto Scaling', 'Target tracking on CPU (60%) and ALB requests per target (500); 1–3 tasks per service'],
      ['Security', 'Security groups, IAM, Secrets Manager, GitHub OIDC provider', 'Per-tier firewalls, least-privilege roles, runtime secret injection, keyless CI/CD'],
      ['Operations', 'CloudWatch Logs, Dashboard, Alarms, SNS', 'Centralized container and database logs, metrics dashboard, alerting'],
    ],
    [1500, 3300, 4226],
  ),
  spacer(),
);

// 4
body.push(
  h1('4. Network Design'),
  table(
    ['Subnet', 'CIDR (AZ A / AZ B)', 'Route table', 'Contains'],
    [
      ['Public', '10.0.0.0/24 · 10.0.1.0/24', '0.0.0.0/0 → Internet Gateway', 'ALB nodes, NAT instance'],
      ['Private app', '10.0.10.0/24 · 10.0.11.0/24', '0.0.0.0/0 → NAT instance ENI', 'Web and app Fargate tasks (no public IPs)'],
      ['Private DB', '10.0.20.0/24 · 10.0.21.0/24', 'local only (no internet route)', 'RDS PostgreSQL (DB subnet group)'],
    ],
    [1400, 2500, 2700, 2426],
  ),
  spacer(),
  p('Private tasks need outbound HTTPS only to pull images from ECR, read Secrets Manager and ship logs to CloudWatch; the NAT instance provides this without allowing any inbound connection. The database layer cannot initiate or receive internet traffic at all.'),
);

// 5
body.push(
  h1('5. Containerization and CI/CD Pipeline'),
  p('**Containers.** The web image is a multi-stage build: a node:22-alpine stage runs the Vite production build, and an nginx:1.27-alpine stage serves the static files (≈ 75 MB) with gzip, long-term caching for hashed assets and an SPA fallback; the /api upstream is a runtime variable (BACKEND_URL) so the same image runs in docker-compose and on ECS. The app image is node:22-alpine with production dependencies only, runs as the non-root node user, and has a HEALTHCHECK on /api/health. docker-compose.yml runs all three tiers locally with health-check-ordered start-up; only the web service publishes a port.'),
  p('**Pipeline (.github/workflows/ci-cd.yml).** Every push and pull request runs:'),
  table(
    ['Stage', 'What it does'],
    [
      ['1. Backend tests', 'Jest + Supertest (78 tests) against a PostgreSQL 16 service container, with coverage'],
      ['2. Frontend', 'ESLint and Vite production build'],
      ['3. Terraform validate', 'terraform fmt -check, init, validate'],
      ['4. Docker build', 'Builds both images with Buildx layer caching (proves the Dockerfiles)'],
      ['5. Deploy (main only)', 'OIDC login to an IAM role → build and push images to ECR (tag = commit SHA) → download the live task definitions → render the new image → rolling update of eventra-app then eventra-web → wait for stability → smoke test /api/health through the ALB'],
    ],
    [2200, 6826],
  ),
  spacer(),
  p('ECS deployment circuit breakers roll back automatically if a new version never becomes healthy, and a concurrency group prevents overlapping deploys. The deploy job is skipped (not failed) until the repository variable AWS_DEPLOY_ENABLED is set.'),
);

// 6
body.push(
  h1('6. Security Considerations'),
  table(
    ['Control', 'Implementation'],
    [
      ['Security groups per tier', 'alb-sg: 80 from internet · web-sg: 80 from alb-sg · app-sg: 4000 from web-sg · db-sg: 5432 from app-sg, no egress. Rules reference security groups, not IP ranges.'],
      ['Network segmentation', 'Only the ALB and NAT instance are public; tasks have no public IPs; RDS publicly_accessible = false in subnets without an internet route.'],
      ['Least privilege (IAM)', 'Execution role may read only the eventra/app secret; task role has no permissions; the GitHub deploy role trusts only this repository on main, and may push only to the two ECR repositories, update only the two ECS services and pass only the two ECS roles.'],
      ['Secrets management', 'Terraform generates DB, JWT and admin passwords and stores them in Secrets Manager; ECS injects them as environment variables at start-up. No secret exists in code, images, task definitions or Git (.env is git-ignored). CI/CD uses OIDC short-lived credentials instead of stored AWS keys.'],
      ['Data protection', 'RDS storage encryption, rds.force_ssl = 1 (TLS mandatory), bcrypt (cost 12) password hashing, parameterised SQL, CSV-injection protection.'],
      ['Application hardening', 'helmet + Nginx CSP and security headers, CORS allow-list, rate limiting on login and registration, Zod input validation, JWT expiry, non-root containers, ECR image scanning, IMDSv2 and no SSH on the NAT instance.'],
    ],
    [2300, 6726],
  ),
  spacer(),
);

// 7
body.push(
  h1('7. Testing Results and Deployment Verification'),
  table(
    ['Suite', 'Scope', 'Result'],
    [
      ['Backend (Jest + Supertest)', 'Health/DB-down 503, listing and filters, registration, duplicate email, full event, concurrent overbooking, admin auth, CRUD, CSV, rate limits', '78 / 78 passed (88% statement coverage)'],
      ['API end-to-end via Nginx', 'Full flow on docker compose: admin creates event, visitor registers, duplicate and sold-out, CSV, DB and API ports not exposed, non-root container', '27 / 27 passed'],
      ['Browser UI (headless Chrome)', 'Real UI on desktop and phone: filters, registration, confirmation, admin login, create/delete event, CSV export', '29 / 29 passed (after 2 fix loops)'],
      ['Cloud-readiness', 'Two app replicas with one JWT (stateless), health 503 when DB is down, data persists across restarts', '3 / 3 passed'],
      ['GitHub Actions CI', 'Tests, lint/build, Terraform validate, Docker builds on every push', 'Green; deploy job runs once AWS is enabled'],
    ],
    [2300, 4626, 2100],
  ),
  spacer(),
  p('Testing found and fixed one critical defect (a React effect returned the Promise from window.scrollTo(), blanking the page on navigation in current Chrome) and two layout issues; the regression checks are part of the UI suite. Figures 2 and 3 show the automated deployment run and the live application served through the load balancer; the complete evidence set is in Appendix A.'),
  ...shot('26-github-actions-run.png', 'GitHub Actions run with all jobs green, including the AWS deploy', 'GitHub → Actions → latest run on main'),
  ...shot('28-app-in-browser.png', 'Eventra running on AWS, opened through the ALB address', 'Browser showing the website_url from terraform output'),
);

// 8
body.push(
  h1('8. Non-Functional Requirements Justification'),
  table(
    ['NFR', 'How the design addresses it', 'Known limitation → improvement'],
    [
      ['Scalability', 'Stateless containers (JWT, no local files); ALB distributes over a target group; horizontal scaling of both tiers; row-level locking and a unique constraint keep data correct with many replicas; paginated, indexed queries.', 'Single RDS instance → read replicas / Aurora, RDS Proxy.'],
      ['Availability / Reliability', 'Two AZs; ALB across AZs; health checks at ALB, container and /api/health (DB-aware) levels; ECS replaces failed tasks; deployment circuit breaker with rollback; managed RDS backups; graceful shutdown.', 'Cost choices: min 1 task, single-AZ RDS, one NAT instance (outbound only) → min_tasks = 2, db_multi_az = true, NAT Gateway per AZ.'],
      ['Elasticity', 'Target-tracking auto scaling on CPU 60% (both tiers) and ALB requests per target (web), 1 → 3 tasks, fast scale-out (60 s) and automatic scale-in (180 s); Fargate needs no pre-provisioned servers; RDS storage autoscaling.', 'DB compute is fixed → Aurora Serverless v2.'],
      ['Security', 'Segmented subnets, chained least-privilege security groups, Secrets Manager, OIDC (no CI keys), TLS to the database, encryption at rest, app-level hardening (see §6).', 'HTTP only → ACM certificate + HTTPS listener, AWS WAF; pin RDS CA.'],
      ['Maintainability / Deployability', 'Identical containers locally, in CI and on ECS; automated test → build → push → rolling deploy → smoke test on every push; SHA-tagged immutable images; one-command IaC.', 'No staging environment → Terraform workspace per environment with approval gate.'],
      ['Performance / Latency', 'Nginx gzip and immutable caching of hashed assets; code-split admin bundle; indexed SQL; all tiers in one region/VPC; scaling before saturation; p50/p95 latency on the dashboard.', 'No CDN or cache → CloudFront, ElastiCache.'],
      ['Cost-Efficiency', '≈ $65/month vs ≈ $127 for the standard HA layout: NAT instance, smallest Fargate size, Spot for scaled tasks, Graviton for NAT/RDS, log retention and ECR lifecycle, terraform destroy when idle.', 'Savings trade availability (see above).'],
      ['Portability', 'OCI images, 12-factor env configuration, standard PostgreSQL, docker-compose runs anywhere; only Terraform and the deploy job are AWS-specific.', 'Kubernetes manifests/Helm for provider-neutral deployment.'],
    ],
    [1700, 4626, 2700],
  ),
  spacer(),
);

// 9
body.push(
  h1('9. Cost Estimate and Optimization'),
  table(
    ['Component', 'Configuration', 'USD / month'],
    [
      ['Application Load Balancer', '1 ALB, ~1 LCU', '17.4'],
      ['ECS Fargate', '2 tasks × 0.25 vCPU / 0.5 GB, 24×7', '18.0'],
      ['NAT instance', 'EC2 t4g.nano + 8 GB gp3', '3.7'],
      ['Public IPv4', '3 addresses (NAT + 2 ALB nodes)', '11.0'],
      ['RDS PostgreSQL', 'db.t4g.micro single-AZ, 20 GB gp3', '14.0'],
      ['Secrets Manager, CloudWatch, Cloud Map, ECR', '1 secret, ~0.3 GB logs, 4 alarms, 0.5 GB images', '1.2'],
      ['**Total**', 'us-east-1 on-demand, low traffic', '**≈ 65 (≈ 2.2 / day)**'],
    ],
    [3000, 4126, 1900],
  ),
  spacer(),
  p(`Estimate checked with the AWS Pricing Calculator: ${pricingLink}. **Implemented optimizations:** (1) NAT instance instead of NAT Gateway (–$30/month); (2) right-sized Fargate tasks with a minimum of one per tier and automatic scale-in; (3) FARGATE_SPOT for scaled-out tasks (up to 70% cheaper); (4) Graviton t4g instances for NAT and RDS; (5) 7-day log retention and ECR lifecycle rules; (6) terraform destroy between demonstrations. **Proposed:** ARM64 Fargate images (–20%), scheduled scale-to-zero for non-production, Savings Plans/Reserved Instances for long-running production, and S3 + CloudFront for static assets.`),
);

// 10
body.push(
  h1('10. Limitations and Conclusion'),
  p('The solution meets every system requirement of the brief: VPC with public/private subnets, Internet Gateway, route tables and NAT; containerized web and application tiers built from Dockerfiles; a managed, non-public PostgreSQL database; images in Amazon ECR; a GitHub Actions pipeline that tests, builds, pushes and deploys on every change; an ALB with a target group and auto scaling; per-tier security groups, segmentation, least-privilege IAM and managed secrets; and four cloud-native enhancements (Terraform IaC, centralized CloudWatch logging/monitoring/alarms, a cost estimate with optimizations, and Spot-based cost tuning).'),
  p('Honest limitations, all deliberate cost trade-offs or out of scope for coursework: single NAT instance and single-AZ database, one task per tier at rest, HTTP without TLS at the load balancer, and per-task rate-limit counters. Each has a one-line Terraform or configuration change toward production readiness, listed in §8.'),
);

// Appendix A
const evidence = [
  ['Network / VPC', [
    ['01-vpc.png', 'VPC eventra-vpc (10.0.0.0/16)'],
    ['02-subnets.png', 'Six subnets across two Availability Zones'],
    ['03-route-tables.png', 'Public route table: 0.0.0.0/0 → Internet Gateway'],
    ['04-route-table-private.png', 'Private app route table: 0.0.0.0/0 → NAT instance'],
    ['05-internet-gateway.png', 'Internet Gateway attached to the VPC'],
    ['06-nat-instance.png', 'NAT instance (t4g.nano) in the public subnet'],
  ]],
  ['Compute / containers', [
    ['07-ecs-cluster.png', 'ECS cluster with the web and app services'],
    ['08-ecs-tasks.png', 'Running, healthy Fargate tasks'],
    ['09-ecs-service-connect.png', 'Service Connect: app.eventra.local:4000, no public IP'],
    ['10-autoscaling.png', 'Service auto scaling (min 1, max 3, target tracking)'],
  ]],
  ['Security groups', [
    ['11-sg-alb.png', 'alb-sg inbound: HTTP 80 from the internet'],
    ['12-sg-web.png', 'web-sg inbound: 80 from alb-sg only'],
    ['13-sg-app.png', 'app-sg inbound: 4000 from web-sg only'],
    ['14-sg-db.png', 'db-sg inbound: 5432 from app-sg only'],
  ]],
  ['Load balancer', [
    ['15-load-balancer.png', 'Internet-facing ALB in two AZs with HTTP:80 listener'],
    ['16-target-group.png', 'Target group with healthy web task targets'],
  ]],
  ['Database', [
    ['17-rds.png', 'RDS PostgreSQL — publicly accessible: No'],
    ['18-rds-config.png', 'RDS configuration — db.t4g.micro, encryption enabled'],
  ]],
  ['Container registry', [
    ['19-ecr-repos.png', 'ECR repositories with scan on push'],
    ['20-ecr-images.png', 'Images tagged with commit SHA and latest'],
  ]],
  ['Secrets, IAM and monitoring', [
    ['21-secrets-manager.png', 'Secrets Manager secret eventra/app (value not shown)'],
    ['22-iam-oidc.png', 'GitHub OIDC deploy role trust policy'],
    ['23-cloudwatch-dashboard.png', 'CloudWatch dashboard eventra-overview'],
    ['24-cloudwatch-alarms.png', 'CloudWatch alarms'],
    ['25-cloudwatch-logs.png', 'Centralized container logs (/ecs/eventra)'],
  ]],
  ['CI/CD', [
    ['27-github-deploy-log.png', 'Deploy job log: push to ECR and health-check smoke test'],
  ]],
  ['Cost', [
    ['29-pricing-calculator.png', 'AWS Pricing Calculator estimate'],
  ]],
];

body.push(new Paragraph({ children: [new PageBreak()] }), h1('Appendix A — Deployment Evidence'));
body.push(p('Console screenshots were captured from the live deployment as listed in docs/evidence-checklist.md. Command-line evidence for every component is in docs/evidence/cli/ (generated by infra/collect-evidence.sh).'));
for (const [group, items] of evidence) {
  body.push(h2(group));
  for (const [file, caption] of items) body.push(...shot(file, caption));
}
body.push(h2('Running application (captured automatically on the live site)'));
body.push(
  ...appShot('01-home-desktop.png', 'Homepage — upcoming events (desktop)', 700),
  ...appShot('02-home-phone.png', 'Homepage on a phone-size screen', 640),
  ...appShot('03-event-details.png', 'Event details with registration form', 640),
  ...appShot('04-confirmation.png', 'Registration confirmation with unique code', 640),
  ...appShot('07-dashboard.png', 'Admin dashboard with statistics and chart', 640),
  ...appShot('10-registrations.png', 'Registrations list with CSV export', 640),
);

body.push(h1('Appendix B — Source Files'));
body.push(
  table(
    ['File', 'Purpose'],
    [
      ['frontend/Dockerfile, frontend/nginx/default.conf.template', 'Web tier image (multi-stage Node → Nginx) and reverse-proxy configuration'],
      ['backend/Dockerfile', 'Application tier image (node:22-alpine, non-root)'],
      ['docker-compose.yml', 'Local three-tier orchestration (web, app, db) with health checks'],
      ['.github/workflows/ci-cd.yml', 'CI/CD pipeline definition (test, build, push, deploy)'],
      ['infra/terraform/*.tf', 'Infrastructure as code: network, security, ECS, ALB, RDS, ECR, IAM, secrets, monitoring'],
      ['docs/', 'Specification, design, test report, deploy plan, NFR justification, cost estimate'],
      ['Repository', REPO_URL],
    ],
    [4000, 5026],
  ),
);

// ---------- document ----------
const doc = new Document({
  creator: STUDENT.name,
  title: 'Eventra — SE-490 Technical Report',
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: COLORS.ink } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: COLORS.brand }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: COLORS.ink }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: {
    config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }],
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Eventra · SE-490 Technical Report · Page ', size: 16, color: COLORS.muted }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.muted })] })],
        }),
      },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${Math.round(buf.length / 1024)} KB)`);
  if (missing.length) {
    console.log(`${missing.length} screenshot(s) still missing — shown as placeholders:`);
    missing.forEach((m) => console.log(`  - ${m.replace(/\\/g, '/')}`));
  } else {
    console.log('All screenshots included.');
  }
});
