import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { RefundConfirmationEmailProps } from '../../types.js';

export const RefundConfirmationEmail = ({
  customerName,
  refundAmount,
  mode = 'dark',
}: RefundConfirmationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="אישור החזר כספי" mode={mode}>
      <Header title="אישור החזר כספי" icon="↩️" mode={mode} />
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
          בוצע החזר כספי עבור הזמנתך.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '↩️', label: 'סכום ההחזר', value: refundAmount },
            ]}
            mode={mode}
          />
        </Section>
        <CTAButton href="#" label="צפייה בפרטים →" />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

RefundConfirmationEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  refundAmount: '₪150.00',
  orderId: 'ORD-2024-003',
  refundDate: '2024-01-18',
  mode: 'dark',
} as RefundConfirmationEmailProps;
