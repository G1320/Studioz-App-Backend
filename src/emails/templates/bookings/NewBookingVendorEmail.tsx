import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { NewBookingVendorEmailProps } from '../../types.js';

export const NewBookingVendorEmail = ({
  ownerName,
  studioName,
  customerName,
  guestEmail,
  guestPhone,
  serviceName,
  dateTime,
  duration,
  bookingUrl,
  mode = 'light',
}: NewBookingVendorEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="הזמנה חדשה התקבלה" mode={mode}>
      <Header title="הזמנה חדשה התקבלה" icon="🔔" mode={mode} />
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
          יש לך הזמנה חדשה בסטודיו{' '}
          <span style={{ fontWeight: 700, color: colors.brandYellow }}>
            {studioName}
          </span>
          .
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '👤', label: 'לקוח', value: customerName },
              {
                icon: '📧',
                label: 'פרטי קשר',
                value: `${guestEmail} • ${guestPhone}`,
              },
              { icon: '✨', label: 'שירות', value: serviceName },
              {
                icon: '📅',
                label: 'תאריך ושעה',
                value: `${dateTime} (${duration})`,
              },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href={bookingUrl || 'https://studioz.co.il/dashboard'}
            label="צפייה בהזמנה →"
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
          אתה מקבל הודעה זו כי הסטודיו בבעלותך.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

NewBookingVendorEmail.PreviewProps = {
  ownerName: 'אלון מזרחי',
  studioName: 'Sonic Haven TLV',
  customerName: 'יוסי כהן',
  guestEmail: 'yossi@email.com',
  guestPhone: '052-1234567',
  serviceName: 'אולפן הקלטה מקצועי',
  dateTime: '15 ינואר 2026, 14:00',
  duration: '3 שעות',
  mode: 'light',
} as NewBookingVendorEmailProps;
