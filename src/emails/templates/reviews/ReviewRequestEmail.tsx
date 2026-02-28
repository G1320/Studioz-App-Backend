import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { ReviewRequestEmailProps } from '../../types.js';

export const ReviewRequestEmail = ({
  customerName,
  reviewUrl,
  mode = 'dark',
}: ReviewRequestEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="איך היה בסטודיו?" mode={mode}>
      <Header title="איך היה בסטודיו?" icon="⭐" mode={mode} />
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
          נשמח לשמוע על החוויה שלך! הדירוג שלך עוזר ליוצרים אחרים.
        </Text>
        <div style={{ marginTop: '32px' }}>
          <CTAButton href={reviewUrl || '#'} label="השאר ביקורת →" />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

ReviewRequestEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  mode: 'dark',
} as ReviewRequestEmailProps;
