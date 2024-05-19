const fs = require('fs');

const readAndParseJsonFile = (filePath) => {
  console.log(`Reading and parsing JSON file from: ${filePath}`);
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Error reading or parsing the file ${filePath}`, error);
    return {};
  }
};

module.exports = { readAndParseJsonFile };
