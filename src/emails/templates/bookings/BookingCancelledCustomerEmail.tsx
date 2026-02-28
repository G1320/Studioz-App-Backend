import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { BookingCancelledCustomerEmailProps } from '../../types.js';

export const BookingCancelledCustomerEmail = ({
  customerName,
  mode = 'dark',
}: BookingCancelledCustomerEmailProps) => {
  const theme = getTheme(mode);

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
          לצערנו, ההזמנה שלך בוטלה. אם שילמת, ההחזר יבוצע בהתאם למדיניות
          הביטולים.
        </Text>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/studios"
            label="מעבר לסטודיואים →"
            variant="danger"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

BookingCancelledCustomerEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  mode: 'dark',
} as BookingCancelledCustomerEmailProps;
