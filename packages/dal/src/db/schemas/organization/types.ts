import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { invitation, member, organization } from './schema'

// Organization types
export type Organization = InferSelectModel<typeof organization>
export type NewOrganization = InferInsertModel<typeof organization>

// Member types
export type Member = InferSelectModel<typeof member>
export type NewMember = InferInsertModel<typeof member>

// Invitation types
export type Invitation = InferSelectModel<typeof invitation>
export type NewInvitation = InferInsertModel<typeof invitation>
