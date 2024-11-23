import { Model } from "mongoose";
import { ItemModel } from "../../models/itemModel.js";
import { StudioModel } from "../../models/studioModel.js";
import { UserModel } from "../../models/userModel.js";
import { Request, Response } from 'express';  // Importing Request and Response for type safety

const performSearch = async <T>(
    model: Model<T>,
    searchTerm: string,
    paths: string[],
    indexName = "default"
    ): Promise<T[]> => {
    try {
        return await model.aggregate([
            {
                $search: {
                    index: indexName,
                    text: {
                        query: searchTerm,
                        path: paths,
                        fuzzy: {
                            maxEdits: 2,
                            prefixLength: 2,
                        },
                    },
                },
            },
            { $limit: 20 },
            {
                $project: {
                    name: 1,
                    description: 1,
                    score: { $meta: "searchScore" },
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
            performSearch(StudioModel, searchTerm, ['name', 'description'], 'studios'),
            performSearch(ItemModel, searchTerm, ['name', 'description'], 'items'),
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
            ["name", "description"],
            "items" 
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
            ["name", "description"],
            "studios" 
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
            "users" 
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
