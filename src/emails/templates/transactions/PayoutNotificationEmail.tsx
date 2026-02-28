import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { PayoutNotificationEmailProps } from '../../types.js';

export const PayoutNotificationEmail = ({
  ownerName,
  amount,
  invoiceUrl,
  mode = 'dark',
}: PayoutNotificationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="אישור תשלום (Payout)" mode={mode}>
      <Header title="אישור תשלום (Payout)" icon="💰" mode={mode} />
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
          היי {ownerName},
        </Text>
        <Text
          style={{
            lineHeight: '1.7',
            color: theme.textMuted,
            margin: '0 0 24px',
            fontFamily,
          }}
        >
          התשלום עבור ההזמנות שלך הועבר לחשבונך.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '💰', label: 'סכום הזיכוי', value: amount },
            ]}
            mode={mode}
          />
        </Section>
        <CTAButton href={invoiceUrl || '#'} label="צפייה בפרטים →" />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

PayoutNotificationEmail.PreviewProps = {
  ownerName: 'דני לוי',
  amount: '₪1,200.00',
  orderId: 'ORD-2024-005',
  date: '2024-01-20',
  invoiceUrl: 'https://studioz.co.il/payouts/PO-2024-001',
  mode: 'dark',
} as PayoutNotificationEmailProps;
