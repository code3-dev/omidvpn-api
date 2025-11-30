const fs = require('fs');
const path = require('path');
const { getCountryCode } = require('./helpers/countryHelper');

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDecimal(min, max, decimals = 2) {
  return (Math.random() * (max - min) + min).toFixed(decimals);
}

function extractCountryName(content, filename) {
  // First try to extract from JSON metadata in Hidezen files
  const lines = content.split('\n');
  for (let line of lines) {
    if (line.includes('"server":')) {
      try {
        const match = line.match(/"server":\s*"([^"]+)"/);
        if (match && match[1]) {
          // Remove _tcp suffix if present
          return match[1].replace(/_tcp$/, '');
        }
      } catch (e) {
        console.error('Error parsing server name:', e);
      }
    }
  }
  
  // If no JSON metadata found, try to extract from filename for vpnbook files
  if (filename.includes('vpnbook-')) {
    return 'Random';
  }
  
  return 'Unknown';
}

function extractServerIP(content) {
  const lines = content.split('\n');
  for (let line of lines) {
    const remoteMatch = line.match(/^remote\s+(\d+\.\d+\.\d+\.\d+)/);
    if (remoteMatch && remoteMatch[1]) {
      return remoteMatch[1];
    }
  }
  return '219.100.37.119';
}

function generateServerData(countryName, countryShort) {
  return {
    hostname: "pro-server",
    ip: "219.100.37.119",
    score: getRandomNumber(70, 100).toString(),
    ping: getRandomNumber(5, 50).toString(),
    speed: getRandomDecimal(20, 100).toString(),
    countrylong: countryName,
    countryshort: countryShort,
    numvpnsessions: getRandomNumber(10, 500).toString(),
    uptime: getRandomDecimal(95, 100, 1).toString(),
    totalusers: getRandomNumber(1000, 50000).toString(),
    totaltraffic: getRandomDecimal(10, 1000).toString(),
    logtype: "2weeks",
    operator: "Pro Users.",
    message: "",
    openvpn_configdata_base64: ""
  };
}

function processOvpnFiles() {
  const inputDir = path.join(__dirname, 'input');
  const apiDir = path.join(__dirname, 'api');
  const outputFile = path.join(apiDir, 'index.json');
  
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir);
  }
  
  const files = fs.readdirSync(inputDir).filter(file => path.extname(file) === '.ovpn');
  
  if (files.length === 0) {
    console.log('No .ovpn files found in input directory');
    return;
  }
  
  const servers = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(inputDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
          
      const countryName = extractCountryName(content, file);
      const countryShort = getCountryCode(countryName);
      const serverIP = extractServerIP(content);
          
      const base64Content = Buffer.from(content).toString('base64');
          
      const serverData = generateServerData(countryName, countryShort);
      serverData.ip = serverIP;
      serverData.openvpn_configdata_base64 = base64Content;
          
      servers.push({
        servers: [serverData]
      });
          
      console.log(`Processed: ${file} -> ${countryName} (${serverIP})`);
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }
  
  const outputData = servers;
  
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 4));
  console.log(`Successfully generated ${outputFile} with ${servers.length} servers`);
}

module.exports = {
  getRandomNumber,
  getRandomDecimal,
  generateServerData,
  processOvpnFiles
};

if (require.main === module) {
  processOvpnFiles();
}