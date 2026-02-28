import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { BookingModifiedEmailProps } from '../../types.js';

export const BookingModifiedEmail = ({
  customerName,
  reservationId,
  bookingUrl,
  mode = 'dark',
}: BookingModifiedEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="פרטי ההזמנה עודכנו" mode={mode}>
      <Header title="פרטי ההזמנה עודכנו" icon="⚙️" mode={mode} />
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
          חל שינוי בפרטי ההזמנה שלך.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '#', label: 'מספר הזמנה', value: reservationId },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton href={bookingUrl || '#'} label="צפייה בפרטים →" />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

BookingModifiedEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  reservationId: 'BK-2026-0115',
  mode: 'dark',
} as BookingModifiedEmailProps;
