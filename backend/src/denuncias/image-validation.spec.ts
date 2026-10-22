import { getImageMimeType } from './image-validation';

describe('getImageMimeType', () => {
  it('recognizes JPEG signatures', () => {
    expect(getImageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe(
      'image/jpeg',
    );
  });

  it('recognizes PNG signatures', () => {
    expect(
      getImageMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
  });

  it('recognizes WebP signatures', () => {
    expect(getImageMimeType(Buffer.from('RIFFxxxxWEBP', 'ascii'))).toBe(
      'image/webp',
    );
  });

  it('rejects unknown and truncated data', () => {
    expect(getImageMimeType(Buffer.from('not an image'))).toBeNull();
    expect(getImageMimeType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
