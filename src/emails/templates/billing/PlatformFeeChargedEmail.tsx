import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { PlatformFeeChargedEmailProps } from '../../types.js';

export const PlatformFeeChargedEmail = ({
  vendorName,
  period,
  totalFeeAmount,
  totalTransactionAmount,
  feeCount,
  feePercentage,
  invoiceUrl,
  mode = 'light',
}: PlatformFeeChargedEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview={`חיוב עמלת פלטפורמה - ${period}`} mode={mode}>
      <Header title="חיוב עמלת פלטפורמה" icon="💳" mode={mode} />
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
          העמלה החודשית עבור תקופת {period} חויבה בהצלחה מכרטיס האשראי שלך.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '📅', label: 'תקופה', value: period },
              { icon: '💳', label: 'סכום עמלה', value: `₪${totalFeeAmount.toFixed(2)}` },
              { icon: '📊', label: 'סה"כ עסקאות', value: `₪${totalTransactionAmount.toFixed(2)}` },
              { icon: '🔢', label: 'מספר עסקאות', value: String(feeCount) },
              { icon: '📐', label: 'אחוז עמלה', value: `${(feePercentage * 100).toFixed(0)}%` },
            ]}
            mode={mode}
          />
        </Section>
        {invoiceUrl && (
          <div style={{ marginTop: '32px' }}>
            <CTAButton
              href={invoiceUrl}
              label="צפייה בחשבונית →"
            />
          </div>
        )}
        <div style={{ marginTop: '16px' }}>
          <CTAButton
            href="https://studioz.co.il/dashboard?tab=billing"
            label="פרטי חיוב בדשבורד →"
          />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

PlatformFeeChargedEmail.PreviewProps = {
  vendorName: 'יוסי כהן',
  period: 'פברואר 2026',
  totalFeeAmount: 450,
  totalTransactionAmount: 5000,
  feeCount: 23,
  feePercentage: 0.09,
  invoiceUrl: 'https://example.com/invoice',
  mode: 'light',
} as PlatformFeeChargedEmailProps;
