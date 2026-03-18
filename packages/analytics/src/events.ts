/**
 * Analytics Event Names and Property Types
 *
 * Naming Convention: object_action
 * - Objects: user, organization, connection, queue, job, invitation, theme, scheduled_job, redis_key
 * - Actions: created, updated, deleted, viewed, clicked, selected, paused, resumed, etc.
 *
 * Event names are lowercase with underscores for consistency with PostHog conventions
 */

/**
 * All analytics event names
 * Use these constants throughout the app to ensure consistency
 */
export const AnalyticsEvents = {
  // Auth Events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  USER_ACCOUNT_LINKED: 'user_account_linked',
  USER_ACCOUNT_UNLINKED: 'user_account_unlinked',

  // Organization Events
  ORGANIZATION_CREATED: 'organization_created',
  ORGANIZATION_SWITCHED: 'organization_switched',
  ORGANIZATION_SLUG_CHECKED: 'organization_slug_checked',

  // Team/Member Events
  MEMBER_INVITED: 'member_invited',
  MEMBER_REMOVED: 'member_removed',
  MEMBER_ROLE_UPDATED: 'member_role_updated',

  // Invitation Events
  INVITATION_ACCEPTED: 'invitation_accepted',
  INVITATION_REJECTED: 'invitation_rejected',
  INVITATION_CANCELLED: 'invitation_cancelled',
  INVITATION_RESENT: 'invitation_resent',

  // Connection Events
  CONNECTION_CREATED: 'connection_created',
  CONNECTION_UPDATED: 'connection_updated',
  CONNECTION_DELETED: 'connection_deleted',
  CONNECTION_TESTED: 'connection_tested',
  CONNECTION_SET_DEFAULT: 'connection_set_default',
  CONNECTION_SELECTED: 'connection_selected',
  CONNECTION_URL_TOGGLED: 'connection_url_toggled',

  // Queue Events
  QUEUE_PAUSED: 'queue_paused',
  QUEUE_RESUMED: 'queue_resumed',
  QUEUE_CLEANED: 'queue_cleaned',
  QUEUE_PURGED: 'queue_purged',
  QUEUE_OBLITERATED: 'queue_obliterated',
  QUEUE_DELETED: 'queue_deleted',
  QUEUE_VIEWED: 'queue_viewed',
  QUEUE_LIST_VIEWED: 'queue_list_viewed',
  QUEUE_EMPTY_TOGGLE: 'queue_empty_toggle',

  // Job Events
  JOB_VIEWED: 'job_viewed',
  JOBS_RETRIED: 'jobs_retried',
  JOBS_INVOKED: 'jobs_invoked',
  JOBS_REMOVED: 'jobs_removed',
  JOB_ADDED: 'job_added',
  JOB_DATA_COPIED: 'job_data_copied',
  JOB_ERROR_COPIED: 'job_error_copied',
  JOB_LOG_COPIED: 'job_log_copied',
  JOB_TAB_CHANGED: 'job_tab_changed',
  JOB_STATUS_FILTERED: 'job_status_filtered',

  // Scheduled Job Events
  SCHEDULED_JOB_REMOVED: 'scheduled_job_removed',
  SCHEDULED_JOBS_VIEWED: 'scheduled_jobs_viewed',
  SCHEDULED_JOBS_EXPANDED: 'scheduled_jobs_expanded',
  SCHEDULED_JOBS_COLLAPSED: 'scheduled_jobs_collapsed',

  // Redis Key Events
  REDIS_KEYS_VIEWED: 'redis_keys_viewed',
  REDIS_KEY_DELETED: 'redis_key_deleted',
  REDIS_KEY_COPIED: 'redis_key_copied',
  REDIS_KEY_SELECTED: 'redis_key_selected',
  REDIS_KEY_FILTER_CHANGED: 'redis_key_filter_changed',

  // Worker Events
  WORKERS_VIEWED: 'workers_viewed',

  // UI Events
  THEME_CHANGED: 'theme_changed',
  DIALOG_OPENED: 'dialog_opened',
  DIALOG_CLOSED: 'dialog_closed',
  FAILED_ATTEMPT_EXPANDED: 'failed_attempt_expanded',
  FAILED_ATTEMPT_COLLAPSED: 'failed_attempt_collapsed',
  JSON_NODE_EXPANDED: 'json_node_expanded',
  JSON_COPIED: 'json_copied',

  // Page View Events
  TEAM_VIEWED: 'team_viewed',
  CONNECTIONS_VIEWED: 'connections_viewed',

  // Job Log Events
  JOB_LOGS_CLEARED: 'job_logs_cleared',

  // Settings Events
  SETTINGS_VIEWED: 'settings_viewed',
} as const

/**
 * Type for all event names
 */
export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]

