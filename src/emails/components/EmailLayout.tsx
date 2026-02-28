import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Preview,
  Font,
} from '@react-email/components';
import { type ThemeMode, getTheme, fontFamily } from './theme.js';

interface EmailLayoutProps {
  children: React.ReactNode;
  preview?: string;
  mode?: ThemeMode;
}

export function EmailLayout({
  children,
  preview,
  mode = 'dark',
}: EmailLayoutProps) {
  const theme = getTheme(mode);

  return (
    <Html dir="rtl" lang="he">
      <Head>
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily={['Arial', 'Helvetica', 'sans-serif']}
          webFont={{
            url: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      {preview && <Preview>{preview}</Preview>}
      <Body
        style={{
          margin: 0,
          padding: '20px',
          backgroundColor: theme.bg,
          fontFamily,
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
          }}
        >
          <Section
            style={{
              backgroundColor: theme.cardBg,
              borderRadius: '16px',
              border: `1px solid ${theme.border}`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {children}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
