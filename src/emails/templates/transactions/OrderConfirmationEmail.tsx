import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { OrderConfirmationEmailProps } from '../../types.js';

export const OrderConfirmationEmail = ({
  customerName,
  orderId,
  total,
  invoiceUrl,
  mode = 'dark',
}: OrderConfirmationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="אישור רכישה" mode={mode}>
      <Header title="אישור רכישה" icon="✓" mode={mode} />
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
          תודה על הרכישה! ההזמנה שלך התקבלה ומעובדת.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '#', label: 'מספר הזמנה', value: orderId },
              { icon: '💳', label: 'סכום', value: total },
            ]}
            mode={mode}
          />
        </Section>
        <CTAButton href={invoiceUrl || '#'} label="צפייה בהזמנה →" />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

OrderConfirmationEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  orderId: 'ORD-2024-001',
  orderDate: '2024-01-15',
  total: '₪350.00',
  invoiceUrl: 'https://studioz.co.il/orders/ORD-2024-001',
  mode: 'dark',
} as OrderConfirmationEmailProps;
