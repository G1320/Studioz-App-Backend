import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { BookingExpiredCustomerEmailProps } from '../../types.js';

export const BookingExpiredCustomerEmail = ({
  customerName,
  serviceName,
  studioName,
  mode = 'dark',
}: BookingExpiredCustomerEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="ההזמנה פגה" mode={mode}>
      <Header title="ההזמנה פגה" icon="⏰" mode={mode} />
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
          ההזמנה שלך ל{serviceName} ב{studioName} פגה מכיוון שלא אושרה בזמן.
          אתה מוזמן להזמין מחדש בכל עת.
        </Text>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/studios"
            label="הזמנה מחדש →"
            variant="primary"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

BookingExpiredCustomerEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  serviceName: 'אולפן הקלטה',
  studioName: 'Sonic Haven TLV',
  mode: 'dark',
} as BookingExpiredCustomerEmailProps;
