const { UserModel } = require('../../models/userModel');
const { StudioModel } = require('../../models/studioModel');
const handleRequest = require('../../utils/requestHandler');
const ExpressError = require('../../utils/expressError');

const createUser = handleRequest(async (req) => {
  const { username, name } = req.body;

  // Check if username or email already exist in the database
  const existingUser = await UserModel.findOne({ $or: [{ username }, { name }] });
  if (existingUser) throw new Error('Username or email already exists');

  const user = new UserModel(req.body);
  await user.save();
  return user;
});

const getUserBySub = handleRequest(async (req) => {
  const user = await UserModel.findOne({ sub: req.params.sub });

  if (!user) return null; 

  return user;
});

const getUserStudios = handleRequest(async (req) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw new ExpressError('User not found', 404);

  const studios = await StudioModel.find({ _id: { $in: user.studios } });
  if (!studios) throw new ExpressError('No studios found for this user', 404);

  return studios;
});

const addStudioToUser = handleRequest(async (req) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const studioId = req.params.studioId;
  if (!studioId) throw new ExpressError('Studio ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const studio = await StudioModel.findById(studioId);

  if (!studio) throw new ExpressError('Studio not found', 404);
  if (!studio.items) studio.items = [];
  if (user.studios.includes(studio._id)) throw new ExpressError('Studio already added!', 400);
  // if (studio.items.length < 1) throw new ExpressError('Studio is empty, add some items first!', 400);

  user.studios.push(studio._id);
  await user.save();

  return studio;
});

const removeStudioFromUser = handleRequest(async (req) => {
  const userId = req.params.id;
  if (!userId) throw new ExpressError('User ID not provided', 400);

  const studioId = req.params.studioId;
  if (!studioId) throw new ExpressError('Studio ID not provided', 400);

  const user = await UserModel.findById(userId);
  if (!user) throw new ExpressError('User not found', 404);

  const studio = await StudioModel.findById(studioId);
  if (!studio) throw new ExpressError('Studio not found', 404);

  user.studios.pull(studio._id);
  await user.save();

  return studio;
});

const getAllUsers = handleRequest(async () => {
  const users = await UserModel.find({});
  if (!users) throw new ExpressError('No users found', 404);

  return users;
});

const updateUser = handleRequest(async (req) => {
  const user = await UserModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!user) throw new ExpressError('User not found', 404);

  return user;
});

const deleteUser = handleRequest(async (req) => {
  const user = await UserModel.findByIdAndDelete(req.params.id);
  if (!user) throw new ExpressError('User not found', 404);

  // Using the "null" return to signal a 204 No Content response
  return null;
});

module.exports = {
  createUser,
  getUserBySub,
  getUserStudios,
  addStudioToUser,
  removeStudioFromUser,
  getAllUsers,
  updateUser,
  deleteUser,
};
