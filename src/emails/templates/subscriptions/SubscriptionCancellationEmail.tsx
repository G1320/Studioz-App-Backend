import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { SubscriptionCancellationEmailProps } from '../../types.js';

export const SubscriptionCancellationEmail = ({
  customerName,
  mode = 'dark',
}: SubscriptionCancellationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="המינוי בוטל" mode={mode}>
      <Header title="המינוי בוטל" icon="❌" mode={mode} />
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
          המינוי שלך בוטל לבקשתך. תוכל להמשיך להשתמש בשירות עד סוף תקופת
          החיוב הנוכחית.
        </Text>
        <CTAButton
          href="https://studioz.co.il"
          label="מעבר לאתר →"
          variant="danger"
        />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

SubscriptionCancellationEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  mode: 'dark',
} as SubscriptionCancellationEmailProps;
