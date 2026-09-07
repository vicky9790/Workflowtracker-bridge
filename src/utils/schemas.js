const { z } = require('zod');

const organizations = {
  register: z.object({
    organizationName: z.string().min(2).max(200),
    email: z.string().email(),
    password: z.string().min(8).max(200),
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  update: z
    .object({ organizationName: z.string().min(2).max(200) })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' }),
  settings: z.object({
    administratorEmail: z.string().email(),
    timeZone: z.string().min(1).max(100),
    workingHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
    workingHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format'),
    browserTracking: z.boolean().optional(),
    applicationTracking: z.boolean().optional(),
    keyboardMetrics: z.boolean().optional(),
    mouseTracking: z.boolean().optional(),
    screenshotsEnabled: z.boolean().optional(),
    idleDetection: z.boolean().optional(),
    idleThresholdSeconds: z.number().int().min(0).optional(),
    screenshotIntervalMs: z.number().int().min(0).optional(),
    setupCompleted: z.boolean(),
    organizationName: z.string().min(2).max(200).optional(),
  }).strict(),
};

const employees = {
  create: z.object({
    employeeCode: z.string().min(1).max(100),
    fullName: z.string().min(1).max(200),
    email: z.string().email().optional(),
    department: z.string().max(200).optional(),
    designation: z.string().max(200).optional(),
  }),
  update: z
    .object({
      fullName: z.string().min(1).max(200).optional(),
      email: z.string().email().optional(),
      department: z.string().max(200).optional(),
      designation: z.string().max(200).optional(),
      status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' }),
  list: z.object({
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(200).default(50),
  }),
  idParam: z.object({ id: z.string().uuid() }),
};

const devices = {
  list: z.object({
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(200).default(50),
  }),
  idParam: z.object({ id: z.string().uuid() }),
  updateStatus: z.object({ status: z.enum(['ONLINE', 'OFFLINE', 'DISABLED']) }),
};

const agent = {
  enroll: z.object({
    organization_code: z.string().min(1).optional(),
    employee_id: z.string().min(1).optional(),
    activation_code: z.string().min(1).optional(),
    device_id: z.string().min(1),
    hostname: z.string().optional(),
    os: z.string().optional(),
    os_version: z.string().optional(),
    arch: z.string().optional(),
    agent_version: z.string().optional(),
  }),
  heartbeat: z.object({
    // PRIVATE is real: the Agent sends it when privateMode is on (see
    // heartbeat.ts). It does not change Device.status in the DB (that
    // stays ONLINE - the device IS connected, just paused for privacy);
    // it's passed through as-is to the org's Zoho device_heartbeat call.
    status: z.enum(['ONLINE', 'OFFLINE', 'PRIVATE']).default('ONLINE'),
    agent_version: z.string().optional(),
  }),
};

const eventIdRequired = z.string().min(1).max(200);

const activity = {
  workSession: z.object({
    session_id: z.string().min(1),
    action: z.enum(['START', 'END']),
    login_time: z.string().optional(),
    logout_time: z.string().optional(),
    total_duration: z.union([z.string(), z.number()]).optional(),
    active_duration: z.union([z.string(), z.number()]).optional(),
    idle_duration: z.union([z.string(), z.number()]).optional(),
    session_status: z.string().optional(),
    session_date: z.string().optional(),
    notes: z.string().optional(),
    event_id: eventIdRequired,
  }),
  browserActivity: z.object({
    browser: z.string().min(1),
    domain: z.string().min(1),
    url: z.string().optional(),
    page_title: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    duration_seconds: z.union([z.string(), z.number()]).optional(),
    action: z.enum(['OPEN', 'CLOSE']),
    event_id: z.string().min(1),
    open_event_id: z.string().optional(),
  }),
  applicationUsage: z.object({
    application_name: z.string().min(1),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    duration_seconds: z.union([z.string(), z.number()]).optional(),
    event_id: eventIdRequired,
  }),
  keyboardMetrics: z.object({
    keystroke_count: z.union([z.string(), z.number()]).optional(),
    active_duration: z.union([z.string(), z.number()]).optional(),
    timestamp: z.string().optional(),
    event_id: eventIdRequired,
  }),
  mouseMetrics: z.object({
    click_count: z.union([z.string(), z.number()]).optional(),
    movement_events: z.union([z.string(), z.number()]).optional(),
    scroll_events: z.union([z.string(), z.number()]).optional(),
    active_duration: z.union([z.string(), z.number()]).optional(),
    timestamp: z.string().optional(),
    event_id: eventIdRequired,
  }),
  screenshot: z.object({
    timestamp: z.string().optional(),
    screenshot_file: z.string().min(1),
    session_id: z.string().optional(),
    capture_reason: z.string().optional(),
    privacy_status: z.string().optional(),
    event_id: eventIdRequired,
  }),
  batchEvent: z.object({
    type: z.string().min(1),
    event_id: eventIdRequired,
    data: z.record(z.any()),
  }),
  batch: z.object({
    events: z.array(z.lazy(() => activity.batchEvent)).min(1).max(500),
  }),
};

const zoho = {
  callback: z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }),
};

const sync = {
  logsQuery: z.object({
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(200).default(50),
    status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'DEAD']).optional(),
  }),
};

const integrations = {
  creatorActivationParams: z.object({
    employeeId: z.string().min(1),
  }),
  creatorActivationBody: z.object({
    organizationId: z.string().min(1),
    employeeName: z.string().optional(),
    email: z.string().optional(),
  }).passthrough(),
};

module.exports = { organizations, employees, devices, agent, activity, zoho, sync, integrations };

