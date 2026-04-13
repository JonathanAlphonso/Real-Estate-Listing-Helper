export async function generateListingDescription(
  propertyData: Record<string, string>,
): Promise<string> {
  return generateTemplateSuggestion(propertyData);
}

function generateTemplateSuggestion(data: Record<string, string>): string {
  const parts: string[] = [];
  const type = data['Property Type'] || data['Style'] || 'home';

  if (data['Bedrooms'] && data['Bathrooms']) {
    parts.push(`${data['Bedrooms']}+${data['Bathrooms']}`);
  }

  parts.push(type.toLowerCase());

  if (data['Square Footage']) {
    parts.push(`with ${data['Square Footage']} sqft of living space`);
  }

  if (data['Basement'] && data['Basement'].toLowerCase() !== 'none') {
    parts.push(`${data['Basement'].toLowerCase()} basement`);
  }

  if (data['Garage']) {
    parts.push(`${data['Garage'].toLowerCase()} garage`);
  }

  const location = data['City'] || '';
  if (location) {
    parts.push(`in ${location}`);
  }

  return parts.length > 1
    ? `Welcome to this beautiful ${parts.join(', ')}.`
    : 'Beautiful property in a desirable location.';
}
