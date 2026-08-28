import { Section, Text, Hr } from '@react-email/components';
import { EmailLayout } from '../../components/EmailLayout.js';
import { Header } from '../../components/Header.js';
import { Footer } from '../../components/Footer.js';
import { CTAButton } from '../../components/CTAButton.js';
import { DetailsCard } from '../../components/DetailsCard.js';
import { colors, fontFamily, getTheme } from '../../components/theme.js';
import type { ProjectCollaboratorInviteEmailProps } from '../../types.js';

export type { ProjectCollaboratorInviteEmailProps };

export const ProjectCollaboratorInviteEmail = ({
  inviterName,
  projectTitle,
  studioName,
  side,
  inviteUrl,
  expiresInLabel = '14 ימים',
  mode = 'light'
}: ProjectCollaboratorInviteEmailProps) => {
  const theme = getTheme(mode);
  const sideLabel = side === 'customer' ? 'לקוח' : 'סטודיו';
  const sideIcon = side === 'customer' ? '🎧' : '🎛️';

  const detailRows = [
    { icon: '👤', label: 'מי הזמין', value: inviterName },
    { icon: '📝', label: 'פרויקט', value: projectTitle },
    ...(studioName ? [{ icon: '🏠', label: 'סטודיו', value: studioName }] : []),
    { icon: sideIcon, label: 'צד בפרויקט', value: sideLabel },
    { icon: '⏳', label: 'תוקף ההזמנה', value: expiresInLabel }
  ];

  return (
    <EmailLayout preview={`${inviterName} הזמין/ה אותך לשתף פעולה ב־${projectTitle}`} mode={mode}>
      <Header title="הוזמנת לשתף פעולה" icon="🤝" mode={mode} />
      <Section style={{ padding: '24px' }}>
        <Text
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: theme.text,
            margin: '0 0 8px',
            fontFamily
          }}
        >
          שלום,
        </Text>
        <Text
          style={{
            lineHeight: '1.7',
            color: theme.textMuted,
            margin: '0 0 24px',
            fontFamily
          }}
        >
          <span style={{ fontWeight: 700, color: colors.brandYellow }}>{inviterName}</span> הזמין/ה
          אותך להצטרף לפרויקט מרחוק ב־Studioz כמשתף/ת פעולה מצד ה
          <span style={{ fontWeight: 700, color: theme.text }}>{sideLabel}</span>.
        </Text>

        <Section style={{ marginBottom: '24px' }}>
          <DetailsCard rows={detailRows} mode={mode} />
        </Section>

        <Section
          style={{
            marginBottom: '24px',
            borderRadius: '12px',
            backgroundColor: colors.brandYellowLight,
            border: `1px solid ${colors.brandYellowBorder}`,
            padding: '16px 20px'
          }}
        >
          <Text
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: theme.text,
              margin: '0 0 10px',
              fontFamily
            }}
          >
            מה כלול בהזמנה
          </Text>
          {[
            'צ׳אט משותף עם כל משתתפי הפרויקט',
            'העלאה והורדה של קבצי מקור ותוצרים',
            'פעולות תהליך בצד שלך (למשל אישור, מסירה או בקשת תיקונים)'
          ].map((item) => (
            <Text
              key={item}
              style={{
                fontSize: '13px',
                lineHeight: '1.6',
                color: theme.textMuted,
                margin: '0 0 6px',
                fontFamily
              }}
            >
              ✓ {item}
            </Text>
          ))}
          <Hr
            style={{
              borderColor: colors.brandYellowBorder,
              borderTop: 'none',
              margin: '12px 0'
            }}
          />
          <Text
            style={{
              fontSize: '12px',
              lineHeight: '1.6',
              color: theme.textMuted,
              margin: 0,
              fontFamily
            }}
          >
            תשלומים והטענת אמצעי תשלום נשארים אצל הלקוח ששילם — למשתפי פעולה אין גישה לתשלום.
          </Text>
        </Section>

        <div style={{ marginTop: '8px' }}>
          <CTAButton href={inviteUrl} label="קבלת ההזמנה →" />
        </div>

        <Text
          style={{
            fontSize: '12px',
            color: theme.textMuted,
            marginTop: '20px',
            textAlign: 'center',
            lineHeight: '1.6',
            fontFamily
          }}
        >
          יש להתחבר עם כתובת האימייל שאליה נשלחה ההזמנה.
          <br />
          אם לא ביקשת הזמנה זו, אפשר להתעלם מהמייל.
        </Text>
      </Section>
      <Footer mode={mode} />
    </EmailLayout>
  );
};

ProjectCollaboratorInviteEmail.PreviewProps = {
  inviteeEmail: 'bandmate@email.com',
  inviterName: 'יוסי כהן',
  projectTitle: 'מיקס ומאסטר לאלבום',
  studioName: 'Sonic Haven TLV',
  side: 'customer',
  inviteUrl: 'https://studioz.co.il/he/projects/invites/example-token',
  expiresInLabel: '14 ימים',
  mode: 'light'
} as ProjectCollaboratorInviteEmailProps;

export default ProjectCollaboratorInviteEmail;
