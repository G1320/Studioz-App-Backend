import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { fontFamily, getTheme } from '../../components/theme.js';
import type { WelcomeEmailProps } from '../../types.js';

export const WelcomeEmail = ({ name, mode = 'dark' }: WelcomeEmailProps) => {
  const theme = getTheme(mode);

  return (
    <EmailLayout preview="ברוכים הבאים ל-StudioZ!" mode={mode}>
      <Header title="ברוכים הבאים ל-StudioZ!" icon="✨" mode={mode} />
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
          היי {name},
        </Text>
        <Text
          style={{
            lineHeight: '1.7',
            color: theme.textMuted,
            margin: '0 0 24px',
            fontFamily,
          }}
        >
          אנחנו שמחים שהצטרפת אלינו! גלה את הסטודיו המושלם ליצירה הבאה שלך.
        </Text>
        <CTAButton href="https://studioz.co.il/studios" label="גלה סטודיואים →" />
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

WelcomeEmail.PreviewProps = {
  name: 'יוסי כהן',
  mode: 'dark',
} as WelcomeEmailProps;
