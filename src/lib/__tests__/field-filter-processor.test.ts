import { describe, it, expect } from '@jest/globals';
import { processXmlWithFieldFilter } from '../field-filter-processor';
import type { FieldFilterConfig } from '../types';

describe('Field Filter Processor', () => {
  const sampleXml = `<?xml version="1.0"?>
<notification>
  <devicename>SERVER-01</devicename>
  <alertmessage>High CPU Usage Detected</alertmessage>
  <severity>high</severity>
  <timestamp>2024-01-15T10:30:00Z</timestamp>
  <internal_id>12345</internal_id>
  <customer_name>Acme Corp</customer_name>
</notification>`;

  describe('processXmlWithFieldFilter', () => {
    it('should extract all fields when includeFields is empty', async () => {
      const fieldFilter: FieldFilterConfig = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'Test',
        includeFields: [],
        excludeFields: [],
        createdAt: new Date().toISOString()
      };

      const result = await processXmlWithFieldFilter(sampleXml, fieldFilter);

      expect(result.extracted).toBeTruthy();
      expect(result.extracted.devicename).toBe('SERVER-01');
      expect(result.extracted.alertmessage).toBe('High CPU Usage Detected');
      expect(result.extracted.severity).toBe('high');
    });

    it('should only include specified fields', async () => {
      const fieldFilter: FieldFilterConfig = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'Test',
        includeFields: ['devicename', 'alertmessage'],
        excludeFields: [],
        createdAt: new Date().toISOString()
      };

      const result = await processXmlWithFieldFilter(sampleXml, fieldFilter);

      expect(result.extracted.devicename).toBe('SERVER-01');
      expect(result.extracted.alertmessage).toBe('High CPU Usage Detected');
      expect(result.extracted.severity).toBeUndefined();
      expect(result.extracted.internal_id).toBeUndefined();
    });

    it('should exclude specified fields', async () => {
      const fieldFilter: FieldFilterConfig = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'Test',
        includeFields: [],
        excludeFields: ['internal_id', 'timestamp'],
        createdAt: new Date().toISOString()
      };

      const result = await processXmlWithFieldFilter(sampleXml, fieldFilter);

      expect(result.extracted.devicename).toBe('SERVER-01');
      expect(result.extracted.alertmessage).toBe('High CPU Usage Detected');
      expect(result.extracted.severity).toBe('high');
      expect(result.extracted.internal_id).toBeUndefined();
      expect(result.extracted.timestamp).toBeUndefined();
    });

    it('should handle test notifications', async () => {
      const testXml = 'THIS IS A TEST NOTIFICATION';
      const fieldFilter: FieldFilterConfig = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'Test',
        includeFields: [],
        excludeFields: [],
        createdAt: new Date().toISOString()
      };

      const result = await processXmlWithFieldFilter(testXml, fieldFilter);

      expect(result.extracted.TestNotification).toBe('true');
      expect(result.extracted.Message).toBe(testXml);
    });

    it('should return processed string output', async () => {
      const fieldFilter: FieldFilterConfig = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'Test',
        includeFields: ['devicename', 'severity'],
        excludeFields: [],
        createdAt: new Date().toISOString()
      };

      const result = await processXmlWithFieldFilter(sampleXml, fieldFilter);

      expect(result.processed).toBeTruthy();
      expect(typeof result.processed).toBe('string');
      expect(result.processed).toContain('SERVER-01');
      expect(result.processed).toContain('high');
    });

    it('should handle invalid XML gracefully', async () => {
      const invalidXml = 'Not valid XML';
      const fieldFilter: FieldFilterConfig = {
        id: 'test-filter',
        name: 'Test Filter',
        description: 'Test',
        includeFields: [],
        excludeFields: [],
        createdAt: new Date().toISOString()
      };

      await expect(
        processXmlWithFieldFilter(invalidXml, fieldFilter)
      ).rejects.toThrow();
    });
  });
});
