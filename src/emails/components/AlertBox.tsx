import { Section, Text } from '@react-email/components';
import { type ThemeMode, getTheme, colors, fontFamily } from './theme.js';

interface AlertBoxProps {
  children: React.ReactNode;
  type: 'warning' | 'danger';
  mode?: ThemeMode;
}

export function AlertBox({
  children,
  type,
  mode = 'dark',
}: AlertBoxProps) {
  const theme = getTheme(mode);
  const isWarning = type === 'warning';

  const bgColor = isWarning ? colors.warningLight : colors.dangerLight;
  const borderColor = isWarning
    ? colors.warningBorder
    : colors.dangerBorder;
  const textColor = isWarning ? theme.warningText : theme.dangerText;

  return (
    <Section
      style={{
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: bgColor,
        border: `1px dashed ${borderColor}`,
        textAlign: 'center',
      }}
    >
      <Text
        style={{
          fontSize: '14px',
          color: textColor,
          margin: 0,
          fontFamily,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}
