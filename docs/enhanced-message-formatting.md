# Enhanced Message Formatting

This document describes the enhanced message formatting system implemented across all integration platforms (Slack, Discord, Teams) with proper color coding based on the `QualitativeNewState` field.

## Overview

The enhanced formatting system provides:

1. **Color-coded messages** based on N-Central `QualitativeNewState` values
2. **Comprehensive field extraction** for N-Central XML data
3. **Cross-platform consistency** with platform-specific formatting
4. **Proper field filter isolation** to ensure filters only apply to their associated integrations

## Color Coding Specification

### QualitativeNewState Priority

The system prioritizes the `QualitativeNewState` field over other severity indicators:

| State | Slack | Teams | Discord | Meaning |
|-------|-------|--------|---------|---------|
| `Failed` | `#ff0000` (Red) | `attention` | `0xff0000` | Critical failure |
| `Normal` | `#36a64f` (Green) | `good` | `0x00ff00` | Normal operation |
| `Warning` | `#ffaa00` (Orange) | `warning` | `0xffaa00` | Warning condition |

### Fallback Logic

When `QualitativeNewState` is not available, the system falls back to:
1. `Status` field (error, success, warning, etc.)
2. `Severity` field (critical, warning, etc.)
3. Default colors for each platform

## Platform-Specific Implementation

### Slack (`slack-formatter.ts`)

- **Rich message attachments** with color-coded indicators
- **Comprehensive field mapping** for N-Central XML fields
- **Field limit**: Maximum 15 fields per message
- **Field truncation**: Values longer than 200 characters are truncated
- **Case-insensitive field matching**

#### Key Features:
- Prioritizes N-Central specific fields (DeviceName, CustomerName, TaskIdent, etc.)
- Automatic field name formatting (camelCase → Title Case)
- Smart value truncation with ellipsis

### Teams (Custom Route)

- **Adaptive Cards** with theme-appropriate colors
- **FactSet layouts** for structured data presentation
- **Teams-specific color themes**: `attention`, `good`, `warning`, `default`

### Discord (Custom Route)

- **Rich embeds** with hex color coding
- **Structured field layout** with titles and descriptions
- **Timestamp support** for message context
- **Field limits** to comply with Discord API constraints

## Field Extraction and Mapping

### N-Central Specific Fields

The system recognizes and properly formats these N-Central XML fields:

1. **Device Information**
   - `DeviceName`, `device_name`, `devicename`
   - `DeviceURI`, `device_uri`

2. **Customer Information**
   - `CustomerName`, `customer_name`, `customername`
   - `ExternalCustomerID`, `external_customer_id`

3. **State Information**
   - `QualitativeNewState`, `qualitativeNewState`
   - `QualitativeOldState`, `qualitativeOldState`
   - `QuantitativeNewState`, `quantitative_new_state`

4. **Task Information**
   - `TaskIdent`, `task_ident`, `taskid`
   - `TimeOfStateChange`, `time_of_state_change`
   - `ActiveNotificationTriggerID`

5. **System Information**
   - `NCentralURI`, `ncentral_uri`
   - `ProbeURI`, `probe_uri`
   - `AffectedService`, `affected_service`

### Field Processing Rules

1. **Priority Mapping**: N-Central specific fields take priority over generic ones
2. **Case Insensitive**: Field matching works regardless of case
3. **Value Validation**: Only non-empty string/number values are included
4. **Length Limits**: Values are truncated if too long
5. **Field Limits**: Maximum 15 fields per message across all platforms

## Field Filter Integration

### Isolation Guarantee

Field filters are properly isolated per integration:

```typescript
// Each integration checks its own fieldFilterId
if (integration.fieldFilterId) {
  filteredData = processXmlWithFieldFilter(data, integration.fieldFilterId);
} else {
  filteredData = data; // No filtering applied
}
```

This ensures:
- Slack receives all data when no filter is applied
- Field filters only affect their associated integrations
- No cross-contamination between integrations

## Testing

The enhanced formatting system includes comprehensive tests:

### Test Files

1. **`enhanced-formatting.test.ts`**: Tests Slack formatter functionality
   - Color coding based on QualitativeNewState
   - N-Central field extraction and mapping
   - Field limits and truncation
   - Real-world N-Central data scenarios
   - Error handling and edge cases

2. **`route-helpers.test.ts`**: Tests Teams and Discord color functions
   - QualitativeNewState priority
   - Fallback logic for missing fields
   - Case sensitivity handling
   - Platform-specific color format validation

### Test Coverage

- ✅ **36 passing tests** covering all aspects of enhanced formatting
- ✅ **Color coding** validation for all platforms
- ✅ **Field extraction** with various data scenarios
- ✅ **Error handling** for null/undefined values
- ✅ **Integration scenarios** with real N-Central data
- ✅ **Cross-platform consistency** validation

## Usage Examples

### Typical N-Central Failure Notification

```json
{
  "DeviceName": "SRV-PROD-01",
  "QualitativeNewState": "Failed",
  "QualitativeOldState": "Normal",
  "TaskIdent": "DISK_SPACE_CHECK_C",
  "TimeOfStateChange": "2024-01-15T14:30:00Z",
  "CustomerName": "Acme Corporation",
  "LongMessage": "Disk space on C:\\ exceeded 85% threshold"
}
```

**Result**: Red-colored message across all platforms with structured field display.

### N-Central Recovery Notification

```json
{
  "DeviceName": "SRV-PROD-01",
  "QualitativeNewState": "Normal",
  "QualitativeOldState": "Failed",
  "TaskIdent": "DISK_SPACE_CHECK_C",
  "CustomerName": "Acme Corporation"
}
```

**Result**: Green-colored message indicating successful recovery.

## Implementation Status

### ✅ Completed Features

1. **Enhanced Slack Formatter** with comprehensive field mapping
2. **Teams Color Logic** with QualitativeNewState priority
3. **Discord Rich Embeds** with proper color coding
4. **Field Filter Isolation** verified and working
5. **Comprehensive Test Suite** with 36 passing tests

### 🔧 Configuration

No additional configuration required. The enhanced formatting is automatically applied to all new notifications that include N-Central XML data.

### 🚀 Performance

- Minimal performance impact
- Efficient field extraction with early termination
- Smart caching of formatted field names
- Optimized for typical N-Central notification sizes

## Troubleshooting

### Common Issues

1. **Missing Fields**: Ensure field names match the recognized patterns (case-insensitive)
2. **Wrong Colors**: Verify `QualitativeNewState` field is properly set in the source data
3. **Truncated Values**: Check if field values exceed 200 character limit

### Debug Information

Enable verbose logging to see:
- Field extraction process
- Color selection logic
- Filter application results

---

The enhanced message formatting system provides a robust, tested, and maintainable solution for N-Central notification formatting across all supported platforms.
