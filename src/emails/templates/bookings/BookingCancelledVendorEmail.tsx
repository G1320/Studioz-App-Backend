import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { BookingCancelledVendorEmailProps } from '../../types.js';

export const BookingCancelledVendorEmail = ({
  ownerName,
  mode = 'dark',
}: BookingCancelledVendorEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="הזמנה בוטלה" mode={mode}>
      <Header title="הזמנה בוטלה" icon="❌" mode={mode} />
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
          אחת ההזמנות לסטודיו שלך בוטלה על ידי הלקוח.
        </Text>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/dashboard"
            label="מעבר לדאשבורד →"
            variant="danger"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

BookingCancelledVendorEmail.PreviewProps = {
  ownerName: 'אלון מזרחי',
  mode: 'dark',
} as BookingCancelledVendorEmailProps;
