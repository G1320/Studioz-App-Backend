import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { OrderCancelledEmailProps } from '../../types.js';

export const OrderCancelledEmail = ({
  customerName,
  orderId,
  studioName,
  mode = 'dark',
}: OrderCancelledEmailProps) => {
  const theme = getTheme(mode);

  const detailRows = [
    { icon: '#', label: 'מספר הזמנה', value: orderId },
    ...(studioName
      ? [{ icon: '📍', label: 'סטודיו', value: studioName }]
      : []),
  ];

  return (
    <EmailLayout preview="ההזמנה בוטלה" mode={mode}>
      <Header title="ההזמנה בוטלה" icon="❌" mode={mode} />
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
          הזמנתך בוטלה בהצלחה. אם בוצע תשלום, הזיכוי יבוצע בהתאם למדיניות
          הביטולים.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard rows={detailRows} mode={mode} />
        </Section>
        <CTAButton
          href="https://studioz.co.il/studios"
          label="מעבר לסטודיואים →"
          variant="danger"
        />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

OrderCancelledEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  orderId: 'ORD-2024-007',
  studioName: 'סטודיו הקלטות TLV',
  mode: 'dark',
} as OrderCancelledEmailProps;
