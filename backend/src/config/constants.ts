export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MARKETING_MANAGER: 'Marketing Manager',
  ASSISTANT_MANAGER: 'Assistant Manager',
  ASSISTANT_MARKETING_MANAGER: 'Assistant Marketing Manager',
  TEAM_LEADER: 'Team Leader',
  EMPLOYEE: 'Employee',
  POSTING_EXECUTIVE: 'Posting & Content Executive',
  BARTER_EXECUTIVE: 'Barter Collab Executive',
  PAID_EXECUTIVE: 'Paid Collab Executive',
  CLIENT: 'Client',
};

// Brand Assignment Division Enum: 1 = Posting & Content, 2 = Barter Collab, 3 = Paid Collab
export const BRAND_ASSIGNMENT_TYPE = {
  POSTING: 1,
  BARTER: 2,
  PAID: 3
} as const;

export type BrandAssignmentTypeId = 1 | 2 | 3;

export const BRAND_ASSIGNMENT_LABEL: Record<number, string> = {
  1: 'Posting & Content',
  2: 'Barter Collab',
  3: 'Paid Collab'
};

export const getAssignmentTypeFromRole = (role?: string | null): BrandAssignmentTypeId => {
  if (!role) return 1;
  const r = role.toLowerCase();
  if (r.includes('barter')) return 2;
  if (r.includes('paid')) return 3;
  return 1;
};

export const isManagerOrAdminRole = (role?: string | null): boolean => {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r.includes('admin') || r.includes('manager');
};

