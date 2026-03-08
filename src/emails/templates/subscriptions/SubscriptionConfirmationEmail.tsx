import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { HighlightCard } from '../../components/HighlightCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { SubscriptionConfirmationEmailProps } from '../../types.js';

export const SubscriptionConfirmationEmail = ({
  customerName,
  planName,
  startDate,
  mode = 'light',
}: SubscriptionConfirmationEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="המינוי שלך הופעל" mode={mode}>
      <Header title="המינוי שלך הופעל" icon="💳" mode={mode} />
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
          ברוכים הבאים לתוכנית{' '}
          <span style={{ fontWeight: 700, color: colors.brandYellow }}>
            {planName}
          </span>
          !
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <HighlightCard title={planName} mode={mode} />
        </Section>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '✨', label: 'תוכנית', value: planName },
              { icon: '📅', label: 'תאריך התחלה', value: startDate },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile"
            label="מעבר לפרופיל →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

SubscriptionConfirmationEmail.PreviewProps = {
  customerName: 'שרה לוי',
  planName: 'Pro',
  startDate: '1 ינואר 2026',
  mode: 'light',
} as SubscriptionConfirmationEmailProps;
