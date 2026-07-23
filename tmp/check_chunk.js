const http = require('http');
http.get('http://localhost:3300/_next/static/chunks/ssr/webpack-127658d5cbb6f3a4.js', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const urls = new Set(data.match(/https?:\/\/[^\s"'<>]+/g) || []);
    if (urls.size > 0) {
      urls.forEach(u => console.log('URL:', u));
      // Check for the problem URL
    }
    const hasBackendApi = data.includes('http://backend-api:5000');
    const hasLocalhost8082 = data.includes('http://localhost:8082/api');
    if (hasBackendApi) {
      console.log('\nFAIL: Still uses backend-api:5000');
    } else if (hasLocalhost8082) {
      console.log('\nSUCCESS: Now uses localhost:8082/api!');
    } else {
      console.log('\nURLs not directly in webpack chunk — Next.js may use a different mechanism');
      // Print first 500 chars for inspection
      console.log(data.slice(0, 500));
    }
  });
});
