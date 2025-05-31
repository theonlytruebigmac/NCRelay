import { formatSlackMessage } from '../slack-formatter';

describe('Enhanced Message Formatting', () => {
  describe('QualitativeNewState Color Coding', () => {
    test('should return red color for Failed state', () => {
      const data = { QualitativeNewState: 'Failed' };
      const message = formatSlackMessage(data);
      expect(message.attachments?.[0]?.color).toBe('#ff0000');
    });

    test('should return green color for Normal state', () => {
      const data = { QualitativeNewState: 'Normal' };
      const message = formatSlackMessage(data);
      expect(message.attachments?.[0]?.color).toBe('#36a64f');
    });

    test('should return yellow color for Warning state', () => {
      const data = { QualitativeNewState: 'Warning' };
      const message = formatSlackMessage(data);
      expect(message.attachments?.[0]?.color).toBe('#ffaa00');
    });

    test('should prioritize QualitativeNewState over other severity fields', () => {
      const data = { 
        QualitativeNewState: 'Failed',
        severity: 'low',
        status: 'ok'
      };
      const message = formatSlackMessage(data);
      expect(message.attachments?.[0]?.color).toBe('#ff0000');
    });
  });

  describe('N-Central Field Extraction', () => {
    test('should extract and display N-Central specific fields', () => {
      const data = {
        DeviceName: 'SERVER-01',
        QualitativeNewState: 'Failed',
        TaskIdent: 'TASK123',
        TimeOfStateChange: '2024-01-15T10:30:00Z',
        NCentralURI: 'https://ncentral.example.com',
        CustomerName: 'Acme Corp'
      };

      const message = formatSlackMessage(data);
      const fields = message.attachments?.[0]?.fields || [];
      
      // Should include device name
      expect(fields.some(f => f.title === 'Device' && f.value === 'SERVER-01')).toBe(true);
      
      // Should include customer
      expect(fields.some(f => f.title === 'Customer' && f.value === 'Acme Corp')).toBe(true);
      
      // Should include task ident
      expect(fields.some(f => f.title === 'Task Ident' && f.value === 'TASK123')).toBe(true);
      
      // Should include time of state change
      expect(fields.some(f => f.title === 'Time of State Change' && f.value === '2024-01-15T10:30:00Z')).toBe(true);
    });

    test('should handle case-insensitive field names', () => {
      const data = {
        devicename: 'SERVER-02',
        qualitativeNewState: 'Normal',
        customername: 'Beta Corp'
      };

      const message = formatSlackMessage(data);
      const fields = message.attachments?.[0]?.fields || [];
      
      expect(fields.some(f => f.title === 'Device' && f.value === 'SERVER-02')).toBe(true);
      expect(fields.some(f => f.title === 'Customer' && f.value === 'Beta Corp')).toBe(true);
      expect(message.attachments?.[0]?.color).toBe('#36a64f'); // Green for Normal
    });
  });

  describe('Field Limit and Truncation', () => {
    test('should limit fields to 15 maximum', () => {
      const data: Record<string, string> = {};
      // Create 20 fields
      for (let i = 1; i <= 20; i++) {
        data[`field${i}`] = `value${i}`;
      }

      const message = formatSlackMessage(data);
      const fields = message.attachments?.[0]?.fields || [];
      
      expect(fields.length).toBeLessThanOrEqual(15);
    });

    test('should truncate very long field values', () => {
      const longValue = 'x'.repeat(300);
      const data = { LongField: longValue };

      const message = formatSlackMessage(data);
      const fields = message.attachments?.[0]?.fields || [];
      const longField = fields.find(f => f.title === 'Long Field');
      
      if (longField) {
        expect(longField.value.length).toBeLessThanOrEqual(200);
        if (longField.value.length === 200) {
          expect(longField.value).toMatch(/\.\.\.$/);
        }
      }
    });
  });

  describe('Message Structure', () => {
    test('should create proper Slack message structure', () => {
      const data = {
        DeviceName: 'TEST-SERVER',
        QualitativeNewState: 'Failed',
        message: 'Test alert message'
      };

      const message = formatSlackMessage(data);
      
      expect(message).toHaveProperty('text');
      expect(message).toHaveProperty('attachments');
      expect(message.attachments).toHaveLength(1);
      
      const attachment = message.attachments![0];
      expect(attachment).toHaveProperty('color');
      expect(attachment).toHaveProperty('fields');
      expect(attachment).toHaveProperty('footer', 'NCRelay');
      expect(attachment).toHaveProperty('ts');
    });

    test('should handle empty data gracefully', () => {
      const data = {};
      const message = formatSlackMessage(data);
      
      expect(message).toHaveProperty('text');
      expect(message.attachments).toHaveLength(1);
      expect(message.attachments![0].fields).toBeDefined();
    });

    test('should extract title from various field names', () => {
      const testCases = [
        { title: 'Alert Title', expected: 'Alert Title' },
        { deviceName: 'SERVER-01', expected: 'SERVER-01' },
        { alertName: 'CPU High', expected: 'CPU High' },
        { subject: 'Subject Line', expected: 'Subject Line' }
      ];

      testCases.forEach((testCase) => {
        const message = formatSlackMessage(testCase);
        expect(message.text).toBe(testCase.expected);
      });
    });
  });
});

