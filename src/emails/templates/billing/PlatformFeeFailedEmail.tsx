import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { AlertBox } from '../../components/AlertBox.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { PlatformFeeFailedEmailProps } from '../../types.js';

export const PlatformFeeFailedEmail = ({
  vendorName,
  period,
  totalFeeAmount,
  failureReason,
  retryCount,
  maxRetries,
  mode = 'light',
}: PlatformFeeFailedEmailProps) => {
  const theme = getTheme(mode);
  const isLastAttempt = retryCount >= maxRetries;

  return (
    <EmailLayout preview={`חיוב עמלה נכשל - נדרשת פעולה`} mode={mode}>
      <Header title="חיוב עמלה נכשל" icon="⚠️" mode={mode} />
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
          היי {vendorName},
        </Text>
        <Text
          style={{
            lineHeight: '1.7',
            color: theme.textMuted,
            margin: '0 0 24px',
            fontFamily,
          }}
        >
          {isLastAttempt
            ? `לא הצלחנו לחייב את העמלה עבור תקופת ${period} לאחר ${maxRetries} ניסיונות. אנא עדכנו את אמצעי התשלום שלכם.`
            : `החיוב החודשי עבור עמלת הפלטפורמה נכשל. ננסה שוב בעוד מספר ימים.`}
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <AlertBox type="danger" mode={mode}>
            {failureReason || 'אירעה שגיאה בעיבוד התשלום'}
          </AlertBox>
        </Section>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '📅', label: 'תקופה', value: period },
              { icon: '💳', label: 'סכום לחיוב', value: `₪${totalFeeAmount.toFixed(2)}` },
              { icon: '🔄', label: 'ניסיון', value: `${retryCount} מתוך ${maxRetries}` },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton
            href="https://studioz.co.il/profile/subscription"
            label="עדכון אמצעי תשלום →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

PlatformFeeFailedEmail.PreviewProps = {
  vendorName: 'יוסי כהן',
  period: 'פברואר 2026',
  totalFeeAmount: 450,
  failureReason: 'כרטיס האשראי נדחה',
  retryCount: 1,
  maxRetries: 3,
  mode: 'light',
} as PlatformFeeFailedEmailProps;
