import { Button } from '@react-email/components';
import { colors, fontFamily } from './theme.js';

interface CTAButtonProps {
  href: string;
  label: string;
  variant?: 'primary' | 'danger';
}

export function CTAButton({
  href,
  label,
  variant = 'primary',
}: CTAButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <table
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={{ borderCollapse: 'collapse' }}
    >
      <tr>
        <td align="center">
          <Button
            href={href}
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily,
              textDecoration: 'none',
              textAlign: 'center',
              backgroundColor: isPrimary
                ? colors.brandGold
                : colors.danger,
              color: isPrimary ? '#000000' : '#ffffff',
              boxShadow: `0 4px 12px ${
                isPrimary
                  ? colors.brandGoldShadow
                  : colors.dangerShadow
              }`,
            }}
          >
            {label}
          </Button>
        </td>
      </tr>
    </table>
  );
}
