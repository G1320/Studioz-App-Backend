import { Section, Text } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { NewProjectVendorEmailProps } from '../../types.js';

const truncate = (text: string, maxLen: number): string => {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
};

export const NewProjectVendorEmail = ({
  ownerName,
  studioName,
  customerName,
  customerEmail,
  customerPhone,
  projectTitle,
  projectBrief,
  price,
  serviceName,
  projectUrl,
  mode = 'light',
}: NewProjectVendorEmailProps) => {
  const theme = getTheme(mode);
  const priceStr = `₪${typeof price === 'number' ? price.toLocaleString('he-IL') : price}`;
  const contact = [customerEmail || '', customerPhone || ''].filter(Boolean).join(' • ') || '—';

  return (
    <EmailLayout preview="בקשת פרויקט חדשה התקבלה" mode={mode}>
      <Header title="בקשת פרויקט חדשה התקבלה" icon="📋" mode={mode} />
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
          התקבלה בקשה חדשה לפרויקט מרחוק בסטודיו{' '}
          <span style={{ fontWeight: 700, color: colors.brandYellow }}>{studioName}</span>.
        </Text>
        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard
            rows={[
              { icon: '👤', label: 'לקוח', value: customerName },
              { icon: '📧', label: 'פרטי קשר', value: contact },
              { icon: '✨', label: 'שירות', value: serviceName },
              { icon: '📝', label: 'כותרת הפרויקט', value: projectTitle },
              { icon: '💬', label: 'תיאור קצר', value: truncate(projectBrief, 200) },
              { icon: '💰', label: 'מחיר', value: priceStr },
            ]}
            mode={mode}
          />
        </Section>
        <div style={{ marginTop: '32px' }}>
          <CTAButton href={projectUrl || 'https://studioz.co.il/projects'} label="צפייה בבקשה →" />
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

NewProjectVendorEmail.PreviewProps = {
  ownerName: 'אלון מזרחי',
  studioName: 'Sonic Haven TLV',
  customerName: 'יוסי כהן',
  customerEmail: 'yossi@email.com',
  customerPhone: '052-1234567',
  projectTitle: 'מיקס ומאסטר לאלבום',
  projectBrief: 'אני צריך מיקס מלא ל־12 שירים בסגנון אינדי־פופ...',
  price: 2500,
  serviceName: 'מיקס ומאסטר מרחוק',
  projectUrl: 'https://studioz.co.il/projects/507f1f77bcf86cd799439011',
  mode: 'light',
} as NewProjectVendorEmailProps;
