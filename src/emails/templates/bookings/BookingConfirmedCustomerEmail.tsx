import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { BookingConfirmedCustomerEmailProps } from '../../types.js';

export const BookingConfirmedCustomerEmail = ({
  customerName,
  studioName,
  serviceName,
  dateTime,
  duration,
  location,
  totalPaid,
  bookingUrl,
  mode = 'light',
}: BookingConfirmedCustomerEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="הזמנתך אושרה" mode={mode}>
      <Header title="הזמנתך אושרה" icon="✓" mode={mode} />
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
          הזמנתך לסטודיו{' '}
          <span style={{ fontWeight: 700, color: colors.brandYellow }}>
            {studioName}
          </span>{' '}
          אושרה.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '✨', label: 'שירות', value: serviceName },
              {
                icon: '📅',
                label: 'תאריך ושעה',
                value: `${dateTime} (${duration})`,
              },
              { icon: '📍', label: 'מיקום', value: location },
              { icon: '💳', label: 'סך הכל שולם', value: totalPaid },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href={bookingUrl || '#'}
            label="צפייה / ניהול הזמנה →"
          />
        </div>
        <Text
          style={{
            fontSize: '12px',
            color: '#71717a',
            marginTop: '16px',
            textAlign: 'center',
            fontFamily,
          }}
        >
          צריכים עזרה? שלחו מייל או התקשרו אלינו בכל זמן.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

BookingConfirmedCustomerEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  studioName: 'Sonic Haven TLV',
  serviceName: 'אולפן הקלטה מקצועי',
  dateTime: '15 ינואר 2026, 14:00',
  duration: '3 שעות',
  location: 'דיזנגוף 50, תל אביב',
  totalPaid: '₪450',
  mode: 'light',
} as BookingConfirmedCustomerEmailProps;