/**
 * Common property keys used across events
 */
export const AnalyticsProperties = {
  // User properties
  USER_ID: 'user_id',
  EMAIL: 'email',

  // Auth properties
  AUTH_METHOD: 'auth_method',
  PROVIDER: 'provider',

  // Organization properties
  ORGANIZATION_ID: 'organization_id',
  ORGANIZATION_NAME: 'organization_name',
  ORGANIZATION_SLUG: 'organization_slug',

  // Connection properties
  CONNECTION_ID: 'connection_id',
  CONNECTION_NAME: 'connection_name',
  CONNECTION_ENVIRONMENT: 'connection_environment',
  IS_DEFAULT: 'is_default',

  // Queue properties
  QUEUE_NAME: 'queue_name',
  QUEUE_STATUS: 'queue_status',
  JOB_COUNT: 'job_count',

  // Job properties
  JOB_ID: 'job_id',
  JOB_IDS: 'job_ids',
  JOB_STATUS: 'job_status',
  JOB_TAB: 'job_tab',

  // Invitation properties
  INVITATION_ID: 'invitation_id',
  INVITEE_EMAIL: 'invitee_email',
  MEMBER_ROLE: 'member_role',

  // Member properties
  MEMBER_ID: 'member_id',
  OLD_ROLE: 'old_role',
  NEW_ROLE: 'new_role',

  // UI properties
  THEME: 'theme',
  DIALOG_TYPE: 'dialog_type',
  ACTION: 'action',

  // Result properties
  SUCCESS: 'success',
  ERROR_MESSAGE: 'error_message',

  // Filter properties
  FILTER_STATUS: 'filter_status',
  EXCLUDE_BULL_KEYS: 'exclude_bull_keys',
  SEARCH_PATTERN: 'search_pattern',

  // Redis key properties
  REDIS_KEY: 'redis_key',

  // Scheduled job properties
  SCHEDULER_ID: 'scheduler_id',

  // Metadata
  PAGE: 'page',
  TAB: 'tab',
  VISIBLE: 'visible',
} as const

/**
 * Auth method values
 */
export const AuthMethod = {
  EMAIL: 'email',
  GOOGLE: 'google',
  GITHUB: 'github',
} as const

export type AuthMethodType = (typeof AuthMethod)[keyof typeof AuthMethod]

/**
 * Dialog type values
 */
export const DialogType = {
  CREATE_CONNECTION: 'create_connection',
  EDIT_CONNECTION: 'edit_connection',
  DELETE_CONNECTION: 'delete_connection',
  CREATE_ORGANIZATION: 'create_organization',
  DELETE_QUEUE: 'delete_queue',
  PURGE_QUEUE: 'purge_queue',
  INVITE_MEMBER: 'invite_member',
  REMOVE_MEMBER: 'remove_member',
  CANCEL_INVITATION: 'cancel_invitation',
  UNLINK_ACCOUNT: 'unlink_account',
  DELETE_REDIS_KEY: 'delete_redis_key',
  INVOKE_JOB: 'invoke_job',
  DUPLICATE_JOB: 'duplicate_job',
  ADD_JOB: 'add_job',
  DELETE_JOB_LOGS: 'delete_job_logs',
} as const

export type DialogTypeValue = (typeof DialogType)[keyof typeof DialogType]

/**
 * Environment values for connections
 */
export const ConnectionEnvironment = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
} as const

/**
 * Member role values
 */
export const MemberRole = {
  MEMBER: 'member',
  ADMIN: 'admin',
  OWNER: 'owner',
} as const

/**
 * Theme values
 */
export const ThemeValue = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
} as const

/**
 * Job tab values
 */
export const JobTab = {
  ATTEMPTS: 'attempts',
  DATA: 'data',
  LOGS: 'logs',
  OPTIONS: 'options',
} as const

/**
 * Queue tab values
 */
export const QueueTab = {
  JOBS: 'jobs',
  SCHEDULED: 'scheduled',
} as const

// ============================================================================
// Event Property Types - Define expected properties for each event
// ============================================================================

/**
 * Auth event properties
 */
export interface SignUpEventProperties {
  [AnalyticsProperties.AUTH_METHOD]: AuthMethodType
  [AnalyticsProperties.EMAIL]?: string
}

export interface SignInEventProperties {
  [AnalyticsProperties.AUTH_METHOD]: AuthMethodType
  [AnalyticsProperties.EMAIL]?: string
  [AnalyticsProperties.SUCCESS]: boolean
}

export interface AccountLinkEventProperties {
  [AnalyticsProperties.PROVIDER]: string
  [AnalyticsProperties.SUCCESS]: boolean
}

/**
 * Organization event properties
 */
