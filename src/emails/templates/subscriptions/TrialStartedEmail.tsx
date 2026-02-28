import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { HighlightCard } from '../../components/HighlightCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { TrialStartedEmailProps } from '../../types.js';

export const TrialStartedEmail = ({
  customerName,
  planName,
  price,
  trialEndDate,
  mode = 'dark',
}: TrialStartedEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="תקופת הניסיון שלך התחילה!" mode={mode}>
      <Header title="תקופת הניסיון שלך התחילה!" icon="▶️" mode={mode} />
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
          ברוך הבא ל-StudioZ! תקופת הניסיון שלך לתוכנית{' '}
          <span style={{ fontWeight: 700, color: colors.brandGold }}>
            {planName}
          </span>{' '}
          הופעלה בהצלחה. עכשיו זה הזמן להפיח חיים ביצירה שלך.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <HighlightCard
            icon="✨"
            title="ניסיון ללא עלות"
            subtitle={`מסתיים ב-${trialEndDate}`}
            mode={mode}
          />
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
            href="https://studioz.co.il/dashboard"
            label="התחלת עבודה →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

TrialStartedEmail.PreviewProps = {
  customerName: 'מיכל רוזנברג',
  planName: 'Starter',
  price: '79',
  trialEndDate: '1 פברואר 2026',
  mode: 'dark',
} as TrialStartedEmailProps;
