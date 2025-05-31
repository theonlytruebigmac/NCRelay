
/**
 * Test helper functions extracted from the route to ensure color coding works correctly
 * These functions are duplicated here for testing purposes
 */

type ExtractedData = Record<string, unknown>;

function getStatusColor(data: ExtractedData): string {
  // First check QualitativeNewState for most accurate status
  const qualitativeNewState = ((data.QualitativeNewState || '') + '').toLowerCase();
  if (qualitativeNewState) {
    if (qualitativeNewState === 'failed' || qualitativeNewState === 'failure') {
      return 'attention'; // Red for Teams
    }
    if (qualitativeNewState === 'normal' || qualitativeNewState === 'ok') {
      return 'good'; // Green for Teams
    }
    if (qualitativeNewState === 'warning' || qualitativeNewState === 'warn') {
      return 'warning'; // Yellow for Teams
    }
  }

  // Fallback to other status fields
  const status = ((data.Status || data.status || '') + '').toLowerCase();
  const severity = ((data.Severity || data.severity || '') + '').toLowerCase();

  if (status.includes('error') || status.includes('failed') || severity.includes('critical')) {
    return 'attention';
  } else if (status.includes('warn') || severity.includes('warning')) {
    return 'warning';
  } else if (status.includes('ok') || status.includes('success') || status.includes('resolved') || status.includes('normal')) {
    return 'good';
  }
  
  return 'default';
}

function getDiscordEmbedColor(data: ExtractedData): number {
  // First check QualitativeNewState for most accurate status
  const qualitativeNewState = ((data.QualitativeNewState || '') + '').toLowerCase();
  if (qualitativeNewState) {
    if (qualitativeNewState === 'failed' || qualitativeNewState === 'failure') {
      return 0xff0000; // Red for Failed
    }
    if (qualitativeNewState === 'normal' || qualitativeNewState === 'ok') {
      return 0x00ff00; // Green for Normal/OK
    }
    if (qualitativeNewState === 'warning' || qualitativeNewState === 'warn') {
      return 0xffaa00; // Orange for Warning
    }
  }

  // Fallback to other status fields
  const status = ((data.Status || data.status || '') + '').toLowerCase();
  const severity = ((data.Severity || data.severity || '') + '').toLowerCase();

  if (status.includes('error') || status.includes('failed') || severity.includes('critical')) {
    return 0xff0000; // Red
  } else if (status.includes('warn') || severity.includes('warning')) {
    return 0xffaa00; // Orange
  } else if (status.includes('ok') || status.includes('success') || status.includes('resolved') || status.includes('normal')) {
    return 0x00ff00; // Green
  }
  
  return 0x36a64f; // Default green
}

describe('Teams Color Coding', () => {
  describe('QualitativeNewState Priority', () => {
    test('should return attention color for Failed state', () => {
      const data = { QualitativeNewState: 'Failed' };
      expect(getStatusColor(data)).toBe('attention');
    });

    test('should return good color for Normal state', () => {
      const data = { QualitativeNewState: 'Normal' };
      expect(getStatusColor(data)).toBe('good');
    });

    test('should return warning color for Warning state', () => {
      const data = { QualitativeNewState: 'Warning' };
      expect(getStatusColor(data)).toBe('warning');
    });

    test('should handle case variations', () => {
      expect(getStatusColor({ QualitativeNewState: 'FAILED' })).toBe('attention');
      expect(getStatusColor({ QualitativeNewState: 'normal' })).toBe('good');
      expect(getStatusColor({ QualitativeNewState: 'Warning' })).toBe('warning');
    });

    test('should prioritize QualitativeNewState over other fields', () => {
      const data = {
        QualitativeNewState: 'Normal',
        Status: 'Error',
        severity: 'Critical'
      };
      expect(getStatusColor(data)).toBe('good'); // Should use QualitativeNewState
    });
  });

  describe('Fallback Logic', () => {
    test('should fall back to Status field when QualitativeNewState is missing', () => {
      expect(getStatusColor({ Status: 'Error' })).toBe('attention');
      expect(getStatusColor({ status: 'success' })).toBe('good');
      expect(getStatusColor({ Status: 'warning' })).toBe('warning');
    });

    test('should fall back to Severity field', () => {
      expect(getStatusColor({ Severity: 'Critical' })).toBe('attention');
      expect(getStatusColor({ severity: 'warning' })).toBe('warning');
    });

    test('should return default when no recognized status found', () => {
      expect(getStatusColor({ randomField: 'randomValue' })).toBe('default');
      expect(getStatusColor({})).toBe('default');
    });
  });
});

describe('Discord Color Coding', () => {
  describe('QualitativeNewState Priority', () => {
    test('should return red color (0xff0000) for Failed state', () => {
      const data = { QualitativeNewState: 'Failed' };
      expect(getDiscordEmbedColor(data)).toBe(0xff0000);
    });

    test('should return green color (0x00ff00) for Normal state', () => {
      const data = { QualitativeNewState: 'Normal' };
      expect(getDiscordEmbedColor(data)).toBe(0x00ff00);
    });

    test('should return orange color (0xffaa00) for Warning state', () => {
      const data = { QualitativeNewState: 'Warning' };
      expect(getDiscordEmbedColor(data)).toBe(0xffaa00);
    });

    test('should handle case variations', () => {
      expect(getDiscordEmbedColor({ QualitativeNewState: 'FAILED' })).toBe(0xff0000);
      expect(getDiscordEmbedColor({ QualitativeNewState: 'normal' })).toBe(0x00ff00);
      expect(getDiscordEmbedColor({ QualitativeNewState: 'Warning' })).toBe(0xffaa00);
    });

    test('should prioritize QualitativeNewState over other fields', () => {
      const data = {
        QualitativeNewState: 'Normal',
        Status: 'Error',
        severity: 'Critical'
      };
      expect(getDiscordEmbedColor(data)).toBe(0x00ff00); // Should use QualitativeNewState
    });
  });

  describe('Fallback Logic', () => {
    test('should fall back to Status field when QualitativeNewState is missing', () => {
      expect(getDiscordEmbedColor({ Status: 'Error' })).toBe(0xff0000);
      expect(getDiscordEmbedColor({ status: 'success' })).toBe(0x00ff00);
      expect(getDiscordEmbedColor({ Status: 'warning' })).toBe(0xffaa00);
    });

    test('should fall back to Severity field', () => {
      expect(getDiscordEmbedColor({ Severity: 'Critical' })).toBe(0xff0000);
      expect(getDiscordEmbedColor({ severity: 'warning' })).toBe(0xffaa00);
    });

    test('should return default green when no recognized status found', () => {
      expect(getDiscordEmbedColor({ randomField: 'randomValue' })).toBe(0x36a64f);
      expect(getDiscordEmbedColor({})).toBe(0x36a64f);
    });
  });

  describe('Color Value Validation', () => {
    test('should return valid hex color values', () => {
      const colors = [
        getDiscordEmbedColor({ QualitativeNewState: 'Failed' }),
        getDiscordEmbedColor({ QualitativeNewState: 'Normal' }),
        getDiscordEmbedColor({ QualitativeNewState: 'Warning' }),
        getDiscordEmbedColor({})
      ];

      colors.forEach(color => {
        expect(typeof color).toBe('number');
        expect(color).toBeGreaterThanOrEqual(0x000000);
        expect(color).toBeLessThanOrEqual(0xffffff);
      });
    });
  });
});
