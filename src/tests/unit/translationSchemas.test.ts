import { describe, it, expect } from 'vitest';
import {
  studioNameSchema,
  studioDescriptionSchema,
  itemNameSchema,
  itemDescriptionSchema
} from '../../middleware/validation/translationSchemas.js';

describe('translationSchemas', () => {
  describe('studioNameSchema', () => {
    it('accepts English-only studio name', () => {
      const { error } = studioNameSchema.validate({ en: 'Sound Garden Studio' });
      expect(error).toBeUndefined();
    });

    it('accepts bilingual studio name', () => {
      const { error } = studioNameSchema.validate({
        en: 'Sound Garden Studio',
        he: 'גן הצלילים'
      });
      expect(error).toBeUndefined();
    });

    it('rejects missing English name', () => {
      const { error } = studioNameSchema.validate({ he: 'גן הצלילים' });
      expect(error).toBeDefined();
    });

    it('rejects English name that is too short', () => {
      const { error } = studioNameSchema.validate({ en: 'AB' });
      expect(error).toBeDefined();
    });

    it('rejects Hebrew-only text in English name field', () => {
      const { error } = studioNameSchema.validate({ en: 'סטודיו בדיקה' });
      expect(error).toBeDefined();
    });

    it('treats empty Hebrew name as optional', () => {
      const { error, value } = studioNameSchema.validate({ en: 'Test Studio', he: '' });
      expect(error).toBeUndefined();
      expect(value.he).toBeUndefined();
    });
  });

  describe('studioDescriptionSchema', () => {
    it('accepts omitted description', () => {
      const { error } = studioDescriptionSchema.validate(undefined);
      expect(error).toBeUndefined();
    });

    it('accepts English-only description', () => {
      const { error } = studioDescriptionSchema.validate({
        en: 'A professional recording studio in downtown.'
      });
      expect(error).toBeUndefined();
    });

    it('accepts empty Hebrew description', () => {
      const { error, value } = studioDescriptionSchema.validate({
        en: 'English description',
        he: ''
      });
      expect(error).toBeUndefined();
      expect(value?.he).toBeUndefined();
    });
  });

  describe('itemNameSchema', () => {
    it('accepts English-only item name', () => {
      const { error } = itemNameSchema.validate({ en: 'Mixing Session' });
      expect(error).toBeUndefined();
    });

    it('rejects missing English name', () => {
      const { error } = itemNameSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe('itemDescriptionSchema', () => {
    it('requires English description', () => {
      const { error } = itemDescriptionSchema.validate({ he: 'תיאור בעברית' });
      expect(error).toBeDefined();
    });

    it('accepts English-only description', () => {
      const { error } = itemDescriptionSchema.validate({
        en: 'Full mix and master for one song.'
      });
      expect(error).toBeUndefined();
    });

    it('accepts bilingual description', () => {
      const { error } = itemDescriptionSchema.validate({
        en: 'Full mix and master for one song.',
        he: 'מיקס ומאסטר מלא לשיר אחד.'
      });
      expect(error).toBeUndefined();
    });
  });
});
