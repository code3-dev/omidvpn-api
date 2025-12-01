const fs = require('fs');
const path = require('path');
const tar = require('tar');
const { getCountryCode } = require('./helpers/countryHelper');

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDecimal(min, max, decimals = 2) {
  return (Math.random() * (max - min) + min).toFixed(decimals);
}

function extractServerInfo(content) {
  const lines = content.split('\n');
  let serverName = 'Unknown';
  let hostname = 'pro-server';
  
  for (let line of lines) {
    if (line.includes('"server":')) {
      try {
        const match = line.match(/"server":\s*"([^"]+)"/);
        if (match && match[1]) {
          // Extract server name without removing suffixes for hostname
          serverName = match[1].replace(/_(tcp|TCP|udp|UDP)$/, '');
          // Use the full server name (with suffixes) as hostname
          hostname = match[1];
        }
      } catch (e) {
        console.error('Error parsing server name:', e);
      }
    }
  }
  
  return { serverName, hostname };
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

function generateServerData(countryName, countryShort, hostname) {
  return {
    hostname: hostname,
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

async function processTarFiles() {
  const inputDir = path.join(__dirname, 'input');
  const apiDir = path.join(__dirname, 'api');
  const extractDir = path.join(__dirname, 'extract');
  
  // Create directories if they don't exist
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir);
  }
  
  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir);
  }
  
  // Get all tar files in input directory
  const files = fs.readdirSync(inputDir).filter(file => path.extname(file) === '.tar');
  
  if (files.length === 0) {
    console.log('No .tar files found in input directory');
    return;
  }
  
  for (const file of files) {
    try {
      const tarName = path.basename(file, '.tar');
      const tarFilePath = path.join(inputDir, file);
      const extractPath = path.join(extractDir, tarName);
      const apiSubDir = path.join(apiDir, tarName);
      const outputFile = path.join(apiSubDir, 'index.json');
      
      // Create extraction directory
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }
      
      // Extract tar file
      await tar.extract({
        file: tarFilePath,
        cwd: extractPath
      });
      
      console.log(`Extracted: ${file} to ${extractPath}`);
      
      // Get all .ovpn files from extracted directory
      const ovpnFiles = getAllOvpnFiles(extractPath);
      
      if (ovpnFiles.length === 0) {
        console.log(`No .ovpn files found in ${file}`);
        // Clean up empty extraction directory
        fs.rmdirSync(extractPath);
        continue;
      }
      
      const servers = [];
      
      // Process each .ovpn file
      for (const ovpnFile of ovpnFiles) {
        try {
          const ovpnFilePath = path.join(extractPath, ovpnFile);
          const content = fs.readFileSync(ovpnFilePath, 'utf8');
              
          const serverInfo = extractServerInfo(content);
          const countryName = serverInfo.serverName;
          const countryShort = getCountryCode(countryName);
          const serverIP = extractServerIP(content);
          const hostname = serverInfo.hostname;
              
          const base64Content = Buffer.from(content).toString('base64');
              
          const serverData = generateServerData(countryName, countryShort, hostname);
          serverData.ip = serverIP;
          serverData.openvpn_configdata_base64 = base64Content;
              
          servers.push({
            servers: [serverData]
          });
              
          console.log(`Processed: ${ovpnFile} -> ${countryName} (${serverIP})`);
        } catch (error) {
          console.error(`Error processing file ${ovpnFile}:`, error);
        }
      }
      
      // Create API directory for this tar file
      if (!fs.existsSync(apiSubDir)) {
        fs.mkdirSync(apiSubDir, { recursive: true });
      }
      
      // Write index.json for this tar file
      fs.writeFileSync(outputFile, JSON.stringify(servers, null, 4));
      console.log(`Successfully generated ${outputFile} with ${servers.length} servers`);
      
      // Remove extracted config files from extract directory
      removeExtractedConfigFiles(extractPath);
      console.log(`Removed extracted config files from ${extractPath}`);
      
    } catch (error) {
      console.error(`Error processing tar file ${file}:`, error);
    }
  }
}

function getAllOvpnFiles(dirPath) {
  let results = [];
  const list = fs.readdirSync(dirPath);
  
  list.forEach((file) => {
    file = path.resolve(dirPath, file);
    const stat = fs.statSync(file);
    
    if (stat && stat.isDirectory()) {
      results = [...results, ...getAllOvpnFiles(file)];
    } else if (path.extname(file) === '.ovpn') {
      results.push(path.relative(dirPath, file));
    }
  });
  
  return results;
}

function removeExtractedConfigFiles(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively remove files in subdirectories
      removeExtractedConfigFiles(filePath);
      // Remove empty directory
      fs.rmdirSync(filePath);
    } else if (path.extname(file) === '.ovpn') {
      // Remove .ovpn files
      fs.unlinkSync(filePath);
    }
    // Keep .tar files and any other files
  });
}

module.exports = {
  getRandomNumber,
  getRandomDecimal,
  generateServerData,
  processTarFiles
};

if (require.main === module) {
  processTarFiles().catch(console.error);
}