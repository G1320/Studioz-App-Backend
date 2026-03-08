import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { AlertBox } from '../../components/AlertBox.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { TrialEndingEmailProps } from '../../types.js';

export const TrialEndingEmail = ({
  customerName,
  planName,
  price,
  daysRemaining,
  trialEndDate,
  mode = 'light',
}: TrialEndingEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="תקופת הניסיון שלך עומדת להסתיים" mode={mode}>
      <Header
        title="תקופת הניסיון שלך עומדת להסתיים"
        icon="⚠️"
        mode={mode}
      />
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
          רצינו להזכיר שתקופת הניסיון שלך לתוכנית{' '}
          <span style={{ fontWeight: 700, color: colors.brandYellow }}>
            {planName}
          </span>{' '}
          מסתיימת בעוד{' '}
          <span style={{ fontWeight: 600, color: theme.text }}>
            {daysRemaining}
          </span>{' '}
          ימים.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <AlertBox type="warning" mode={mode}>
            לאחר סיום תקופת הניסיון, תחויב אוטומטית בסך של{' '}
            <span style={{ fontWeight: 700 }}>₪{price}</span> לחודש, אלא אם
            תבטל לפני ה-{trialEndDate}.
          </AlertBox>
        </Section>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '💳', label: 'תוכנית', value: planName },
              {
                icon: '📅',
                label: 'תאריך סיום ניסיון',
                value: trialEndDate,
              },
              { icon: '💰', label: 'מחיר חודשי', value: `₪${price}` },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile/subscription"
            label="ניהול מינוי →"
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
          אם אתה נהנה מהשירות, אין צורך לבצע אף פעולה.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

TrialEndingEmail.PreviewProps = {
  customerName: 'דוד בן ארי',
  planName: 'Pro',
  price: '149',
  daysRemaining: 3,
  trialEndDate: '18 ינואר 2026',
  mode: 'light',
} as TrialEndingEmailProps;
