import Joi from 'joi';

/** Mirrors Frontend/src/shared/validation/schemas/base.ts */
export const REGEX = {
  ENGLISH: /^[a-zA-Z0-9\s.,;:!?'"()@#$%&*_+=-]+$/,
  HAS_ENGLISH: /[a-zA-Z]/,
  HEBREW: /^[\u0590-\u05FF0-9\s.,;:!?'"()@#$%&*_+=-]+$/,
  HAS_HEBREW: /[\u0590-\u05FF]/
};

/** Mirrors Frontend/src/shared/constants/fieldLimits.ts */
export const STUDIO_NAME_MIN = 3;
export const STUDIO_NAME_MAX = 50;
export const STUDIO_SUBTITLE_MAX = 100;
export const STUDIO_DESCRIPTION_MAX = 2000;
export const ITEM_NAME_MIN = 3;
export const ITEM_NAME_MAX = 50;
export const ITEM_DESCRIPTION_MAX = 2000;

const requiredEnglishText = (options: { label: string; min: number; max: number }) =>
  Joi.string()
    .trim()
    .min(options.min)
    .max(options.max)
    .pattern(REGEX.ENGLISH)
    .custom((value, helpers) => {
      if (!REGEX.HAS_ENGLISH.test(value)) {
        return helpers.message({
          custom: `${options.label} must contain at least one English character`
        });
      }
      return value;
    })
    .required()
    .label(options.label);

const optionalEnglishText = (options: { label: string; max: number }) =>
  Joi.string()
    .trim()
    .empty(['', null])
    .optional()
    .max(options.max)
    .pattern(REGEX.ENGLISH)
    .custom((value, helpers) => {
      if (value === undefined) return value;
      if (!REGEX.HAS_ENGLISH.test(value)) {
        return helpers.message({
          custom: `${options.label} must contain at least one English character`
        });
      }
      return value;
    })
    .label(options.label);

const optionalHebrewText = (options: { label: string; min?: number; max: number }) =>
  Joi.string()
    .trim()
    .empty(['', null])
    .optional()
    .max(options.max)
    .pattern(REGEX.HEBREW)
    .custom((value, helpers) => {
      if (value === undefined) return value;
      if (!REGEX.HAS_HEBREW.test(value)) {
        return helpers.message({
          custom: `${options.label} must contain at least one Hebrew character`
        });
      }
      if (options.min !== undefined && value.length < options.min) {
        return helpers.message({ custom: `${options.label} must be at least ${options.min} characters` });
      }
      return value;
    })
    .label(options.label);

export const studioNameSchema = Joi.object({
  en: requiredEnglishText({
    label: 'English Name',
    min: STUDIO_NAME_MIN,
    max: STUDIO_NAME_MAX
  }),
  he: optionalHebrewText({
    label: 'Hebrew Name',
    min: STUDIO_NAME_MIN,
    max: STUDIO_NAME_MAX
  })
}).required();

export const studioSubtitleSchema = Joi.object({
  en: optionalEnglishText({ label: 'English Subtitle', max: STUDIO_SUBTITLE_MAX }),
  he: optionalHebrewText({ label: 'Hebrew Subtitle', max: STUDIO_SUBTITLE_MAX })
}).optional();

export const studioDescriptionSchema = Joi.object({
  en: optionalEnglishText({ label: 'English Description', max: STUDIO_DESCRIPTION_MAX }),
  he: optionalHebrewText({ label: 'Hebrew Description', max: STUDIO_DESCRIPTION_MAX })
}).optional();

export const itemNameSchema = Joi.object({
  en: requiredEnglishText({
    label: 'English Name',
    min: ITEM_NAME_MIN,
    max: ITEM_NAME_MAX
  }),
  he: optionalHebrewText({
    label: 'Hebrew Name',
    min: ITEM_NAME_MIN,
    max: ITEM_NAME_MAX
  })
}).required();

export const itemDescriptionSchema = Joi.object({
  en: requiredEnglishText({
    label: 'English Description',
    min: 1,
    max: ITEM_DESCRIPTION_MAX
  }),
  he: optionalHebrewText({
    label: 'Hebrew Description',
    max: ITEM_DESCRIPTION_MAX
  })
}).required();

/** Denormalized studio name copy — plain optional strings (matches frontend). */
export const itemStudioNameSchema = Joi.object({
  en: Joi.string().trim().empty(['', null]).optional().max(ITEM_NAME_MAX).label('English Studio Name'),
  he: Joi.string().trim().empty(['', null]).optional().max(ITEM_NAME_MAX).label('Hebrew Studio Name')
}).optional();
