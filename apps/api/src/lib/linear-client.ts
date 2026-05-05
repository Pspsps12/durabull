const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql'

interface LinearGraphQLError {
  message?: string
  extensions?: {
    code?: string
    type?: string
  }
}

interface LinearGraphQLResponse<T> {
  data?: T
  errors?: LinearGraphQLError[]
}

export class LinearApiError extends Error {
  status: number
  retryable: boolean
  rateLimitResetAt: Date | null

  constructor(
    message: string,
    options: { status: number; retryable: boolean; rateLimitResetAt?: Date | null }
  ) {
    super(message)
    this.name = 'LinearApiError'
    this.status = options.status
    this.retryable = options.retryable
    this.rateLimitResetAt = options.rateLimitResetAt ?? null
  }
}

export interface LinearIssueInput {
  teamId: string
  title: string
  description: string
  projectId?: string | null
  labelIds?: string[]
  assigneeId?: string | null
  stateId?: string | null
  priority?: number | null
}

export interface LinearIssueResult {
  id: string
  identifier: string
  url: string
}

export interface LinearTeamSummary {
  id: string
  name: string
  key: string
}

export interface LinearMetadata {
  teams: LinearTeamSummary[]
  projects: Array<{ id: string; name: string }>
  labels: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string; email?: string | null }>
  states: Array<{ id: string; name: string; teamId: string }>
}

function parseRateLimitReset(headers: Headers): Date | null {
  const reset = headers.get('x-ratelimit-reset')
  if (!reset) return null
  const numeric = Number(reset)
  if (!Number.isFinite(numeric)) return null
  return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
}

function redactLinearError(message: string): string {
  return message.replace(/lin_api_[A-Za-z0-9_-]+/g, '[REDACTED_LINEAR_API_KEY]')
}

async function linearGraphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  let response: Response
  try {
    response = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
  } catch (error) {
    throw new LinearApiError(error instanceof Error ? error.message : 'Linear network error', {
      status: 0,
      retryable: true,
    })
  }

  const rateLimitResetAt = parseRateLimitReset(response.headers)
  const retryable =
    response.status === 429 ||
    response.status === 408 ||
    response.status >= 500 ||
    response.status === 0

  let payload: LinearGraphQLResponse<T> | null = null
  try {
    payload = (await response.json()) as LinearGraphQLResponse<T>
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new LinearApiError(
      redactLinearError(
        payload?.errors?.[0]?.message ?? `Linear request failed (${response.status})`
      ),
      { status: response.status, retryable, rateLimitResetAt }
    )
  }

  if (payload?.errors?.length) {
    const code = payload.errors[0]?.extensions?.code ?? payload.errors[0]?.extensions?.type
    const retryableGraphql = code === 'RATELIMITED' || code === 'INTERNAL_ERROR'
    throw new LinearApiError(
      redactLinearError(payload.errors[0]?.message ?? 'Linear GraphQL error'),
      {
        status: code === 'AUTHENTICATION_ERROR' ? 401 : 400,
        retryable: retryableGraphql,
        rateLimitResetAt,
      }
    )
  }

  if (!payload?.data) {
    throw new LinearApiError('Linear returned an empty response.', {
      status: response.status,
      retryable: true,
      rateLimitResetAt,
    })
  }

  return payload.data
}

export async function validateLinearApiKey(apiKey: string): Promise<{ organizationName: string }> {
  const data = await linearGraphql<{ organization: { name: string } }>(
    apiKey,
    'query DurabullValidateLinearKey { organization { name } }'
  )

  return { organizationName: data.organization.name }
}

export async function fetchLinearMetadata(apiKey: string): Promise<LinearMetadata> {
  const data = await linearGraphql<{
    teams: { nodes: LinearTeamSummary[] }
    projects: { nodes: Array<{ id: string; name: string }> }
    issueLabels: { nodes: Array<{ id: string; name: string }> }
    users: { nodes: Array<{ id: string; name: string; email?: string | null }> }
    workflowStates: { nodes: Array<{ id: string; name: string; team: { id: string } }> }
  }>(
    apiKey,
    `query DurabullLinearMetadata {
      teams(first: 100) { nodes { id name key } }
      projects(first: 100) { nodes { id name } }
      issueLabels(first: 100) { nodes { id name } }
      users(first: 100) { nodes { id name email } }
      workflowStates(first: 250) { nodes { id name team { id } } }
    }`
  )

  return {
    teams: data.teams.nodes,
    projects: data.projects.nodes,
    labels: data.issueLabels.nodes,
    users: data.users.nodes,
    states: data.workflowStates.nodes.map((state) => ({
      id: state.id,
      name: state.name,
      teamId: state.team.id,
    })),
  }
}

export async function createLinearIssue(
  apiKey: string,
  input: LinearIssueInput
): Promise<LinearIssueResult> {
  const data = await linearGraphql<{
    issueCreate: {
      success: boolean
      issue?: LinearIssueResult | null
    }
  }>(
    apiKey,
    `mutation DurabullCreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }`,
    {
      input: {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.labelIds?.length ? { labelIds: input.labelIds } : {}),
        ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
        ...(input.stateId ? { stateId: input.stateId } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
      },
    }
  )

  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new LinearApiError('Linear did not create an issue.', { status: 400, retryable: false })
  }

  return data.issueCreate.issue
}