describe('Integration Tests', () => {
  describe('Real-world N-Central Data', () => {
    test('should handle typical N-Central failure notification', () => {
      const nCentralData = {
        DeviceName: 'SRV-PROD-01',
        QualitativeNewState: 'Failed',
        QualitativeOldState: 'Normal',
        TaskIdent: 'DISK_SPACE_CHECK_C',
        TimeOfStateChange: '2024-01-15T14:30:00Z',
        NCentralURI: 'https://ncentral.company.com',
        CustomerName: 'Acme Corporation',
        LongMessage: 'Disk space on C:\\ has exceeded 85% threshold. Current usage: 92%',
        ThresholdValue: '85',
        CurrentValue: '92'
      };

      const message = formatSlackMessage(nCentralData);
      
      // Should use red color for Failed state
      expect(message.attachments?.[0]?.color).toBe('#ff0000');
      
      // Should include key N-Central fields
      const fields = message.attachments?.[0]?.fields || [];
      expect(fields.some(f => f.title === 'Device' && f.value === 'SRV-PROD-01')).toBe(true);
      expect(fields.some(f => f.title === 'Customer' && f.value === 'Acme Corporation')).toBe(true);
      expect(fields.some(f => f.title === 'Task Ident' && f.value === 'DISK_SPACE_CHECK_C')).toBe(true);
      expect(fields.some(f => f.title === 'Qualitative Old State' && f.value === 'Normal')).toBe(true);
    });

    test('should handle N-Central recovery notification', () => {
      const nCentralData = {
        DeviceName: 'SRV-PROD-01',
        QualitativeNewState: 'Normal',
        QualitativeOldState: 'Failed',
        TaskIdent: 'DISK_SPACE_CHECK_C',
        TimeOfStateChange: '2024-01-15T15:45:00Z',
        CustomerName: 'Acme Corporation',
        LongMessage: 'Disk space on C:\\ has returned to normal levels. Current usage: 78%'
      };

      const message = formatSlackMessage(nCentralData);
      
      // Should use green color for Normal state
      expect(message.attachments?.[0]?.color).toBe('#36a64f');
      
      // Should indicate recovery
      const fields = message.attachments?.[0]?.fields || [];
      expect(fields.some(f => f.title === 'Qualitative Old State' && f.value === 'Failed')).toBe(true);
      expect(fields.some(f => f.title === 'Qualitative New State' && f.value === 'Normal')).toBe(true);
    });

    test('should handle warning state notifications', () => {
      const nCentralData = {
        DeviceName: 'SRV-TEST-02',
        QualitativeNewState: 'Warning',
        TaskIdent: 'CPU_USAGE_CHECK',
        CustomerName: 'Beta Corp',
        LongMessage: 'CPU usage elevated but not critical. Current: 75%'
      };

      const message = formatSlackMessage(nCentralData);
      
      // Should use yellow/orange color for Warning state
      expect(message.attachments?.[0]?.color).toBe('#ffaa00');
      
      const fields = message.attachments?.[0]?.fields || [];
      expect(fields.some(f => f.title === 'Qualitative New State' && f.value === 'Warning')).toBe(true);
    });
  });

  describe('Cross-Platform Consistency', () => {
    test('should maintain consistent color mapping across platforms', () => {
      const testData = { QualitativeNewState: 'Failed' };
      
      // Slack should use hex red
      const slackMessage = formatSlackMessage(testData);
      expect(slackMessage.attachments?.[0]?.color).toBe('#ff0000');
      
      // The route functions should use platform-specific formats
      // These are tested in route-helpers.test.ts
    });

    test('should handle mixed case consistently', () => {
      const testCases = [
        { QualitativeNewState: 'failed' },
        { QualitativeNewState: 'Failed' },
        { QualitativeNewState: 'FAILED' }
      ];

      testCases.forEach(data => {
        const message = formatSlackMessage(data);
        expect(message.attachments?.[0]?.color).toBe('#ff0000');
      });
    });
  });

  describe('Field Priority and Mapping', () => {
    test('should prioritize N-Central specific fields over generic ones', () => {
      const data = {
        DeviceName: 'N-Central Device',
        hostname: 'Generic Hostname',
        CustomerName: 'N-Central Customer',
        customer: 'Generic Customer',
        QualitativeNewState: 'Failed',
        status: 'OK'
      };

      const message = formatSlackMessage(data);
      const fields = message.attachments?.[0]?.fields || [];
      
      // Should prioritize N-Central fields
      expect(fields.some(f => f.title === 'Device' && f.value === 'N-Central Device')).toBe(true);
      expect(fields.some(f => f.title === 'Customer' && f.value === 'N-Central Customer')).toBe(true);
      
      // Should use QualitativeNewState for color, not status
      expect(message.attachments?.[0]?.color).toBe('#ff0000');
    });
  });

  describe('Error Handling', () => {
    test('should handle null and undefined values gracefully', () => {
      const data = {
        DeviceName: null,
        QualitativeNewState: undefined,
        CustomerName: '',
        testField: 'Test Value'
      };

      const message = formatSlackMessage(data);
      
      // Should not crash and should include valid fields
      expect(message).toBeDefined();
      expect(message.attachments).toHaveLength(1);
      
      const fields = message.attachments![0].fields || [];
      // Should include the non-null/non-empty field
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some(f => f.value === 'Test Value')).toBe(true);
    });

    test('should handle non-string values in QualitativeNewState', () => {
      const testCases = [
        { QualitativeNewState: 123 },
        { QualitativeNewState: true },
        { QualitativeNewState: { status: 'Failed' } }
      ];

      testCases.forEach(data => {
        const message = formatSlackMessage(data);
        // Should not crash
        expect(message).toBeDefined();
        expect(message.attachments).toHaveLength(1);
      });
    });
  });
});
