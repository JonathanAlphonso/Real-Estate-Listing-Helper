import readline from 'readline';

export async function generateListingDescription(
  propertyData: Record<string, string>,
): Promise<string> {
  // Generate a template-based suggestion
  const suggestion = generateTemplateSuggestion(propertyData);

  console.log('\n========================================');
  console.log('  LISTING DESCRIPTION');
  console.log('========================================');
  console.log(`\nSuggested description:\n  "${suggestion}"\n`);
  console.log('Options:');
  console.log('  1. Press ENTER to use the suggestion above');
  console.log('  2. Paste your own description and press ENTER');
  console.log('');
  console.log('Tip: Copy the property details below into Claude (claude.ai)');
  console.log('and ask it to write a one-line MLS listing description:\n');
  console.log('--- Copy from here ---');
  for (const [key, value] of Object.entries(propertyData)) {
    if (value) console.log(`${key}: ${value}`);
  }
  console.log('--- End copy ---\n');

  const userInput = await promptForInput('Description: ');

  return userInput.trim() || suggestion;
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

function promptForInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}
