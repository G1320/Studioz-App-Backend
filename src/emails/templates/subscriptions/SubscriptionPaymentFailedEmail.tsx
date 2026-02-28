import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { AlertBox } from '../../components/AlertBox.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { SubscriptionPaymentFailedEmailProps } from '../../types.js';

export const SubscriptionPaymentFailedEmail = ({
  customerName,
  planName,
  price,
  failureReason,
  mode = 'dark',
}: SubscriptionPaymentFailedEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="חיוב מינוי נכשל" mode={mode}>
      <Header title="חיוב מינוי נכשל" icon="⚠️" mode={mode} />
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
          ניסיון החיוב עבור המינוי שלך נכשל.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <AlertBox type="danger" mode={mode}>
            <span style={{ fontWeight: 700 }}>⚠️ סיבת הכישלון:</span>
            <br />
            {failureReason ||
              'פרטי כרטיס לא מעודכנים או חוסר במסגרת אשראי'}
          </AlertBox>
        </Section>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '💳', label: 'תוכנית', value: planName },
              { icon: '💰', label: 'סכום', value: price },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile/billing"
            label="עדכון פרטי תשלום →"
            variant="danger"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

SubscriptionPaymentFailedEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  planName: 'Pro',
  price: '₪149',
  failureReason: 'כרטיס האשראי נדחה',
  mode: 'dark',
} as SubscriptionPaymentFailedEmailProps;
