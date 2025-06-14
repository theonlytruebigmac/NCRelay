// Simplified version for Docker container
// This avoids module import issues when running in a container

// Export a simple initialization function
export async function initializeApp() {
  console.log('NCRelay server stub initialized successfully');
  
  // Log environment information for debugging
  console.log(`Running with NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`PORT configured as: ${process.env.PORT}`);
  
  // Set up a basic interval to simulate scheduled tasks
  setInterval(() => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] NCRelay is running...`);
  }, 60000); // Log every minute
  
  return true;
}
