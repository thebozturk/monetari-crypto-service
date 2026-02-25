import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class AuthSeedService implements OnModuleInit {
  private readonly logger = new Logger(AuthSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const existing = await this.userRepository.findOne({
      where: { username: 'monetari' },
    });

    if (!existing) {
      const hashedPassword = await bcrypt.hash('monetari123', 10);
      const user = this.userRepository.create({
        username: 'monetari',
        password: hashedPassword,
      });
      await this.userRepository.save(user);
      this.logger.log('Seed user "monetari" created');
    }
  }
}
