import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { SubscriptionUpgradedEmailProps } from '../../types.js';

export const SubscriptionUpgradedEmail = ({
  customerName,
  planName,
  mode = 'dark',
}: SubscriptionUpgradedEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="המינוי שודרג!" mode={mode}>
      <Header title="המינוי שודרג!" icon="🚀" mode={mode} />
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
          שדרגת בהצלחה לתוכנית{' '}
          <span style={{ fontWeight: 700, color: colors.brandGold }}>
            {planName}
          </span>
          .
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[{ icon: '✨', label: 'תוכנית', value: planName }]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile"
            label="מעבר לפרופיל →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

SubscriptionUpgradedEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  planName: 'Pro',
  mode: 'dark',
} as SubscriptionUpgradedEmailProps;
