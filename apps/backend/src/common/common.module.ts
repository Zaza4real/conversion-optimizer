import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [
    {
      provide: EncryptionService,
      useFactory: (config: ConfigService) => {
        const key = config.get<string>('ENCRYPTION_KEY');
        if (!key) throw new Error('ENCRYPTION_KEY is required');
        return new EncryptionService(key);
      },
      inject: [ConfigService],
    },
  ],
  exports: [EncryptionService],
})
export class CommonModule {}
