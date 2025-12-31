import mongoose from 'mongoose';
import { ItemModel } from '../models/itemModel.js';
import connectToDb from '../db/mongoose.js';

const cleanupSubCategories = async () => {
  try {
    // Connect to database
    await connectToDb();
    console.log('Connected to database');

    // Find all items with more than 1 subCategory
    const items = await ItemModel.find({
      subCategories: { $exists: true, $type: 'array' },
      $expr: { $gt: [{ $size: '$subCategories' }, 1] }
    });

    console.log(`Found ${items.length} items with more than 1 subCategory`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      if (!item.subCategories || item.subCategories.length <= 1) {
        continue;
      }

      const titleEn = item.name?.en?.toLowerCase() || '';
      
      // Extract significant words from English title (exclude common words)
      const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);
      const titleWords = titleEn.split(/\s+/).filter(word => word.length > 2 && !commonWords.has(word));
      
      // Find the first subCategory that matches the English title (case-insensitive)
      // Match if: 1) title includes subCategory, or 2) subCategory includes any significant word from title
      const matchedSubCategory = item.subCategories.find((subCat: string) => {
        const subCatLower = subCat.toLowerCase();
        
        // Check if title includes the full subCategory
        if (titleEn.includes(subCatLower)) {
          return true;
        }
        
        // Check if subCategory includes any significant word from the title
        return titleWords.some(word => subCatLower.includes(word));
      });

      if (matchedSubCategory && item.subCategories.length > 1) {
        // Only update if item still has more than 1 subCategory
        const originalCount = item.subCategories.length;
        // Update item to keep only the matched subCategory
        item.subCategories = [matchedSubCategory];
        await item.save();
        console.log(`Updated item ${item._id}: "${item.name?.en || 'N/A'}" - kept subCategory: "${matchedSubCategory}" (reduced from ${originalCount} to 1)`);
        updatedCount++;
      } else {
        console.log(`Skipped item ${item._id}: "${item.name?.en || 'N/A'}" - no matching subCategory found in title`);
        skippedCount++;
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Updated: ${updatedCount} items`);
    console.log(`- Skipped: ${skippedCount} items`);
    console.log(`- Total processed: ${items.length} items`);

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error cleaning up subCategories:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

cleanupSubCategories();
