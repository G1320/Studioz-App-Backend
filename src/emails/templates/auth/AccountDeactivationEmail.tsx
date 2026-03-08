import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { AccountDeactivationEmailProps } from '../../types.js';

export const AccountDeactivationEmail = ({
  customerName,
  mode = 'light',
}: AccountDeactivationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="חשבונך בוטל" mode={mode}>
      <Header title="חשבונך בוטל" icon="👋" mode={mode} />
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
          חשבונך ב-Studioz בוטל בהצלחה. אנחנו מצטערים לראות אותך עוזב.
        </Text>
        <CTAButton
          href="https://studioz.co.il"
          label="מעבר לאתר →"
          variant="danger"
        />
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
          אם זו טעות, צור איתנו קשר.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

AccountDeactivationEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  mode: 'light',
} as AccountDeactivationEmailProps;
