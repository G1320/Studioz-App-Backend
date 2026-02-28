import { Section, Text } from '@react-email/components';
import { type ThemeMode, getTheme, colors, fontFamily } from './theme.js';

interface HeaderProps {
  title: string;
  icon: string;
  mode?: ThemeMode;
}

export function Header({ title, icon, mode = 'dark' }: HeaderProps) {
  const theme = getTheme(mode);

  return (
    <Section
      style={{
        padding: '24px',
        backgroundColor: theme.headerBg,
        borderBottom: `1px solid ${theme.headerBorder}`,
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
          <td
            align="right"
            valign="middle"
            style={{ paddingLeft: '16px' }}
          >
            <Text
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: theme.text,
                margin: 0,
                fontFamily,
              }}
            >
              {title}
            </Text>
          </td>
          <td
            align="left"
            valign="middle"
            style={{ width: '48px' }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: colors.brandGold,
                borderRadius: '12px',
                textAlign: 'center',
                lineHeight: '48px',
                fontSize: '24px',
                color: '#000000',
                boxShadow: `0 4px 12px ${colors.brandGoldShadow}`,
              }}
            >
              {icon}
            </div>
          </td>
        </tr>
      </table>
    </Section>
  );
}
