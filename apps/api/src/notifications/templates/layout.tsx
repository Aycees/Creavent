import type { CSSProperties, ReactNode } from 'react';
import { Body, Head, Html, Link, Preview } from 'react-email';

// The frame of every Creavent email (mockup EmailVerify, EmailReset): the logo
// above a white card, and a footer with the support address. Tables and inline
// styles, so it renders the same in Gmail, Outlook, and phone mail apps.

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const ink = '#18181B';
const muted = '#5C5C63';
const subtle = '#74747B';
const border = '#E3E3E0';

// The "market grid" logo: 3 x 3 squares, the center one ember, the last one
// outlined (design brief §9).
function Logo() {
  const cell = (bg: string, outlined = false): CSSProperties => ({
    width: 6,
    height: 6,
    padding: 0,
    borderRadius: 1.5,
    background: bg,
    boxShadow: outlined ? `inset 0 0 0 1.5px ${ink}` : undefined,
    fontSize: 0,
    lineHeight: 0,
  });
  const rows = [
    [cell(ink), cell(ink), cell(ink)],
    [cell(ink), cell('#C93C17'), cell(ink)],
    [cell(ink), cell(ink), cell('#FFFFFF', true)],
  ];
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'middle', paddingRight: 8 }}>
            <table role="presentation" cellPadding={0} cellSpacing={2} style={{ borderCollapse: 'separate', margin: -2 }}>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((style, j) => (
                      <td key={j} style={style}>
                        &nbsp;
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
          <td style={{ verticalAlign: 'middle', fontFamily: font, fontSize: 20, lineHeight: '24px', fontWeight: 600, letterSpacing: -0.6, color: ink }}>
            creavent
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailLayout({
  preview,
  children,
  supportEmail,
  siteHost,
}: {
  preview: string;
  children: ReactNode;
  supportEmail: string;
  siteHost: string;
}) {
  const footer: CSSProperties = { margin: 0, fontFamily: font, fontSize: 13, lineHeight: '20px', color: subtle };
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, background: '#FAFAF9' }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ background: '#FAFAF9' }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '48px 24px' }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 600 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0 4px 20px' }}>
                        <Logo />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ background: '#FFFFFF', border: `1px solid ${border}`, borderRadius: 12, padding: 40 }}>{children}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '24px 4px 0' }}>
                        <p style={{ ...footer, marginBottom: 8 }}>
                          Questions? Write to{' '}
                          <Link href={`mailto:${supportEmail}`} style={{ color: muted, textDecoration: 'underline' }}>
                            {supportEmail}
                          </Link>
                          .
                        </p>
                        <p style={footer}>
                          Creavent · Find flea markets and local events near you.
                          <br />
                          You&apos;re getting this because this address was used on {siteHost}.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h1 style={{ margin: '0 0 20px', fontFamily: font, fontSize: 26, lineHeight: '32px', fontWeight: 600, letterSpacing: -0.4, color: ink }}>
      {children}
    </h1>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <p style={{ margin: '0 0 16px', fontFamily: font, fontSize: 16, lineHeight: '24px', color: ink }}>{children}</p>;
}

// Smaller grey text: expiry, reassurance, and the like.
export function Note({ children, last }: { children: ReactNode; last?: boolean }) {
  return <p style={{ margin: last ? 0 : '0 0 20px', fontFamily: font, fontSize: 14, lineHeight: '21px', color: muted }}>{children}</p>;
}

export function ActionButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 20px' }}>
      <tbody>
        <tr>
          <td style={{ borderRadius: 8, background: ink }}>
            <a
              href={href}
              style={{ display: 'inline-block', padding: '14px 24px', fontFamily: font, fontSize: 16, lineHeight: '20px', fontWeight: 600, color: '#FFFFFF', textDecoration: 'none', borderRadius: 8 }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: border, margin: '8px 0 20px', fontSize: 0, lineHeight: 0 }}>&nbsp;</div>;
}

// "Button not working?" and the address to copy.
export function CopyLink({ href }: { href: string }) {
  return (
    <>
      <p style={{ margin: '0 0 6px', fontFamily: font, fontSize: 14, lineHeight: '21px', color: muted }}>
        Button not working? Copy this link into your browser:
      </p>
      <p style={{ margin: '0 0 20px', fontFamily: font, fontSize: 14, lineHeight: '21px', color: ink }}>
        <a href={href} style={{ color: ink, textDecoration: 'underline', wordBreak: 'break-all' }}>
          {href}
        </a>
      </p>
    </>
  );
}

// A grey box with a label and a few lines, like the reset email's request details.
export function InfoBox({ label, lines }: { label: string; lines: string[] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 20px', background: '#F3F3F1', borderRadius: 8 }}>
      <tbody>
        <tr>
          <td style={{ padding: '14px 16px' }}>
            <p style={{ margin: '0 0 4px', fontFamily: font, fontSize: 13, lineHeight: '20px', color: muted, fontWeight: 600 }}>{label}</p>
            <p style={{ margin: 0, fontFamily: font, fontSize: 14, lineHeight: '21px', color: ink }}>
              {lines.map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
