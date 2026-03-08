import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { PasswordResetEmailProps } from '../../types.js';

export const PasswordResetEmail = ({
  customerName,
  resetLink,
  mode = 'light',
}: PasswordResetEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="איפוס סיסמה" mode={mode}>
      <Header title="איפוס סיסמה" icon="🔑" mode={mode} />
      <Section style={{ padding: '24px' }}>
        <Text
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: theme.text,
            margin: '0 0 8px',
            fontFamily,
          }}
        >
          היי {customerName},
        </Text>
        <Text
          style={{
            lineHeight: '1.7',
            color: theme.textMuted,
            margin: '0 0 24px',
            fontFamily,
          }}
        >
          ביקשת לאפס את הסיסמה שלך. השתמש בקישור למטה כדי להמשיך.
        </Text>
        <CTAButton href={resetLink} label="איפוס סיסמה →" />
        <Text
          style={{
            fontSize: '13px',
            lineHeight: '1.6',
            color: theme.textMuted,
            margin: '24px 0 0',
            fontFamily,
            textAlign: 'center',
          }}
        >
          אם לא ביקשת איפוס סיסמה, התעלם מהודעה זו.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

PasswordResetEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  resetLink: 'https://studioz.co.il/reset-password?token=abc123',
  mode: 'light',
} as PasswordResetEmailProps;
