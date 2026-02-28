import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { BookingReminderEmailProps } from '../../types.js';

export const BookingReminderEmail = ({
  customerName,
  studioName,
  dateTime,
  bookingUrl,
  mode = 'dark',
}: BookingReminderEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="תזכורת להזמנה" mode={mode}>
      <Header title="תזכורת להזמנה" icon="⏰" mode={mode} />
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
          הסשן שלך מתחיל בקרוב! אל תשכח להגיע בזמן.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '📍', label: 'סטודיו', value: studioName },
              { icon: '📅', label: 'מועד', value: dateTime },
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

BookingReminderEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  studioName: 'Sonic Haven TLV',
  dateTime: '15 ינואר 2026, 14:00',
  mode: 'dark',
} as BookingReminderEmailProps;
