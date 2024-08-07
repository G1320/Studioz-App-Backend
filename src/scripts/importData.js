const mongoose = require('mongoose');
const { StudioModel } = require('../models/studioModel');
const { UserModel } = require('../models/userModel');
const { ItemModel } = require('../models/itemModel');
const connectToDb = require('../db/mongoose');
const path = require('path');
const { readAndParseJsonFile } = require('../utils/fileUtils');

async function importDocument(model, collection, uniqueField) {
  try {
    const query = { [uniqueField]: collection[uniqueField] };
    const existingDoc = await model.findOne(query);
    if (existingDoc) {
      console.log(`Document with ${uniqueField} ${collection[uniqueField]} already exists.`);
      return;
    }
    const doc = await model.create(collection);
    console.log('Inserted document:', doc);
  } catch (error) {
    console.error(`Error importing document with ${uniqueField} ${collection[uniqueField]}:`, error);
  }
}

async function importData(model, filePath, uniqueField) {
  const jsonData = readAndParseJsonFile(filePath);
  const dataArray = Object.values(jsonData);

  const importPromises = dataArray.map((collection) => importDocument(model, collection, uniqueField));
  await Promise.all(importPromises);
}

async function main() {
  try {
    await connectToDb();
    await importData(ItemModel, path.join(__dirname, '../data/items.json'), 'src');
    await importData(StudioModel, path.join(__dirname, '../data/studios.json'), 'name');
    await importData(UserModel, path.join(__dirname, '../data/users.json'), 'username');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.connection.close();
  }
}

main().catch(console.error);
