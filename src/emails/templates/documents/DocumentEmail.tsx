import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { DocumentEmailProps } from '../../types.js';

export const DocumentEmail = ({
  customerName,
  documentName,
  documentUrl,
  mode = 'dark',
}: DocumentEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="מסמך חדש נשלח אליך" mode={mode}>
      <Header title="מסמך חדש נשלח אליך" icon="📄" mode={mode} />
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
          נשלח אליך מסמך חדש. תוכל לצפות בו ולהורידו בקישור המצורף.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '📄', label: 'שם המסמך', value: documentName },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton href={documentUrl} label="צפייה במסמך →" />
        </div>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

DocumentEmail.PreviewProps = {
  customerName: 'יוסי כהן',
  documentName: 'חשבונית מס #12345',
  documentUrl: 'https://studioz.co.il/document/test',
  mode: 'dark',
} as DocumentEmailProps;
