import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

@Injectable()
export class EvidenceStorageService {
  private readonly driver: 'local' | 'r2';
  private readonly bucket: string | undefined;
  private readonly client: S3Client | undefined;
  private readonly localDirectory = join(process.cwd(), 'uploads', 'reports');

  constructor(config: ConfigService) {
    const driver = config.get<string>('storage.driver', 'local');
    if (driver !== 'local' && driver !== 'r2') {
      throw new Error('STORAGE_DRIVER must be local or r2');
    }
    this.driver = driver;

    if (this.driver === 'r2') {
      this.bucket = config.getOrThrow<string>('storage.r2Bucket');
      this.client = new S3Client({
        region: 'auto',
        endpoint: config.getOrThrow<string>('storage.r2Endpoint'),
        credentials: {
          accessKeyId: config.getOrThrow<string>('storage.r2AccessKeyId'),
          secretAccessKey: config.getOrThrow<string>(
            'storage.r2SecretAccessKey',
          ),
        },
      });
    }
  }

  async put(key: string, buffer: Buffer, contentType: string) {
    if (this.driver === 'r2') {
      const { client, bucket } = this.getR2();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return;
    }

    await mkdir(this.localDirectory, { recursive: true });
    await writeFile(join(this.localDirectory, key), buffer);
  }

  async get(key: string): Promise<Buffer | null> {
    if (this.driver === 'r2') {
      const { client, bucket } = this.getR2();
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        if (!result.Body) {
          return null;
        }
        return Buffer.from(await result.Body.transformToByteArray());
      } catch (error) {
        if (error instanceof NoSuchKey) {
          return null;
        }
        throw error;
      }
    }

    try {
      return await readFile(join(this.localDirectory, key));
    } catch (error) {
      if (isMissingFile(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string) {
    if (this.driver === 'r2') {
      const { client, bucket } = this.getR2();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return;
    }

    await unlink(join(this.localDirectory, key));
  }

  private getR2() {
    if (!this.client || !this.bucket) {
      throw new Error('R2 storage is not configured');
    }
    return { client: this.client, bucket: this.bucket };
  }
}
