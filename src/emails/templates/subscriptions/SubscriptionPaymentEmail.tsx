import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { SubscriptionPaymentEmailProps } from '../../types.js';

export const SubscriptionPaymentEmail = ({
  customerName,
  price,
  nextBillingDate,
  mode = 'dark',
}: SubscriptionPaymentEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="אישור תשלום מינוי" mode={mode}>
      <Header title="אישור תשלום מינוי" icon="✓" mode={mode} />
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
          התשלום התקופתי עבור המינוי שלך עובד בהצלחה.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '💳', label: 'סכום', value: price },
              { icon: '⏰', label: 'תאריך חיוב הבא', value: nextBillingDate },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile/subscription"
            label="צפייה בפרטים →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

SubscriptionPaymentEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  planName: 'Pro',
  price: '₪149',
  nextBillingDate: '1 פברואר 2026',
  mode: 'dark',
} as SubscriptionPaymentEmailProps;
