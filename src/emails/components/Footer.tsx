import { Section, Text, Img, Link } from '@react-email/components';
import { type ThemeMode, getTheme, colors, fontFamily } from './theme.js';

interface FooterProps {
  mode?: ThemeMode;
}

export function Footer({ mode = 'dark' }: FooterProps) {
  const theme = getTheme(mode);
  const year = new Date().getFullYear();

  return (
    <Section
      style={{
        padding: '24px',
        backgroundColor: theme.footerBg,
        borderTop: `1px solid ${theme.footerBorder}`,
        textAlign: 'center',
      }}
    >
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ borderCollapse: 'collapse' }}
      >
        <tr>
          <td align="center">
            <Img
              src="https://www.studioz.co.il/logo.png"
              alt="StudioZ"
              width={24}
              height={24}
              style={{
                borderRadius: '6px',
                display: 'inline-block',
              }}
            />
          </td>
        </tr>
        <tr>
          <td align="center" style={{ paddingTop: '12px' }}>
            <Text
              style={{
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: theme.text,
                margin: 0,
                fontFamily,
              }}
            >
              STUDIOZ
            </Text>
          </td>
        </tr>
        <tr>
          <td align="center" style={{ paddingTop: '8px' }}>
            <Text
              style={{
                fontSize: '12px',
                color: colors.copyright,
                margin: 0,
                fontFamily,
              }}
            >
              &copy; {year} StudioZ &mdash; תודה שאתם חלק מהקהילה
              היצירתית שלנו.
            </Text>
          </td>
        </tr>
      </table>
    </Section>
  );
}
