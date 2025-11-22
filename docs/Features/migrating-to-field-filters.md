# Migrating from Grok Patterns to Field Filters

This guide will help you transition from the previous Grok pattern approach to the new field filter system in NCRelay.

## Why Migrate?

Field filters offer several advantages over Grok patterns:

- **Simpler to create and maintain**: No regular expression knowledge required
- **Visual selection of fields**: See all available fields at a glance
- **More reliable extraction**: More robust handling of XML structure variations
- **Reusable across integrations**: Create once, use in multiple places

## Migration Steps

### Step 1: Identify Your Existing Integrations with Grok Patterns

1. Go to **Dashboard > Integrations**
2. Note which integrations are using Grok patterns

### Step 2: Obtain Sample XML Notifications

For each integration:

1. Either use a recent notification that was processed by the integration
2. Or trigger a test notification from N-central

### Step 3: Create New Field Filters

1. Go to **Dashboard > Field Filters > Create New**
2. Paste your sample XML
3. Name your filter (consider naming it after the corresponding integration)
4. Click "Extract Fields"
5. Select the fields you want to include (reference your existing Grok pattern)
6. Save the filter

### Step 4: Update Your Integrations

For each integration:

1. Go to **Dashboard > Integrations**
2. Click "Edit" for the integration
3. In the form, find the "Field Filter" dropdown
4. Select your newly created filter
5. Save the integration

### Step 5: Test and Verify

1. Trigger test notifications through your updated integrations
2. Verify that the notifications are processed correctly
3. If needed, adjust your field filter selections

## Backward Compatibility

NCRelay maintains backward compatibility with Grok patterns. Existing integrations will continue to work even if you don't migrate them to field filters. However, we recommend migrating for a better experience.

## Troubleshooting

If you encounter issues during migration:

- **Missing fields**: Check if you need to include additional fields in your filter
- **Formatting differences**: Field filters extract exact XML values, which might differ from Grok pattern transformations
- **Notification failures**: Temporarily revert to Grok patterns while troubleshooting

## Need Help?

If you need assistance with migration:

1. Check the [Field Filters documentation](./field-filters.md) for detailed information
2. Contact support with specific details about your integration setup

## Future Considerations

Moving forward, we recommend:

- Using field filters for all new integrations
- Gradually migrating existing integrations to field filters
- Creating standardized field filters for common notification types
- Consider implementing [IP whitelisting](./ip-whitelisting.md) for additional security on custom API endpoints

## Additional Security Features

In addition to field filters, NCRelay offers:

- **IP Whitelisting**: Restrict access to custom API endpoints by IP address
- **Secure Authentication**: Built-in user authentication and session management
- **Data Filtering**: Control which fields are processed and forwarded

For more information on security features, see the [IP Whitelisting documentation](./ip-whitelisting.md).