export const PERMISSIONS = [
  // User & Employee
  'employee.view',
  'employee.create',
  'employee.update',
  'employee.delete',

  // Brand
  'brand.view',
  'brand.create',
  'brand.update',
  'brand.delete',
  'brand.assign',

  // Task
  'task.view',
  'task.create',
  'task.update',
  'task.delete',
  'task.verify',

  // Daily Postings & Calendar
  'posting.view',
  'posting.create',
  'posting.update',

  // Performance & Reports
  'performance.view',
  'report.view',
  'report.export',

  // Settings & System
  'settings.view',
  'settings.update',
  'audit.view',

  // Target Module
  'target.view',
  'target.create',
  'target.update',
  'target.delete',
  'target.paid.view',
  'target.barter.view',

  // Influencer Module - General
  'influencer.view',
  'influencer.create',
  'influencer.update',
  'influencer.delete',

  // Influencer - Paid Collaborations
  'influencer.paid.view',
  'influencer.paid.create',
  'influencer.paid.update',
  'influencer.paid.delete',

  // Influencer - Barter Collaborations
  'influencer.barter.view',
  'influencer.barter.create',
  'influencer.barter.update',
  'influencer.barter.delete',

  // Influencer - Payment Audit Logs
  'influencer.payment.view',

  // Client Portal
  'client.view',
  'client.approve'
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: PERMISSIONS,
  [ROLES.ADMIN]: PERMISSIONS,
  [ROLES.MARKETING_MANAGER]: [
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'brand.view', 'brand.create', 'brand.update', 'brand.delete', 'brand.assign',
    'task.view', 'task.create', 'task.update', 'task.delete', 'task.verify',
    'posting.view', 'posting.create', 'posting.update',
    'performance.view', 'report.view', 'report.export',
    'settings.view', 'audit.view',
    'target.view', 'target.create', 'target.update', 'target.delete', 'target.paid.view', 'target.barter.view',
    'influencer.view', 'influencer.create', 'influencer.update', 'influencer.delete',
    'influencer.paid.view', 'influencer.paid.create', 'influencer.paid.update', 'influencer.paid.delete',
    'influencer.barter.view', 'influencer.barter.create', 'influencer.barter.update', 'influencer.barter.delete',
    'influencer.payment.view'
  ],
  [ROLES.ASSISTANT_MANAGER]: [
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'brand.view', 'brand.create', 'brand.update', 'brand.delete', 'brand.assign',
    'task.view', 'task.create', 'task.update', 'task.delete', 'task.verify',
    'posting.view', 'posting.create', 'posting.update',
    'performance.view', 'report.view', 'report.export',
    'settings.view', 'audit.view',
    'target.view', 'target.paid.view', 'target.barter.view',
    'influencer.view', 'influencer.create', 'influencer.update', 'influencer.delete',
    'influencer.paid.view', 'influencer.paid.create', 'influencer.paid.update',
    'influencer.barter.view', 'influencer.barter.create', 'influencer.barter.update',
    'influencer.payment.view'
  ],
  [ROLES.ASSISTANT_MARKETING_MANAGER]: [
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'brand.view', 'brand.create', 'brand.update', 'brand.delete', 'brand.assign',
    'task.view', 'task.create', 'task.update', 'task.delete', 'task.verify',
    'posting.view', 'posting.create', 'posting.update',
    'performance.view', 'report.view', 'report.export',
    'settings.view', 'audit.view',
    'target.view', 'target.paid.view', 'target.barter.view',
    'influencer.view', 'influencer.create', 'influencer.update', 'influencer.delete',
    'influencer.paid.view', 'influencer.paid.create', 'influencer.paid.update',
    'influencer.barter.view', 'influencer.barter.create', 'influencer.barter.update',
    'influencer.payment.view'
  ],
  [ROLES.TEAM_LEADER]: [
    'employee.view', 'employee.create', 'employee.update',
    'brand.view', 'brand.create', 'brand.update', 'brand.assign',
    'task.view', 'task.create', 'task.update', 'task.verify',
    'posting.view', 'posting.create', 'posting.update',
    'performance.view', 'report.view',
    'target.view', 'target.update', 'target.paid.view', 'target.barter.view',
    'influencer.view', 'influencer.create', 'influencer.update',
    'influencer.paid.view', 'influencer.paid.create', 'influencer.paid.update',
    'influencer.barter.view', 'influencer.barter.create', 'influencer.barter.update'
  ],
  [ROLES.POSTING_EXECUTIVE]: [
    'brand.view',
    'task.view', 'task.create', 'task.update',
    'posting.view', 'posting.create', 'posting.update',
    'performance.view'
  ],
  [ROLES.BARTER_EXECUTIVE]: [
    'brand.view',
    'influencer.view', 'influencer.create', 'influencer.update',
    'influencer.barter.view', 'influencer.barter.create', 'influencer.barter.update',
    'target.view', 'target.barter.view',
    'performance.view'
  ],
  [ROLES.PAID_EXECUTIVE]: [
    'brand.view',
    'influencer.view', 'influencer.create', 'influencer.update',
    'influencer.paid.view', 'influencer.paid.create', 'influencer.paid.update',
    'influencer.payment.view', 'influencer.payment.create', 'influencer.payment.update',
    'target.view', 'target.paid.view',
    'performance.view'
  ],
  [ROLES.EMPLOYEE]: [
    'employee.view',
    'brand.view', 'brand.create', 'brand.update', 'brand.delete',
    'task.view', 'task.create', 'task.update', 'task.delete',
    'posting.view', 'posting.update',
    'performance.view', 'report.view',
    'target.view',
    'influencer.view', 'influencer.create', 'influencer.update', 'influencer.delete',
    'influencer.paid.view', 'influencer.barter.view'
  ],
  [ROLES.CLIENT]: [
    'client.view',
    'client.approve',
    'posting.view',
    'brand.view'
  ]
};

export const PLATFORMS = ['Instagram', 'YouTube', 'TikTok', 'X (Twitter)', 'LinkedIn', 'Facebook'];
export const CONTENT_TYPES = ['Reel', 'Post', 'Story', 'Short', 'Video', 'Carousel', 'Article', 'Tweet'];
export const TASK_STATUSES = ['Pending', 'In Progress', 'Submitted', 'Verified', 'Rejected', 'Delayed', 'Missed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const DEPARTMENTS = ['Influencer Marketing', 'Content Creation', 'Campaign Strategy', 'Quality Control', 'Management'];
export const DESIGNATIONS = [
  'Marketing Manager',
  'Assistant Manager',
  'Assistant Marketing Manager',
  'Senior Influencer Specialist',
  'Influencer Executive',
  'Posting & Content Executive',
  'Barter Collab Executive',
  'Paid Collab Executive',
  'Content Strategist',
  'Team Lead'
];
