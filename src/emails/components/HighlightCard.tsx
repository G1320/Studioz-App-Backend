import { Section, Text } from '@react-email/components';
import { type ThemeMode, getTheme, colors, fontFamily } from './theme.js';

interface HighlightCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  mode?: ThemeMode;
}

export function HighlightCard({
  title,
  subtitle,
  icon,
  mode = 'dark',
}: HighlightCardProps) {
  const theme = getTheme(mode);

  return (
    <Section
      style={{
        borderRadius: '16px',
        padding: '32px',
        backgroundColor: colors.brandGoldLight,
        border: `1px solid ${colors.brandGoldBorder}`,
        textAlign: 'center',
      }}
    >
      {icon && (
        <table
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          role="presentation"
          style={{ borderCollapse: 'collapse' }}
        >
          <tr>
            <td align="center" style={{ paddingBottom: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: colors.brandGold,
                  borderRadius: '50%',
                  textAlign: 'center',
                  lineHeight: '64px',
                  fontSize: '32px',
                  margin: '0 auto',
                  display: 'inline-block',
                }}
              >
                {icon}
              </div>
            </td>
          </tr>
        </table>
      )}
      <Text
        style={{
          fontSize: '24px',
          fontWeight: 800,
          color: theme.text,
          margin: 0,
          fontFamily,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            fontSize: '14px',
            color: theme.textMuted,
            margin: '8px 0 0 0',
            fontFamily,
          }}
        >
          {subtitle}
        </Text>
      )}
    </Section>
  );
}
