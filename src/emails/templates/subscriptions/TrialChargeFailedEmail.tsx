import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { AlertBox } from '../../components/AlertBox.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { TrialChargeFailedEmailProps } from '../../types.js';

export const TrialChargeFailedEmail = ({
  customerName,
  planName,
  price,
  failureReason,
  mode = 'dark',
}: TrialChargeFailedEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="פעולה נדרשת: התשלום נכשל" mode={mode}>
      <Header title="פעולה נדרשת: התשלום נכשל" icon="⚠️" mode={mode} />
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
          לא הצלחנו לעבד את התשלום עבור המינוי שלך לתוכנית{' '}
          <span style={{ fontWeight: 700, color: colors.brandGold }}>
            {planName}
          </span>{' '}
          לאחר סיום תקופת הניסיון.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <AlertBox type="danger" mode={mode}>
            <span style={{ fontWeight: 700 }}>⚠️ סיבת הכישלון:</span>
            <br />
            {failureReason ||
              'פרטי כרטיס לא מעודכנים או חוסר במסגרת אשראי'}
          </AlertBox>
        </Section>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '💳', label: 'תוכנית', value: planName },
              { icon: '💰', label: 'סכום', value: price },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile/billing"
            label="עדכון פרטי תשלום →"
            variant="danger"
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
          אנא עדכן את פרטי התשלום שלך בהקדם כדי למנוע השהיה של השירות.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

TrialChargeFailedEmail.PreviewProps = {
  customerName: 'נועה גולן',
  planName: 'Pro',
  price: '₪149',
  failureReason: 'כרטיס האשראי נדחה - מסגרת אשראי לא מספיקה',
  mode: 'dark',
} as TrialChargeFailedEmailProps;
