import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { SubscriptionExpiringEmailProps } from '../../types.js';

export const SubscriptionExpiringEmail = ({
  customerName,
  nextBillingDate,
  mode = 'light',
}: SubscriptionExpiringEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="המינוי עומד להסתיים" mode={mode}>
      <Header title="המינוי עומד להסתיים" icon="⏰" mode={mode} />
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
          המינוי שלך עומד לפוג בקרוב. הקפד לחדש אותו.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              {
                icon: '📅',
                label: 'תאריך תפוגה',
                value: nextBillingDate,
              },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile/subscription"
            label="חידוש מינוי →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

SubscriptionExpiringEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  nextBillingDate: '15 פברואר 2026',
  mode: 'light',
} as SubscriptionExpiringEmailProps;
