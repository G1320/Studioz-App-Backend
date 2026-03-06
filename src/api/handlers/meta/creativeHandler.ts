import { Request } from 'express';
import handleRequest from '../../../utils/requestHandler.js';
import ExpressError from '../../../utils/expressError.js';
import * as metaService from '../../../services/metaService.js';

const getImages = handleRequest(async (req: Request) => {
  return metaService.getAdImages(req.query as Record<string, unknown>);
});

const getVideos = handleRequest(async (req: Request) => {
  return metaService.getAdVideos(req.query as Record<string, unknown>);
});

const uploadImage = handleRequest(async (req: Request) => {
  const { filePath, fileName } = req.body;
  if (!filePath) throw new ExpressError('File path is required', 400);
  if (!fileName) throw new ExpressError('File name is required', 400);
  return metaService.uploadImage(filePath, fileName);
});

const uploadVideo = handleRequest(async (req: Request) => {
  const { filePath, title } = req.body;
  if (!filePath) throw new ExpressError('File path is required', 400);
  if (!title) throw new ExpressError('Video title is required', 400);
  return metaService.uploadVideo(filePath, title);
});

const createCreative = handleRequest(async (req: Request) => {
  const { name } = req.body;
  if (!name) throw new ExpressError('Creative name is required', 400);
  return metaService.createCreative(req.body);
});

export default {
  getImages,
  getVideos,
  uploadImage,
  uploadVideo,
  createCreative
};
