import { Model } from "mongoose";
import { ItemModel } from "../../models/itemModel.js";
import { StudioModel } from "../../models/studioModel.js";
import { UserModel } from "../../models/userModel.js";
import { Request, Response } from 'express';  // Importing Request and Response for type safety

const performSearch = async <T>(
  model: Model<T>,
  searchTerm: string,
  textPaths: string[],
  indexName = "default",
  autocompletePaths: string[] = textPaths
): Promise<T[]> => {
  try {
    const autocompleteShould = autocompletePaths.map((path) => ({
      autocomplete: {
        query: searchTerm,
        path,
        fuzzy: {
          maxEdits: 1,
          prefixLength: 2,
        },
      },
    }));

    return await model.aggregate([
      {
        $search: {
          index: indexName,
          compound: {
            should: [
              ...autocompleteShould,
              {
                text: {
                  query: searchTerm,
                path: textPaths,
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 2,
                  },
                },
              },
            ],
          },
        },
      },
      { $addFields: { score: { $meta: "searchScore" } } },
      { $sort: { score: -1 } },
      { $limit: 20 },
      {
        $project: {
          name: 1,
          description: 1,
          studioName: 1,
          price: 1,
          categories: 1,
          subCategories: 1,
          score: 1,
        },
      },
    ]);
  } catch (error) {
    console.error(`Error performing search on ${model.collection.name}:`, error);
    throw new Error("Search operation failed");
  }
};

export const searchStudiosAndItems = async (req: Request, res: Response) => {
    const searchTerm = req.query.q as string;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    try {
        const [studios, items] = await Promise.all([
      performSearch(
        StudioModel,
        searchTerm,
        ['name.en', 'name.he', 'description.en', 'description.he'],
        'studios',
        ['name.en', 'name.he']
      ),
      performSearch(
        ItemModel,
        searchTerm,
        ['name.en', 'name.he', 'description.en', 'description.he'],
        'items',
        ['name.en', 'name.he']
      ),
        ]);
        return res.status(200).json({
            studios,
            items,
        });
    } catch (error) {
        console.error('Error performing combined search:', error);
        return res.status(500).json({ error: 'Search operation failed' });
    }
};

// Item search
export const searchItems = async (req: Request, res: Response) => {
    const searchTerm = req.query.q; 
    if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
    }

    try {
        const items = await performSearch(
            ItemModel,
            searchTerm as string,
      ["name.en", "name.he", "description.en", "description.he"],
      "items",
      ["name.en", "name.he"]
        );        console.log('items: ', items);
        return res.status(200).json(items);
    } catch (error) {
        return res.status(500).json({ error: "Search operation failed" });
    }
}

// Studio search
export const searchStudios = async (req: Request, res: Response) => {
    console.log('searchStudios: ', searchStudios);
    const searchTerm = req.query.q; 
    if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
    }

    try {
        const studios = await performSearch(
            StudioModel,
            searchTerm as string,
      ["name.en", "name.he", "description.en", "description.he"],
      "studios",
      ["name.en", "name.he"]
        );        console.log('studios: ', studios);
        return res.status(200).json(studios);
    } catch (error) {
        return res.status(500).json({ error: "Search operation failed" });
    }
}

// User search
export const searchUsers = async (req: Request, res: Response) => {
    const searchTerm = req.query.q; 
    if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
    }

    try {
        const users = await performSearch(
            UserModel,
            searchTerm as string,
      ["name", "description"],
      "users",
      ["name"]
        );        console.log('users: ', users);
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ error: "Search operation failed" });
    }
}

export default {
    searchStudiosAndItems,
    searchItems,
    searchStudios,
    searchUsers,
};
