import { Section, Text } from '@react-email/components';
import { type ThemeMode, getTheme, fontFamily } from './theme.js';

interface DetailsRow {
  icon: string;
  label: string;
  value: string;
}

interface DetailsCardProps {
  rows: DetailsRow[];
  mode?: ThemeMode;
}

export function DetailsCard({ rows, mode = 'dark' }: DetailsCardProps) {
  const theme = getTheme(mode);

  return (
    <Section
      style={{
        borderRadius: '12px',
        backgroundColor: theme.detailBg,
        border: `1px solid ${theme.detailBorder}`,
        padding: '20px',
      }}
    >
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ borderCollapse: 'collapse' }}
      >
        {rows.map((row, index) => {
          const isLast = index === rows.length - 1;
          return (
            <tr key={index}>
              <td
                align="right"
                valign="middle"
                style={{
                  padding: '12px 0',
                  borderBottom: isLast
                    ? 'none'
                    : `1px solid ${theme.footerBorder}`,
                }}
              >
                <Text
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: theme.textMuted,
                    margin: 0,
                    fontFamily,
                  }}
                >
                  {row.icon} {row.label}
                </Text>
              </td>
              <td
                align="left"
                valign="middle"
                style={{
                  padding: '12px 0',
                  borderBottom: isLast
                    ? 'none'
                    : `1px solid ${theme.footerBorder}`,
                }}
              >
                <Text
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.text,
                    margin: 0,
                    fontFamily,
                  }}
                >
                  {row.value}
                </Text>
              </td>
            </tr>
          );
        })}
      </table>
    </Section>
  );
}
