import { Model } from "mongoose";
import { ItemModel } from "../../models/itemModel.js";
import { StudioModel } from "../../models/studioModel.js";
import { UserModel } from "../../models/userModel.js";
import { Request, Response } from 'express';  // Importing Request and Response for type safety

// Generic search function
const performSearch = async <T>(
    model: Model<T>, // Mongoose model with a generic schema T
    searchTerm: string,
    paths: string[], // Array of strings representing the search paths
    indexName = "default"
): Promise<T[]> => {
    console.log('searchTerm: ', searchTerm);
    try {
        return await model.aggregate([
            {
                $search: {
                    index: indexName,
                    text: {
                        query: searchTerm,
                        path: paths,
                    },
                },
            },
            { $limit: 20 },
            {
                $project: {
                    title: 1,
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

// Item search
export const searchItems = async (req: Request, res: Response) => {
    const searchTerm = req.query.q; // Getting search term from query parameter
    console.log('searchTerm: ', searchTerm);
    if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
    }

    try {
        const items = await performSearch(ItemModel, searchTerm as string, ["title", "description"]);
        console.log('items: ', items);
        return res.status(200).json(items);
    } catch (error) {
        return res.status(500).json({ error: "Search operation failed" });
    }
}

// Studio search
export const searchStudios = async (req: Request, res: Response) => {
    console.log('searchStudios: ', searchStudios);
    const searchTerm = req.query.q; // Getting search term from query parameter
    if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
    }

    try {
        const studios = await performSearch(StudioModel, searchTerm as string, ["title", "description"]);
        console.log('studios: ', studios);
        return res.status(200).json(studios);
    } catch (error) {
        return res.status(500).json({ error: "Search operation failed" });
    }
}

// User search
export const searchUsers = async (req: Request, res: Response) => {
    const searchTerm = req.query.q; // Getting search term from query parameter
    console.log('searchTerm: ', searchTerm);
    if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
    }

    try {
        const users = await performSearch(UserModel, searchTerm as string, ["name", "email"]);
        console.log('users: ', users);
        return res.status(200).json(users);
    } catch (error) {
        return res.status(500).json({ error: "Search operation failed" });
    }
}

export default {
    searchItems,
    searchStudios,
    searchUsers,
};
