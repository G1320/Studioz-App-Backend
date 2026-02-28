import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { EmailVerificationEmailProps } from '../../types.js';

export const EmailVerificationEmail = ({
  customerName,
  verificationLink,
  verificationCode,
  mode = 'dark',
}: EmailVerificationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="אימות כתובת אימייל" mode={mode}>
      <Header title="אימות כתובת אימייל" icon="🛡️" mode={mode} />
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
          אנא אמת את כתובת האימייל שלך כדי להשלים את תהליך ההרשמה.
        </Text>
        {verificationCode && (
          <Section style={{ marginBottom: '24px' }}>
            <DetailsCard
              rows={[
                {
                  icon: '🔐',
                  label: 'קוד אימות',
                  value: verificationCode,
                },
              ]}
              mode={mode}
            />
          </Section>
        )}
        <CTAButton href={verificationLink} label="אימות אימייל →" />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

EmailVerificationEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  verificationLink: 'https://studioz.co.il/verify?token=abc123',
  verificationCode: '123456',
  mode: 'dark',
} as EmailVerificationEmailProps;
