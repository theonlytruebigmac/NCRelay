# Field Filters in NCRelay

Field filters provide a simpler and more intuitive way to extract and manage fields from N-central XML notifications compared to the previous Grok pattern approach.

## What are Field Filters?

Field filters allow you to:

1. Upload sample XML from N-central
2. Automatically extract all available fields
3. Select which fields to include or exclude using checkboxes
4. Save the filter configuration for reuse across multiple integrations

## Benefits Over Grok Patterns

- **No Regular Expression Knowledge Required**: Field filters automatically extract XML fields without needing to write complex regex patterns
- **Visual Field Selection**: Easily see all available fields and select the ones you want
- **Consistent Field Extraction**: Fields are extracted consistently regardless of XML structure variations
- **Reusable Configurations**: Create once, use in multiple integrations

## Security Features

Field filters work alongside NCRelay's other security features:

- **IP Whitelisting**: Restrict access to custom API endpoints by IP address (see [IP Whitelisting documentation](./ip-whitelisting.md))
- **Data Filtering**: Control which fields are extracted and processed from notifications
- **Integration-Specific Filtering**: Apply different field filters to different integrations

## Creating a Field Filter

1. Navigate to **Dashboard > Field Filters > Create New Filter**
2. Paste a sample XML notification from N-central
3. Give your filter a name and description
4. Click "Extract Fields" to automatically identify all available fields
5. Select the fields you want to include or specifically exclude
6. Save your filter

## Using Field Filters in Integrations

When creating or editing an integration:

1. In the Integration form, look for the "Field Filter" dropdown
2. Select your previously created filter
3. Save the integration

Now, all notifications processed by this integration will use your field filter to extract only the fields you selected.

## Migrating from Grok Patterns

If you've been using Grok patterns, you can easily migrate to field filters:

1. Create a new field filter as described above
2. Edit your existing integration and select your new field filter
3. Optionally keep your Grok pattern as a fallback (not recommended for new setups)

For any existing integrations that use Grok patterns, NCRelay will continue to process them correctly. However, we recommend migrating to field filters for a better experience.

## Technical Details

Field filters work by:

1. Parsing the XML into a structured object
2. Flattening nested XML structures into dot-notation paths
3. Applying include/exclude rules to determine which fields to keep
4. Returning a processed payload with only the selected fields

## Troubleshooting

If your field filter isn't extracting the expected fields:

1. Check your sample XML to ensure it contains all the fields you expect
2. Verify that you haven't accidentally excluded important fields
3. Try re-extracting fields from your sample XML
4. Ensure your integration is correctly configured to use the field filter
