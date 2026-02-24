import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface InviteEmailProps {
  recipientEmail: string
  inviterName: string
  inviterEmail: string
  organizationName: string
  inviteLink: string
  role: string
  expiresAt?: Date
}

// Brand colors
const emerald = {
  50: '#ecfdf5',
  100: '#d1fae5',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  900: '#064e3b',
  950: '#022c22',
}

const neutral = {
  50: '#fafafa',
  100: '#f5f5f5',
  200: '#e5e5e5',
  300: '#d4d4d4',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#171717',
  950: '#0a0a0a',
}

export function InviteEmail({
  inviterName = 'Team Member',
  // inviterEmail is intentionally unused - kept in interface for future use
  organizationName = 'Acme Inc',
  inviteLink = 'https://durabull.io/invite/example-id',
  role = 'member',
  expiresAt,
}: InviteEmailProps) {
  const expirationText = expiresAt
    ? `This invitation expires on ${expiresAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`
    : 'This invitation will expire in 7 days.'

  const previewText = `You've been invited to join ${organizationName} on Durabull`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <div style={logoBox}>
              <svg
                viewBox="0 0 569 569"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                style={{ display: 'block', margin: '10px auto' }}
                role="img"
                aria-label="Durabull"
              >
                <title>Durabull</title>
                <path
                  d="M295 25L515 150.597V401.847L422.757 457"
                  stroke="#064e3b"
                  strokeWidth="28.409"
                  strokeLinecap="round"
                />
                <path
                  d="M274 544L54 418.112V166.281L146.243 111"
                  stroke="#064e3b"
                  strokeWidth="28.409"
                  strokeLinecap="round"
                />
                <path
                  d="M245 55L465 180.659V372.821L372.758 428"
                  stroke="#064e3b"
                  strokeWidth="28.409"
                  strokeLinecap="round"
                />
                <path
                  d="M324 515L105 389.004V196.327L196.823 141"
                  stroke="#064e3b"
                  strokeWidth="28.409"
                  strokeLinecap="round"
                />
                <path
                  d="M195 84L415 209.743V342.783L322.757 398"
                  stroke="#064e3b"
                  strokeWidth="28.409"
                  strokeLinecap="round"
                />
                <path
                  d="M374 484L154 358.657V226.041L246.243 171"
                  stroke="#064e3b"
                  strokeWidth="28.409"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </Section>

          {/* Header */}
          <Heading style={heading}>You've Been Invited</Heading>

          {/* Content Card */}
          <Section style={contentCard}>
            <Text style={paragraph}>
              <span style={highlightText}>{inviterName}</span> has invited you to join{' '}
              <span style={highlightText}>{organizationName}</span> on Durabull as a{' '}
              <span style={roleTag}>{role}</span>.
            </Text>

            <Text style={mutedParagraph}>
              Durabull is the modern queue management dashboard for BullMQ. Monitor jobs, debug
              failures, and scale your background processing with your team.
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={buttonSection}>
            <Button style={button} href={inviteLink}>
              Accept Invitation
            </Button>
          </Section>

          {/* Expiration notice */}
          <Section style={noticeSection}>
            <Text style={noticeText}>{expirationText}</Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Text style={footer}>
            This email was sent by{' '}
            <Link href="https://durabull.io" style={footerLink}>
              Durabull
            </Link>{' '}
            on behalf of {organizationName}.
          </Text>

          <Text style={footerMuted}>
            If you didn't expect this invitation, you can safely ignore this email.
          </Text>

          {/* Fallback link */}
          <Section style={fallbackSection}>
            <Text style={fallbackText}>Can't click the button? Copy and paste this link:</Text>
            <Text style={fallbackLinkWrapper}>
              <Link href={inviteLink} style={fallbackLink}>
                {inviteLink}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles - Premium dark theme matching brand
const main = {
  backgroundColor: neutral[950],
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: '40px 20px',
}

const container = {
  backgroundColor: neutral[900],
  margin: '0 auto',
  padding: '48px 40px',
  borderRadius: '16px',
  maxWidth: '560px',
  border: `1px solid ${neutral[800]}`,
}

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
}

const logoBox = {
  display: 'inline-block',
  width: '48px',
  height: '48px',
  backgroundColor: emerald[500],
  borderRadius: '10px',
  textAlign: 'center' as const,
}

const heading = {
  color: neutral[50],
  fontSize: '28px',
  fontWeight: '600' as const,
  textAlign: 'center' as const,
  margin: '0 0 32px 0',
  letterSpacing: '-0.02em',
}

const contentCard = {
  backgroundColor: neutral[800],
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '8px',
  border: `1px solid ${neutral[700]}`,
}

const paragraph = {
  color: neutral[200],
  fontSize: '16px',
  lineHeight: '1.7',
  margin: '0 0 16px 0',
}

const mutedParagraph = {
  color: neutral[400],
  fontSize: '15px',
  lineHeight: '1.6',
  margin: 0,
}

const highlightText = {
  color: neutral[50],
  fontWeight: '600' as const,
}

const roleTag = {
  display: 'inline-block',
  backgroundColor: emerald[950],
  color: emerald[400],
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  fontWeight: '500' as const,
  fontFamily: 'ui-monospace, monospace',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  display: 'inline-block',
  padding: '14px 36px',
  backgroundColor: emerald[500],
  color: emerald[950],
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  borderRadius: '8px',
}

const noticeSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const noticeText = {
  color: neutral[500],
  fontSize: '13px',
  margin: 0,
}

const hr = {
  borderColor: neutral[800],
  borderTopWidth: '1px',
  margin: '24px 0',
}

const footer = {
  color: neutral[400],
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
  lineHeight: '1.6',
}

const footerLink = {
  color: emerald[400],
  textDecoration: 'none',
}

const footerMuted = {
  color: neutral[600],
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
}

const fallbackSection = {
  backgroundColor: neutral[800],
  borderRadius: '8px',
  padding: '16px',
  border: `1px solid ${neutral[700]}`,
}

const fallbackText = {
  color: neutral[500],
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0 0 8px 0',
}

const fallbackLinkWrapper = {
  margin: 0,
  textAlign: 'center' as const,
}

const fallbackLink = {
  color: emerald[400],
  fontSize: '12px',
  wordBreak: 'break-all' as const,
  fontFamily: 'ui-monospace, monospace',
}

export default InviteEmail
