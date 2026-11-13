import type { ReactNode } from 'react';
import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from 'react-email';

// The base layout for every Creavent email: plain, readable on a phone, with
// one button for the one thing to do (design brief §4).
export function EmailLayout({
  preview,
  children,
  supportEmail,
}: {
  preview: string;
  children: ReactNode;
  supportEmail: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#FAFAF9', color: '#18181B', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0 }}>
        <Container style={{ maxWidth: '520px', padding: '32px 20px' }}>
          <Text style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 24px' }}>creavent</Text>
          <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '24px', border: '1px solid #E3E3E0' }}>
            {children}
          </Section>
          <Hr style={{ borderColor: '#E3E3E0', margin: '24px 0 16px' }} />
          <Text style={{ fontSize: '13px', color: '#5C5C63', margin: 0 }}>
            Questions? Email us at {supportEmail}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: '16px', lineHeight: '24px', margin: '0 0 16px' }}>{children}</Text>;
}

export function ActionButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      style={{ backgroundColor: '#18181B', color: '#FFFFFF', borderRadius: '10px', padding: '14px 20px', fontSize: '16px', fontWeight: 600 }}
    >
      {children}
    </Button>
  );
}