export interface OrganizationSwitchedProperties {
  [AnalyticsProperties.ORGANIZATION_ID]: string
  [AnalyticsProperties.ORGANIZATION_NAME]: string
  [AnalyticsProperties.ORGANIZATION_SLUG]: string
}

/**
 * Connection event properties
 */
export interface ConnectionEventProperties {
  [AnalyticsProperties.CONNECTION_ID]?: string
  [AnalyticsProperties.CONNECTION_NAME]?: string
  [AnalyticsProperties.CONNECTION_ENVIRONMENT]?: string
  [AnalyticsProperties.IS_DEFAULT]?: boolean
  [AnalyticsProperties.SUCCESS]?: boolean
}

export interface ConnectionTestedProperties {
  [AnalyticsProperties.SUCCESS]: boolean
  [AnalyticsProperties.ERROR_MESSAGE]?: string
}

export interface ConnectionSelectedProperties {
  [AnalyticsProperties.CONNECTION_ID]: string
  [AnalyticsProperties.CONNECTION_NAME]: string
  [AnalyticsProperties.CONNECTION_ENVIRONMENT]: string
}

/**
 * Queue event properties
 */
export interface QueueEventProperties {
  [AnalyticsProperties.QUEUE_NAME]: string
  [AnalyticsProperties.SUCCESS]?: boolean
  [AnalyticsProperties.ERROR_MESSAGE]?: string
}

export interface QueueCleanedProperties extends QueueEventProperties {
  [AnalyticsProperties.QUEUE_STATUS]: string
  [AnalyticsProperties.JOB_COUNT]: number
}

/**
 * Job event properties
 */
export interface JobViewedProperties {
  [AnalyticsProperties.QUEUE_NAME]: string
  [AnalyticsProperties.JOB_ID]: string
  [AnalyticsProperties.JOB_STATUS]?: string
}

export interface JobsOperationProperties {
  [AnalyticsProperties.QUEUE_NAME]: string
  [AnalyticsProperties.JOB_IDS]: string[]
  [AnalyticsProperties.JOB_COUNT]: number
  [AnalyticsProperties.SUCCESS]?: boolean
}

export interface JobTabChangedProperties {
  [AnalyticsProperties.JOB_ID]: string
  [AnalyticsProperties.JOB_TAB]: string
}

export interface JobStatusFilteredProperties {
  [AnalyticsProperties.QUEUE_NAME]: string
  [AnalyticsProperties.FILTER_STATUS]: string
}

/**
 * Invitation event properties
 */
export interface InvitationEventProperties {
  [AnalyticsProperties.INVITATION_ID]: string
  [AnalyticsProperties.SUCCESS]?: boolean
}

export interface MemberInvitedProperties {
  [AnalyticsProperties.INVITEE_EMAIL]: string
  [AnalyticsProperties.MEMBER_ROLE]: string
  [AnalyticsProperties.ORGANIZATION_ID]: string
  [AnalyticsProperties.SUCCESS]?: boolean
}

export interface MemberRemovedProperties {
  [AnalyticsProperties.MEMBER_ID]: string
  [AnalyticsProperties.ORGANIZATION_ID]: string
  [AnalyticsProperties.SUCCESS]?: boolean
}

export interface MemberRoleUpdatedProperties {
  [AnalyticsProperties.MEMBER_ID]: string
  [AnalyticsProperties.OLD_ROLE]: string
  [AnalyticsProperties.NEW_ROLE]: string
  [AnalyticsProperties.SUCCESS]?: boolean
}

/**
 * UI event properties
 */
export interface ThemeChangedProperties {
  [AnalyticsProperties.THEME]: string
}

export interface DialogEventProperties {
  [AnalyticsProperties.DIALOG_TYPE]: DialogTypeValue
}

/**
 * Redis key event properties
 */
export interface RedisKeyEventProperties {
  [AnalyticsProperties.REDIS_KEY]: string
  [AnalyticsProperties.SUCCESS]?: boolean
}

export interface RedisKeyFilterChangedProperties {
  [AnalyticsProperties.EXCLUDE_BULL_KEYS]: boolean
  [AnalyticsProperties.SEARCH_PATTERN]?: string
}

/**
 * Scheduled job event properties
 */
export interface ScheduledJobEventProperties {
  [AnalyticsProperties.QUEUE_NAME]: string
  [AnalyticsProperties.SCHEDULER_ID]: string
  [AnalyticsProperties.SUCCESS]?: boolean
}

/**
 * Job logs cleared event properties
 */
export interface JobLogsClearedProperties {
  [AnalyticsProperties.QUEUE_NAME]: string
  [AnalyticsProperties.JOB_ID]: string
  [AnalyticsProperties.SUCCESS]?: boolean
  [AnalyticsProperties.ERROR_MESSAGE]?: string
}
